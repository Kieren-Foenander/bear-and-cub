import * as THREE from "three"
import type { Button, PadState } from "../services/Input.ts"
import type { Glyph } from "./prompts.ts"
import type { Bear, BearId } from "./bear.ts"

/** What a prompt shows right now. */
export interface PromptView {
  readonly buttons: ReadonlyArray<Glyph>
  readonly label: string
  /** Flash the prompt: "press it NOW!" */
  readonly now?: boolean
}

/**
 * Something a bear can do when standing in the right place. Each one shows a big button prompt.
 *
 * - `press`: tap the button once
 * - `mash`: tap the button `count` times
 * - `guide`: coaching only. Shows whatever `view` returns and never eats button presses; the
 *   actual success is decided by the game world (e.g. a swipe that physically reaches a target).
 */
export interface Interaction {
  readonly id: string
  readonly who: BearId
  readonly kind: "press" | "mash" | "guide"
  readonly buttons: ReadonlyArray<Button>
  readonly label: string
  readonly count?: number
  /** World position the prompt floats above. */
  readonly anchor: () => THREE.Vector3
  /** Is the bear close enough? */
  readonly inRange: (bear: Bear) => boolean
  readonly enabled: () => boolean
  /** For `guide` prompts: what to show this frame, or null to hide. */
  readonly view?: (bear: Bear) => PromptView | null
  readonly onStep?: (progress: number) => void
  readonly onComplete?: (bear: Bear) => void
}

export interface ActivePrompt {
  readonly interaction: Interaction
  readonly bear: Bear
  readonly progress: number
  readonly view: PromptView
}

export class Interactions {
  readonly list: Array<Interaction> = []
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

    if (nearest.kind === "guide") {
      const view = nearest.view?.(bear)
      if (view) this.active.push({ interaction: nearest, bear, progress: 0, view })
      return
    }

    let progress = this.progress.get(nearest.id) ?? 0
    if (pad) {
      if (nearest.kind === "press" && nearest.buttons.some((b) => pad.pressed[b])) progress = 1
      if (nearest.kind === "mash" && pad.pressed[nearest.buttons[0]!]) {
        progress = Math.min(1, progress + 1 / (nearest.count ?? 3))
        nearest.onStep?.(progress)
      }
      for (const button of nearest.buttons) {
        pad.pressed[button] = false
      }
    }

    if (progress >= 1) {
      this.progress.set(nearest.id, 0)
      nearest.onComplete?.(bear)
      return
    }
    this.progress.set(nearest.id, progress)
    this.active.push({ interaction: nearest, bear, progress, view: { buttons: nearest.buttons, label: nearest.label } })
  }

  /** Call at the start of each frame. */
  beginFrame() {
    this.active = []
  }
}

/** Helper for the common "stand near this point" range check. */
export const near = (point: () => THREE.Vector3, radius: number) => (bear: Bear) =>
  bear.position.distanceTo(point()) < radius
