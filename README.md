# Agent Survival Toolkit

Advanced MakeCode blocks for the Minecraft Education Agent, designed for Member + Survival play.

The extension avoids world commands such as teleport, fill, setblock, summon, give, time, or weather. Every workflow is built from normal Agent actions: inspect, detect, move, destroy, place, collect, and inventory checks.

Action blocks are statement-style blocks, so they connect in a command stack. Use `agent last count` and `agent last error` after an action to check what happened.

## Blocks

- `agent last error`
- `agent last count`
- `agent signal ready/success/found/empty/blocked/no item/invalid input`
- `agent mark signal using slot ...`
- `agent mark last result using slot ...`
- `agent mark scan result using slot ...`
- `agent mark inventory check using marker slot ...`
- `agent has at least ... items in slot ...`
- `agent scan any block/water/lava around radius ... height ...`
- `agent scan found target`
- `passive mobs near agent radius ...`
- `hostile mobs near agent radius ...`
- `agent collect drops`
- `agent stride forward`
- `agent backtrack`
- `agent strike forward/back/left/right/up/down`
- `agent sweep attack`
- `agent vertical combo`
- `agent charge attack`
- `agent lunge attack`
- `agent retreat attack`
- `agent guard area`
- `agent emerald power attack all directions`
- `agent dig forward/back/left/right/up/down`
- `agent drill line`
- `agent quarry tunnel`
- `agent stair mine down`
- `agent strip mine`
- `agent clear dirt cube 3 x 3 x 3`
- `agent lay path`
- `agent build platform`
- `agent build wall`
- `agent build bridge`
- `agent fill box`

## Result values

`agent last count` means the count from the most recent action. Depending on the action it can mean steps moved, tunnel slices mined, branches advanced, blocks placed, or soil blocks cleared.

`agent last error` can be:

- `none`
- `blocked`
- `no item`
- `invalid input`

Mob detection blocks return target selectors. For Member + Survival lessons, use them only with blocks that your world permissions allow. Avoid command-like mob actions such as teleport, effect, kill, or execute unless the host has explicitly allowed them. MakeCode target selectors do not provide a clean count/boolean result, so block scans use `agent last count`, while mob selectors are passed into other allowed mob actions.

Communication blocks avoid chat and world commands so they work for Member + Survival players. `agent signal ...` uses Agent gestures. `agent mark ...` places one marker block from the selected Agent inventory slot: forward means success/ready, up means found, down means empty, left means blocked, back means no item, and right means invalid input.

`agent emerald power attack all directions` attacks forward, right, back, left, up, and down. Put emeralds in the selected Agent inventory slot before running it. The block drops one emerald behind the Agent for each five attacks, which removes it from the Agent inventory without using world commands. If the selected slot runs out, the action stops and `agent last error` becomes `no item`.

## Install in MakeCode

1. Open Minecraft Education Code Builder.
2. Create or open a MakeCode project.
3. Open **Extensions**.
4. Search for this exact URL:

```text
https://github.com/numraise/agent-survival-toolkit
```

MakeCode search results only show approved extensions. Until this repo is approved by MakeCode/Microsoft, use the exact URL above.

## Automated Testing

Run the local logic tests:

```sh
node tests/run-agent-survival-tests.js
```

These tests mock the MakeCode Agent API and verify the workflow logic without opening Minecraft Education. In-game verification is still needed for release testing because Minecraft world state, permissions, and inventory are runtime conditions.
