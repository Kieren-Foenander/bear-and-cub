import { type ButtonStyle, type Device, emptyPad, mergePads, type PadState } from "../services/Input.ts"
import type { BearId } from "./bear.ts"

export interface Routed {
  readonly mama: PadState | null
  readonly cub: PadState | null
  readonly mamaStyle: ButtonStyle
  readonly cubStyle: ButtonStyle
  readonly twoPlayer: boolean
  /** Which bear the shared controller / keyboard is driving. */
  readonly active: BearId
  readonly swapped: boolean
  readonly anyPressed: boolean
}

/**
 * Decides which device drives which bear.
 *
 * - Two or more controllers: controller 1 is Mama, controller 2 is Cub.
 * - One controller (or just a keyboard): it drives one bear at a time, and Back/Select (or Tab) switches.
 * - The keyboard always drives whichever bear is "active", handy for testing next to a controller.
 */
export class ControlRouter {
  active: BearId = "mama"

  route(devices: ReadonlyArray<Device>): Routed {
    const keyboard = devices.find((d) => d.kind === "keyboard")
    const pads = devices.filter((d) => d.kind === "gamepad")
    const twoPlayer = pads.length >= 2
    const anyPressed = devices.some((d) => d.state.pressed.a || d.state.pressed.start || d.state.pressed.b)

    let swapped = false
    const shared = twoPlayer ? (keyboard ? [keyboard] : []) : devices.slice()
    if (shared.some((d) => d.state.pressed.swap)) {
      this.active = this.active === "mama" ? "cub" : "mama"
      swapped = true
    }
    const sharedPad = shared.length > 0 ? mergePads(shared.map((d) => d.state)) : emptyPad()
    const sharedStyle: ButtonStyle = pads[0] && !twoPlayer ? pads[0].style : "keyboard"

    if (twoPlayer) {
      const [mamaPad, cubPad] = pads
      const withKeyboard = (pad: PadState, bear: BearId) => (this.active === bear ? mergePads([pad, sharedPad]) : pad)
      return {
        mama: withKeyboard(mamaPad!.state, "mama"),
        cub: withKeyboard(cubPad!.state, "cub"),
        mamaStyle: mamaPad!.style,
        cubStyle: cubPad!.style,
        twoPlayer,
        active: this.active,
        swapped,
        anyPressed
      }
    }

    return {
      mama: this.active === "mama" ? sharedPad : null,
      cub: this.active === "cub" ? sharedPad : null,
      mamaStyle: sharedStyle,
      cubStyle: sharedStyle,
      twoPlayer,
      active: this.active,
      swapped,
      anyPressed
    }
  }
}
