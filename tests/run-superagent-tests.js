const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "superagent.ts");
const ADDON = path.join(ROOT, "superagent-addon");

const Direction = {
  FORWARD: 0,
  BACK: 1,
  LEFT: 2,
  RIGHT: 3,
  UP: 4,
  DOWN: 5,
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function transformEnum(body) {
  let nextValue = 0;
  const pairs = body
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("=");
      const name = parts[0].trim();
      const value = parts[1] === undefined ? nextValue : Number(parts[1].trim());
      nextValue = value + 1;
      return `${JSON.stringify(name)}:${value}`;
    });
  return `{${pairs.join(",")}}`;
}

function transformMakeCodeTs(source) {
  let js = source
    .replace(/\/\/%[^\n]*\n/g, "")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/enum\s+(\w+)\s*\{([\s\S]*?)\}/g, (_, name, body) => {
      return `const ${name} = ${transformEnum(body)};`;
    })
    .replace(/namespace\s+superagent\s*\{/, "const superagent = (() => {\n")
    .replace(/export\s+function\s+(\w+)\s*\(/g, "function $1(")
    .replace(/\)\s*:\s*(number|boolean|string|Superagent[A-Za-z0-9_]+)\s*\{/g, ") {")
    .replace(/([,(]\s*)([a-z][A-Za-z0-9_]*)\s*:\s*(number|boolean|string|Superagent[A-Za-z0-9_]+)/g, "$1$2");

  const privateNames = new Set([
    "clamp",
    "attackDirection",
    "runAtAgent",
    "runAtSuperagent",
    "setSuperagentPosition",
    "selectSuperagentNear",
    "teleportCharacterFrom",
    "teleportCharacterTo",
    "directionOffset",
    "ensureCharacter",
    "showCharacterPulse",
    "ensureFollowLoop",
    "smartMoveStep",
    "patrolStep",
    "orbitStep",
    "syncAddonMob",
    "auraPulseCommands",
    "attackCommandBurst",
    "ensureAuraLoop",
    "showRingPulse",
    "showVerticalPulse",
    "showShieldPulse",
    "smartRing",
    "pulse",
  ]);

  const exportNames = [...js.matchAll(/function\s+(\w+)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => !privateNames.has(name));

  const lastBrace = js.lastIndexOf("}");
  return `${js.slice(0, lastBrace)}
return { ${exportNames.join(", ")} };
})();
globalThis.superagent = superagent;
globalThis.SuperagentBurstStyle = SuperagentBurstStyle;
globalThis.SuperagentStatus = SuperagentStatus;
globalThis.SuperagentSmartMode = SuperagentSmartMode;
${js.slice(lastBrace + 1)}`;
}

function createMockAgent() {
  const calls = [];
  const commandCalls = [];
  const mobCalls = [];
  return {
    calls,
    commandCalls,
    mobCalls,
    attack(direction) {
      calls.push(["attack", direction]);
    },
    turn(direction) {
      calls.push(["turn", direction]);
    },
    move(direction, steps) {
      calls.push(["move", direction, steps]);
    },
    collectAll() {
      calls.push(["collectAll"]);
    },
    getPosition() {
      calls.push(["getPosition"]);
      return { x: 10, y: 20, z: 30 };
    },
  };
}

function loadSuperagent(agent) {
  const source = fs.readFileSync(SOURCE, "utf8");
  const sandbox = {
    agent,
    mobs: {
      target(kind) {
        return {
          kind,
          coordinate: null,
          radius: null,
          rules: [],
          atCoordinate(p) {
            this.coordinate = p;
          },
          withinRadius(radius) {
            this.radius = radius;
          },
          addRule(rule, value) {
            this.rules.push([rule, value]);
          },
        };
      },
      execute(target, position, command) {
        agent.commandCalls.push(["execute", target, position, command]);
        return true;
      },
      teleportToPosition(target, destination) {
        agent.mobCalls.push(["teleportToPosition", target, destination]);
        return true;
      },
    },
    loops: {
      forever(callback) {
        agent.calls.push(["forever", typeof callback]);
      },
      pause(ms) {
        agent.calls.push(["pause", ms]);
      },
    },
    positions: {
      add(p1, p2) {
        return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z };
      },
    },
    pos(x, y, z) {
      return { x, y, z };
    },
    LOCAL_PLAYER: "local_player",
    ALL_ENTITIES: "all_entities",
    TurnDirection: { Left: 0, Right: 1 },
    FORWARD: Direction.FORWARD,
    BACK: Direction.BACK,
    LEFT: Direction.LEFT,
    RIGHT: Direction.RIGHT,
    UP: Direction.UP,
    DOWN: Direction.DOWN,
    globalThis: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(transformMakeCodeTs(source), sandbox, { filename: "superagent.ts" });
  return sandbox.globalThis.superagent;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("superagent attack aura performs ring attacks and pulse", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.attackAura(2, 3, 0);
  assert.strictEqual(toolkit.reportLastBurstCount(), 24);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.FORWARD).length, 6);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.UP).length, 0);
  assert(agent.calls.some((call) => call[0] === "turn"));
});

