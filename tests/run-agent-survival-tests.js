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
const DIRT = 3;
const WATER = 9;
const LAVA = 11;

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
    .replace(/namespace\s+agentSurvival\s*\{/, "const agentSurvival = (() => {\n")
    .replace(/export\s+function\s+(\w+)\s*\(/g, "function $1(")
    .replace(/\)\s*:\s*(number|boolean|AgentSurvivalError|AgentSurvivalAxis|AgentSurvivalScanTarget|Position|TargetSelector)\s*\{/g, ") {")
    .replace(/([,(]\s*)([a-z][A-Za-z0-9_]*)\s*:\s*(number|boolean|string|AgentSurvivalError|AgentSurvivalAxis|AgentSurvivalScanTarget|Position|TargetSelector)/g, "$1$2")
    .replace(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=/g, "const $1 =");

  const privateNames = new Set([
    "clamp",
    "resetResult",
    "remember",
    "blockAt",
    "offsetFromAgent",
    "scanMatches",
    "mobsNearAgentFamily",
    "isSoilBlock",
    "turnAroundInternal",
    "destroyIfPresent",
    "destroySoilIfPresent",
    "moveThrough",
    "axisDirection",
    "placeIfEmpty",
    "moveAndPlaceLine",
    "backtrackInternal",
    "attackDirection",
    "clearTunnelFace",
    "moveToCubeCell",
  ]);

  const exportNames = [...js.matchAll(/function\s+(\w+)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => !privateNames.has(name));

  const lastBrace = js.lastIndexOf("}");
  return `${js.slice(0, lastBrace)}
return { ${exportNames.join(", ")} };
})();
globalThis.agentSurvival = agentSurvival;
globalThis.AgentSurvivalError = AgentSurvivalError;
globalThis.AgentSurvivalAxis = AgentSurvivalAxis;
globalThis.AgentSurvivalScanTarget = AgentSurvivalScanTarget;
${js.slice(lastBrace + 1)}`;
}

function createMockAgent(options = {}) {
  const calls = [];
  const blocks = {
    [Direction.FORWARD]: options.forward ?? AIR,
    [Direction.BACK]: options.back ?? AIR,
    [Direction.DOWN]: options.down ?? STONE,
    [Direction.LEFT]: options.left ?? AIR,
    [Direction.RIGHT]: options.right ?? AIR,
    [Direction.UP]: options.up ?? AIR,
  };
  const inventory = Object.assign({}, options.inventory || {});

  const agent = {
    calls,
    currentSlot: 1,
    testBlocks: options.testBlocks || {},
    getPosition() {
      calls.push(["getPosition"]);
      return options.position || { x: 10, y: 64, z: 20 };
    },
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
      blocks[Direction.FORWARD] = options.afterMoveForward ?? AIR;
      blocks[Direction.BACK] = AIR;
      blocks[Direction.LEFT] = AIR;
      blocks[Direction.RIGHT] = AIR;
      blocks[Direction.UP] = AIR;
      blocks[Direction.DOWN] = options.afterMoveDown ?? STONE;
    },
    turn(direction) {
      calls.push(["turn", direction]);
    },
    attack(direction) {
      calls.push(["attack", direction]);
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
      agent.currentSlot = slot;
    },
    place(direction) {
      calls.push(["place", direction]);
      blocks[direction] = STONE;
      if (inventory[agent.currentSlot] > 0) {
        inventory[agent.currentSlot] -= 1;
      }
    },
    getItemCount(slot) {
      calls.push(["getItemCount", slot]);
      return inventory[slot] || 0;
    },
  };

  return agent;
}

function loadToolkit(agent) {
  const source = fs.readFileSync(SOURCE, "utf8");
  const sandbox = {
    agent,
    blocks: {
      testForBlock(block, position) {
        const key = `${position.x},${position.y},${position.z}`;
        return (agent.testBlocks && agent.testBlocks[key] !== undefined ? agent.testBlocks[key] : AIR) === block;
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
    mobs: {
      target(kind) {
        return {
          kind,
          coordinate: null,
          radius: 0,
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
    },
    ALL_ENTITIES: 0,
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

test("acting commands expose statement-style void APIs", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.strideForward(3), undefined);
  assert.strictEqual(toolkit.reportLastCount(), 3);
  assert.strictEqual(toolkit.reportLastError(), 0);
});

test("backtrack restores facing with two turns on each side", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.backtrack(2);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "turn").length, 4);
});

test("strikeAxis attacks one selected direction repeatedly", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.strikeAxis(0, false, 3);
  assert.strictEqual(toolkit.reportLastCount(), 3);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.FORWARD).length, 3);
});

