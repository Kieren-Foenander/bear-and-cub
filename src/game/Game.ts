import { Effect, Layer } from "effect"
import { Hud } from "../services/Hud.ts"
import { type ButtonStyle, Input } from "../services/Input.ts"
import { Physics } from "../services/Physics.ts"
import { Renderer } from "../services/Renderer.ts"
import { type Progress, recordResult, Save } from "../services/Save.ts"
import { Sound } from "../services/Sound.ts"
import { ControlRouter, type Routed } from "./controls.ts"
import { GameHud } from "./hud.ts"
import { LEVELS } from "./levels/index.ts"
import { type LevelStats, MenuNav, Menus } from "./menus.ts"
import { Prompts } from "./prompts.ts"
import { Stage } from "./stage.ts"

type Screen = "title" | "map" | "playing" | "paused" | "help" | "complete" | "credits"

const PAUSE_ITEMS = ["Keep playing", "How to play", "Start level again", "Back to the map"] as const
/** How long to enjoy the celebration before the "You did it!" card. */
const CELEBRATE_TIME = 3

/**
 * The whole game session: menus, saving, and whichever level (Stage) is currently loaded.
 * Plain mutable TypeScript, so the per-frame hot path stays allocation-light.
 */
class Session {
  readonly router = new ControlRouter()
  private readonly nav = new MenuNav()
  private readonly hud: GameHud
  private readonly prompts: Prompts
  private readonly menus: Menus
  stage: Stage
  private levelIndex = 0
  screen: Screen = "title"
  private mapSelected = 0
  private pauseSelected = 0
  private progress: Progress
  private lastStats: LevelStats | null = null
  private readonly unlockAll = new URLSearchParams(location.search).has("unlock")

  constructor(
    private readonly renderer: Renderer["Service"],
    private readonly physics: Physics["Service"],
    private readonly input: Input["Service"],
    private readonly sound: Sound["Service"],
    private readonly save: Save["Service"],
    hudRoot: HTMLElement
  ) {
    this.hud = new GameHud(hudRoot)
    this.prompts = new Prompts(hudRoot)
    this.menus = new Menus(hudRoot)
    this.progress = save.load()

    // `?level=3` jumps straight into a level (handy while building them).
    const requested = Number(new URLSearchParams(location.search).get("level"))
    if (requested >= 1 && requested <= LEVELS.length) {
      this.levelIndex = requested - 1
      this.stage = this.makeStage(this.levelIndex)
      this.screen = "playing"
    } else {
      this.levelIndex = this.firstUnfinished()
      this.mapSelected = this.levelIndex
      this.stage = this.makeStage(this.levelIndex)
    }
  }

  private makeStage(index: number) {
    return new Stage(LEVELS[index]!, {
      rapier: this.physics.RAPIER,
      camera: this.renderer.camera,
      sound: this.sound,
      toast: (text) => this.hud.toast(this.named(text)),
      popCounter: () => this.hud.popCounter(),
      rumble: (who, strength, ms) => {
        // Two controllers: each bear has its own. One controller: it gets everything.
        const pads = this.input.devices().filter((d) => d.kind === "gamepad")
        const targets = pads.length >= 2 ? (who === "both" ? [pads[0]!, pads[1]!] : [who === "mama" ? pads[0]! : pads[1]!]) : pads.slice(0, 1)
        for (const pad of targets) this.input.rumble(pad.id, strength, ms)
      }
    })
  }

  /** What we call the little one's bear. Dad can change it with N on the title screen. */
  get cubName() {
    return this.progress.cubName?.trim() || "Cub"
  }

  /** Swap "Cub" in any text for her chosen name. */
  private named(text: string) {
    return this.cubName === "Cub" ? text : text.replace(/\bCub\b/g, this.cubName)
  }

  /** Ask for a name (only from the title or map screen, so typing can't move the bears). */
  askName() {
    if (this.screen !== "title" && this.screen !== "map") return
    const name = window.prompt("What's Cub's name?", this.cubName === "Cub" ? "" : this.cubName)
    if (name === null) return
    this.progress = { ...this.progress, cubName: name.trim().slice(0, 16) }
    this.save.save(this.progress)
  }

