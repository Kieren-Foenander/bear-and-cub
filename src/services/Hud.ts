import { Context, Effect, Layer } from "effect"

/** The DOM layer that sits on top of the 3D canvas. Everything big and friendly lives here. */
export class Hud extends Context.Service<Hud, {
  readonly root: HTMLElement
}>()("bears/services/Hud") {
  static readonly layer = Layer.effect(
    Hud,
    Effect.gen(function*() {
      const root = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const root = document.createElement("div")
          root.className = "hud"
          document.getElementById("app")!.appendChild(root)
          return root
        }),
        (root) => Effect.sync(() => root.remove())
      )
      return Hud.of({ root })
    })
  )
}
