const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "agent-survival.ts");

const Direction = {
  FORWARD: 0,
  BACK: 1,
  LEFT: 2,
  RIGHT: 3,
  UP: 4,
  DOWN: 5,
};

const AIR = 0;
const STONE = 1;
const WATER = 9;
const LAVA = 11;

function transformMakeCodeTs(source) {
  let js = source
    .replace(/\/\/%[^\n]*\n/g, "")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/enum\s+AgentSurvivalError\s*\{([\s\S]*?)\}/, (_, body) => {
      const entries = body
        .split("\n")
        .map((line) => line.trim().replace(/,$/, ""))
        .filter(Boolean)
        .map((line) => line.split("=")[0].trim());
      const pairs = entries.map((name, index) => `${JSON.stringify(name)}:${index}`).join(",");
      return `const AgentSurvivalError = {${pairs}};`;
    })
    .replace(/namespace\s+agentSurvival\s*\{/, "const agentSurvival = (() => {\n")
    .replace(/export\s+function\s+(\w+)\s*\(/g, "function $1(")
    .replace(/\)\s*:\s*(number|boolean|AgentSurvivalError)\s*\{/g, ") {")
    .replace(/([,(]\s*)([a-z][A-Za-z0-9_]*)\s*:\s*(number|boolean|AgentSurvivalError)/g, "$1$2")
    .replace(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=/g, "const $1 =");

  const exportNames = [...js.matchAll(/function\s+(\w+)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => ![
      "clamp",
      "remember",
      "blockAt",
      "isHazardBlock",
      "hasSafeFloor",
      "frontIsSafeToEnter",
      "clearFrontIfSafe",
      "turnAroundInternal",
      "resetError",
      "clearTunnelFace",
      "placeWallRow",
    ].includes(name));

  const lastBrace = js.lastIndexOf("}");
  return `${js.slice(0, lastBrace)}
return { ${exportNames.join(", ")} };
})();
globalThis.agentSurvival = agentSurvival;
globalThis.AgentSurvivalError = AgentSurvivalError;
${js.slice(lastBrace + 1)}`;
}

function createMockAgent(options = {}) {
  const calls = [];
  const blocks = {
    [Direction.FORWARD]: options.forward ?? AIR,
    [Direction.DOWN]: options.down ?? STONE,
    [Direction.LEFT]: options.left ?? AIR,
    [Direction.RIGHT]: options.right ?? AIR,
    [Direction.UP]: options.up ?? AIR,
  };
  const inventory = Object.assign({}, options.inventory || {});

  const agent = {
    calls,
    inspect(kind, direction) {
      calls.push(["inspect", direction]);
      return blocks[direction] ?? AIR;
    },
    detect(kind, direction) {
      calls.push(["detect", direction]);
      return (blocks[direction] ?? AIR) !== AIR;
    },
    move(direction, steps) {
      calls.push(["move", direction, steps]);
      if (
        direction === Direction.FORWARD ||
        direction === Direction.BACK ||
        direction === Direction.LEFT ||
        direction === Direction.RIGHT
      ) {
        blocks[Direction.FORWARD] = AIR;
        blocks[Direction.DOWN] = options.afterMoveDown ?? STONE;
      }
    },
    turn(direction) {
      calls.push(["turn", direction]);
    },
    destroy(direction) {
      calls.push(["destroy", direction]);
      blocks[direction] = AIR;
    },
    collectAll() {
      calls.push(["collectAll"]);
    },
    setSlot(slot) {
      calls.push(["setSlot", slot]);
    },
    place(direction) {
      calls.push(["place", direction]);
      if (direction === Direction.DOWN) {
        blocks[Direction.DOWN] = STONE;
      }
      if (inventory[agent.currentSlot] > 0) {
        inventory[agent.currentSlot] -= 1;
      }
    },
    getItemCount(slot) {
      calls.push(["getItemCount", slot]);
      return inventory[slot] || 0;
    },
    currentSlot: 1,
  };

  const originalSetSlot = agent.setSlot.bind(agent);
  agent.setSlot = (slot) => {
    agent.currentSlot = slot;
    originalSetSlot(slot);
  };

  return agent;
}

function loadToolkit(agent) {
  const source = fs.readFileSync(SOURCE, "utf8");
  const sandbox = {
    agent,
    AgentInspection: { Block: 0 },
    AgentDetection: { Block: 0 },
    TurnDirection: { Left: 0, Right: 1 },
    FORWARD: Direction.FORWARD,
    BACK: Direction.BACK,
    LEFT: Direction.LEFT,
    RIGHT: Direction.RIGHT,
    UP: Direction.UP,
    DOWN: Direction.DOWN,
    console,
    globalThis: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(transformMakeCodeTs(source), sandbox, { filename: "agent-survival.ts" });
  return sandbox.globalThis.agentSurvival;
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

test("moveSafe walks across clear ground", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.moveSafe(3), 3);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "move").length, 3);
});

test("moveSafe stops on a forward block", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.moveSafe(3), 0);
  assert.strictEqual(toolkit.reportLastError(), 1);
});