test("sweepAttack attacks the four horizontal directions", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.sweepAttack(2);
  assert.strictEqual(toolkit.reportLastCount(), 8);
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.BACK));
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.LEFT));
});

test("verticalCombo attacks down, forward, and up", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.verticalCombo(1);
  assert.strictEqual(toolkit.reportLastCount(), 3);
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.DOWN));
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.UP));
});

test("chargeAttack attacks while advancing", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.chargeAttack(2, 2);
  assert.strictEqual(toolkit.reportLastCount(), 4);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "move" && call[1] === Direction.FORWARD).length, 2);
});

test("lungeAttack attacks along a line and returns", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.lungeAttack(3, 2);
  assert.strictEqual(toolkit.reportLastCount(), 6);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "attack" && call[1] === Direction.FORWARD).length, 6);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "move" && call[1] === Direction.FORWARD).length, 3);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "turn").length, 4);
});

test("retreatAttack attacks while backing away", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.retreatAttack(2, 1);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "move" && call[1] === Direction.BACK).length, 2);
});

test("guardArea attacks all adjacent directions by round", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  toolkit.guardArea(2, 1);
  assert.strictEqual(toolkit.reportLastCount(), 12);
  assert(agent.calls.some((call) => call[0] === "attack" && call[1] === Direction.DOWN));
});

test("digAxis destroys a selected adjacent block", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  toolkit.digAxis(0, false);
  assert.strictEqual(toolkit.reportLastCount(), 1);
  assert(agent.calls.some((call) => call[0] === "destroy" && call[1] === Direction.FORWARD));
});

test("drillLine digs, collects, and advances", () => {
  const agent = createMockAgent({ forward: STONE, afterMoveForward: STONE });
  const toolkit = loadToolkit(agent);
  toolkit.drillLine(3);
  assert.strictEqual(toolkit.reportLastCount(), 3);
  assert(agent.calls.filter((call) => call[0] === "move" && call[1] === Direction.FORWARD).length >= 3);
  assert(agent.calls.some((call) => call[0] === "collectAll"));
});

test("quarryTunnel clears a rectangular face then advances", () => {
  const agent = createMockAgent({ forward: STONE });
  const toolkit = loadToolkit(agent);
  toolkit.quarryTunnel(2, 2, 2);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.UP));
});

test("stairMineDown advances forward and downward", () => {
  const agent = createMockAgent({ forward: STONE, down: STONE });
  const toolkit = loadToolkit(agent);
  toolkit.stairMineDown(2);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.DOWN));
});

test("stripMine creates branches and preserves the total count", () => {
  const agent = createMockAgent({ forward: STONE, afterMoveForward: STONE });
  const toolkit = loadToolkit(agent);
  toolkit.stripMine(2, 1, 1);
  assert.strictEqual(toolkit.reportLastCount(), 6);
  assert(agent.calls.filter((call) => call[0] === "turn").length >= 8);
});

