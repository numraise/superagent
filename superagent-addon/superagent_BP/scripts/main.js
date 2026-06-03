import { EntityComponentTypes, system, world } from "@minecraft/server";

const SUPER_AGENT_ID = "superagent:superagent";
const LEGACY_VISIBLE_MARKER_ID = "minecraft:armor_stand";
const DISPLAY_NAME = "superagent";
const ROOT_TAG = "superagent.managed";
const OWNER_TAG_PREFIX = "superagent.owner.";
const READY_TAG = "superagent.ready.0_1_12";
const ATTACK_RADIUS = 8;
const ATTACK_DAMAGE = 14;
const MAX_ATTACK_TARGETS = 12;
const FOLLOW_RADIUS = 128;
const TICK_RATE = 2;
const PRESENCE_RADIUS = 1.35;

const CUSTOM_PRESENCE_PARTICLES = [
  "superagent:agent_aura",
  "superagent:agent_spark"
];

const FALLBACK_PRESENCE_PARTICLES = [
  "minecraft:totem_particle",
  "minecraft:heart_particle",
  "minecraft:villager_happy",
  "minecraft:basic_flame_particle",
  "minecraft:basic_smoke_particle",
  "minecraft:critical_hit_emitter"
];

const ATTACK_PARTICLES = [
  "superagent:attack_burst",
  "minecraft:critical_hit_emitter",
  "minecraft:basic_flame_particle"
];

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

const HIGH_THREAT_TYPES = [
  "minecraft:blaze",
  "minecraft:breeze",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:elder_guardian",
  "minecraft:evocation_illager",
  "minecraft:ghast",
  "minecraft:guardian",
  "minecraft:hoglin",
  "minecraft:phantom",
  "minecraft:piglin_brute",
  "minecraft:pillager",
  "minecraft:ravager",
  "minecraft:vex",
  "minecraft:vindicator",
  "minecraft:warden",
  "minecraft:witch",
  "minecraft:wither_skeleton"
];

function ownerTag(player) {
  return OWNER_TAG_PREFIX + player.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 32);
}

function isAgent(entity) {
  const typeId = (entity.typeId || "").toLowerCase();
  const nameTag = (entity.nameTag || "").toLowerCase();
  return typeId === "minecraft:agent" ||
    typeId === "agent" ||
    typeId.endsWith(":agent") ||
    typeId.indexOf("agent") >= 0 ||
    nameTag.endsWith(".agent") ||
    nameTag.indexOf(".agent") >= 0;
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
    location: anchorLocation,
    maxDistance: FOLLOW_RADIUS
  });
}

function findManagedSuperagentsNearPlayer(player) {
  return findManagedSuperagents(player, player.location);
}

function addEffectSafe(entity, effect, duration, options) {
  if (!entity) {
    return;
  }
  try {
    entity.addEffect(effect, duration, options);
  } catch (error) {
  }
}

function configureSuperagent(superagent, player) {
  if (!superagent) {
    return;
  }
  superagent.nameTag = DISPLAY_NAME;
  superagent.addTag(ROOT_TAG);
  superagent.addTag(ownerTag(player));
  addEffectSafe(superagent, "resistance", 200, {
    amplifier: 255,
    showParticles: false
  });
  addEffectSafe(superagent, "fire_resistance", 200, {
    amplifier: 1,
    showParticles: false
  });
}

function ensureSuperagentAtLocation(player, location) {
  const existing = findManagedSuperagents(player, location);
  let superagent = closestEntity(existing, location);
  if (!superagent) {
    try {
      superagent = player.dimension.spawnEntity(SUPER_AGENT_ID, location);
    } catch (error) {
      return undefined;
    }
  }
  configureSuperagent(superagent, player);
  for (const duplicate of existing) {
    if (duplicate.id !== superagent.id) {
      duplicate.remove();
    }
  }
  return superagent;
}

function ensureSuperagent(player, agentEntity) {
  return ensureSuperagentAtLocation(player, agentEntity.location);
}

function ensureFallbackSuperagent(player) {
  const existing = findManagedSuperagentsNearPlayer(player);
  const current = closestEntity(existing, player.location);
  if (current) {
    configureSuperagent(current, player);
    return current;
  }
  return ensureSuperagentAtLocation(player, player.location);
}