test("moveUntilBlocked delegates to safe movement", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.moveUntilBlocked(4), 4);
});

test("backtrack turns around, walks, and restores facing", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.backtrack(2), 2);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "turn").length, 4);
});

test("moveSafe stops near lava", () => {
  const agent = createMockAgent({ forward: LAVA });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.moveSafe(2), 0);
  assert.strictEqual(toolkit.reportLastError(), 2);
});

test("detectHazardNear sees water at the side", () => {
  const agent = createMockAgent({ left: WATER });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.detectHazardNear(), true);
});

test("stopIfUnsafe reports unsafe over a gap", () => {
  const agent = createMockAgent({ down: AIR });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.stopIfUnsafe(), true);
  assert.strictEqual(toolkit.reportLastError(), 2);
});

test("digForwardSafe destroys non-hazard block and collects", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.digForwardSafe(), true);
  assert(agent.calls.some((call) => call[0] === "destroy" && call[1] === Direction.FORWARD));
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("digAndCollect collects even when no block is ahead", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.digAndCollect(), true);
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("digForwardSafe refuses lava", () => {
  const agent = createMockAgent({ forward: LAVA });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.digForwardSafe(), false);
  assert(!agent.calls.some((call) => call[0] === "destroy"));
  assert.strictEqual(toolkit.reportLastError(), 2);
});

test("mineStairDown destroys below and descends", () => {
  const agent = createMockAgent({ forward: STONE, down: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.mineStairDown(1), 1);
  assert(agent.calls.some((call) => call[0] === "destroy" && call[1] === Direction.DOWN));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.DOWN));
});

test("clearSmallArea uses tunnel clearing", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.clearSmallArea(1, 1, 1), 1);
});

test("mineLine digs and moves one slice at a time", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.mineLine(1), 1);
  assert(agent.calls.some((call) => call[0] === "destroy"));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.FORWARD));
});

test("placeLine uses selected slot and places below", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 3: 3 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.placeLine(3, 2), 2);
  assert(agent.calls.some((call) => call[0] === "setSlot" && call[1] === 3));
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.DOWN).length, 2);
});

test("hasEnough reads the Agent inventory", () => {
  const agent = createMockAgent({ inventory: { 2: 12 } });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.hasEnough(2, 10), true);
  assert.strictEqual(toolkit.hasEnough(2, 13), false);
});

test("buildFloor snakes across rows", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 6 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.buildFloor(1, 2, 2), 4);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "turn"));
});

test("buildBridge places below when crossing a gap", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 4 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.buildBridge(1, 2, 1), 2);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.DOWN).length, 2);
});

test("buildBridge stops when out of blocks", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 1 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.buildBridge(1, 3, 1), 1);
  assert.strictEqual(toolkit.reportLastError(), 3);
});

test("buildWall places forward while moving sideways", () => {
  const agent = createMockAgent({ inventory: { 1: 9 } });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.buildWall(1, 3, 2), 6);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.FORWARD).length, 6);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.LEFT));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.UP));
});

test("mineTunnel clears a compact face then advances", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.mineTunnel(1, 2, 2), 1);
  assert(agent.calls.filter((call) => call[0] === "destroy").length >= 1);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.UP));
});

console.log("All Agent Survival Toolkit tests passed.");
