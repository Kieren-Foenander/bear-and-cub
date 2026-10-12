import * as THREE from "three"
import type { Button, ButtonStyle } from "../services/Input.ts"
import type { ActivePrompt } from "./interactions.ts"

/** Prompts can show real buttons, or "move the stick". */
export type Glyph = Button | "move"

const GLYPHS: Record<ButtonStyle, Record<Glyph, { text: string; color: string }>> = {
  xbox: {
    a: { text: "A", color: "#3fbf4f" },
    b: { text: "B", color: "#e5484d" },
    x: { text: "X", color: "#3b82f6" },
    y: { text: "Y", color: "#f5c518" },
    swap: { text: "⧉", color: "#666" },
    start: { text: "☰", color: "#666" },
    move: { text: "🕹️", color: "#5d6b7a" }
  },
  playstation: {
    a: { text: "✕", color: "#5b8def" },
    b: { text: "○", color: "#e5484d" },
    x: { text: "□", color: "#e46fbe" },
    y: { text: "△", color: "#2fbf9f" },
    swap: { text: "⧉", color: "#666" },
    start: { text: "☰", color: "#666" },
    move: { text: "🕹️", color: "#5d6b7a" }
  },
  keyboard: {
    a: { text: "Space", color: "#3fbf4f" },
    b: { text: "E", color: "#e5484d" },
    x: { text: "Q", color: "#3b82f6" },
    y: { text: "R", color: "#f5c518" },
    swap: { text: "Tab", color: "#666" },
    start: { text: "Enter", color: "#666" },
    move: { text: "WASD", color: "#5d6b7a" }
  }
}

export const buttonHtml = (button: Glyph, style: ButtonStyle) => {
  const glyph = GLYPHS[style][button]
  const wide = style === "keyboard" && glyph.text.length > 1 ? " wide" : ""
  return `<span class="btn${wide}" style="--btn:${glyph.color}">${glyph.text}</span>`
}

/** Big floating button prompts, positioned over the 3D world each frame. */
export class Prompts {
  private readonly elements = new Map<string, HTMLElement>()
  private readonly projected = new THREE.Vector3()

  constructor(private readonly root: HTMLElement) {}

  update(prompts: ReadonlyArray<ActivePrompt>, camera: THREE.Camera, styleFor: (prompt: ActivePrompt) => ButtonStyle) {
    const seen = new Set<string>()
    for (const prompt of prompts) {
      const { interaction, bear, progress, view } = prompt
      const style = styleFor(prompt)
      // A new key when the buttons change, so the new button pops in.
      const key = `${interaction.id}:${style}:${view.buttons.join("+")}`
      seen.add(key)
      let el = this.elements.get(key)
      if (!el) {
        el = document.createElement("div")
        el.className = `prompt ${bear.spec.id} ${interaction.kind}`
        const buttons = view.buttons.map((b) => buttonHtml(b, style)).join(`<span class="plus">+</span>`)
        el.innerHTML = `
          <div class="prompt-buttons">${buttons}</div>
          <div class="prompt-label"></div>
          ${interaction.kind === "mash" ? `<div class="prompt-bar"><div class="prompt-fill"></div></div>` : ""}`
        this.root.appendChild(el)
        this.elements.set(key, el)
      }
      const label = el.querySelector<HTMLElement>(".prompt-label")!
      if (label.textContent !== view.label) label.textContent = view.label
      el.classList.toggle("now", view.now === true)
      this.projected.copy(interaction.anchor()).project(camera)
      const x = (this.projected.x * 0.5 + 0.5) * window.innerWidth
      const y = (-this.projected.y * 0.5 + 0.5) * window.innerHeight
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
      el.style.display = this.projected.z < 1 ? "" : "none"
      const fill = el.querySelector<HTMLElement>(".prompt-fill")
      if (fill) fill.style.width = `${Math.round(progress * 100)}%`
    }
    for (const [key, el] of this.elements) {
      if (!seen.has(key)) {
        el.remove()
        this.elements.delete(key)
      }
    }
  }
}
