import { EntityComponentTypes, system, world } from "@minecraft/server";

const SUPER_AGENT_ID = "superagent:superagent";
const DISPLAY_NAME = "superagent";
const ROOT_TAG = "superagent.managed";
const OWNER_TAG_PREFIX = "superagent.owner.";
const ATTACK_RADIUS = 4.5;
const ATTACK_DAMAGE = 6;
const FOLLOW_RADIUS = 96;
const TICK_RATE = 2;

const HOSTILE_TYPES = [
  "minecraft:blaze",
  "minecraft:breeze",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:drowned",
  "minecraft:elder_guardian",
  "minecraft:enderman",
  "minecraft:endermite",
  "minecraft:evocation_illager",
  "minecraft:ghast",
  "minecraft:guardian",
  "minecraft:hoglin",
  "minecraft:husk",
  "minecraft:magma_cube",
  "minecraft:phantom",
  "minecraft:piglin_brute",
  "minecraft:pillager",
  "minecraft:ravager",
  "minecraft:shulker",
  "minecraft:silverfish",
  "minecraft:skeleton",
  "minecraft:slime",
  "minecraft:spider",
  "minecraft:stray",
  "minecraft:vex",
  "minecraft:vindicator",
  "minecraft:warden",
  "minecraft:witch",
  "minecraft:wither_skeleton",
  "minecraft:zoglin",
  "minecraft:zombie",
  "minecraft:zombie_pigman",
  "minecraft:zombie_villager",
  "minecraft:zombified_piglin"
];

function ownerTag(player) {
  return OWNER_TAG_PREFIX + player.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 32);
}

function isAgent(entity) {
  return entity.typeId === "minecraft:agent" || entity.typeId === "agent";
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function closestEntity(entities, location) {
  let closest;
  let closestDistance = Number.MAX_VALUE;
  for (const entity of entities) {
    const nextDistance = distanceSquared(entity.location, location);
    if (nextDistance < closestDistance) {
      closest = entity;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function findPlayerAgent(player) {
  const nearby = player.dimension.getEntities({
    location: player.location,
    maxDistance: FOLLOW_RADIUS
  });
  return closestEntity(nearby.filter(isAgent), player.location);
}

function findManagedSuperagents(player, anchorLocation) {
  return player.dimension.getEntities({
    type: SUPER_AGENT_ID,
    tags: [ROOT_TAG, ownerTag(player)],
    location: anchorLocation,
    maxDistance: FOLLOW_RADIUS
  });
}

function configureSuperagent(superagent, player) {
  superagent.nameTag = DISPLAY_NAME;
  superagent.addTag(ROOT_TAG);
  superagent.addTag(ownerTag(player));
  superagent.addEffect("invisibility", 200, {
    amplifier: 1,
    showParticles: false
  });
  superagent.addEffect("resistance", 200, {
    amplifier: 255,
    showParticles: false
  });
  superagent.addEffect("fire_resistance", 200, {
    amplifier: 1,
    showParticles: false
  });
}

function ensureSuperagent(player, agentEntity) {
  const existing = findManagedSuperagents(player, agentEntity.location);
  let superagent = closestEntity(existing, agentEntity.location);
  if (!superagent) {
    superagent = player.dimension.spawnEntity(SUPER_AGENT_ID, agentEntity.location);
  }
  configureSuperagent(superagent, player);
  for (const duplicate of existing) {
    if (duplicate.id !== superagent.id) {
      duplicate.remove();
    }
  }
  return superagent;
}

function followAgent(superagent, agentEntity) {
  const rotation = agentEntity.getRotation();
  superagent.teleport(agentEntity.location, {
    dimension: agentEntity.dimension,
    rotation,
    checkForBlocks: false
  });
  superagent.clearVelocity();
}

function isAttackTarget(entity) {
  if (!entity || entity.typeId === SUPER_AGENT_ID || isAgent(entity)) {
    return false;
  }
  if (entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item") {
    return false;
  }
  return HOSTILE_TYPES.indexOf(entity.typeId) >= 0;
}

function emitAuraParticles(dimension, location, tick) {
  const angle = tick * 0.45;
  const ring = [
    { x: Math.cos(angle) * 1.4, y: 0.3, z: Math.sin(angle) * 1.4 },
    { x: Math.cos(angle + 2.1) * 1.4, y: 0.9, z: Math.sin(angle + 2.1) * 1.4 },
    { x: Math.cos(angle + 4.2) * 1.4, y: 1.5, z: Math.sin(angle + 4.2) * 1.4 }
  ];
  for (const offset of ring) {
    try {
      dimension.spawnParticle("minecraft:critical_hit_emitter", {
        x: location.x + offset.x,
        y: location.y + offset.y,
        z: location.z + offset.z
      });
    } catch (error) {
      try {
        dimension.spawnParticle("minecraft:basic_flame_particle", {
          x: location.x + offset.x,
          y: location.y + offset.y,
          z: location.z + offset.z
        });
      } catch (ignored) {
      }
    }
  }
}

function attackAround(superagent, tick) {
  const targets = superagent.dimension.getEntities({
    location: superagent.location,
    maxDistance: ATTACK_RADIUS
  });
  for (const target of targets) {
    if (!isAttackTarget(target)) {
      continue;
    }
    try {
      target.addEffect("slowness", 60, {
        amplifier: 1,
        showParticles: true
      });
      target.applyDamage(ATTACK_DAMAGE);
    } catch (error) {
    }
  }
  emitAuraParticles(superagent.dimension, superagent.location, tick);
}

function keepAlive(superagent) {
  try {
    const health = superagent.getComponent(EntityComponentTypes.Health);
    if (health) {
      health.resetToMaxValue();
    }
  } catch (error) {
  }
}

function tickPlayer(player, tick) {
  const agentEntity = findPlayerAgent(player);
  if (!agentEntity) {
    return;
  }
  const superagent = ensureSuperagent(player, agentEntity);
  followAgent(superagent, agentEntity);
  keepAlive(superagent);
  attackAround(superagent, tick);
}

world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.hurtEntity.typeId === SUPER_AGENT_ID || event.hurtEntity.hasTag(ROOT_TAG)) {
    event.cancel = true;
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "superagent:burst" || !event.sourceEntity) {
    return;
  }
  const anchor = event.sourceEntity;
  const superagent = closestEntity(
    anchor.dimension.getEntities({
      type: SUPER_AGENT_ID,
      location: anchor.location,
      maxDistance: FOLLOW_RADIUS
    }),
    anchor.location
  );
  if (superagent) {
    attackAround(superagent, system.currentTick);
  }
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      tickPlayer(player, system.currentTick);
    } catch (error) {
    }
  }
}, TICK_RATE);
