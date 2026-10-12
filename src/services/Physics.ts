import RAPIER from "@dimforge/rapier3d-compat"
import { Context, Effect, Layer } from "effect"

export const GRAVITY = 22

export class Physics extends Context.Service<Physics, {
  readonly RAPIER: typeof RAPIER
  readonly world: RAPIER.World
}>()("bears/services/Physics") {
  static readonly layer = Layer.effect(
    Physics,
    Effect.gen(function*() {
      // Rapier ships as WASM; it has to finish loading before we touch it.
      yield* Effect.promise(() => RAPIER.init())
      const world = yield* Effect.acquireRelease(
        Effect.sync(() => new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })),
        (world) => Effect.sync(() => world.free())
      )
      return Physics.of({ RAPIER, world })
    })
  )
}