  private firstUnfinished() {
    const index = LEVELS.findIndex((level) => !this.progress.levels[level.id]?.done)
    return index === -1 ? 0 : index
  }

  private unlocked = (index: number) => {
    const after = LEVELS[index]!.unlockAfter ?? LEVELS[index - 1]?.id
    return this.unlockAll || after === undefined || this.progress.levels[after]?.done === true
  }

  private loadLevel(index: number) {
    this.stage.dispose()
    this.levelIndex = index
    this.stage = this.makeStage(index)
    this.screen = "playing"
    this.menus.hide()
    this.hud.toast(LEVELS[index]!.title)
  }

  private menuStyle(): ButtonStyle {
    return this.input.devices().find((d) => d.kind === "gamepad")?.style ?? "keyboard"
  }

  private padCount = 0

  frame(dt: number) {
    this.input.poll()
    const devices = this.input.devices()
    // Let everyone know when a controller joins or leaves.
    const pads = devices.filter((d) => d.kind === "gamepad").length
    if (pads !== this.padCount) {
      if (pads > this.padCount) this.sound.play("pickup")
      this.hud.toast(
        pads >= 2 ? `🎮🎮 Mama = 1, ${this.cubName} = 2` : pads === 1 ? "🎮 Controller ready!" : "🎮 Controller gone"
      )
      this.padCount = pads
    }
    const style = this.menuStyle()

    if (this.screen === "playing") {
      const routed = this.router.route(devices)
      if (devices.some((d) => d.state.pressed.start)) {
        this.screen = "paused"
        this.pauseSelected = 0
        this.sound.play("swap")
      } else {
        this.play(dt, routed)
      }
    } else {
      this.menu(dt, style)
    }

    const stage = this.stage
    const playing = this.screen === "playing"
    this.hud.update(dt, {
      visible: playing,
      twoPlayer: devices.filter((d) => d.kind === "gamepad").length >= 2,
      active: this.router.active,
      mamaStyle: this.styleFor("mama", devices) ?? "keyboard",
      cubStyle: this.styleFor("cub", devices) ?? "keyboard",
      objective: playing ? this.named(stage.objective().text) : "",
      cubName: this.cubName,
      berries: stage.berries.collected,
      berriesTotal: stage.berries.total,
      butterflies: stage.butterfliesFound,
      butterfliesTotal: stage.butterfliesTotal,
      soundLocked: this.screen !== "title" && this.sound.isLocked()
    })
    this.prompts.update(playing ? stage.interactions.active : [], this.renderer.camera, ({ bear }) =>
      this.styleFor(bear.spec.id, devices) ?? "keyboard"
    )
    if (this.renderEnabled) this.render()
  }

  /** Automated tests turn rendering off and draw only when they take a screenshot. */
  renderEnabled = true

  render() {
    this.stage.render(this.renderer.renderer)
  }

  private styleFor(bear: "mama" | "cub", devices: ReturnType<Input["Service"]["devices"]>): ButtonStyle | undefined {
    const pads = devices.filter((d) => d.kind === "gamepad")
    if (pads.length >= 2) return (bear === "mama" ? pads[0] : pads[1])!.style
    return pads[0]?.style
  }

  private play(dt: number, routed: Routed) {
    if (routed.swapped) {
      this.sound.play("swap")
      this.hud.toast(this.router.active === "mama" ? "Playing as Mama" : `Playing as ${this.cubName}`)
    }
    this.stage.update(dt, routed)
    if (this.stage.completeTime > CELEBRATE_TIME) this.finishLevel()
  }

  private finishLevel() {
    const level = LEVELS[this.levelIndex]!
    const stats: LevelStats = {
      berries: this.stage.berries.collected,
      berriesTotal: this.stage.berries.total,
      butterflies: this.stage.butterfliesFound,
      butterfliesTotal: this.stage.butterfliesTotal
    }
    this.progress = recordResult(this.progress, level.id, { done: true, ...stats })
    this.save.save(this.progress)
    this.lastStats = stats
    this.screen = "complete"
  }

