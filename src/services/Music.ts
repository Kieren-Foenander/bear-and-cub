import { Context, Effect, Layer } from "effect"
import { Sound } from "./Sound.ts"
import { MusicEngine } from "./music/engine.ts"

const SETTING_KEY = "bears.music.muted"

export class Music extends Context.Service<Music, {
  readonly play: (theme: string) => void
  readonly celebrate: () => void
}>()("bears/services/Music") {
  static readonly layer = Layer.effect(
    Music,
    Effect.gen(function*() {
      const sound = yield* Sound
      const engine = yield* Effect.acquireRelease(
        Effect.sync(() => new MusicEngine(sound.context)),
        (engine) => Effect.sync(() => engine.dispose())
      )
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          let muted = false
          // Storage can be unavailable in private/restricted browser sessions.
          try { muted = localStorage.getItem(SETTING_KEY) === "true" } catch { /* keep the default */ }
          engine.setMuted(muted)
          engine.setHidden(document.hidden)

          const indicator = document.createElement("button")
          indicator.type = "button"
          indicator.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:50;border:0;border-radius:16px;padding:8px 12px;background:#fff8e6dd;color:#59452e;font:600 12px system-ui;cursor:pointer;box-shadow:0 2px 8px #0001"
          const update = () => {
            indicator.textContent = muted ? "♫ Music off · M" : "♫ Music on · M"
            indicator.setAttribute("aria-label", "Background music")
            indicator.setAttribute("aria-pressed", String(!muted))
            indicator.title = "Toggle music and ambience (M). Sound effects stay on."
          }
          const toggle = () => {
            muted = !muted
            engine.setMuted(muted)
            try { localStorage.setItem(SETTING_KEY, String(muted)) } catch { /* in-memory mute still works */ }
            update()
          }
          const onKey = (event: KeyboardEvent) => {
            if (event.code !== "KeyM" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
            const target = event.target
            if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
            toggle()
          }
          const onVisibility = () => engine.setHidden(document.hidden)
          update()
          document.getElementById("app")!.appendChild(indicator)
          indicator.addEventListener("click", toggle)
          window.addEventListener("keydown", onKey)
          document.addEventListener("visibilitychange", onVisibility)
          // Sound owns the only AudioContext and its gesture listeners. While suspended,
          // tick creates no voices or sources and never attempts to resume the context.
          const timer = window.setInterval(() => {
            if (!sound.isLocked()) engine.tick()
          }, 25)
          return { indicator, toggle, onKey, onVisibility, timer }
        }),
        ({ indicator, toggle, onKey, onVisibility, timer }) => Effect.sync(() => {
          window.clearInterval(timer)
          indicator.removeEventListener("click", toggle)
          indicator.remove()
          window.removeEventListener("keydown", onKey)
          document.removeEventListener("visibilitychange", onVisibility)
        })
      )
      return Music.of({
        play: (theme) => engine.play(theme),
        celebrate: () => { if (!sound.isLocked()) engine.celebrate() }
      })
    })
  )
}
