import * as THREE from "three"
import { BEAR_STYLES } from "./models/styles.ts"
import type { BearAnimState, BearLook, BearStyle, BearStyleModel } from "./models/types.ts"

export type { BearAnimState, BearLook } from "./models/types.ts"

/** Feet-to-ear-tip height at scale 1. */
export const MODEL_HEIGHT = 1.9

/** Load every style's assets. Awaited once at startup. */
export const preloadBearModels = async (): Promise<void> => {
  await Promise.all(BEAR_STYLES.map((style) => style.preload?.()))
}

let defaultStyle: string = BEAR_STYLES[0]!.id

/** Which style new bears are built in (the session sets this from the saved choice). */
export const setDefaultBearStyle = (id: string) => {
  if (BEAR_STYLES.some((style) => style.id === id)) defaultStyle = id
}

export const bearStyle = (id: string): BearStyle => BEAR_STYLES.find((style) => style.id === id) ?? BEAR_STYLES[0]!

/**
 * The bear the game talks to. It wraps whichever art style is chosen and can swap styles live
 * (the hat comes along), so styles can be compared in the middle of a level.
 */
export class BearModel {
  readonly root = new THREE.Group()
  private impl: BearStyleModel
  private hat: THREE.Object3D | null = null
  style: string

  constructor(
    private readonly look: BearLook,
    private readonly scale: number,
    style = defaultStyle
  ) {
    this.style = bearStyle(style).id
    this.impl = bearStyle(this.style).create(look, scale)
    this.root.add(this.impl.root)
  }

  setStyle(id: string) {
    const style = bearStyle(id)
    if (style.id === this.style) return
    this.root.remove(this.impl.root)
    this.impl.wear(null)
    this.style = style.id
    this.impl = style.create(this.look, this.scale)
    this.root.add(this.impl.root)
    if (this.hat) this.impl.wear(this.hat)
  }

  land(strength: number) {
    this.impl.land(strength)
  }

  cheer() {
    this.impl.cheer()
  }

  swipe() {
    this.impl.swipe()
  }

  celebrate() {
    this.impl.celebrate()
  }

  shake() {
    this.impl.shake()
  }

  wear(hat: THREE.Object3D | null) {
    this.hat = hat
    this.impl.wear(hat)
  }

  animate(dt: number, state: BearAnimState) {
    this.impl.animate(dt, state)
  }
}
