enum SuperagentBurstStyle {
    //% block="ring"
    Ring = 0,
    //% block="vertical"
    Vertical = 1,
    //% block="sphere"
    Sphere = 2
}

enum SuperagentStatus {
    //% block="ready"
    Ready = 0,
    //% block="attack"
    Attack = 1,
    //% block="shield"
    Shield = 2
}

enum SuperagentSmartMode {
    //% block="guard"
    Guard = 0,
    //% block="chase"
    Chase = 1,
    //% block="emergency"
    Emergency = 2
}

enum SuperagentMoveDirection {
    //% block="north"
    North = 0,
    //% block="east"
    East = 1,
    //% block="south"
    South = 2,
    //% block="west"
    West = 3,
    //% block="up"
    Up = 4,
    //% block="down"
    Down = 5
}

enum SuperagentSmartMoveMode {
    //% block="guard"
    Guard = 0,
    //% block="scout"
    Scout = 1,
    //% block="patrol"
    Patrol = 2,
    //% block="orbit"
    Orbit = 3,
    //% block="evade"
    Evade = 4,
    //% block="high ground"
    HighGround = 5,
    //% block="zigzag"
    Zigzag = 6,
    //% block="spiral"
    Spiral = 7
}

/**
 * Member-safe control blocks for the one-block superagent character.
 */
//% weight=96 color=#5a43b5 icon="\uf21e" block="superagent"
namespace superagent {
    let lastBurstCount = 0
    let followLoopStarted = false
    let followingAgent = false
    let superagentPosition = pos(0, 0, 0)

    function clamp(value: number, min: number, max: number): number {
        if (value < min) {
            return min
        }
        if (value > max) {
            return max
        }
        return value
    }

    function attackDirection(direction: number, hits: number) {
        for (let i = 0; i < hits; i++) {
            agent.attack(direction)
            lastBurstCount++
        }
    }

    function runAtAgent(command: string): boolean {
        return mobs.execute(mobs.target(LOCAL_PLAYER), agent.getPosition(), command)
    }

    function runAtSuperagent(command: string): boolean {
        return mobs.execute(mobs.target(LOCAL_PLAYER), superagentPosition, command)
    }

    function selectSuperagentNear(position, radius: number) {
        let selected = mobs.target(ALL_ENTITIES)
        selected.atCoordinate(position)
        selected.withinRadius(clamp(radius, 1, 256))
        selected.addRule("type", "superagent:superagent")
        return selected
    }

    function teleportCharacterFrom(oldPosition, newPosition) {
        mobs.teleportToPosition(selectSuperagentNear(oldPosition, 256), newPosition)
        mobs.teleportToPosition(selectSuperagentNear(newPosition, 32), newPosition)
    }

    function teleportCharacterTo(position) {
        let oldPosition = superagentPosition
        superagentPosition = position
        teleportCharacterFrom(oldPosition, superagentPosition)
    }

    function setSuperagentPosition(position) {
        teleportCharacterTo(position)
        ensureCharacter()
    }

    function directionOffset(direction: SuperagentMoveDirection, blocks: number) {
        blocks = clamp(blocks, 1, 32)
        if (direction == SuperagentMoveDirection.East) {
            return pos(blocks, 0, 0)
        }
        if (direction == SuperagentMoveDirection.South) {
            return pos(0, 0, blocks)
        }
        if (direction == SuperagentMoveDirection.West) {
            return pos(0 - blocks, 0, 0)
        }
        if (direction == SuperagentMoveDirection.Up) {
            return pos(0, blocks, 0)
        }
        if (direction == SuperagentMoveDirection.Down) {
            return pos(0, 0 - blocks, 0)
        }
        return pos(0, 0, 0 - blocks)
    }

    function ensureCharacter() {
        runAtSuperagent("execute unless entity @e[type=superagent:superagent,r=2] run summon superagent:superagent ~ ~ ~")
        mobs.teleportToPosition(selectSuperagentNear(superagentPosition, 256), superagentPosition)
        runAtSuperagent("effect @e[type=superagent:superagent,r=2,c=1] resistance 10 255 true")
        runAtSuperagent("effect @e[type=superagent:superagent,r=2,c=1] fire_resistance 10 1 true")
        showCharacterPulse()
    }

