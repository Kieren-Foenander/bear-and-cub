import { Effect, Fiber, Layer } from "effect"
import { preloadBearModels } from "./game/bearModel.ts"
import { GameLive } from "./game/Game.ts"
import { Hud } from "./services/Hud.ts"
import { Input } from "./services/Input.ts"
import { Music } from "./services/Music.ts"
import { Physics } from "./services/Physics.ts"
import { Renderer } from "./services/Renderer.ts"
import { Save } from "./services/Save.ts"
import { Sound } from "./services/Sound.ts"
import "./style.css"

const MainLive = GameLive.pipe(
  Layer.provide(Layer.mergeAll(
    Renderer.layer, Physics.layer, Input.layer,
    Music.layer.pipe(Layer.provideMerge(Sound.layer)), Save.layer, Hud.layer
  ))
)

const fiber = Effect.runFork(
  Effect.promise(() => preloadBearModels()).pipe(Effect.andThen(Layer.launch(MainLive)))
)

// On hot reload, interrupting the fiber runs every finalizer: the canvas, listeners,
// audio and physics world are all cleaned up before the new version starts.
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => Effect.runPromise(Fiber.interrupt(fiber)))
}