function isAttackTarget(entity) {
  if (!entity || entity.hasTag(ROOT_TAG) || entity.typeId === SUPER_AGENT_ID || entity.typeId === LEGACY_VISIBLE_MARKER_ID || isAgent(entity)) {
    return false;
  }
  if (entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item") {
    return false;
  }
  return HOSTILE_TYPES.indexOf(entity.typeId) >= 0;
}

function isHighThreat(entity) {
  return HIGH_THREAT_TYPES.indexOf(entity.typeId) >= 0;
}

function threatScore(entity, origin) {
  let score = 100 - distanceSquared(entity.location, origin);
  if (isHighThreat(entity)) {
    score += 80;
  }
  if (entity.typeId === "minecraft:creeper" || entity.typeId === "minecraft:warden") {
    score += 120;
  }
  return score;
}

function smartAttackTargets(superagent) {
  return superagent.dimension.getEntities({
    location: superagent.location,
    maxDistance: ATTACK_RADIUS
  })
    .filter(isAttackTarget)
    .sort((a, b) => threatScore(b, superagent.location) - threatScore(a, superagent.location))
    .slice(0, MAX_ATTACK_TARGETS);
}

function weakenTarget(target) {
  target.addEffect("slowness", 80, {
    amplifier: isHighThreat(target) ? 2 : 1,
    showParticles: true
  });
  target.addEffect("weakness", 80, {
    amplifier: isHighThreat(target) ? 1 : 0,
    showParticles: true
  });
}

function emitAuraParticles(dimension, location, tick) {
  const angle = tick * 0.45;
  const ring = [
    { x: Math.cos(angle) * 1.4, y: 0.3, z: Math.sin(angle) * 1.4 },
    { x: Math.cos(angle + 2.1) * 1.4, y: 0.9, z: Math.sin(angle + 2.1) * 1.4 },
    { x: Math.cos(angle + 4.2) * 1.4, y: 1.5, z: Math.sin(angle + 4.2) * 1.4 }
  ];
  for (const offset of ring) {
    spawnParticleAny(dimension, ATTACK_PARTICLES, {
      x: location.x + offset.x,
      y: location.y + offset.y,
      z: location.z + offset.z
    });
  }
}

function formatCoord(value) {
  return Math.round(value * 100) / 100;
}

function runCommandSafe(dimension, command) {
  try {
    if (typeof dimension.runCommandAsync === "function") {
      dimension.runCommandAsync(command);
      return true;
    }
  } catch (error) {
  }
  try {
    if (typeof dimension.runCommand === "function") {
      dimension.runCommand(command);
      return true;
    }
  } catch (error) {
  }
  return false;
}

function spawnParticleCommand(dimension, name, location) {
  return runCommandSafe(dimension, `particle ${name} ${formatCoord(location.x)} ${formatCoord(location.y)} ${formatCoord(location.z)}`);
}

function spawnParticleAny(dimension, names, location) {
  for (const name of names) {
    try {
      dimension.spawnParticle(name, location);
      return true;
    } catch (error) {
    }
  }
  for (const name of names) {
    if (spawnParticleCommand(dimension, name, location)) {
      return true;
    }
  }
  return false;
}

function emitPresenceParticles(dimension, location, tick) {
  const angle = tick * 0.28;
  spawnParticleAny(dimension, CUSTOM_PRESENCE_PARTICLES, {
    x: location.x,
    y: location.y + 0.2,
    z: location.z
  });
  spawnParticleAny(dimension, CUSTOM_PRESENCE_PARTICLES, {
    x: location.x,
    y: location.y + 1.35,
    z: location.z
  });
  const offsets = [
    { x: Math.cos(angle) * PRESENCE_RADIUS, y: 0.25, z: Math.sin(angle) * PRESENCE_RADIUS },
    { x: Math.cos(angle + Math.PI) * PRESENCE_RADIUS, y: 0.25, z: Math.sin(angle + Math.PI) * PRESENCE_RADIUS },
    { x: Math.cos(angle + 1.57) * PRESENCE_RADIUS, y: 0.8, z: Math.sin(angle + 1.57) * PRESENCE_RADIUS },
    { x: Math.cos(angle - 1.57) * PRESENCE_RADIUS, y: 0.8, z: Math.sin(angle - 1.57) * PRESENCE_RADIUS },
    { x: Math.cos(angle + 0.8) * 0.55, y: 1.35, z: Math.sin(angle + 0.8) * 0.55 },
    { x: Math.cos(angle + 3.9) * 0.55, y: 1.35, z: Math.sin(angle + 3.9) * 0.55 },
    { x: 0, y: 1.75, z: 0 }
  ];
  for (const offset of offsets) {
    spawnParticleAny(dimension, FALLBACK_PRESENCE_PARTICLES, {
      x: location.x + offset.x,
      y: location.y + offset.y,
      z: location.z + offset.z
    });
  }
}

