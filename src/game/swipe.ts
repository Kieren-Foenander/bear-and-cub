import * as THREE from "three"
import type { Bear, BearId } from "./bear.ts"
import type { Interactions } from "./interactions.ts"

/**
 * Something you knock by swiping at it (X). Targets hang just high enough that the cub can only
 * reach them near the top of a jump, so "jump, then swipe at the top" is a real rule of the world
 * rather than a hidden timer.
 */
export interface SwipeTarget {
  readonly id: string
  /** Bears allowed to hit it. Practice targets let Mama show how it's done. */
  readonly who: ReadonlyArray<BearId>
  readonly position: () => THREE.Vector3
  /** How close (sideways) the bear has to be to reach it. */
  readonly horizontalReach: number
  /** How far above/below the paw the target can be and still get hit. Smaller = stricter timing. */
  readonly verticalReach: number
  readonly enabled: () => boolean
  readonly onHit: (bear: Bear) => void
  /** 0..1: how close the bear's paw is to reaching it, for a glow. */
  readonly glow?: (amount: number) => void
}

/** Where a bear's swiping paw is. */
export const pawY = (bear: Bear) => bear.position.y + bear.spec.halfHeight + bear.spec.radius * 0.5

/** How high above the ground a target has to hang so a bear's paw reaches it at `lift` up into a jump. */
export const hangHeight = (bear: Pick<Bear["spec"], "halfHeight" | "radius">, lift: number) =>
  bear.halfHeight * 2 + bear.radius * 1.5 + lift

const COACH_RANGE = 2.6
const HINT_TIME = 1.4

export class Swipes {
  private readonly targets: Array<SwipeTarget> = []
  /** A short coaching message after a miss, per bear. */
  private readonly hints = new Map<BearId, { text: string; time: number }>()

  constructor(private readonly interactions: Interactions) {}

  /** Register a target. `coach` adds a prompt that walks the bear through jump → swipe. */
  add(target: SwipeTarget, coach?: { who: BearId; enabled?: () => boolean }) {
    this.targets.push(target)
    if (!coach) return
    this.interactions.add({
      id: `swipe-${target.id}`,
      who: coach.who,
      kind: "guide",
      buttons: ["a"],
      label: "Jump!",
      anchor: () => target.position().clone().add(new THREE.Vector3(0, 1.1, 0)),
      inRange: (bear) => horizontal(bear, target) < COACH_RANGE,
      enabled: coach.enabled ?? target.enabled,
      view: (bear) => {
        if (bear.mode !== "walk") return null
        const hint = this.hints.get(bear.spec.id)
        if (this.inReach(bear, target)) return { buttons: ["x"], label: "NOW!", now: true }
        if (hint) return { buttons: bear.grounded ? ["a"] : ["x"], label: hint.text }
        if (bear.grounded) return { buttons: ["a"], label: "Jump!" }
        return { buttons: ["x"], label: "Get ready…" }
      }
    })
  }

  inReach(bear: Bear, target: SwipeTarget) {
    const dy = target.position().y - pawY(bear)
    return horizontal(bear, target) < target.horizontalReach && Math.abs(dy) < target.verticalReach
  }

  /** The bear swiped. Returns true if it hit something. */
  swipe(bear: Bear) {
    let hit = false
    let nearMiss: SwipeTarget | null = null
    for (const target of this.targets) {
      if (!target.enabled() || !target.who.includes(bear.spec.id)) continue
      if (this.inReach(bear, target)) {
        target.onHit(bear)
        hit = true
      } else if (horizontal(bear, target) < COACH_RANGE) {
        nearMiss = target
      }
    }
    if (!hit && nearMiss) {
      const below = nearMiss.position().y > pawY(bear)
      const text = bear.grounded ? "Jump first!" : below && bear.velocity.y > 0 ? "Wait for the top!" : "Too late, try again!"
      this.hints.set(bear.spec.id, { text, time: HINT_TIME })
    }
    if (hit) this.hints.delete(bear.spec.id)
    return hit
  }

  update(dt: number, bears: ReadonlyArray<Bear>) {
    for (const [id, hint] of this.hints) {
      hint.time -= dt
      if (hint.time <= 0) this.hints.delete(id)
    }
    for (const target of this.targets) {
      if (!target.glow) continue
      let amount = 0
      if (target.enabled()) {
        for (const bear of bears) {
          if (!target.who.includes(bear.spec.id)) continue
          if (this.inReach(bear, target)) amount = 1
          else if (horizontal(bear, target) < COACH_RANGE) amount = Math.max(amount, 0.25)
        }
      }
      target.glow(amount)
    }
  }
}

const horizontal = (bear: Bear, target: SwipeTarget) => {
  const p = target.position()
  return Math.hypot(bear.position.x - p.x, bear.position.z - p.z)
}