test("clearDirtCube3 only destroys soil-like blocks while moving through the cube", () => {
  const agent = createMockAgent({
    forward: DIRT,
    back: DIRT,
    left: DIRT,
    right: DIRT,
    up: DIRT,
    down: DIRT,
    afterMoveDown: AIR,
  });
  const toolkit = loadToolkit(agent);
  toolkit.clearDirtCube3();
  assert(toolkit.reportLastCount() >= 1);
  assert(agent.calls.some((call) => call[0] === "inspect"));
  assert(agent.calls.some((call) => call[0] === "destroy"));
});

test("layPath uses selected slot and places below", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 3: 3 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  toolkit.layPath(3, 2);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert(agent.calls.some((call) => call[0] === "setSlot" && call[1] === 3));
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.DOWN).length, 2);
});

test("hasEnough reads the Agent inventory", () => {
  const agent = createMockAgent({ inventory: { 2: 12 } });
  const toolkit = loadToolkit(agent);
  assert.strictEqual(toolkit.hasEnough(2, 10), true);
  assert.strictEqual(toolkit.hasEnough(2, 13), false);
});

test("scanBlocksAround counts water or lava in a configurable radius", () => {
  const agent = createMockAgent({
    testBlocks: {
      "11,64,20": WATER,
      "9,64,20": LAVA,
      "10,64,21": STONE,
    },
  });
  const toolkit = loadToolkit(agent);
  toolkit.scanBlocksAround(1, 1, 0);
  assert.strictEqual(toolkit.reportLastCount(), 1);
  assert.strictEqual(toolkit.scanFound(), true);
  toolkit.scanBlocksAround(2, 1, 0);
  assert.strictEqual(toolkit.reportLastCount(), 1);
  toolkit.scanBlocksAround(0, 1, 0);
  assert.strictEqual(toolkit.reportLastCount(), 3);
});

test("mob selector helpers target animal and monster families around the Agent", () => {
  const agent = createMockAgent();
  const toolkit = loadToolkit(agent);
  const passive = toolkit.passiveMobsNearAgent(7);
  const hostile = toolkit.hostileMobsNearAgent(9);
  assert.strictEqual(passive.radius, 7);
  assert.deepStrictEqual(passive.coordinate, { x: 10, y: 64, z: 20 });
  assert(passive.rules.some((rule) => rule[0] === "family" && rule[1] === "animal"));
  assert.strictEqual(hostile.radius, 9);
  assert(hostile.rules.some((rule) => rule[0] === "family" && rule[1] === "monster"));
});

test("buildPlatform snakes across rows", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 6 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  toolkit.buildPlatform(1, 2, 2);
  assert.strictEqual(toolkit.reportLastCount(), 4);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.RIGHT));
  assert(agent.calls.some((call) => call[0] === "turn"));
});

test("buildBridge places below when crossing a gap", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 4 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  toolkit.buildBridge(1, 2, 1);
  assert.strictEqual(toolkit.reportLastCount(), 2);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.DOWN).length, 2);
});

test("buildBridge stops when out of blocks", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 1 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  toolkit.buildBridge(1, 3, 1);
  assert.strictEqual(toolkit.reportLastCount(), 1);
  assert.strictEqual(toolkit.reportLastError(), 2);
});

test("buildWall places forward while moving sideways and upward", () => {
  const agent = createMockAgent({ inventory: { 1: 9 } });
  const toolkit = loadToolkit(agent);
  toolkit.buildWall(1, 3, 2);
  assert.strictEqual(toolkit.reportLastCount(), 6);
  assert.strictEqual(agent.calls.filter((call) => call[0] === "place" && call[1] === Direction.FORWARD).length, 6);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.UP));
});

test("fillBox builds layered volumes", () => {
  const agent = createMockAgent({ down: AIR, inventory: { 1: 16 }, afterMoveDown: AIR });
  const toolkit = loadToolkit(agent);
  toolkit.fillBox(1, 2, 2, 2);
  assert.strictEqual(toolkit.reportLastCount(), 8);
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.UP));
  assert(agent.calls.some((call) => call[0] === "move" && call[1] === Direction.FORWARD));
});

console.log("All Agent Survival Toolkit tests passed.");
