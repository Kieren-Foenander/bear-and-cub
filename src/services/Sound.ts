import { Context, Effect, Layer } from "effect"

/** C major pentatonic, so any sequence of notes sounds nice. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]

export type SoundName =
  | "jump"
  | "bigJump"
  | "land"
  | "pickup"
  | "putdown"
  | "throw"
  | "splash"
  | "smash"
  | "found"
  | "push"
  | "roar"
  | "cubRoar"
  | "lever"
  | "success"
  | "swap"

export class Sound extends Context.Service<Sound, {
  readonly play: (name: SoundName) => void
  /** Plays the nth note of a pentatonic scale, used for flowers. */
  readonly note: (index: number) => void
  /** Browsers only allow audio after a click or key press. */
  readonly unlock: () => void
  readonly isLocked: () => boolean
}>()("bears/services/Sound") {
  static readonly layer = Layer.effect(
    Sound,
    Effect.gen(function*() {
      const ctx = yield* Effect.acquireRelease(
        Effect.sync(() => new AudioContext()),
        (ctx) => Effect.promise(() => ctx.close())
      )
      // Any click or key press counts as permission to play audio.
      const resume = () => void ctx.resume()
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          window.addEventListener("pointerdown", resume)
          window.addEventListener("keydown", resume)
        }),
        () =>
          Effect.sync(() => {
            window.removeEventListener("pointerdown", resume)
            window.removeEventListener("keydown", resume)
          })
      )

      const master = ctx.createGain()
      master.gain.value = 0.35
      master.connect(ctx.destination)

      const tone = (
        freq: number,
        options: { type?: OscillatorType; duration?: number; delay?: number; slideTo?: number; volume?: number } = {}
      ) => {
        const { type = "sine", duration = 0.25, delay = 0, slideTo, volume = 0.6 } = options
        const start = ctx.currentTime + delay
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, start)
        if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        osc.connect(gain).connect(master)
        osc.start(start)
        osc.stop(start + duration + 0.05)
      }

      const noise = (options: { duration?: number; filter?: number; volume?: number; sweepTo?: number } = {}) => {
        const { duration = 0.4, filter = 1200, volume = 0.5, sweepTo } = options
        const length = Math.floor(ctx.sampleRate * duration)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        const lowpass = ctx.createBiquadFilter()
        lowpass.type = "lowpass"
        lowpass.frequency.setValueAtTime(filter, ctx.currentTime)
        if (sweepTo !== undefined) lowpass.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration)
        const gain = ctx.createGain()
        gain.gain.value = volume
        source.connect(lowpass).connect(gain).connect(master)
        source.start()
      }

      const play = (name: SoundName) => {
        if (ctx.state !== "running") return
        switch (name) {
          case "jump":
            return tone(420, { type: "triangle", slideTo: 760, duration: 0.18, volume: 0.4 })
          case "bigJump":
            return tone(220, { type: "triangle", slideTo: 420, duration: 0.22, volume: 0.45 })
          case "land":
            return tone(160, { type: "sine", slideTo: 90, duration: 0.12, volume: 0.35 })
          case "pickup":
            tone(392, { type: "triangle", duration: 0.12 })
            return tone(587, { type: "triangle", duration: 0.18, delay: 0.08 })
          case "putdown":
            tone(587, { type: "triangle", duration: 0.12 })
            return tone(392, { type: "triangle", duration: 0.18, delay: 0.08 })
          case "throw":
            noise({ duration: 0.35, filter: 400, sweepTo: 3000, volume: 0.35 })
            return tone(300, { type: "sine", slideTo: 900, duration: 0.35, volume: 0.3 })
          case "splash":
            noise({ duration: 0.6, filter: 3000, sweepTo: 300, volume: 0.6 })
            return tone(700, { type: "sine", slideTo: 200, duration: 0.3, volume: 0.25 })
          case "smash":
            noise({ duration: 0.8, filter: 900, sweepTo: 120, volume: 0.9 })
            return tone(110, { type: "square", slideTo: 40, duration: 0.5, volume: 0.35 })
          case "found":
            PENTATONIC.slice(3, 7).forEach((f, i) => tone(f, { type: "sine", duration: 0.3, delay: i * 0.07, volume: 0.35 }))
            return
          case "push":
            return tone(180, { type: "square", slideTo: 120, duration: 0.15, volume: 0.25 })
          case "roar":
            noise({ duration: 0.5, filter: 500, volume: 0.4 })
            return tone(110, { type: "sawtooth", slideTo: 80, duration: 0.5, volume: 0.25 })
          case "cubRoar":
            noise({ duration: 0.3, filter: 1400, volume: 0.25 })
            return tone(330, { type: "sawtooth", slideTo: 240, duration: 0.3, volume: 0.2 })
          case "lever":
            tone(300, { type: "square", duration: 0.1, volume: 0.25 })
            return tone(450, { type: "square", duration: 0.1, delay: 0.1, volume: 0.25 })
          case "success":
            ;[0, 2, 4, 5].forEach((n, i) => tone(PENTATONIC[n]!, { type: "triangle", duration: 0.35, delay: i * 0.12 }))
            return tone(PENTATONIC[7]!, { type: "triangle", duration: 0.8, delay: 0.5 })
          case "swap":
            return tone(660, { type: "sine", slideTo: 990, duration: 0.15, volume: 0.3 })
        }
      }

      const note = (index: number) => {
        if (ctx.state !== "running") return
        tone(PENTATONIC[((index % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length]!, {
          type: "sine",
          duration: 0.5,
          volume: 0.3
        })
      }

      return Sound.of({
        play,
        note,
        unlock: () => void ctx.resume(),
        isLocked: () => ctx.state !== "running"
      })
    })
  )
}
