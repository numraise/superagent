enum AgentSurvivalError {
    //% block="none"
    None = 0,
    //% block="blocked"
    Blocked = 1,
    //% block="unsafe"
    Unsafe = 2,
    //% block="no item"
    NoItem = 3,
    //% block="invalid input"
    InvalidInput = 4
}

/**
 * Survival-safe workflow blocks for the Minecraft Education Agent.
 */
//% weight=95 color=#2d7d46 icon="\uf6ec" block="Agent Survival"
namespace agentSurvival {
    let lastError = AgentSurvivalError.None

    const AIR = 0
    const WATER = 9
    const STILL_WATER = 8
    const LAVA = 11
    const STILL_LAVA = 10
    const FIRE = 51
    const CACTUS = 81
    const MAGMA = 213
    const CAMPFIRE = 720
    const SOUL_CAMPFIRE = 721

    function clamp(value: number, min: number, max: number): number {
        if (value < min) {
            return min
        }
        if (value > max) {
            return max
        }
        return value
    }

    function remember(error: AgentSurvivalError): AgentSurvivalError {
        lastError = error
        return error
    }

    function blockAt(direction: number): number {
        return agent.inspect(AgentInspection.Block, direction)
    }

    function isHazardBlock(blockId: number): boolean {
        return blockId == WATER
            || blockId == STILL_WATER
            || blockId == LAVA
            || blockId == STILL_LAVA
            || blockId == FIRE
            || blockId == CACTUS
            || blockId == MAGMA
            || blockId == CAMPFIRE
            || blockId == SOUL_CAMPFIRE
    }

    function hasSafeFloor(): boolean {
        return agent.detect(AgentDetection.Block, DOWN) && !isHazardBlock(blockAt(DOWN))
    }

    function frontIsSafeToEnter(): boolean {
        return !agent.detect(AgentDetection.Block, FORWARD) && !isHazardBlock(blockAt(FORWARD)) && hasSafeFloor()
    }

    function clearFrontIfSafe(): boolean {
        if (!agent.detect(AgentDetection.Block, FORWARD)) {
            return true
        }
        if (isHazardBlock(blockAt(FORWARD))) {
            remember(AgentSurvivalError.Unsafe)
            return false
        }
        agent.destroy(FORWARD)
        agent.collectAll()
        return true
    }

