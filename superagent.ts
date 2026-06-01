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

/**
 * Member-safe control blocks for the invisible superagent add-on helper.
 */
//% weight=96 color=#5a43b5 icon="\uf21e" block="superagent"
namespace superagent {
    let lastBurstCount = 0
    let auraLoopStarted = false

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

    function syncAddonMob() {
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superagent,r=64]")
        runAtAgent("kill @e[type=minecraft:armor_stand,name=superaagent,r=64]")
        runAtAgent("execute unless entity @e[type=superagent:superagent,r=2] run summon superagent:superagent ~ ~ ~")
        runAtAgent("tp @e[type=superagent:superagent,r=16,c=1] ~ ~ ~")
        runAtAgent("effect @e[type=superagent:superagent,r=3,c=1] invisibility 10 1 true")
        runAtAgent("effect @e[type=superagent:superagent,r=3,c=1] resistance 10 255 true")
    }

    function auraPulseCommands() {
        runAtAgent("particle superagent:agent_aura ~ ~0.2 ~")
        runAtAgent("particle superagent:agent_spark ~ ~1.2 ~")
        runAtAgent("particle minecraft:basic_flame_particle ~1 ~0.35 ~")
        runAtAgent("particle minecraft:basic_flame_particle ~-1 ~0.35 ~")
        runAtAgent("particle minecraft:basic_flame_particle ~ ~0.35 ~1")
        runAtAgent("particle minecraft:basic_flame_particle ~ ~0.35 ~-1")
        runAtAgent("particle minecraft:totem_particle ~ ~1.25 ~")
        runAtAgent("particle minecraft:villager_happy ~ ~1.6 ~")
    }

    function attackCommandBurst(strength: number) {
        let damage = 8 + strength * 3
        runAtAgent("particle superagent:attack_burst ~ ~0.8 ~")
        runAtAgent("particle minecraft:critical_hit_emitter ~ ~1 ~")
        runAtAgent("effect @e[family=monster,r=8] slowness 3 1 false")
        runAtAgent("effect @e[family=monster,r=8] weakness 3 0 false")
        runAtAgent("damage @e[family=monster,r=8] " + damage + " entity_attack")
    }

    function ensureAuraLoop() {
        if (auraLoopStarted) {
            return
        }
        auraLoopStarted = true
        loops.forever(function () {
            syncAddonMob()
            auraPulseCommands()
            loops.pause(300)
        })
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
        syncAddonMob()
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
        syncAddonMob()
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
            syncAddonMob()
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
            syncAddonMob()
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
}
