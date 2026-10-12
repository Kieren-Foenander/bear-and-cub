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
  readonly visible: boolean
  readonly twoPlayer: boolean
  readonly active: BearId
  readonly mamaStyle: ButtonStyle
  readonly cubStyle: ButtonStyle
  readonly objective: string
  readonly berries: number
  readonly berriesTotal: number
  readonly butterflies: number
  readonly butterfliesTotal: number
  readonly soundLocked: boolean
  readonly cubName: string
}

/** All the big, friendly, readable-from-the-couch bits of in-game UI. */
export class GameHud {
  private readonly layer = el("game-hud")
  private readonly players = el("players")
  private readonly objective = el("objective")
  private readonly counters = el("counters")
  private readonly toastEl = el("toast")
  private readonly sound = el("sound-hint", "🔇 Click anywhere for sound")
  private toastTimer = 0
  private lastPlayers = ""
  private lastObjective = ""
  private lastCounts = ""

  constructor(root: HTMLElement) {
    this.layer.append(this.players, this.objective, this.counters)
    root.append(this.layer, this.toastEl, this.sound)
  }

  toast(text: string) {
    this.toastEl.textContent = text
    this.toastEl.classList.remove("show")
    void this.toastEl.offsetWidth
    this.toastEl.classList.add("show")
    this.toastTimer = 2.2
  }

  popCounter() {
    this.counters.classList.remove("pop")
    void this.counters.offsetWidth
    this.counters.classList.add("pop")
  }

  update(dt: number, state: HudState) {
    this.toastTimer -= dt
    if (this.toastTimer <= 0) this.toastEl.classList.remove("show")
    this.layer.classList.toggle("hidden", !state.visible)
    this.toastEl.style.visibility = state.visible ? "" : "hidden"

    const players = JSON.stringify([state.twoPlayer, state.active, state.mamaStyle, state.cubName])
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
      const swap = state.twoPlayer ? "" : `<div class="swap-hint">${buttonHtml("swap", state.mamaStyle)} switch bear</div>`
      this.players.innerHTML = card("mama", "Mama Bear", mamaWho) + card("cub", state.cubName, cubWho) + swap
    }

    if (state.objective !== this.lastObjective) {
      this.lastObjective = state.objective
      this.objective.textContent = state.objective
      this.objective.classList.remove("pop")
      void this.objective.offsetWidth
      this.objective.classList.add("pop")
    }

    const counts = `${state.berries}/${state.berriesTotal}/${state.butterflies}/${state.butterfliesTotal}`
    if (counts !== this.lastCounts) {
      this.lastCounts = counts
      const butterflies = state.butterfliesTotal > 0 ? `<span>🦋 ${state.butterflies} / ${state.butterfliesTotal}</span>` : ""
      this.counters.innerHTML = `<span>🍓 ${state.berries} / ${state.berriesTotal}</span>${butterflies}`
    }

    this.sound.style.display = state.soundLocked ? "" : "none"
  }
}
