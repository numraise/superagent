enum AgentSurvivalError {
    //% block="none"
    None = 0,
    //% block="blocked"
    Blocked = 1,
    //% block="no item"
    NoItem = 2,
    //% block="invalid input"
    InvalidInput = 3
}

enum AgentSurvivalAxis {
    //% block="forward"
    Forward = 0,
    //% block="right"
    Right = 1,
    //% block="up"
    Up = 2
}

enum AgentSurvivalDirection {
    //% block="forward"
    Forward = 0,
    //% block="back"
    Back = 1,
    //% block="left"
    Left = 2,
    //% block="right"
    Right = 3,
    //% block="up"
    Up = 4,
    //% block="down"
    Down = 5
}

enum AgentSurvivalScanTarget {
    //% block="any block"
    AnyBlock = 0,
    //% block="water"
    Water = 1,
    //% block="lava"
    Lava = 2
}

enum AgentSurvivalSignal {
    //% block="ready"
    Ready = 0,
    //% block="success"
    Success = 1,
    //% block="found"
    Found = 2,
    //% block="empty"
    Empty = 3,
    //% block="blocked"
    Blocked = 4,
    //% block="no item"
    NoItem = 5,
    //% block="invalid input"
    InvalidInput = 6
}

/**
 * Advanced workflow blocks for the Minecraft Education Agent in survival play.
 */
//% weight=95 color=#2d7d46 icon="\uf6ec" block="Agent Survival"
namespace agentSurvival {
    let lastError = AgentSurvivalError.None
    let lastCount = 0

    const AIR = 0
    const WATER = 9
    const STILL_WATER = 8
    const LAVA = 11
    const STILL_LAVA = 10
    const GRASS = 2
    const DIRT = 3
    const FARMLAND = 60
    const MYCELIUM = 110
    const GRASS_PATH = 198
    const PODZOL = 243

    function clamp(value: number, min: number, max: number): number {
        if (value < min) {
            return min
        }
        if (value > max) {
            return max
        }
        return value
    }

    function resetResult() {
        lastError = AgentSurvivalError.None
        lastCount = 0
    }

    function remember(error: AgentSurvivalError) {
        lastError = error
    }

    function blockAt(direction: number): number {
        return agent.inspect(AgentInspection.Block, direction)
    }

    function offsetFromAgent(x: number, y: number, z: number): Position {
        return positions.add(agent.getPosition(), pos(x, y, z))
    }

    function scanMatches(target: AgentSurvivalScanTarget, p: Position): boolean {
        if (target == AgentSurvivalScanTarget.Water) {
            return blocks.testForBlock(WATER, p) || blocks.testForBlock(STILL_WATER, p)
        }
        if (target == AgentSurvivalScanTarget.Lava) {
            return blocks.testForBlock(LAVA, p) || blocks.testForBlock(STILL_LAVA, p)
        }
        return !blocks.testForBlock(AIR, p)
    }

    function mobsNearAgentFamily(radius: number, family: string): TargetSelector {
        radius = clamp(radius, 1, 64)
        let selected = mobs.target(ALL_ENTITIES)
        selected.atCoordinate(agent.getPosition())
        selected.withinRadius(radius)
        selected.addRule("family", family)
        return selected
    }

    function isSoilBlock(blockId: number): boolean {
        return blockId == DIRT
            || blockId == GRASS
            || blockId == FARMLAND
            || blockId == MYCELIUM
            || blockId == GRASS_PATH
            || blockId == PODZOL
    }