function attackAround(superagent, tick) {
  const targets = smartAttackTargets(superagent);
  for (const target of targets) {
    try {
      weakenTarget(target);
      target.applyDamage(ATTACK_DAMAGE + (isHighThreat(target) ? 4 : 0));
    } catch (error) {
    }
  }
  emitAuraParticles(superagent.dimension, superagent.location, tick);
}

function keepAlive(superagent) {
  if (!superagent) {
    return;
  }
  try {
    const health = superagent.getComponent(EntityComponentTypes.Health);
    if (health) {
      health.resetToMaxValue();
    }
  } catch (error) {
  }
}

function refreshAgentVisibleEffects(agentEntity) {
  addEffectSafe(agentEntity, "strength", 80, {
    amplifier: 1,
    showParticles: true
  });
  addEffectSafe(agentEntity, "resistance", 80, {
    amplifier: 0,
    showParticles: true
  });
}

function markerNameMatches(entity) {
  const nameTag = (entity.nameTag || "").toLowerCase();
  return nameTag === "superagent" || nameTag === "superaagent";
}

function removeEntitySafe(entity) {
  try {
    entity.remove();
  } catch (error) {
  }
}

function cleanupLegacyVisibleMarkers(player, anchorLocation) {
  const legacyMarkers = player.dimension.getEntities({
    type: LEGACY_VISIBLE_MARKER_ID,
    location: anchorLocation,
    maxDistance: FOLLOW_RADIUS
  });
  for (const marker of legacyMarkers) {
    if (marker.hasTag(ROOT_TAG) || markerNameMatches(marker)) {
      removeEntitySafe(marker);
    }
  }
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},tag=${ROOT_TAG}]`);
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},name=superagent]`);
  runCommandSafe(player.dimension, `kill @e[type=${LEGACY_VISIBLE_MARKER_ID},name=superaagent]`);
}

function announceReady(player) {
  try {
    if (!player.hasTag(READY_TAG)) {
      player.addTag(READY_TAG);
      player.sendMessage("superagent 0.1.12 script active");
    }
  } catch (error) {
  }
}

function tickSuperagent(player, superagent, tick) {
  configureSuperagent(superagent, player);
  keepAlive(superagent);
  emitPresenceParticles(superagent.dimension, superagent.location, tick);
  attackAround(superagent, tick);
}

function tickPlayer(player, tick) {
  announceReady(player);
  cleanupLegacyVisibleMarkers(player, player.location);
  const fallbackSuperagent = ensureFallbackSuperagent(player);
  if (fallbackSuperagent) {
    tickSuperagent(player, fallbackSuperagent, tick);
  }
  const superagents = findManagedSuperagentsNearPlayer(player);
  for (const superagent of superagents) {
    if (fallbackSuperagent && superagent.id === fallbackSuperagent.id) {
      continue;
    }
    tickSuperagent(player, superagent, tick);
  }
}

world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.hurtEntity.hasTag(ROOT_TAG) || event.hurtEntity.typeId === SUPER_AGENT_ID) {
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
  const attackAnchor = superagent || closestEntity(
    anchor.dimension.getEntities({
      location: anchor.location,
      maxDistance: FOLLOW_RADIUS
    }).filter(isAgent),
    anchor.location
  ) || anchor;
  emitPresenceParticles(attackAnchor.dimension, attackAnchor.location, system.currentTick);
  attackAround(attackAnchor, system.currentTick);
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      tickPlayer(player, system.currentTick);
    } catch (error) {
    }
  }
}, TICK_RATE);
