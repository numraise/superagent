# superagent

Minecraft Education 1.21.133 add-on and MakeCode extension for an invisible helper mob named `superaagent` that follows the Education Agent and shows a visible aura on the Agent.

## What It Adds

- A custom invisible entity `superagent:superagent` named `superaagent`.
- Custom resource-pack aura particles, fallback vanilla particles, and MakeCode commands that emit effects at `agent.getPosition()` so students can see that `superaagent` is active without showing a body.
- Automatic cleanup for legacy armor stand markers from older builds.
- Persistent, non-monster helper entity designed not to despawn in Peaceful.
- Script behavior that keeps one managed `superaagent` on top of each player's Minecraft Education Agent.
- Rotation sync from the Agent to `superaagent`.
- Damage cancellation, high health, resistance, fire resistance, no gravity, no collision, and knockback resistance.
- Smart hostile-mob attack aura that prioritizes nearby high-threat mobs, adds slowness/weakness, and emits attack particles.
- MakeCode `superagent` blocks that are safe for Member + Survival use because they rely on normal Agent actions.

## MakeCode Blocks

- `superagent show ready/attack/shield`
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
https://github.com/numraise/superagent#superagent-0.1.10
```

## Test

```sh
node tests/run-superagent-tests.js
node tools/package-superagent-addon.js
```

In-game verification is still required because Minecraft world state, Agent availability, and permissions are runtime conditions.
