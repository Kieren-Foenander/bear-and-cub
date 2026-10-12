import RAPIER from "@dimforge/rapier3d-compat"
import { Context, Effect, Layer } from "effect"

export const GRAVITY = 22

/** The Rapier physics engine. Each level creates (and frees) its own world from it. */
export class Physics extends Context.Service<Physics, {
  readonly RAPIER: typeof RAPIER
}>()("bears/services/Physics") {
  static readonly layer = Layer.effect(
    Physics,
    Effect.gen(function*() {
      // Rapier ships as WASM; it has to finish loading before we touch it.
      yield* Effect.promise(() => RAPIER.init())
      return Physics.of({ RAPIER })
    })
  )
}
