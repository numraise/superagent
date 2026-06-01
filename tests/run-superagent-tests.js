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
    .replace(/\)\s*:\s*(number|boolean|string|SuperagentBurstStyle|SuperagentStatus)\s*\{/g, ") {")
    .replace(/([,(]\s*)([a-z][A-Za-z0-9_]*)\s*:\s*(number|boolean|string|SuperagentBurstStyle|SuperagentStatus)/g, "$1$2");

  const privateNames = new Set([
    "clamp",
    "attackDirection",
    "showRingPulse",
    "showVerticalPulse",
    "showShieldPulse",
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
${js.slice(lastBrace + 1)}`;
}

function createMockAgent() {
  const calls = [];
  return {
    calls,
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
  };
}

function loadSuperagent(agent) {
  const source = fs.readFileSync(SOURCE, "utf8");
  const sandbox = {
    agent,
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

test("superagent entity is invisible-helper friendly, persistent, non-monster, and invulnerable", () => {
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
});

test("superagent script follows Education Agent and protects the managed mob", () => {
  const script = fs.readFileSync(path.join(ADDON, "superagent_BP", "scripts", "main.js"), "utf8");
  assert(script.includes('entity.typeId === "minecraft:agent"'));
  assert(script.includes("superagent.teleport(agentEntity.location"));
  assert(script.includes("rotation"));
  assert(script.includes("world.beforeEvents.entityHurt.subscribe"));
  assert(script.includes("event.cancel = true"));
  assert(script.includes("target.applyDamage(ATTACK_DAMAGE)"));
  assert(script.includes("dimension.spawnParticle"));
});