test("superagent power burst attacks all six directions and collects drops", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.powerBurst(1, 2);
  assert.strictEqual(toolkit.reportLastBurstCount(), 12);
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.DOWN));
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("superagent smart sweep prioritizes forward pressure and vertical guard", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.smartSweep(1, 2, 0);
  assert.strictEqual(toolkit.reportLastBurstCount(), 12);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.FORWARD).length, 3);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.UP).length, 2);
  assert(agent.calls.some((call) => call[0] === "turn"));
});

test("superagent overdrive uses emergency six-direction pressure and collects drops", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.overdrive(1, 1);
  assert.strictEqual(toolkit.reportLastBurstCount(), 13);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.BACK).length, 2);
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("superagent extension emits visible aura and sync commands at the Agent position", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.keepAuraOn();
  const commands = agent.commandCalls.map((call) => call[3]);
  assert(commands.some((command) => command.includes("summon superagent:superagent")));
  assert(!commands.some((command) => command.includes("tp @e[type=superagent:superagent")));
  assert(agent.mobCalls.some((call) => call[0] === "teleportToPosition"));
  assert(commands.some((command) => command.includes("particle superagent:agent_aura")));
  assert(commands.some((command) => command.includes("particle minecraft:basic_flame_particle")));
  assert(agent.commandCalls.every((call) => call[2].x === 10 && call[2].y === 20 && call[2].z === 30));
});

test("superagent extension controls an independent one-block character position", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.moveCharacter(1, 3);
  toolkit.attackFromCharacter(5, 4);
  const commands = agent.commandCalls.map((call) => call[3]);
  const positions = agent.commandCalls.map((call) => call[2]);
  assert(commands.some((command) => command.includes("summon superagent:superagent")));
  assert(commands.some((command) => command.includes("particle superagent:agent_aura")));
  assert(commands.some((command) => command.includes("damage @e[family=monster,r=5] 20 entity_attack")));
  assert(!commands.some((command) => command.includes("tp @e[type=superagent:superagent")));
  assert(agent.mobCalls.some((call) => call[0] === "teleportToPosition" && call[2].x === 13 && call[2].y === 20 && call[2].z === 30));
  assert(agent.mobCalls.some((call) => call[1].rules.some((rule) => rule[0] === "type" && rule[1] === "superagent:superagent")));
  assert(positions.some((position) => position.x === 10 && position.y === 20 && position.z === 30));
});

test("superagent extension can run and stop a follow-agent loop", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.followAgentOn();
  toolkit.followAgentOff();
  assert(agent.calls.some((call) => call[0] === "forever"));
  assert(agent.commandCalls.some((call) => call[3].includes("summon superagent:superagent")));
});

test("superagent extension provides many smart movement commands", () => {
  const agent = createMockAgent();
  const toolkit = loadSuperagent(agent);
  toolkit.spawnAtAgent();
  toolkit.dash(1, 5);
  toolkit.scoutLine(0, 4);
  toolkit.patrolSquare(3, 2);
  toolkit.orbitAgent(4, 8);
  toolkit.evadeToAgentSide(3);
  toolkit.highGround(4);
  toolkit.zigzag(1, 6);
  toolkit.spiralSearch(2, 3);
  toolkit.smartMove(0, 5, 2);
  assert(agent.mobCalls.filter((call) => call[0] === "teleportToPosition").length >= 20);
  assert(agent.commandCalls.some((call) => call[3].includes("particle superagent:attack_burst")));
});

test("add-on manifests target Minecraft Education 1.21.133 compatible engine and stable script API", () => {
  const bp = readJson(path.join(ADDON, "superagent_BP", "manifest.json"));
  const rp = readJson(path.join(ADDON, "superagent_RP", "manifest.json"));
  assert.deepStrictEqual(bp.header.min_engine_version, [1, 21, 100]);
  assert.deepStrictEqual(rp.header.min_engine_version, [1, 21, 100]);
  assert(bp.modules.some((module) => module.type === "script" && module.entry === "scripts/main.js"));
  assert(bp.dependencies.some((dependency) => dependency.module_name === "@minecraft/server" && dependency.version === "2.4.0"));
  assert(bp.dependencies.some((dependency) => dependency.uuid === rp.header.uuid));
});

test("extension and visible add-on names use the same release version", () => {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  const pxtJson = readJson(path.join(ROOT, "pxt.json"));
  const bp = readJson(path.join(ADDON, "superagent_BP", "manifest.json"));
  const rp = readJson(path.join(ADDON, "superagent_RP", "manifest.json"));
  assert.strictEqual(packageJson.version, pxtJson.version);
  assert(bp.header.name.includes(packageJson.version));
  assert(rp.header.name.includes(packageJson.version));
});