    function turnAroundInternal() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Left)
    }

    function resetError() {
        lastError = AgentSurvivalError.None
    }

    /**
     * Get the last reason a survival workflow stopped.
     */
    //% blockId=agent_survival_last_error block="agent survival last error"
    //% group="Status"
    export function reportLastError(): AgentSurvivalError {
        return lastError
    }

    /**
     * True if the selected Agent slot has at least the requested item count.
     */
    //% blockId=agent_survival_has_enough block="agent has at least %amount items in slot %slot"
    //% slot.min=1 slot.max=27 amount.min=1 amount.max=64
    //% group="Inventory"
    export function hasEnough(slot: number, amount: number): boolean {
        slot = clamp(slot, 1, 27)
        amount = clamp(amount, 1, 64)
        return agent.getItemCount(slot) >= amount
    }

    /**
     * Move forward while checking for floor, hazards, and blocking blocks.
     */
    //% blockId=agent_survival_move_safe block="agent move safely %steps steps"
    //% steps.min=0 steps.max=64
    //% group="Movement"
    export function moveSafe(steps: number): number {
        resetError()
        steps = clamp(steps, 0, 64)
        let moved = 0
        for (let i = 0; i < steps; i++) {
            if (!frontIsSafeToEnter()) {
                remember(detectHazardNear() ? AgentSurvivalError.Unsafe : AgentSurvivalError.Blocked)
                break
            }
            agent.move(FORWARD, 1)
            moved++
        }
        return moved
    }

    /**
     * Move forward until blocked or unsafe, up to the limit.
     */
    //% blockId=agent_survival_move_until_blocked block="agent move until blocked max %maxSteps steps"
    //% maxSteps.min=1 maxSteps.max=128
    //% group="Movement"
    export function moveUntilBlocked(maxSteps: number): number {
        return moveSafe(clamp(maxSteps, 1, 128))
    }

    /**
     * Turn around, safely walk back, then face the original direction.
     */
    //% blockId=agent_survival_backtrack block="agent backtrack %steps steps"
    //% steps.min=1 steps.max=64
    //% group="Movement"
    export function backtrack(steps: number): number {
        turnAroundInternal()
        let moved = moveSafe(clamp(steps, 1, 64))
        turnAroundInternal()
        return moved
    }

    /**
     * Check nearby blocks that commonly make survival automation dangerous.
     */
    //% blockId=agent_survival_detect_hazard block="agent detects hazard nearby"
    //% group="Safety"
    export function detectHazardNear(): boolean {
        return isHazardBlock(blockAt(FORWARD))
            || isHazardBlock(blockAt(DOWN))
            || isHazardBlock(blockAt(LEFT))
            || isHazardBlock(blockAt(RIGHT))
    }

    /**
     * Returns true when the Agent should stop before continuing.
     */
    //% blockId=agent_survival_stop_if_unsafe block="agent should stop if unsafe"
    //% group="Safety"
    export function stopIfUnsafe(): boolean {
        if (detectHazardNear() || !hasSafeFloor()) {
            remember(AgentSurvivalError.Unsafe)
            return true
        }
        return false
    }

    /**
     * Destroy the block in front only when it is not a known hazard.
     */
    //% blockId=agent_survival_dig_forward_safe block="agent dig forward safely"
    //% group="Mining"
    export function digForwardSafe(): boolean {
        resetError()
        return clearFrontIfSafe()
    }

    /**
     * Dig forward safely, then collect nearby drops.
     */
    //% blockId=agent_survival_dig_and_collect block="agent dig and collect"
    //% group="Mining"
    export function digAndCollect(): boolean {
        resetError()
        if (!clearFrontIfSafe()) {
            return false
        }
        agent.collectAll()
        return true
    }

    /**
     * Dig a one-block-wide line and move through it safely.
     */
    //% blockId=agent_survival_mine_line block="agent mine line length %length"
    //% length.min=1 length.max=128
    //% group="Mining"
    export function mineLine(length: number): number {
        resetError()
        length = clamp(length, 1, 128)
        let mined = 0
        for (let i = 0; i < length; i++) {
            if (!clearFrontIfSafe()) {
                break
            }
            if (moveSafe(1) != 1) {
                break
            }
            mined++
        }
        return mined
    }

    /**
     * Mine a rectangular tunnel face, moving forward one slice at a time.
     * The Agent starts at the lower-left corner of the tunnel face.
     */
    //% blockId=agent_survival_mine_tunnel block="agent mine tunnel length %length width %width height %height"
    //% length.min=1 length.max=64 width.min=1 width.max=5 height.min=1 height.max=5
    //% group="Mining"
    export function mineTunnel(length: number, width: number, height: number): number {
        resetError()
        length = clamp(length, 1, 64)
        width = clamp(width, 1, 5)
        height = clamp(height, 1, 5)
        let slices = 0
        for (let i = 0; i < length; i++) {
            if (!clearTunnelFace(width, height)) {
                break
            }
            if (moveSafe(1) != 1) {
                break
            }
            slices++
        }
        return slices
    }

    function clearTunnelFace(width: number, height: number): boolean {
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (!clearFrontIfSafe()) {
                    return false
                }
                if (y < height - 1) {
                    agent.move(UP, 1)
                }
            }
            for (let yBack = 0; yBack < height - 1; yBack++) {
                agent.move(DOWN, 1)
            }
            if (x < width - 1) {
                agent.move(RIGHT, 1)
            }
        }
        for (let xBack = 0; xBack < width - 1; xBack++) {
            agent.move(LEFT, 1)
        }
        return true
    }

    /**
     * Mine a simple staircase down. The Agent returns facing the same direction.
     */
    //% blockId=agent_survival_mine_stair_down block="agent mine stair down depth %depth"
    //% depth.min=1 depth.max=64
    //% group="Mining"
    export function mineStairDown(depth: number): number {
        resetError()
        depth = clamp(depth, 1, 64)
        let steps = 0
        for (let i = 0; i < depth; i++) {
            if (!clearFrontIfSafe()) {
                break
            }
            if (moveSafe(1) != 1) {
                break
            }
            if (isHazardBlock(blockAt(DOWN))) {
                remember(AgentSurvivalError.Unsafe)
                break
            }
            agent.destroy(DOWN)
            agent.collectAll()
            agent.move(DOWN, 1)
            steps++
        }
        return steps
    }

    /**
     * Clear a small rectangular volume. The Agent starts at the lower-left-front corner.
     */
    //% blockId=agent_survival_clear_small_area block="agent clear small area width %width height %height depth %depth"
    //% width.min=1 width.max=5 height.min=1 height.max=5 depth.min=1 depth.max=16
    //% group="Mining"
    export function clearSmallArea(width: number, height: number, depth: number): number {
        return mineTunnel(depth, width, height)
    }

    /**
     * Place blocks from a slot in a forward line.
     */
    //% blockId=agent_survival_place_line block="agent place line using slot %slot length %length"
    //% slot.min=1 slot.max=27 length.min=1 length.max=64
    //% group="Building"
    export function placeLine(slot: number, length: number): number {
        resetError()
        slot = clamp(slot, 1, 27)
        length = clamp(length, 1, 64)
        agent.setSlot(slot)
        let placed = 0
        for (let i = 0; i < length; i++) {
            if (!hasEnough(slot, 1)) {
                remember(AgentSurvivalError.NoItem)
                break
            }
            if (!agent.detect(AgentDetection.Block, DOWN)) {
                agent.place(DOWN)
                placed++
            }
            if (i < length - 1 && moveSafe(1) != 1) {
                break
            }
        }
        return placed
    }

    /**
     * Build a flat floor using real blocks from the selected Agent slot.
     */
    //% blockId=agent_survival_build_floor block="agent build floor using slot %slot width %width depth %depth"
    //% slot.min=1 slot.max=27 width.min=1 width.max=16 depth.min=1 depth.max=16
    //% group="Building"
    export function buildFloor(slot: number, width: number, depth: number): number {
        resetError()
        slot = clamp(slot, 1, 27)
        width = clamp(width, 1, 16)
        depth = clamp(depth, 1, 16)
        agent.setSlot(slot)
        let placed = 0
        for (let z = 0; z < depth; z++) {
            placed += placeLine(slot, width)
            if (z < depth - 1) {
                if (z % 2 == 0) {
                    agent.move(RIGHT, 1)
                    turnAroundInternal()
                } else {
                    agent.move(LEFT, 1)
                    turnAroundInternal()
                }
            }
        }
        return placed
    }

    /**
     * Build a vertical wall using real blocks from the selected Agent slot.
     */
    //% blockId=agent_survival_build_wall block="agent build wall using slot %slot width %width height %height"
    //% slot.min=1 slot.max=27 width.min=1 width.max=16 height.min=1 height.max=8
    //% group="Building"
    export function buildWall(slot: number, width: number, height: number): number {
        resetError()
        slot = clamp(slot, 1, 27)
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 8)
        agent.setSlot(slot)
        let placed = 0
        for (let y = 0; y < height; y++) {
            placed += placeWallRow(slot, width)
            if (y < height - 1) {
                for (let xBack = 0; xBack < width - 1; xBack++) {
                    agent.move(LEFT, 1)
                }
                agent.move(UP, 1)
            }
        }
        for (let yBack = 0; yBack < height - 1; yBack++) {
            agent.move(DOWN, 1)
        }
        for (let xBack = 0; xBack < width - 1; xBack++) {
            agent.move(LEFT, 1)
        }
        return placed
    }

    function placeWallRow(slot: number, width: number): number {
        let placed = 0
        for (let i = 0; i < width; i++) {
            if (!hasEnough(slot, 1)) {
                remember(AgentSurvivalError.NoItem)
                break
            }
            agent.place(FORWARD)
            placed++
            if (i < width - 1) {
                agent.move(RIGHT, 1)
            }
        }
        return placed
    }

    /**
     * Build a bridge by placing blocks below while moving forward safely.
     */
    //% blockId=agent_survival_build_bridge block="agent build bridge using slot %slot length %length width %width"
    //% slot.min=1 slot.max=27 length.min=1 length.max=64 width.min=1 width.max=5
    //% group="Building"
    export function buildBridge(slot: number, length: number, width: number): number {
        resetError()
        slot = clamp(slot, 1, 27)
        length = clamp(length, 1, 64)
        width = clamp(width, 1, 5)
        agent.setSlot(slot)
        let placed = 0
        for (let i = 0; i < length; i++) {
            for (let x = 0; x < width; x++) {
                if (!agent.detect(AgentDetection.Block, DOWN)) {
                    if (!hasEnough(slot, 1)) {
                        remember(AgentSurvivalError.NoItem)
                        return placed
                    }
                    agent.place(DOWN)
                    placed++
                }
                if (x < width - 1) {
                    agent.move(RIGHT, 1)
                }
            }
            for (let xBack = 0; xBack < width - 1; xBack++) {
                agent.move(LEFT, 1)
            }
            if (i < length - 1 && moveSafe(1) != 1) {
                break
            }
        }
        return placed
    }
}
