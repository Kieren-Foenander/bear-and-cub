import { Context, Effect, Layer } from "effect"

export const BUTTONS = ["a", "b", "x", "y", "swap", "start"] as const
export type Button = (typeof BUTTONS)[number]

export type ButtonStyle = "xbox" | "playstation" | "keyboard"

/** One frame of input from a single device (or several devices merged). */
export interface PadState {
  /** Left stick / WASD, x: right is +, y: down (towards the camera) is +. */
  moveX: number
  moveY: number
  held: Record<Button, boolean>
  pressed: Record<Button, boolean>
}

export interface Device {
  readonly id: string
  readonly kind: "keyboard" | "gamepad"
  readonly style: ButtonStyle
  readonly state: PadState
  /** True once the device has been touched at least once (keyboard only shows up after a key press). */
  readonly used: boolean
}

export const emptyPad = (): PadState => ({
  moveX: 0,
  moveY: 0,
  held: { a: false, b: false, x: false, y: false, swap: false, start: false },
  pressed: { a: false, b: false, x: false, y: false, swap: false, start: false }
})

export const mergePads = (pads: ReadonlyArray<PadState>): PadState => {
  const out = emptyPad()
  for (const pad of pads) {
    out.moveX += pad.moveX
    out.moveY += pad.moveY
    for (const button of BUTTONS) {
      out.held[button] ||= pad.held[button]
      out.pressed[button] ||= pad.pressed[button]
    }
  }
  const length = Math.hypot(out.moveX, out.moveY)
  if (length > 1) {
    out.moveX /= length
    out.moveY /= length
  }
  return out
}

const KEYMAP: Record<string, Button> = {
  Space: "a",
  KeyK: "a",
  KeyE: "b",
  KeyL: "b",
  KeyQ: "x",
  KeyJ: "x",
  KeyR: "y",
  KeyI: "y",
  Tab: "swap",
  Enter: "start",
  Escape: "start"
}

// Standard gamepad mapping: https://w3c.github.io/gamepad/#remapping
const PAD_BUTTONS: ReadonlyArray<readonly [number, Button]> = [
  [0, "a"],
  [1, "b"],
  [2, "x"],
  [3, "y"],
  [8, "swap"],
  [9, "start"]
]

const DEADZONE = 0.2

const deadzone = (x: number, y: number): [number, number] => {
  const length = Math.hypot(x, y)
  if (length < DEADZONE) return [0, 0]
  const scaled = Math.min(1, (length - DEADZONE) / (1 - DEADZONE))
  return [(x / length) * scaled, (y / length) * scaled]
}

const styleFor = (id: string): ButtonStyle => {
  const lower = id.toLowerCase()
  return /054c|playstation|dualsense|dualshock|wireless controller/.test(lower) ? "playstation" : "xbox"
}

export class Input extends Context.Service<Input, {
  /** Sample every device. Call exactly once per frame before reading `devices`. */
  readonly poll: () => void
  readonly devices: () => ReadonlyArray<Device>
  /** Buzz a controller (by device id). Strength 0..1. Does nothing for keyboards / unsupported pads. */
  readonly rumble: (deviceId: string, strength: number, ms: number) => void
}>()("bears/services/Input") {
  static readonly layer = Layer.effect(
    Input,
    Effect.gen(function*() {
      const keysDown = new Set<string>()
      let keyboardUsed = false

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Tab" || event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault()
        keysDown.add(event.code)
        keyboardUsed = true
      }
      const onKeyUp = (event: KeyboardEvent) => keysDown.delete(event.code)
      const onBlur = () => keysDown.clear()

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          window.addEventListener("keydown", onKeyDown)
          window.addEventListener("keyup", onKeyUp)
          window.addEventListener("blur", onBlur)
        }),
        () =>
          Effect.sync(() => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("keyup", onKeyUp)
            window.removeEventListener("blur", onBlur)
          })
      )

      const previous = new Map<string, Record<Button, boolean>>()
      let current: Array<Device> = []

      const finish = (id: string, state: PadState) => {
        const before = previous.get(id)
        for (const button of BUTTONS) {
          state.pressed[button] = state.held[button] && !(before?.[button] ?? false)
        }
        previous.set(id, { ...state.held })
      }

      const pollKeyboard = (): Device => {
        const state = emptyPad()
        const down = (...codes: Array<string>) => codes.some((code) => keysDown.has(code))
        state.moveX = (down("KeyD", "ArrowRight") ? 1 : 0) - (down("KeyA", "ArrowLeft") ? 1 : 0)
        state.moveY = (down("KeyS", "ArrowDown") ? 1 : 0) - (down("KeyW", "ArrowUp") ? 1 : 0)
        const length = Math.hypot(state.moveX, state.moveY)
        if (length > 1) {
          state.moveX /= length
          state.moveY /= length
        }
        for (const [code, button] of Object.entries(KEYMAP)) {
          if (keysDown.has(code)) state.held[button] = true
        }
        finish("keyboard", state)
        return { id: "keyboard", kind: "keyboard", style: "keyboard", state, used: keyboardUsed }
      }

      const pollGamepad = (pad: Gamepad): Device => {
        const state = emptyPad()
        ;[state.moveX, state.moveY] = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
        // The d-pad also moves, it's often easier for little thumbs.
        const isDown = (index: number) => pad.buttons[index]?.pressed ?? false
        if (isDown(12)) state.moveY = -1
        if (isDown(13)) state.moveY = 1
        if (isDown(14)) state.moveX = -1
        if (isDown(15)) state.moveX = 1
        for (const [index, button] of PAD_BUTTONS) {
          if (isDown(index)) state.held[button] = true
        }
        const id = `gamepad-${pad.index}`
        finish(id, state)
        return { id, kind: "gamepad", style: styleFor(pad.id), state, used: true }
      }

      const poll = () => {
        const devices: Array<Device> = [pollKeyboard()]
        for (const pad of navigator.getGamepads()) {
          if (pad && pad.connected) devices.push(pollGamepad(pad))
        }
        current = devices
      }

      const rumble = (deviceId: string, strength: number, ms: number) => {
        const index = Number(deviceId.replace("gamepad-", ""))
        if (!deviceId.startsWith("gamepad-") || Number.isNaN(index)) return
        const pad = navigator.getGamepads()[index]
        // Not every browser/controller supports rumble; it's a bonus, never required.
        void pad?.vibrationActuator?.playEffect("dual-rumble", {
          duration: ms,
          strongMagnitude: Math.min(1, strength),
          weakMagnitude: Math.min(1, strength * 0.8)
        })?.catch(() => {})
      }

      return Input.of({ poll, devices: () => current, rumble })
    })
  )
}
