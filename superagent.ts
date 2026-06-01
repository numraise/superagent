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

/**
 * Member-safe control blocks for the invisible superagent add-on helper.
 */
//% weight=96 color=#5a43b5 icon="\uf21e" block="superagent"
namespace superagent {
    let lastBurstCount = 0

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
        rounds = clamp(rounds, 1, 32)
        hits = clamp(hits, 1, 8)
        for (let i = 0; i < rounds; i++) {
            attackDirection(FORWARD, hits)
            attackDirection(RIGHT, hits)
            attackDirection(BACK, hits)
            attackDirection(LEFT, hits)
            if (style == SuperagentBurstStyle.Vertical || style == SuperagentBurstStyle.Sphere) {
                attackDirection(UP, hits)
                attackDirection(DOWN, hits)
            }
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
}
