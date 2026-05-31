# Agent Survival Toolkit

Advanced MakeCode blocks for the Minecraft Education Agent, designed for Member + Survival play.

The extension avoids world commands such as teleport, fill, setblock, summon, give, time, or weather. Every workflow is built from normal Agent actions: inspect, detect, move, destroy, place, collect, and inventory checks.

## Blocks

- `agent move safely`
- `agent move until blocked`
- `agent backtrack`
- `agent detects hazard nearby`
- `agent should stop if unsafe`
- `agent dig forward safely`
- `agent dig and collect`
- `agent mine line`
- `agent mine tunnel`
- `agent mine stair down`
- `agent clear small area`
- `agent place line`
- `agent build wall`
- `agent build floor`
- `agent build bridge`
- `agent has at least ... items`
- `agent survival last error`

## Automated Testing

Run the local logic tests:

```sh
node tests/run-agent-survival-tests.js
```

These tests mock the MakeCode Agent API and verify the workflow logic without opening Minecraft Education. In-game verification is still needed for release testing because Minecraft world state, permissions, and inventory are runtime conditions.
