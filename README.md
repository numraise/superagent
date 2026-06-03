# superagent

Minecraft Education 1.21.133 add-on and MakeCode extension for a visible one-block character named `superagent`.

## What It Adds

- A custom visible entity `superagent:superagent` named `superagent`, rendered as exactly one block.
- MakeCode blocks that spawn, recall, move, follow, and attack from the `superagent` character position.
- Custom resource-pack aura particles and fallback vanilla particles so students can see the character is active.
- Automatic cleanup for legacy armor stand markers from older builds.
- Persistent, non-monster character designed not to despawn in Peaceful.
- Script behavior that protects and powers MakeCode-controlled `superagent` characters without forcing them back to the Agent.
- Damage cancellation, high health, resistance, fire resistance, no gravity, no collision, and knockback resistance.
- Smart hostile-mob attack aura that prioritizes nearby high-threat mobs, adds slowness/weakness, and emits attack particles.
- MakeCode `superagent` blocks intended for Member + Survival use through Code Builder, with position control driven by `agent.getPosition()` and extension state.

## MakeCode Blocks

- `superagent show ready/attack/shield`
- `superagent spawn at agent`
- `superagent recall to agent`
- `superagent move north/east/south/west/up/down blocks`
- `superagent follow agent on`
- `superagent follow agent off`
- `superagent dash direction blocks`
- `superagent scout direction steps`
- `superagent patrol square side rounds`
- `superagent orbit agent radius steps`
- `superagent evade to agent side distance`
- `superagent high ground blocks`
- `superagent zigzag direction steps`
- `superagent spiral search radius rounds`
- `superagent smart move guard/scout/patrol/orbit/evade/high ground/zigzag/spiral steps strength`
- `superagent attack from character radius strength`
- `superagent attack aura`
- `superagent guard agent`
- `superagent power burst`
- `superagent smart sweep`
- `superagent overdrive`
- `superagent keep aura on`
- `superagent last burst count`

## Install

Import the add-on bundle:

```sh
node tools/package-superagent-addon.js
```

Then open `dist/superagent.mcaddon` with Minecraft Education and activate both the behavior pack and resource pack in the world. A world owner or teacher must activate the pack first. After that, Member + Survival players can use the MakeCode extension blocks.

Use this GitHub URL in MakeCode Extensions:

```text
https://github.com/numraise/superagent
```

For a pinned classroom build, use:

```text
https://github.com/numraise/superagent#superagent-0.1.12
```

## Test

```sh
node tests/run-superagent-tests.js
node tools/package-superagent-addon.js
```

In-game verification is still required because Minecraft world state, Agent availability, and permissions are runtime conditions.
