import type { ButtonStyle } from "../services/Input.ts"
import type { BearId } from "./bear.ts"
import { buttonHtml } from "./prompts.ts"

const el = (className: string, html = "") => {
  const div = document.createElement("div")
  div.className = className
  div.innerHTML = html
  return div
}

export interface HudState {
  readonly twoPlayer: boolean
  readonly active: BearId
  readonly mamaStyle: ButtonStyle
  readonly cubStyle: ButtonStyle
  readonly objective: string
  readonly butterflies: number
  readonly butterfliesTotal: number
  readonly soundLocked: boolean
}

/** All the big, friendly, readable-from-the-couch bits of UI. */
export class GameHud {
  private readonly start: HTMLElement
  private readonly players: HTMLElement
  private readonly objective: HTMLElement
  private readonly counter: HTMLElement
  private readonly toastEl: HTMLElement
  private readonly sound: HTMLElement
  private toastTimer = 0
  private lastPlayers = ""
  private lastObjective = ""
  private lastCount = -1

  constructor(root: HTMLElement) {
    this.start = el(
      "start-screen",
      `<div class="title">Bear <span>&amp;</span> Cub</div>
       <div class="subtitle">A cosy adventure for two</div>
       <div class="start-press">Press <span class="start-buttons"></span> to start</div>
       <div class="start-help">
         <div><b>1 controller?</b> Press <em>Back / Select</em> (or <em>Tab</em>) to switch bears.</div>
         <div><b>2 controllers?</b> Controller 1 is Mama, controller 2 is Cub.</div>
         <div class="keys">Keyboard: <em>WASD</em> move · <em>Space</em> jump · <em>E</em> action · <em>Q</em>/<em>R</em> X/Y · <em>Tab</em> switch</div>
       </div>`
    )
    this.players = el("players")
    this.objective = el("objective")
    this.counter = el("counter")
    this.toastEl = el("toast")
    this.sound = el("sound-hint", "🔇 Click anywhere for sound")
    root.append(this.start, this.players, this.objective, this.counter, this.toastEl, this.sound)
    this.setStartStyle("xbox")
  }

  setStartStyle(style: ButtonStyle) {
    this.start.querySelector(".start-buttons")!.innerHTML = buttonHtml("a", style)
  }

  hideStart() {
    this.start.classList.add("hidden")
  }

  toast(text: string) {
    this.toastEl.textContent = text
    this.toastEl.classList.remove("show")
    void this.toastEl.offsetWidth
    this.toastEl.classList.add("show")
    this.toastTimer = 2.2
  }

  popCounter() {
    this.counter.classList.remove("pop")
    void this.counter.offsetWidth
    this.counter.classList.add("pop")
  }

  update(dt: number, state: HudState) {
    this.toastTimer -= dt
    if (this.toastTimer <= 0) this.toastEl.classList.remove("show")

    const players = JSON.stringify([state.twoPlayer, state.active, state.mamaStyle, state.cubStyle])
    if (players !== this.lastPlayers) {
      this.lastPlayers = players
      const card = (id: BearId, name: string, who: string) => {
        const active = state.twoPlayer || state.active === id
        return `<div class="player ${id} ${active ? "active" : ""}">
          <div class="player-name">${name}</div>
          <div class="player-who">${who}</div>
        </div>`
      }
      const mamaWho = state.twoPlayer ? "Controller 1" : state.active === "mama" ? "Playing" : "Waiting"
      const cubWho = state.twoPlayer ? "Controller 2" : state.active === "cub" ? "Playing" : "Waiting"
      const swap = state.twoPlayer
        ? ""
        : `<div class="swap-hint">${buttonHtml("swap", state.mamaStyle)} switch bear</div>`
      this.players.innerHTML =
        card("mama", "Mama Bear", mamaWho) + card("cub", "Cub", cubWho) + swap
    }

    if (state.objective !== this.lastObjective) {
      this.lastObjective = state.objective
      this.objective.textContent = state.objective
      this.objective.classList.remove("pop")
      void this.objective.offsetWidth
      this.objective.classList.add("pop")
    }

    if (state.butterflies !== this.lastCount) {
      this.lastCount = state.butterflies
      this.counter.innerHTML = `<span class="counter-icon">🦋</span> ${state.butterflies} / ${state.butterfliesTotal}`
    }

    this.sound.style.display = state.soundLocked ? "" : "none"
  }
}