    function showCharacterPulse() {
        runAtSuperagent("particle superagent:agent_aura ~ ~0.5 ~")
        runAtSuperagent("particle superagent:agent_spark ~ ~1.1 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~0.65 ~0.2 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~-0.65 ~0.2 ~")
        runAtSuperagent("particle minecraft:basic_flame_particle ~ ~0.2 ~0.65")
        runAtSuperagent("particle minecraft:basic_flame_particle ~ ~0.2 ~-0.65")
    }

    function ensureFollowLoop() {
        if (followLoopStarted) {
            return
        }
        followLoopStarted = true
        loops.forever(function () {
            if (followingAgent) {
                superagentPosition = agent.getPosition()
                ensureCharacter()
                attackCommandBurst(2)
            }
            loops.pause(300)
        })
    }

    function syncAddonMob() {
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superagent,r=64]")
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superaagent,r=64]")
        setSuperagentPosition(agent.getPosition())
    }

    function auraPulseCommands() {
        showCharacterPulse()
        runAtSuperagent("particle minecraft:totem_particle ~ ~1.25 ~")
        runAtSuperagent("particle minecraft:villager_happy ~ ~1.6 ~")
    }

    function attackCommandBurst(strength: number) {
        let damage = 8 + strength * 3
        runAtSuperagent("particle superagent:attack_burst ~ ~0.8 ~")
        runAtSuperagent("particle minecraft:critical_hit_emitter ~ ~1 ~")
        runAtSuperagent("effect @e[family=monster,r=8] slowness 3 1 false")
        runAtSuperagent("effect @e[family=monster,r=8] weakness 3 0 false")
        runAtSuperagent("damage @e[family=monster,r=8] " + damage + " entity_attack")
    }

    function ensureAuraLoop() {
        ensureFollowLoop()
    }

    function smartMoveStep(mode: SuperagentSmartMoveMode, step: number, strength: number) {
        if (mode == SuperagentSmartMoveMode.Scout) {
            moveCharacter(SuperagentMoveDirection.North, 1)
        } else if (mode == SuperagentSmartMoveMode.Patrol) {
            patrolStep(4, step)
        } else if (mode == SuperagentSmartMoveMode.Orbit) {
            orbitStep(3 + strength, step)
        } else if (mode == SuperagentSmartMoveMode.Evade) {
            moveCharacter(step % 2 == 0 ? SuperagentMoveDirection.West : SuperagentMoveDirection.East, strength)
        } else if (mode == SuperagentSmartMoveMode.HighGround) {
            moveCharacter(SuperagentMoveDirection.Up, 1)
        } else if (mode == SuperagentSmartMoveMode.Zigzag) {
            moveCharacter(SuperagentMoveDirection.North, 1)
            moveCharacter(step % 2 == 0 ? SuperagentMoveDirection.East : SuperagentMoveDirection.West, 1)
        } else if (mode == SuperagentSmartMoveMode.Spiral) {
            spiralSearch(1 + strength, 1)
        } else {
            showCharacterPulse()
        }
        attackFromCharacter(6, strength)
    }

    function patrolStep(side: number, step: number) {
        let phase = step % 4
        if (phase == 0) {
            moveCharacter(SuperagentMoveDirection.East, side)
        } else if (phase == 1) {
            moveCharacter(SuperagentMoveDirection.South, side)
        } else if (phase == 2) {
            moveCharacter(SuperagentMoveDirection.West, side)
        } else {
            moveCharacter(SuperagentMoveDirection.North, side)
        }
    }

    function orbitStep(radius: number, step: number) {
        radius = clamp(radius, 1, 16)
        let center = agent.getPosition()
        let phase = step % 8
        let target = center
        if (phase == 0) {
            target = positions.add(center, pos(radius, 0, 0))
        } else if (phase == 1) {
            target = positions.add(center, pos(radius, 0, radius))
        } else if (phase == 2) {
            target = positions.add(center, pos(0, 0, radius))
        } else if (phase == 3) {
            target = positions.add(center, pos(0 - radius, 0, radius))
        } else if (phase == 4) {
            target = positions.add(center, pos(0 - radius, 0, 0))
        } else if (phase == 5) {
            target = positions.add(center, pos(0 - radius, 0, 0 - radius))
        } else if (phase == 6) {
            target = positions.add(center, pos(0, 0, 0 - radius))
        } else {
            target = positions.add(center, pos(radius, 0, 0 - radius))
        }
        setSuperagentPosition(target)
    }

    function smartRing(strength: number, includeVertical: boolean, emergency: boolean) {
        attackDirection(FORWARD, strength + 1)
        attackDirection(RIGHT, strength)
        attackDirection(LEFT, strength)
        if (emergency) {
            attackDirection(BACK, strength)
        } else {
            attackDirection(BACK, 1)
        }
        if (includeVertical) {
            attackDirection(UP, strength)
            attackDirection(DOWN, strength)
        }
    }

    function showRingPulse() {
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Right)
    }

    function showVerticalPulse() {
        agent.move(UP, 1)
        agent.move(DOWN, 1)
    }

    function showShieldPulse() {
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Left)
        agent.turn(TurnDirection.Right)
    }

    function pulse(style: SuperagentBurstStyle) {
        ensureAuraLoop()
        ensureCharacter()
        auraPulseCommands()
        if (style == SuperagentBurstStyle.Vertical) {
            showVerticalPulse()
            return
        }
        if (style == SuperagentBurstStyle.Sphere) {
            showRingPulse()
            showVerticalPulse()
            return
        }
        showRingPulse()
    }

    /**
     * Get the number of Agent attacks performed by the last superagent burst.
     */
    //% blockId=superagent_last_burst_count block="superagent last burst count"
    //% group="Status"
    export function reportLastBurstCount(): number {
        return lastBurstCount
    }

    /**
     * Show a small Agent status gesture that does not require commands.
     */
    //% blockId=superagent_show_status block="superagent show %status"
    //% group="Status"
    export function showStatus(status: SuperagentStatus) {
        lastBurstCount = 0
        ensureAuraLoop()
        ensureCharacter()
        auraPulseCommands()
        if (status == SuperagentStatus.Attack) {
            showRingPulse()
            return
        }
        if (status == SuperagentStatus.Shield) {
            showShieldPulse()
            return
        }
        agent.turn(TurnDirection.Right)
        agent.turn(TurnDirection.Left)
    }

    /**
     * Make the Agent perform a superagent-style area attack around itself.
     */
    //% blockId=superagent_attack_aura block="superagent attack aura rounds %rounds hits %hits style %style"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8
    //% group="Combat"
    export function attackAura(rounds: number, hits: number, style: SuperagentBurstStyle) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            attackDirection(FORWARD, hits)
            attackDirection(RIGHT, hits)
            attackDirection(BACK, hits)
            attackDirection(LEFT, hits)
            if (style == SuperagentBurstStyle.Vertical || style == SuperagentBurstStyle.Sphere) {
                attackDirection(UP, hits)
                attackDirection(DOWN, hits)
            }
            attackCommandBurst(hits)
            pulse(style)
        }
    }

    /**
     * Keep guarding the Agent's space with repeated horizontal bursts.
     */
    //% blockId=superagent_guard_agent block="superagent guard agent rounds %rounds hits %hits"
    //% rounds.min=1 rounds.max=64 hits.min=1 hits.max=8
    //% group="Combat"
    export function guardAgent(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Ring)
    }

    /**
     * Perform a full six-direction burst and collect any nearby drops.
     */
    //% blockId=superagent_power_burst block="superagent power burst rounds %rounds hits %hits"
    //% rounds.min=1 rounds.max=32 hits.min=1 hits.max=8
    //% group="Combat"
    export function powerBurst(rounds: number, hits: number) {
        attackAura(rounds, hits, SuperagentBurstStyle.Sphere)
        agent.collectAll()
    }

    /**
     * Sweep threats with a smarter pattern that prioritizes the front, sides, then vertical danger when needed.
     */
    //% blockId=superagent_smart_sweep block="superagent smart sweep rounds %rounds strength %strength mode %mode"
    //% rounds.min=1 rounds.max=16 strength.min=1 strength.max=5
    //% group="Combat"
    export function smartSweep(rounds: number, strength: number, mode: SuperagentSmartMode) {
        lastBurstCount = 0
        ensureAuraLoop()
        rounds = clamp(rounds, 1, 16)
        strength = clamp(strength, 1, 5)
        for (let i = 0; i < rounds; i++) {
            ensureCharacter()
            auraPulseCommands()
            if (mode == SuperagentSmartMode.Emergency) {
                smartRing(strength + 1, true, true)
                showShieldPulse()
            } else if (mode == SuperagentSmartMode.Chase) {
                attackDirection(FORWARD, strength + 2)
                smartRing(strength, false, false)
                showRingPulse()
            } else {
                smartRing(strength, true, false)
                showShieldPulse()
            }
            attackCommandBurst(strength)
        }
    }

    /**
     * Use the strongest member-safe superagent attack pattern and collect nearby drops.
     */
    //% blockId=superagent_overdrive block="superagent overdrive rounds %rounds strength %strength"
    //% rounds.min=1 rounds.max=16 strength.min=1 strength.max=5
    //% group="Combat"
    export function overdrive(rounds: number, strength: number) {
        smartSweep(rounds, strength, SuperagentSmartMode.Emergency)
        agent.collectAll()
    }

    /**
     * Start and refresh the visible superagent aura at the Agent's current position.
     */
    //% blockId=superagent_keep_aura_on block="superagent keep aura on"
    //% group="Status"
    export function keepAuraOn() {
        ensureAuraLoop()
        syncAddonMob()
        auraPulseCommands()
    }

    /**
     * Spawn the visible one-block superagent character at the Agent.
     */
    //% blockId=superagent_spawn_at_agent block="superagent spawn at agent"
    //% group="Control"
    export function spawnAtAgent() {
        followingAgent = false
        setSuperagentPosition(agent.getPosition())
    }

    /**
     * Recall the visible superagent character back to the Agent.
     */
    //% blockId=superagent_recall_to_agent block="superagent recall to agent"
    //% group="Control"
    export function recallToAgent() {
        setSuperagentPosition(agent.getPosition())
    }

    /**
     * Move the visible superagent character on the world grid.
     */
    //% blockId=superagent_move_character block="superagent move %direction blocks %blocks"
    //% blocks.min=1 blocks.max=32
    //% group="Control"
    export function moveCharacter(direction: SuperagentMoveDirection, blocks: number) {
        followingAgent = false
        setSuperagentPosition(positions.add(superagentPosition, directionOffset(direction, blocks)))
    }

    /**
     * Keep the visible superagent character following the Agent.
     */
    //% blockId=superagent_follow_agent_on block="superagent follow agent on"
    //% group="Control"
    export function followAgentOn() {
        followingAgent = true
        ensureFollowLoop()
        recallToAgent()
    }

    /**
     * Stop automatic follow mode for the visible superagent character.
     */
    //% blockId=superagent_follow_agent_off block="superagent follow agent off"
    //% group="Control"
    export function followAgentOff() {
        followingAgent = false
        showCharacterPulse()
    }

    /**
     * Attack hostile mobs around the visible superagent character.
     */
    //% blockId=superagent_attack_from_character block="superagent attack from character radius %radius strength %strength"
    //% radius.min=1 radius.max=16 strength.min=1 strength.max=8
    //% group="Combat"
    export function attackFromCharacter(radius: number, strength: number) {
        radius = clamp(radius, 1, 16)
        strength = clamp(strength, 1, 8)
        let damage = 8 + strength * 3
        ensureCharacter()
        runAtSuperagent("particle superagent:attack_burst ~ ~0.8 ~")
        runAtSuperagent("particle minecraft:critical_hit_emitter ~ ~1 ~")
        runAtSuperagent("effect @e[family=monster,r=" + radius + "] slowness 3 1 false")
        runAtSuperagent("effect @e[family=monster,r=" + radius + "] weakness 3 0 false")
        runAtSuperagent("damage @e[family=monster,r=" + radius + "] " + damage + " entity_attack")
    }

    /**
     * Dash the visible superagent character quickly in one direction.
     */
    //% blockId=superagent_dash block="superagent dash %direction blocks %blocks"
    //% blocks.min=1 blocks.max=32
    //% group="Smart Move"
    export function dash(direction: SuperagentMoveDirection, blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 32)
        for (let i = 0; i < blocks; i++) {
            moveCharacter(direction, 1)
        }
        attackFromCharacter(6, 2)
    }

    /**
     * Scout in a straight line while pulsing and attacking nearby threats.
     */
    //% blockId=superagent_scout_line block="superagent scout %direction steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Smart Move"
    export function scoutLine(direction: SuperagentMoveDirection, steps: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            moveCharacter(direction, 1)
            attackFromCharacter(5, 2)
        }
    }

    /**
     * Patrol a square path around the current superagent position.
     */
    //% blockId=superagent_patrol_square block="superagent patrol square side %side rounds %rounds"
    //% side.min=1 side.max=16 rounds.min=1 rounds.max=8
    //% group="Smart Move"
    export function patrolSquare(side: number, rounds: number) {
        followingAgent = false
        side = clamp(side, 1, 16)
        rounds = clamp(rounds, 1, 8)
        for (let round = 0; round < rounds; round++) {
            for (let phase = 0; phase < 4; phase++) {
                patrolStep(side, phase)
                attackFromCharacter(6, 2)
            }
        }
    }

    /**
     * Orbit around the Agent while attacking from the superagent position.
     */
    //% blockId=superagent_orbit_agent block="superagent orbit agent radius %radius steps %steps"
    //% radius.min=1 radius.max=16 steps.min=1 steps.max=32
    //% group="Smart Move"
    export function orbitAgent(radius: number, steps: number) {
        followingAgent = false
        radius = clamp(radius, 1, 16)
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            orbitStep(radius, i)
            attackFromCharacter(7, 3)
        }
    }

    /**
     * Evade to the Agent's side and counterattack.
     */
    //% blockId=superagent_evade_to_agent_side block="superagent evade to agent side distance %distance"
    //% distance.min=1 distance.max=16
    //% group="Smart Move"
    export function evadeToAgentSide(distance: number) {
        followingAgent = false
        distance = clamp(distance, 1, 16)
        setSuperagentPosition(positions.add(agent.getPosition(), pos(distance, 0, distance)))
        attackFromCharacter(8, 3)
    }

    /**
     * Move the superagent upward for a high-ground guard position.
     */
    //% blockId=superagent_high_ground block="superagent high ground blocks %blocks"
    //% blocks.min=1 blocks.max=16
    //% group="Smart Move"
    export function highGround(blocks: number) {
        followingAgent = false
        blocks = clamp(blocks, 1, 16)
        moveCharacter(SuperagentMoveDirection.Up, blocks)
        attackFromCharacter(8, 3)
    }

    /**
     * Advance with alternating side steps to cover more area.
     */
    //% blockId=superagent_zigzag block="superagent zigzag %direction steps %steps"
    //% steps.min=1 steps.max=32
    //% group="Smart Move"
    export function zigzag(direction: SuperagentMoveDirection, steps: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        for (let i = 0; i < steps; i++) {
            moveCharacter(direction, 1)
            moveCharacter(i % 2 == 0 ? SuperagentMoveDirection.East : SuperagentMoveDirection.West, 1)
            attackFromCharacter(5, 2)
        }
    }

    /**
     * Search outward in a spiral from the current superagent position.
     */
    //% blockId=superagent_spiral_search block="superagent spiral search radius %radius rounds %rounds"
    //% radius.min=1 radius.max=8 rounds.min=1 rounds.max=8
    //% group="Smart Move"
    export function spiralSearch(radius: number, rounds: number) {
        followingAgent = false
        radius = clamp(radius, 1, 8)
        rounds = clamp(rounds, 1, 8)
        for (let round = 1; round <= rounds; round++) {
            moveCharacter(SuperagentMoveDirection.East, radius * round)
            moveCharacter(SuperagentMoveDirection.South, radius * round)
            moveCharacter(SuperagentMoveDirection.West, radius * round + 1)
            moveCharacter(SuperagentMoveDirection.North, radius * round + 1)
            attackFromCharacter(6, 2)
        }
    }

    /**
     * Choose a smart movement pattern and attack from the superagent character.
     */
    //% blockId=superagent_smart_move block="superagent smart move %mode steps %steps strength %strength"
    //% steps.min=1 steps.max=32 strength.min=1 strength.max=8
    //% group="Smart Move"
    export function smartMove(mode: SuperagentSmartMoveMode, steps: number, strength: number) {
        followingAgent = false
        steps = clamp(steps, 1, 32)
        strength = clamp(strength, 1, 8)
        for (let i = 0; i < steps; i++) {
            smartMoveStep(mode, i, strength)
        }
    }
}