    function turnAroundInternal() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Left)
    }

    function destroyIfPresent(direction: number): boolean {
        if (!agent.detect(AgentDetection.Block, direction)) {
            return false
        }
        agent.destroy(direction)
        agent.collectAll()
        return true
    }

    function destroySoilIfPresent(direction: number): boolean {
        if (!agent.detect(AgentDetection.Block, direction)) {
            return false
        }
        if (!isSoilBlock(blockAt(direction))) {
            return false
        }
        agent.destroy(direction)
        agent.collectAll()
        lastCount++
        return true
    }

    function moveThrough(direction: number, soilOnly: boolean): boolean {
        if (agent.detect(AgentDetection.Block, direction)) {
            let cleared = soilOnly ? destroySoilIfPresent(direction) : destroyIfPresent(direction)
            if (!cleared && agent.detect(AgentDetection.Block, direction)) {
                remember(AgentSurvivalError.Blocked)
                return false
            }
        }
        agent.move(direction, 1)
        return true
    }

    function axisDirection(axis: AgentSurvivalAxis, negative: boolean): number {
        if (axis == AgentSurvivalAxis.Right) {
            return negative ? LEFT : RIGHT
        }
        if (axis == AgentSurvivalAxis.Up) {
            return negative ? DOWN : UP
        }
        return negative ? BACK : FORWARD
    }

    function directDirection(direction: AgentSurvivalDirection): number {
        if (direction == AgentSurvivalDirection.Back) {
            return BACK
        }
        if (direction == AgentSurvivalDirection.Left) {
            return LEFT
        }
        if (direction == AgentSurvivalDirection.Right) {
            return RIGHT
        }
        if (direction == AgentSurvivalDirection.Up) {
            return UP
        }
        if (direction == AgentSurvivalDirection.Down) {
            return DOWN
        }
        return FORWARD
    }

    function signalFromError(error: AgentSurvivalError): AgentSurvivalSignal {
        if (error == AgentSurvivalError.Blocked) {
            return AgentSurvivalSignal.Blocked
        }
        if (error == AgentSurvivalError.NoItem) {
            return AgentSurvivalSignal.NoItem
        }
        if (error == AgentSurvivalError.InvalidInput) {
            return AgentSurvivalSignal.InvalidInput
        }
        return AgentSurvivalSignal.Success
    }

    function signalDirection(signal: AgentSurvivalSignal): number {
        if (signal == AgentSurvivalSignal.Blocked) {
            return LEFT
        }
        if (signal == AgentSurvivalSignal.NoItem) {
            return BACK
        }
        if (signal == AgentSurvivalSignal.InvalidInput) {
            return RIGHT
        }
        if (signal == AgentSurvivalSignal.Empty) {
            return DOWN
        }
        if (signal == AgentSurvivalSignal.Found) {
            return UP
        }
        return FORWARD
    }

    function gestureSignal(signal: AgentSurvivalSignal) {
        if (signal == AgentSurvivalSignal.Blocked) {
            agent.turn(TurnDirection.Left)
            agent.turn(TurnDirection.Left)
            return
        }
        if (signal == AgentSurvivalSignal.NoItem) {
            agent.turn(TurnDirection.Right)
            agent.turn(TurnDirection.Right)
            return
        }
        if (signal == AgentSurvivalSignal.InvalidInput) {
            agent.turn(TurnDirection.Left)
            agent.turn(TurnDirection.Right)
            agent.turn(TurnDirection.Left)
            agent.turn(TurnDirection.Right)
            return
        }
        if (signal == AgentSurvivalSignal.Empty) {
            agent.attack(DOWN)
            return
        }
        if (signal == AgentSurvivalSignal.Found) {
            agent.attack(UP)
            return
        }
        agent.attack(FORWARD)
    }

    function clearGesture() {
        agent.attack(UP)
        agent.attack(DOWN)
    }

    function showFoundGesture() {
        agent.attack(UP)
        agent.attack(UP)
        agent.attack(UP)
    }

    function showEmptyGesture() {
        agent.attack(DOWN)
        agent.attack(DOWN)
        agent.attack(DOWN)
    }

    function showBlockedGesture() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Left)
    }

    function showNoGesture() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
    }

    function showSignalGesture(signal: AgentSurvivalSignal) {
        if (signal == AgentSurvivalSignal.Found) {
            showFoundGesture()
            return
        }
        if (signal == AgentSurvivalSignal.Empty) {
            showEmptyGesture()
            return
        }
        if (signal == AgentSurvivalSignal.Blocked || signal == AgentSurvivalSignal.InvalidInput) {
            showBlockedGesture()
            return
        }
        if (signal == AgentSurvivalSignal.NoItem) {
            showNoGesture()
            return
        }
        clearGesture()
    }

    function placeIfEmpty(direction: number, slot: number): boolean {
        if (agent.detect(AgentDetection.Block, direction)) {
            return false
        }
        if (!hasEnough(slot, 1)) {
            remember(AgentSurvivalError.NoItem)
            return false
        }
        agent.setSlot(slot)
        agent.place(direction)
        return true
    }

    function moveAndPlaceLine(slot: number, length: number, placeDirection: number): number {
        let placed = 0
        for (let i = 0; i < length; i++) {
            if (placeIfEmpty(placeDirection, slot)) {
                placed++
            } else if (lastError == AgentSurvivalError.NoItem) {
                break
            }
            if (i < length - 1) {
                agent.move(FORWARD, 1)
            }
        }
        return placed
    }

    function backtrackInternal(steps: number) {
        turnAroundInternal()
        agent.move(FORWARD, steps)
        turnAroundInternal()
    }

    function attackDirection(direction: number, hits: number) {
        hits = clamp(hits, 1, 32)
        for (let i = 0; i < hits; i++) {
            agent.attack(direction)
            lastCount++
        }
    }

    function spendEmeraldCharge(slot: number): boolean {
        if (!hasEnough(slot, 1)) {
            remember(AgentSurvivalError.NoItem)
            return false
        }
        agent.drop(BACK, slot, 1)
        return true
    }

    function powerAttackDirection(direction: number, hits: number, emeraldSlot: number): boolean {
        for (let i = 0; i < hits; i++) {
            if (lastCount % 5 == 0 && !spendEmeraldCharge(emeraldSlot)) {
                return false
            }
            agent.attack(direction)
            lastCount++
        }
        return true
    }

    function clearTunnelFace(width: number, height: number): number {
        let cleared = 0
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (destroyIfPresent(FORWARD)) {
                    cleared++
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
        return cleared
    }

    function moveToCubeCell(currentX: number, currentY: number, currentZ: number, targetX: number, targetY: number, targetZ: number): boolean {
        while (currentX < targetX) {
            if (!moveThrough(RIGHT, true)) {
                return false
            }
            currentX++
        }
        while (currentX > targetX) {
            if (!moveThrough(LEFT, true)) {
                return false
            }
            currentX--
        }
        while (currentZ < targetZ) {
            if (!moveThrough(FORWARD, true)) {
                return false
            }
            currentZ++
        }
        while (currentZ > targetZ) {
            if (!moveThrough(BACK, true)) {
                return false
            }
            currentZ--
        }
        while (currentY < targetY) {
            if (!moveThrough(UP, true)) {
                return false
            }
            currentY++
        }
        while (currentY > targetY) {
            if (!moveThrough(DOWN, true)) {
                return false
            }
            currentY--
        }
        return true
    }

    /**
     * Get the last reason an Agent Survival action stopped.
     */
    //% blockId=agent_survival_last_error block="agent last error"
    //% group="Status"
    export function reportLastError(): AgentSurvivalError {
        return lastError
    }

    /**
     * Get the number of blocks, steps, slices, or items handled by the last action.
     */
    //% blockId=agent_survival_last_count block="agent last count"
    //% group="Status"
    export function reportLastCount(): number {
        return lastCount
    }

    /**
     * Make a visible Agent gesture that works in Member + Survival worlds.
     */
    //% blockId=agent_survival_signal block="agent signal %signal"
    //% group="Communication"
    export function signal(signal: AgentSurvivalSignal) {
        resetResult()
        gestureSignal(signal)
        lastCount = 1
    }

    /**
     * Show a clear Agent response without chat or marker blocks.
     */
    //% blockId=agent_survival_show block="agent show %signal"
    //% group="Communication"
    export function show(signal: AgentSurvivalSignal) {
        resetResult()
        showSignalGesture(signal)
        lastCount = 1
    }

    /**
     * Show the most recent Agent Survival result with an easy Agent gesture.
     */
    //% blockId=agent_survival_show_last_result block="agent show last result"
    //% group="Communication"
    export function showLastResult() {
        let signal = signalFromError(lastError)
        resetResult()
        showSignalGesture(signal)
        lastCount = 1
    }

    /**
     * Show the most recent scan result with an easy Agent gesture.
     */
    //% blockId=agent_survival_show_scan_result block="agent show scan result"
    //% group="Communication"
    export function showScanResult() {
        let signal = lastCount > 0 ? AgentSurvivalSignal.Found : AgentSurvivalSignal.Empty
        resetResult()
        showSignalGesture(signal)
        lastCount = 1
    }

    /**
     * Show whether an Agent inventory slot has enough items.
     */
    //% blockId=agent_survival_show_inventory_check block="agent show inventory slot %slot has at least %amount"
    //% slot.min=1 slot.max=27 amount.min=1 amount.max=64
    //% group="Communication"
    export function showInventoryCheck(slot: number, amount: number) {
        slot = clamp(slot, 1, 27)
        amount = clamp(amount, 1, 64)
        resetResult()
        showSignalGesture(hasEnough(slot, amount) ? AgentSurvivalSignal.Success : AgentSurvivalSignal.NoItem)
        lastCount = 1
    }

    /**
     * Mark a signal by placing one marker block from the selected Agent slot. Direction shows the signal.
     */
    //% blockId=agent_survival_mark_signal block="agent mark %signal using slot %slot"
    //% slot.min=1 slot.max=27
    //% group="Communication"
    //% deprecated=true
    export function markSignal(signal: AgentSurvivalSignal, slot: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        let direction = signalDirection(signal)
        if (agent.detect(AgentDetection.Block, direction)) {
            remember(AgentSurvivalError.Blocked)
            return
        }
        if (placeIfEmpty(direction, slot)) {
            lastCount = 1
        }
    }

    /**
     * Mark the most recent Agent Survival result with a marker block from the selected Agent slot.
     */
    //% blockId=agent_survival_mark_last_result block="agent mark last result using slot %slot"
    //% slot.min=1 slot.max=27
    //% group="Communication"
    //% deprecated=true
    export function markLastResult(slot: number) {
        markSignal(signalFromError(lastError), slot)
    }

    /**
     * Mark the most recent scan result with a marker block from the selected Agent slot.
     */
    //% blockId=agent_survival_mark_scan_result block="agent mark scan result using slot %slot"
    //% slot.min=1 slot.max=27
    //% group="Communication"
    //% deprecated=true
    export function markScanResult(slot: number) {
        markSignal(lastCount > 0 ? AgentSurvivalSignal.Found : AgentSurvivalSignal.Empty, slot)
    }

    /**
     * Mark whether an Agent inventory slot has enough items.
     */
    //% blockId=agent_survival_mark_inventory_check block="agent mark inventory slot %checkSlot has at least %amount using marker slot %markerSlot"
    //% checkSlot.min=1 checkSlot.max=27 amount.min=1 amount.max=64 markerSlot.min=1 markerSlot.max=27
    //% group="Communication"
    //% deprecated=true
    export function markInventoryCheck(checkSlot: number, amount: number, markerSlot: number) {
        checkSlot = clamp(checkSlot, 1, 27)
        amount = clamp(amount, 1, 64)
        markSignal(hasEnough(checkSlot, amount) ? AgentSurvivalSignal.Success : AgentSurvivalSignal.NoItem, markerSlot)
    }

    /**
     * Compatibility block. In Member + Survival it uses an Agent ready gesture instead of chat.
     */
    //% blockId=agent_survival_say block="agent say %message"
    //% message.defl="ready"
    //% group="Communication"
    //% deprecated=true
    export function say(message: string) {
        signal(AgentSurvivalSignal.Ready)
    }

    /**
     * Compatibility block. In Member + Survival it gestures the result instead of chat.
     */
    //% blockId=agent_survival_say_last_result block="agent report last result"
    //% group="Communication"
    //% deprecated=true
    export function sayLastResult() {
        signal(signalFromError(lastError))
    }

    /**
     * Compatibility block. In Member + Survival it gestures found/empty instead of chat.
     */
    //% blockId=agent_survival_say_scan_result block="agent report scan result for %target"
    //% group="Communication"
    //% deprecated=true
    export function sayScanResult(target: AgentSurvivalScanTarget) {
        signal(lastCount > 0 ? AgentSurvivalSignal.Found : AgentSurvivalSignal.Empty)
    }

    /**
     * Compatibility block. In Member + Survival it gestures success/no item instead of chat.
     */
    //% blockId=agent_survival_say_inventory_slot block="agent report inventory slot %slot"
    //% slot.min=1 slot.max=27
    //% group="Communication"
    //% deprecated=true
    export function sayInventorySlot(slot: number) {
        slot = clamp(slot, 1, 27)
        signal(hasEnough(slot, 1) ? AgentSurvivalSignal.Success : AgentSurvivalSignal.NoItem)
    }

    /**
     * True when the selected Agent slot has at least the requested item count.
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
     * Scan a configurable cube around the Agent for blocks, water, or lava.
     */
    //% blockId=agent_survival_scan_blocks_around block="agent scan %target around radius %radius height %height"
    //% radius.min=1 radius.max=32 height.min=0 height.max=16
    //% group="Detection"
    export function scanBlocksAround(target: AgentSurvivalScanTarget, radius: number, height: number) {
        resetResult()
        radius = clamp(radius, 1, 32)
        height = clamp(height, 0, 16)
        for (let x = 0 - radius; x <= radius; x++) {
            for (let y = 0 - height; y <= height; y++) {
                for (let z = 0 - radius; z <= radius; z++) {
                    if (scanMatches(target, offsetFromAgent(x, y, z))) {
                        lastCount++
                    }
                }
            }
        }
    }

    /**
     * True if the most recent scan found at least one matching block.
     */
    //% blockId=agent_survival_scan_found block="agent scan found target"
    //% group="Detection"
    export function scanFound(): boolean {
        return lastCount > 0
    }

    /**
     * Build a selector for passive animal mobs near the Agent.
     */
    //% blockId=agent_survival_passive_mobs_near block="passive mobs near agent radius %radius"
    //% radius.min=1 radius.max=64
    //% group="Detection"
    export function passiveMobsNearAgent(radius: number): TargetSelector {
        return mobsNearAgentFamily(radius, "animal")
    }

    /**
     * Build a selector for hostile monster mobs near the Agent.
     */
    //% blockId=agent_survival_hostile_mobs_near block="hostile mobs near agent radius %radius"
    //% radius.min=1 radius.max=64
    //% group="Detection"
    export function hostileMobsNearAgent(radius: number): TargetSelector {
        return mobsNearAgentFamily(radius, "monster")
    }

    /**
     * Collect nearby drops and store the pickup count as one completed action.
     */
    //% blockId=agent_survival_collect_drops block="agent collect drops"
    //% group="Inventory"
    export function collectDrops() {
        resetResult()
        agent.collectAll()
        lastCount = 1
    }

    /**
     * Move forward without safety checks.
     */
    //% blockId=agent_survival_stride_forward block="agent stride forward %steps steps"
    //% steps.min=1 steps.max=128
    //% group="Movement"
    export function strideForward(steps: number) {
        resetResult()
        steps = clamp(steps, 1, 128)
        agent.move(FORWARD, steps)
        lastCount = steps
    }

    /**
     * Turn around, move back, then face the original direction.
     */
    //% blockId=agent_survival_backtrack block="agent backtrack %steps steps"
    //% steps.min=1 steps.max=128
    //% group="Movement"
    export function backtrack(steps: number) {
        resetResult()
        steps = clamp(steps, 1, 128)
        backtrackInternal(steps)
        lastCount = steps
    }

    /**
     * Attack one direct direction multiple times.
     */
    //% blockId=agent_survival_strike_direction block="agent strike %direction hits %hits"
    //% hits.min=1 hits.max=32
    //% group="Combat"
    export function strikeDirection(direction: AgentSurvivalDirection, hits: number) {
        resetResult()
        attackDirection(directDirection(direction), hits)
    }

    /**
     * Attack one axis direction multiple times.
     */
    //% blockId=agent_survival_strike_axis block="agent strike %axis negative %negative hits %hits"
    //% hits.min=1 hits.max=32
    //% group="Combat"
    //% deprecated=true
    export function strikeAxis(axis: AgentSurvivalAxis, negative: boolean, hits: number) {
        strikeDirection(axisDirection(axis, negative), hits)
    }

    /**
     * Attack forward, right, back, and left without moving.
     */
    //% blockId=agent_survival_sweep_attack block="agent sweep attack hits %hits"
    //% hits.min=1 hits.max=16
    //% group="Combat"
    export function sweepAttack(hits: number) {
        resetResult()
        hits = clamp(hits, 1, 16)
        attackDirection(FORWARD, hits)
        attackDirection(RIGHT, hits)
        attackDirection(BACK, hits)
        attackDirection(LEFT, hits)
    }

    /**
     * Attack low, middle, and high in front of the Agent.
     */
    //% blockId=agent_survival_vertical_combo block="agent vertical combo hits %hits"
    //% hits.min=1 hits.max=16
    //% group="Combat"
    export function verticalCombo(hits: number) {
        resetResult()
        hits = clamp(hits, 1, 16)
        attackDirection(DOWN, hits)
        attackDirection(FORWARD, hits)
        attackDirection(UP, hits)
    }

    /**
     * Attack forward, move forward, and repeat.
     */
    //% blockId=agent_survival_charge_attack block="agent charge attack steps %steps hits %hits"
    //% steps.min=1 steps.max=64 hits.min=1 hits.max=16
    //% group="Combat"
    export function chargeAttack(steps: number, hits: number) {
        resetResult()
        steps = clamp(steps, 1, 64)
        hits = clamp(hits, 1, 16)
        for (let i = 0; i < steps; i++) {
            attackDirection(FORWARD, hits)
            agent.move(FORWARD, 1)
        }
    }

    /**
     * Attack along a forward line, then return to the starting position.
     */
    //% blockId=agent_survival_lunge_attack block="agent lunge attack range %range hits %hits and return"
    //% range.min=1 range.max=16 hits.min=1 hits.max=16
    //% group="Combat"
    export function lungeAttack(range: number, hits: number) {
        resetResult()
        range = clamp(range, 1, 16)
        hits = clamp(hits, 1, 16)
        for (let i = 0; i < range; i++) {
            attackDirection(FORWARD, hits)
            if (i < range - 1) {
                agent.move(FORWARD, 1)
            }
        }
        if (range > 1) {
            backtrackInternal(range - 1)
        }
    }

    /**
     * Attack forward, step backward, and repeat.
     */
    //% blockId=agent_survival_retreat_attack block="agent retreat attack steps %steps hits %hits"
    //% steps.min=1 steps.max=64 hits.min=1 hits.max=16
    //% group="Combat"
    export function retreatAttack(steps: number, hits: number) {
        resetResult()
        steps = clamp(steps, 1, 64)
        hits = clamp(hits, 1, 16)
        for (let i = 0; i < steps; i++) {
            attackDirection(FORWARD, hits)
            agent.move(BACK, 1)
        }
    }

    /**
     * Attack every adjacent direction for several rounds.
     */
    //% blockId=agent_survival_guard_area block="agent guard area rounds %rounds hits %hits"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8
    //% group="Combat"
    export function guardArea(rounds: number, hits: number) {
        resetResult()
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        for (let i = 0; i < rounds; i++) {
            attackDirection(FORWARD, hits)
            attackDirection(RIGHT, hits)
            attackDirection(BACK, hits)
            attackDirection(LEFT, hits)
            attackDirection(UP, hits)
            attackDirection(DOWN, hits)
        }
    }

    /**
     * Attack all six directions with emerald-powered bursts. One emerald is dropped from the selected slot for each five attacks.
     */
    //% blockId=agent_survival_emerald_power_attack block="agent emerald power attack all directions rounds %rounds hits %hits emerald slot %emeraldSlot"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8 emeraldSlot.min=1 emeraldSlot.max=27
    //% group="Combat"
    export function emeraldPowerAttack(rounds: number, hits: number, emeraldSlot: number) {
        resetResult()
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        emeraldSlot = clamp(emeraldSlot, 1, 27)
        for (let i = 0; i < rounds; i++) {
            if (!powerAttackDirection(FORWARD, hits, emeraldSlot)) return
            if (!powerAttackDirection(RIGHT, hits, emeraldSlot)) return
            if (!powerAttackDirection(BACK, hits, emeraldSlot)) return
            if (!powerAttackDirection(LEFT, hits, emeraldSlot)) return
            if (!powerAttackDirection(UP, hits, emeraldSlot)) return
            if (!powerAttackDirection(DOWN, hits, emeraldSlot)) return
        }
    }

    /**
     * Dig one block in the selected direct direction.
     */
    //% blockId=agent_survival_dig_direction block="agent dig %direction"
    //% group="Mining"
    export function digDirection(direction: AgentSurvivalDirection) {
        resetResult()
        if (destroyIfPresent(directDirection(direction))) {
            lastCount = 1
        }
    }

    /**
     * Dig one block in the selected axis and direction.
     */
    //% blockId=agent_survival_dig_axis block="agent dig %axis negative %negative"
    //% group="Mining"
    //% deprecated=true
    export function digAxis(axis: AgentSurvivalAxis, negative: boolean) {
        digDirection(axisDirection(axis, negative))
    }

    /**
     * Dig forward, collect, and move into the cleared space for a straight drill.
     */
    //% blockId=agent_survival_drill_line block="agent drill line length %length"
    //% length.min=1 length.max=128
    //% group="Mining"
    export function drillLine(length: number) {
        resetResult()
        length = clamp(length, 1, 128)
        for (let i = 0; i < length; i++) {
            destroyIfPresent(FORWARD)
            agent.collectAll()
            agent.move(FORWARD, 1)
            lastCount++
        }
    }

    /**
     * Mine a rectangular tunnel face, then advance one slice at a time.
     */
    //% blockId=agent_survival_quarry_tunnel block="agent quarry tunnel length %length width %width height %height"
    //% length.min=1 length.max=64 width.min=1 width.max=7 height.min=1 height.max=7
    //% group="Mining"
    export function quarryTunnel(length: number, width: number, height: number) {
        resetResult()
        length = clamp(length, 1, 64)
        width = clamp(width, 1, 7)
        height = clamp(height, 1, 7)
        for (let i = 0; i < length; i++) {
            clearTunnelFace(width, height)
            agent.move(FORWARD, 1)
            lastCount++
        }
    }

    /**
     * Mine a staircase down.
     */
    //% blockId=agent_survival_stair_mine_down block="agent stair mine down depth %depth"
    //% depth.min=1 depth.max=64
    //% group="Mining"
    export function stairMineDown(depth: number) {
        resetResult()
        depth = clamp(depth, 1, 64)
        for (let i = 0; i < depth; i++) {
            destroyIfPresent(FORWARD)
            agent.move(FORWARD, 1)
            destroyIfPresent(DOWN)
            agent.move(DOWN, 1)
            agent.collectAll()
            lastCount++
        }
    }

    /**
     * Strip mine a main tunnel with left and right branch cuts.
     */
    //% blockId=agent_survival_strip_mine block="agent strip mine length %length branch length %branchLength every %spacing"
    //% length.min=1 length.max=128 branchLength.min=1 branchLength.max=64 spacing.min=1 spacing.max=16
    //% group="Mining"
    export function stripMine(length: number, branchLength: number, spacing: number) {
        resetResult()
        length = clamp(length, 1, 128)
        branchLength = clamp(branchLength, 1, 64)
        spacing = clamp(spacing, 1, 16)
        for (let i = 0; i < length; i++) {
            destroyIfPresent(FORWARD)
            agent.move(FORWARD, 1)
            lastCount++
            if ((i + 1) % spacing == 0) {
                agent.turn(TurnDirection.Left)
                for (let left = 0; left < branchLength; left++) {
                    destroyIfPresent(FORWARD)
                    agent.move(FORWARD, 1)
                    lastCount++
                }
                backtrackInternal(branchLength)
                agent.turn(TurnDirection.Right)
                agent.turn(TurnDirection.Right)
                for (let right = 0; right < branchLength; right++) {
                    destroyIfPresent(FORWARD)
                    agent.move(FORWARD, 1)
                    lastCount++
                }
                backtrackInternal(branchLength)
                agent.turn(TurnDirection.Left)
            }
        }
    }

    /**
     * Clear soil blocks in a 3 x 3 x 3 cube around the Agent and return near the start.
     */
    //% blockId=agent_survival_clear_dirt_cube block="agent clear dirt cube 3 x 3 x 3"
    //% group="Mining"
    export function clearDirtCube3() {
        resetResult()
        let x = 0
        let y = 0
        let z = 0
        for (let layer = -1; layer <= 1; layer++) {
            let rows = layer % 2 == 0 ? [-1, 0, 1] : [1, 0, -1]
            for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
                let targetZ = rows[rowIndex]
                let columns = rowIndex % 2 == 0 ? [-1, 0, 1] : [1, 0, -1]
                for (let columnIndex = 0; columnIndex < 3; columnIndex++) {
                    let targetX = columns[columnIndex]
                    if (moveToCubeCell(x, y, z, targetX, layer, targetZ)) {
                        x = targetX
                        y = layer
                        z = targetZ
                    } else {
                        moveToCubeCell(x, y, z, 0, 0, 0)
                        return
                    }
                }
            }
        }
        moveToCubeCell(x, y, z, 0, 0, 0)
    }

    /**
     * Place blocks below the Agent while moving forward.
     */
    //% blockId=agent_survival_lay_path block="agent lay path using slot %slot length %length"
    //% slot.min=1 slot.max=27 length.min=1 length.max=128
    //% group="Building"
    export function layPath(slot: number, length: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        length = clamp(length, 1, 128)
        lastCount = moveAndPlaceLine(slot, length, DOWN)
    }

    /**
     * Build a flat platform using blocks from the selected Agent slot.
     */
    //% blockId=agent_survival_build_platform block="agent build platform using slot %slot width %width depth %depth"
    //% slot.min=1 slot.max=27 width.min=1 width.max=32 depth.min=1 depth.max=32
    //% group="Building"
    export function buildPlatform(slot: number, width: number, depth: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        width = clamp(width, 1, 32)
        depth = clamp(depth, 1, 32)
        for (let z = 0; z < depth; z++) {
            lastCount += moveAndPlaceLine(slot, width, DOWN)
            if (lastError == AgentSurvivalError.NoItem) {
                return
            }
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
    }

    /**
     * Build a vertical wall in front of the Agent.
     */
    //% blockId=agent_survival_build_wall block="agent build wall using slot %slot width %width height %height"
    //% slot.min=1 slot.max=27 width.min=1 width.max=32 height.min=1 height.max=16
    //% group="Building"
    export function buildWall(slot: number, width: number, height: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        width = clamp(width, 1, 32)
        height = clamp(height, 1, 16)
        agent.setSlot(slot)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!hasEnough(slot, 1)) {
                    remember(AgentSurvivalError.NoItem)
                    return
                }
                agent.place(FORWARD)
                lastCount++
                if (x < width - 1) {
                    agent.move(RIGHT, 1)
                }
            }
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
    }

    /**
     * Build a bridge by placing blocks below while advancing.
     */
    //% blockId=agent_survival_build_bridge block="agent build bridge using slot %slot length %length width %width"
    //% slot.min=1 slot.max=27 length.min=1 length.max=128 width.min=1 width.max=7
    //% group="Building"
    export function buildBridge(slot: number, length: number, width: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        length = clamp(length, 1, 128)
        width = clamp(width, 1, 7)
        for (let i = 0; i < length; i++) {
            for (let x = 0; x < width; x++) {
                if (placeIfEmpty(DOWN, slot)) {
                    lastCount++
                } else if (lastError == AgentSurvivalError.NoItem) {
                    return
                }
                if (x < width - 1) {
                    agent.move(RIGHT, 1)
                }
            }
            for (let xBack = 0; xBack < width - 1; xBack++) {
                agent.move(LEFT, 1)
            }
            if (i < length - 1) {
                agent.move(FORWARD, 1)
            }
        }
    }

    /**
     * Fill a 3D box with blocks from the selected slot. The Agent starts at the lower-left-front corner.
     */
    //% blockId=agent_survival_fill_box block="agent fill box using slot %slot width %width height %height depth %depth"
    //% slot.min=1 slot.max=27 width.min=1 width.max=16 height.min=1 height.max=16 depth.min=1 depth.max=16
    //% group="Building"
    export function fillBox(slot: number, width: number, height: number, depth: number) {
        resetResult()
        slot = clamp(slot, 1, 27)
        width = clamp(width, 1, 16)
        height = clamp(height, 1, 16)
        depth = clamp(depth, 1, 16)
        agent.setSlot(slot)
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    if (placeIfEmpty(DOWN, slot)) {
                        lastCount++
                    } else if (lastError == AgentSurvivalError.NoItem) {
                        return
                    }
                    if (x < width - 1) {
                        agent.move(RIGHT, 1)
                    }
                }
                for (let xBack = 0; xBack < width - 1; xBack++) {
                    agent.move(LEFT, 1)
                }
                if (z < depth - 1) {
                    agent.move(FORWARD, 1)
                }
            }
            for (let zBack = 0; zBack < depth - 1; zBack++) {
                agent.move(BACK, 1)
            }
            if (y < height - 1) {
                agent.move(UP, 1)
            }
        }
        for (let yBack = 0; yBack < height - 1; yBack++) {
            agent.move(DOWN, 1)
        }
    }
}
