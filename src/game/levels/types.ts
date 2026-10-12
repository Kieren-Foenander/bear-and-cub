import type * as THREE from "three"
import type { SoundName } from "../../services/Sound.ts"
import type { Bear } from "../bear.ts"
import type { Berries } from "../collectibles.ts"
import type { Coop } from "../coop.ts"
import type { Interactions } from "../interactions.ts"
import type { Env, Patch } from "../nature.ts"
import type { Particles } from "../particles.ts"
import type { Surfaces } from "../surfaces.ts"
import type { Swipes } from "../swipe.ts"
import type { TerrainDef } from "../terrain.ts"

/** Everything a level can use while it builds itself. */
export interface StageApi extends Env {
  readonly particles: Particles
  readonly interactions: Interactions
  readonly swipes: Swipes
  readonly surfaces: Surfaces
  readonly berries: Berries
  readonly coop: Coop
  readonly mama: Bear
  readonly cub: Bear
  readonly sound: (name: SoundName) => void
  readonly toast: (text: string) => void
  readonly shake: (amount: number) => void
  /** The honey pot at the end. The level is complete when both bears reach it (once `open` says so). */
  readonly goal: (at: THREE.Vector3, open?: () => boolean) => void
  /** Tall grass, flowers that sing, and butterflies hidden in the grass. */
  readonly nature: (options: {
    grass?: ReadonlyArray<Patch>
    flowers?: ReadonlyArray<readonly [number, number]>
    butterflies?: ReadonlyArray<Patch>
  }) => void
}

export interface Objective {
  readonly text: string
  /** Where the floating arrow points, or null for no arrow. */
  readonly target: THREE.Vector3 | null
}

export interface LevelLogic {
  update(dt: number): void
  objective(): Objective
}

export interface LevelDef {
  readonly id: string
  readonly title: string
  /** The controller skill this level teaches, shown on the map. */
  readonly teaches: string
  readonly emoji: string
  readonly sky?: { readonly color: THREE.ColorRepresentation; readonly fog: THREE.ColorRepresentation }
  readonly terrain: TerrainDef
  /** Ground positions (y is ignored). */
  readonly spawn: { readonly mama: readonly [number, number]; readonly cub: readonly [number, number] }
  readonly build: (api: StageApi) => LevelLogic
}