  private menu(dt: number, style: ButtonStyle) {
    const nav = this.nav.read(this.input.devices(), dt)
    // Keep the world gently alive behind the menus (no input reaches the bears).
    if (this.screen !== "paused" && this.screen !== "help") this.stage.update(dt, null)

    switch (this.screen) {
      case "title": {
        this.menus.showTitle(style, this.cubName, this.padCount)
        if (nav.confirm || nav.start) {
          this.sound.unlock()
          this.sound.play("success")
          this.screen = "map"
        }
        return
      }
      case "map": {
        if (nav.left) this.mapSelected = Math.max(0, this.mapSelected - 1)
        if (nav.right) this.mapSelected = Math.min(LEVELS.length - 1, this.mapSelected + 1)
        if (nav.left || nav.right) this.sound.play("pop")
        this.menus.showMap(LEVELS, this.progress, this.unlocked, this.mapSelected, style)
        if (nav.confirm) {
          if (this.unlocked(this.mapSelected)) {
            this.sound.play("pickup")
            this.loadLevel(this.mapSelected)
          } else {
            this.sound.play("miss")
          }
        }
        if (nav.back) this.screen = "title"
        return
      }
      case "paused": {
        if (nav.up) this.pauseSelected = (this.pauseSelected + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length
        if (nav.down) this.pauseSelected = (this.pauseSelected + 1) % PAUSE_ITEMS.length
        this.menus.showPause(PAUSE_ITEMS, this.pauseSelected, style)
        if (nav.back || nav.start || (nav.confirm && this.pauseSelected === 0)) {
          this.screen = "playing"
          this.menus.hide()
        } else if (nav.confirm && this.pauseSelected === 1) {
          this.screen = "help"
        } else if (nav.confirm && this.pauseSelected === 2) {
          this.loadLevel(this.levelIndex)
        } else if (nav.confirm && this.pauseSelected === 3) {
          this.mapSelected = this.levelIndex
          this.screen = "map"
        }
        return
      }
      case "help": {
        this.menus.showHelp(style)
        if (nav.confirm || nav.back || nav.start) this.screen = "paused"
        return
      }
      case "complete": {
        const last = LEVELS[this.levelIndex]!.finale === true
        this.menus.showComplete(LEVELS[this.levelIndex]!, this.lastStats!, last, style)
        if (nav.confirm) {
          this.sound.play("pickup")
          if (last) {
            this.screen = "credits"
          } else {
            this.mapSelected = Math.min(LEVELS.length - 1, this.levelIndex + 1)
            this.screen = "map"
          }
        }
        return
      }
      case "credits": {
        this.menus.showCredits(style, this.cubName)
        if (nav.confirm) {
          this.mapSelected = 0
          this.screen = "map"
        }
        return
      }
      case "playing":
        return
    }
  }
}

/** Wires the Effect services into the game and runs the frame loop until the layer is torn down. */
export const GameLive = Layer.effectDiscard(
  Effect.gen(function*() {
    const renderer = yield* Renderer
    const physics = yield* Physics
    const input = yield* Input
    const sound = yield* Sound
    const save = yield* Save
    const hud = yield* Hud

    const session = yield* Effect.acquireRelease(
      Effect.sync(() => new Session(renderer, physics, input, sound, save, hud.root)),
      (session) => Effect.sync(() => session.stage.dispose())
    )
    // Handy for poking at the game from the browser console while developing.
    if (import.meta.env.DEV) Object.assign(window, { session })

    // N on the title screen: give Cub a name.
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "KeyN") session.askName()
    }
    yield* Effect.acquireRelease(
      Effect.sync(() => window.addEventListener("keydown", onKey)),
      () => Effect.sync(() => window.removeEventListener("keydown", onKey))
    )

    const loop = Effect.callback<never>(() => {
      let last = performance.now()
      let handle = requestAnimationFrame(function tick(now) {
        // Clamp so a background tab doesn't explode the physics when it comes back.
        const dt = Math.min((now - last) / 1000, 1 / 30)
        last = now
        session.frame(dt)
        handle = requestAnimationFrame(tick)
      })
      return Effect.sync(() => cancelAnimationFrame(handle))
    })

    // `?manual` stops the real-time loop so automated playtests can step frames themselves.
    if (!new URLSearchParams(location.search).has("manual")) yield* Effect.forkScoped(loop)
  })
)
