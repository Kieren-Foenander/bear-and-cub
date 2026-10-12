import * as THREE from "three"
import type { Button, PadState } from "../services/Input.ts"
import type { Bear, BearId } from "./bear.ts"

/**
 * Something a bear can do when standing in the right place. Each one shows a big button prompt.
 *
 * - `press`: tap the button once
 * - `mash`: tap the button `count` times
 * - `together`: hold every button in `buttons` at the same time for `holdTime` seconds
 */
export interface Interaction {
  readonly id: string
  readonly who: BearId
  readonly kind: "press" | "mash" | "together"
  readonly buttons: ReadonlyArray<Button>
  readonly label: string
  readonly count?: number
  readonly holdTime?: number
  /** World position the prompt floats above. */
  readonly anchor: () => THREE.Vector3
  /** Is the bear close enough? Defaults to a distance check against `anchor`. */
  readonly inRange: (bear: Bear) => boolean
  readonly enabled: () => boolean
  readonly onStep?: (progress: number) => void
  readonly onComplete: (bear: Bear) => void
}

export interface ActivePrompt {
  readonly interaction: Interaction
  readonly bear: Bear
  readonly progress: number
}

export class Interactions {
  private readonly list: Array<Interaction> = []
  private readonly progress = new Map<string, number>()
  /** Prompts that should be on screen this frame. */
  active: Array<ActivePrompt> = []

  add(interaction: Interaction) {
    this.list.push(interaction)
  }

  /** Runs interactions for one bear. Buttons used by an interaction are removed from `pad` so they don't also jump/roar. */
  update(dt: number, bear: Bear, pad: PadState | null) {
    const candidates = this.list.filter((i) => i.who === bear.spec.id && i.enabled() && i.inRange(bear))
    // Let unused interactions slowly forget their progress.
    for (const interaction of this.list) {
      if (!candidates.includes(interaction) && interaction.who === bear.spec.id) {
        const p = this.progress.get(interaction.id) ?? 0
        if (p > 0) this.progress.set(interaction.id, Math.max(0, p - dt * 0.5))
      }
    }
    if (candidates.length === 0) return

    const nearest = candidates.reduce((a, b) =>
      a.anchor().distanceToSquared(bear.position) <= b.anchor().distanceToSquared(bear.position) ? a : b
    )
    let progress = this.progress.get(nearest.id) ?? 0

    if (pad) {
      switch (nearest.kind) {
        case "press": {
          if (nearest.buttons.some((b) => pad.pressed[b])) progress = 1
          break
        }
        case "mash": {
          if (pad.pressed[nearest.buttons[0]!]) {
            progress = Math.min(1, progress + 1 / (nearest.count ?? 3))
            nearest.onStep?.(progress)
          }
          break
        }
        case "together": {
          const allHeld = nearest.buttons.every((b) => pad.held[b])
          progress = allHeld
            ? Math.min(1, progress + dt / (nearest.holdTime ?? 1))
            : Math.max(0, progress - dt * 0.35)
          if (allHeld) nearest.onStep?.(progress)
          break
        }
      }
      for (const button of nearest.buttons) {
        pad.pressed[button] = false
      }
    }

    if (progress >= 1) {
      this.progress.set(nearest.id, 0)
      nearest.onComplete(bear)
      return
    }
    this.progress.set(nearest.id, progress)
    this.active.push({ interaction: nearest, bear, progress })
  }

  /** Call at the start of each frame. */
  beginFrame() {
    this.active = []
  }
}

/** Helper for the common "stand near this point" range check. */
export const near = (point: () => THREE.Vector3, radius: number) => (bear: Bear) =>
  bear.position.distanceTo(point()) < radius
