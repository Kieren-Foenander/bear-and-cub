import type * as THREE from "three"

/** Colours (and which bear) a model should be. Every style must respect these. */
export interface BearLook {
  /** Lets the model use different proportions for the grown-up and the little one. */
  readonly kind: "mama" | "cub"
  readonly fur: THREE.ColorRepresentation
  readonly belly: THREE.ColorRepresentation
  /** Optional scarf colour, so the cub is easy to spot. */
  readonly scarf?: THREE.ColorRepresentation
}

export interface BearAnimState {
  /** Horizontal speed in m/s. */
  speed: number
  maxSpeed: number
  grounded: boolean
  /** Riding on Mama's back. */
  carried: boolean
  /** Thrown through the air by Mama (can't steer). */
  flying: boolean
  /** Vertical velocity in m/s, + is up. */
  verticalVelocity: number
}

/**
 * One bear, in one art style. The game owns `root`'s position, yaw and scale-free placement;
 * the model owns everything inside it. Origin is on the ground between the feet; it faces +Z.
 * At scale 1 a bear is ~1.9 tall (feet to ear tips), ~2.4 long, ~1.4 wide, with the top of the
 * back at y ≈ 1.55 (where Cub sits when carried). Cub uses the same class at scale 0.55.
 */
export interface BearStyleModel {
  readonly root: THREE.Object3D
  land(strength: number): void
  cheer(): void
  swipe(): void
  celebrate(): void
  shake(): void
  /** Put a hat on the head (built at head scale, centred on the top of the head), or null to remove. */
  wear(hat: THREE.Object3D | null): void
  animate(dt: number, state: BearAnimState): void
}

export interface BearStyle {
  readonly id: string
  /** Shown in the pause menu. */
  readonly label: string
  /** Load any assets (awaited once at startup). */
  readonly preload?: () => Promise<void>
  readonly create: (look: BearLook, scale: number) => BearStyleModel
}