test("superagent entity is a visible one-block programmable character", () => {
  const entity = readJson(path.join(ADDON, "superagent_BP", "entities", "superagent.json"));
  const components = entity["minecraft:entity"].components;
  assert.strictEqual(entity["minecraft:entity"].description.identifier, "superagent:superagent");
  assert(!components["minecraft:type_family"].family.includes("monster"));
  assert(components["minecraft:type_family"].family.includes("superagent"));
  assert.deepStrictEqual(components["minecraft:damage_sensor"].triggers, {
    cause: "all",
    deals_damage: "no",
  });
  assert(components["minecraft:persistent"]);
  assert.strictEqual(components["minecraft:physics"].has_collision, false);
  assert.strictEqual(components["minecraft:physics"].has_gravity, false);
  assert.strictEqual(components["minecraft:nameable"].always_show, true);
  assert.strictEqual(components["minecraft:scale"].value, 1.0);
  assert.strictEqual(components["minecraft:collision_box"].width, 1.0);
  assert.strictEqual(components["minecraft:collision_box"].height, 1.0);
});

test("superagent resource pack renders the character as exactly one block cube", () => {
  const geometry = readJson(path.join(ADDON, "superagent_RP", "models", "entity", "superagent.geo.json"));
  const description = geometry["minecraft:geometry"][0].description;
  const cubes = geometry["minecraft:geometry"][0].bones[0].cubes;
  assert.strictEqual(description.visible_bounds_width, 1);
  assert.strictEqual(description.visible_bounds_height, 1);
  assert.strictEqual(cubes.length, 1);
  assert.deepStrictEqual(cubes[0].origin, [-8, 0, -8]);
  assert.deepStrictEqual(cubes[0].size, [16, 16, 16]);
});

test("superagent resource pack defines visible aura and attack particles", () => {
  const aura = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_agent_aura.json"));
  const spark = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_agent_spark.json"));
  const attack = readJson(path.join(ADDON, "superagent_RP", "particles", "superagent_attack_burst.json"));
  assert.strictEqual(aura.particle_effect.description.identifier, "superagent:agent_aura");
  assert.strictEqual(spark.particle_effect.description.identifier, "superagent:agent_spark");
  assert.strictEqual(attack.particle_effect.description.identifier, "superagent:attack_burst");
  assert(aura.particle_effect.components["minecraft:emitter_shape_disc"]);
  assert(spark.particle_effect.components["minecraft:emitter_shape_sphere"]);
  assert(attack.particle_effect.components["minecraft:emitter_rate_instant"].num_particles >= 20);
});

test("superagent script protects and powers MakeCode-controlled character without auto-following Agent", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes('const SUPER_AGENT_ID = "superagent:superagent"'));
  assert(script.includes('const LEGACY_VISIBLE_MARKER_ID = "minecraft:armor_stand"'));
  assert(script.includes("world.beforeEvents.entityHurt.subscribe"));
  assert(script.includes("event.cancel = true"));
  assert(script.includes("target.applyDamage(ATTACK_DAMAGE"));
  assert(script.includes("dimension.spawnParticle"));
  assert(script.includes("function tickSuperagent"));
  assert(script.includes("const fallbackSuperagent = ensureFallbackSuperagent(player)"));
  assert(!script.includes("function followAgent"));
  assert(!script.includes("superagent.teleport(agentEntity.location"));
});

test("superagent script prioritizes dangerous nearby targets with stronger debuffs", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("const ATTACK_RADIUS = 8"));
  assert(script.includes("const MAX_ATTACK_TARGETS = 12"));
  assert(script.includes("HIGH_THREAT_TYPES"));
  assert(script.includes("function threatScore"));
  assert(script.includes("function smartAttackTargets"));
  assert(script.includes('target.addEffect("weakness"'));
  assert(script.includes("target.applyDamage(ATTACK_DAMAGE + (isHighThreat(target) ? 4 : 0))"));
});

test("superagent script emits a visible presence effect around the controlled character", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes("const PRESENCE_RADIUS = 1.35"));
  assert(script.includes("CUSTOM_PRESENCE_PARTICLES"));
  assert(script.includes("FALLBACK_PRESENCE_PARTICLES"));
  assert(script.includes("function emitPresenceParticles"));
  assert(script.includes("function refreshAgentVisibleEffects"));
  assert(script.includes("function cleanupLegacyVisibleMarkers"));
  assert(script.includes("function spawnParticleAny"));
  assert(script.includes("function spawnParticleCommand"));
  assert(script.includes('"superagent:agent_aura"'));
  assert(script.includes('"minecraft:totem_particle"'));
  assert(!script.includes('addEffectSafe(superagent, "invisibility"'));
  assert(script.includes("function tickSuperagent"));
  assert(script.includes("emitPresenceParticles(superagent.dimension, superagent.location, tick)"));
});

test("superagent script does not depend on command selectors finding Education Agent", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(!script.includes('return `${player.name}.Agent`;'));
  assert(!script.includes("function agentSelector"));
  assert(!script.includes("function runAtNamedAgent"));
  assert(!script.includes("commandPresenceOnAgent"));
  assert(!script.includes("commandFollowSuperagent"));
  assert(!script.includes("commandAttackAroundAgent"));
});
