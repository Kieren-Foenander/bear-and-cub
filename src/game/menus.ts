import { type ButtonStyle, type Device, mergePads } from "../services/Input.ts"
import type { Progress } from "../services/Save.ts"
import type { LevelDef } from "./levels/types.ts"
import { buttonHtml } from "./prompts.ts"

/** Menu input from every device at once: whoever presses, it works. */
export class MenuNav {
  private heldDir = ""
  private repeat = 0

  read(devices: ReadonlyArray<Device>, dt: number) {
    const pad = mergePads(devices.map((d) => d.state))
    const dir =
      pad.moveX > 0.5 ? "right" : pad.moveX < -0.5 ? "left" : pad.moveY > 0.5 ? "down" : pad.moveY < -0.5 ? "up" : ""
    let fire = ""
    if (dir !== this.heldDir) {
      fire = dir
      this.repeat = 0.4
    } else if (dir) {
      this.repeat -= dt
      if (this.repeat <= 0) {
        fire = dir
        this.repeat = 0.18
      }
    }
    this.heldDir = dir
    return {
      left: fire === "left",
      right: fire === "right",
      up: fire === "up",
      down: fire === "down",
      confirm: pad.pressed.a,
      back: pad.pressed.b,
      start: pad.pressed.start
    }
  }
}

export interface LevelStats {
  readonly berries: number
  readonly berriesTotal: number
  readonly butterflies: number
  readonly butterfliesTotal: number
}

const el = (className: string) => {
  const div = document.createElement("div")
  div.className = className
  return div
}

/** The full-screen screens. Only one shows at a time. */
export class Menus {
  private readonly title = el("screen title-screen")
  private readonly map = el("screen map-screen")
  private readonly pause = el("screen pause-screen")
  private readonly complete = el("screen complete-screen")
  private readonly credits = el("screen credits-screen")
  private readonly help = el("screen help-screen")

  constructor(root: HTMLElement) {
    root.append(this.title, this.map, this.pause, this.complete, this.credits, this.help)
    this.hide()
  }

  hide() {
    for (const screen of [this.title, this.map, this.pause, this.complete, this.credits, this.help]) screen.classList.remove("show")
  }

  private show(screen: HTMLElement, html: string) {
    this.hide()
    if (screen.dataset.html !== html) {
      screen.innerHTML = html
      screen.dataset.html = html
    }
    screen.classList.add("show")
  }

  showTitle(style: ButtonStyle, cubName: string) {
    this.show(
      this.title,
      `<div class="title">Bear <span>&amp;</span> Cub</div>
       <div class="subtitle">A cosy adventure for two</div>
       <div class="start-press">Press ${buttonHtml("a", style)} to start</div>
       <div class="start-name">${cubName === "Cub" ? "Grown-ups: press <em>N</em> to give Cub a name" : `Playing as Mama and <b>${cubName}</b> · <em>N</em> to change`}</div>
       <div class="start-help">
         <div><b>1 controller?</b> Press <em>Back / Select</em> (or <em>Tab</em>) to switch bears.</div>
         <div><b>2 controllers?</b> Controller 1 is Mama, controller 2 is Cub.</div>
         <div class="keys">Keyboard: <em>WASD</em> move · <em>Space</em> jump · <em>E</em> action · <em>Q</em> swipe · <em>R</em> throw / call · <em>Tab</em> switch · <em>Esc</em> pause</div>
       </div>`
    )
  }

  showMap(levels: ReadonlyArray<LevelDef>, progress: Progress, unlocked: (index: number) => boolean, selected: number, style: ButtonStyle) {
    const cards = levels
      .map((level, i) => {
        const result = progress.levels[level.id]
        const locked = !unlocked(i)
        const stats = result
          ? `<div class="card-stats">🍓 ${result.berries}/${result.berriesTotal} &nbsp; 🦋 ${result.butterflies}/${result.butterfliesTotal}</div>`
          : `<div class="card-stats">&nbsp;</div>`
        return `<div class="card ${i === selected ? "selected" : ""} ${locked ? "locked" : ""} ${result?.done ? "done" : ""}">
          <div class="card-number">${i + 1}</div>
          <div class="card-emoji">${locked ? "🔒" : level.emoji}</div>
          <div class="card-title">${level.title}</div>
          <div class="card-teaches">${level.teaches}</div>
          ${stats}
          ${result?.done ? `<div class="card-done">✓</div>` : ""}
        </div>`
      })
      .join("")
    this.show(
      this.map,
      `<div class="map-title">Where shall we go?</div>
       <div class="cards">${cards}</div>
       <div class="menu-hint">${unlocked(selected) ? `◀ ▶ choose &nbsp; ${buttonHtml("a", style)} let's go!` : "🔒 Finish the one before to open this one!"}</div>`
    )
  }

  showPause(items: ReadonlyArray<string>, selected: number, style: ButtonStyle) {
    this.show(
      this.pause,
      `<div class="menu-title">Paused</div>
       <div class="menu-list">${items.map((item, i) => `<div class="menu-item ${i === selected ? "selected" : ""}">${item}</div>`).join("")}</div>
       <div class="menu-hint">▲ ▼ choose &nbsp; ${buttonHtml("a", style)} ok</div>`
    )
  }

  showComplete(level: LevelDef, stats: LevelStats, last: boolean, style: ButtonStyle) {
    const berryStars = stats.berriesTotal > 0 && stats.berries === stats.berriesTotal ? " ⭐" : ""
    const butterflyStars = stats.butterfliesTotal > 0 && stats.butterflies === stats.butterfliesTotal ? " ⭐" : ""
    this.show(
      this.complete,
      `<div class="complete-emoji">${level.emoji}</div>
       <div class="menu-title">You did it!</div>
       <div class="complete-sub">${level.title} complete</div>
       <div class="complete-stats">
         <div>🍓 ${stats.berries} / ${stats.berriesTotal}${berryStars}</div>
         <div>🦋 ${stats.butterflies} / ${stats.butterfliesTotal}${butterflyStars}</div>
       </div>
       <div class="menu-hint">${buttonHtml("a", style)} ${last ? "the end…" : "next adventure"}</div>`
    )
  }

  showHelp(style: ButtonStyle) {
    const b = (button: Parameters<typeof buttonHtml>[0]) => buttonHtml(button, style)
    const row = (buttons: string, what: string) => `<div class="help-row"><div class="help-buttons">${buttons}</div><div>${what}</div></div>`
    this.show(
      this.help,
      `<div class="menu-title">How to play</div>
       <div class="help-card">
         ${row(b("move"), "Walk and run")}
         ${row(b("a"), "Jump")}
         ${row(b("b"), "Do things: push, boop, pick up… or roar!")}
         ${row(b("x"), "Swipe (best at the top of a jump)")}
         ${row(b("y"), "Mama: throw Cub, or call Cub back")}
         ${row(b("swap"), "One controller? Switch bears")}
         ${row(`${b("b")} + ${b("b")}`, "Roar together, close up, for a bear hug ❤️")}
       </div>
       <div class="menu-hint">${b("a")} back</div>`
    )
  }

  showCredits(style: ButtonStyle, cubName: string) {
    this.show(
      this.credits,
      `<div class="credits-bears">🐻🧸</div>
       <div class="title">The End</div>
       <div class="subtitle">Mama and Cub found all the honey!</div>
       <div class="credits-text">Thank you for playing, ${cubName}.<br/>You were amazing at helping Mama.</div>
       <div class="credits-small">Made with love by Dad</div>
       <div class="menu-hint">${buttonHtml("a", style)} back to the map</div>`
    )
  }
}
