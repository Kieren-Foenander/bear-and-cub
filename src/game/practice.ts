import type { Button, ButtonStyle, PadState } from "../services/Input.ts"
import type { SoundName } from "../services/Sound.ts"
import { buttonHtml } from "./prompts.ts"

type Target = { readonly kind: "button"; readonly button: Button } | { readonly kind: "stick"; readonly dir: "left" | "right" | "up" | "down" }

const FACE: ReadonlyArray<Button> = ["a", "b", "x", "y"]
const DIRS = ["left", "right", "up", "down"] as const
const ARROWS = { left: "⬅️", right: "➡️", up: "⬆️", down: "⬇️" } as const

/** What we call each button out loud, per controller type ("the green A"). */
const NAMES: Record<ButtonStyle, Record<"a" | "b" | "x" | "y", string>> = {
  xbox: { a: "the green A", b: "the red B", x: "the blue X", y: "the yellow Y" },
  playstation: { a: "the blue cross ✕", b: "the red circle ○", x: "the pink square □", y: "the green triangle △" },
  keyboard: { a: "Space", b: "E", x: "Q", y: "R" }
}

const FLOWERS = ["🌸", "🌼", "🌷", "🌻", "🌺", "💐", "🌹", "🪻"]

/**
 * Button practice: a big button shows up ("Press the green A!"), press it and a flower grows.
 * The first round goes through every face button and stick direction in order, then they mix up.
 * A gentle way to learn where everything is on the controller.
 */
export class ButtonPractice {
  private readonly el = document.createElement("div")
  private targets: Array<Target> = []
  private index = 0
  private grown = 0
  private round = 0
  private hint = ""
  private hintTime = 0
  private cheerTime = 0
  private lastHtml = ""
  private stickArmed = true

  constructor(
    root: HTMLElement,
    private readonly sound: (name: SoundName) => void,
    private readonly note: (index: number) => void
  ) {
    this.el.className = "screen practice-screen"
    root.append(this.el)
  }

  open() {
    this.round = 0
    this.newRound()
    this.el.classList.add("show")
  }

  close() {
    this.el.classList.remove("show")
  }

  private newRound() {
    const ordered: Array<Target> = [...FACE.map((button) => ({ kind: "button" as const, button })), ...DIRS.map((dir) => ({ kind: "stick" as const, dir }))]
    // First time through: in order. After that: shuffled, so it's a game of "find it!".
    this.targets = this.round === 0 ? ordered : ordered.sort(() => Math.random() - 0.5)
    this.index = 0
    this.grown = 0
    this.round++
  }

  /** Returns "exit" when they want to go back to the map. */
  update(dt: number, pad: PadState, style: ButtonStyle): "exit" | null {
    if (pad.pressed.start) return "exit"
    this.hintTime -= dt
    this.cheerTime -= dt

    if (this.cheerTime <= 0 && this.index >= this.targets.length) this.newRound()

    const target = this.targets[this.index]
    if (target && this.cheerTime <= 0) {
      const pressed = FACE.find((button) => pad.pressed[button])
      const stick = Math.hypot(pad.moveX, pad.moveY)
      if (stick < 0.3) this.stickArmed = true
      const dir: (typeof DIRS)[number] | null =
        stick < 0.7 || !this.stickArmed ? null : Math.abs(pad.moveX) > Math.abs(pad.moveY) ? (pad.moveX < 0 ? "left" : "right") : pad.moveY < 0 ? "up" : "down"
      const right = target.kind === "button" ? pressed === target.button : dir === target.dir
      if (right) {
        this.success()
      } else if (pressed) {
        this.sound("miss")
        this.hint = target.kind === "button" ? `Look for ${NAMES[style][target.button as "a"]}!` : "Use the stick this time! 🕹️"
        this.hintTime = 1.8
      } else if (dir) {
        this.stickArmed = false
        if (target.kind === "stick") {
          this.sound("miss")
          this.hint = `The other way! ${ARROWS[target.dir]}`
          this.hintTime = 1.5
        }
      }
    }
    this.render(style)
    return null
  }

  private success() {
    this.note(this.grown + 2)
    this.sound("pop")
    this.stickArmed = false
    this.grown++
    this.index++
    this.hintTime = 0
    if (this.index >= this.targets.length) {
      this.sound("success")
      this.cheerTime = 2.5
    }
  }

  private render(style: ButtonStyle) {
    const target = this.targets[this.index]
    const garden = this.targets.map((_, i) => `<span class="${i < this.grown ? "bloom" : "sprout"}">${i < this.grown ? FLOWERS[i % FLOWERS.length] : "🌱"}</span>`).join("")
    let big = ""
    let text = ""
    if (this.cheerTime > 0 || !target) {
      big = `<div class="practice-big">🎉</div>`
      text = "Wow! A whole garden of flowers!"
    } else if (target.kind === "button") {
      big = `<div class="practice-big">${buttonHtml(target.button, style)}</div>`
      text = style === "keyboard" ? `Press ${NAMES.keyboard[target.button as "a"]}!` : `Press ${NAMES[style][target.button as "a"]}!`
    } else {
      big = `<div class="practice-big practice-stick">${buttonHtml("move", style)}<span>${ARROWS[target.dir]}</span></div>`
      text = `Push the stick ${target.dir}!`
    }
    const html = `
      <div class="menu-title">Button practice</div>
      <div class="practice-garden">${garden}</div>
      ${big}
      <div class="practice-text">${text}</div>
      <div class="practice-hint">${this.hintTime > 0 ? this.hint : "&nbsp;"}</div>
      <div class="menu-hint">${buttonHtml("start", style)} back to the map</div>`
    if (html !== this.lastHtml) {
      this.el.innerHTML = html
      this.lastHtml = html
    }
  }
}
