import { Synth } from "./synth.ts"
import { CHORDS, random, SCALE, THEMES, type Theme, type ThemeId } from "./themes.ts"

/** Effects' master is 0.35; music's voices are also much softer than effect voices. */
export const MUSIC_VOLUME = 0.17
export const CROSSFADE_SECONDS = 1.8
const LOOKAHEAD = 0.18

interface Track {
  readonly theme: Theme
  readonly id: ThemeId
  readonly gain: GainNode
  readonly rng: () => number
  readonly stepSeconds: number
  step: number
  next: number
  retireAt: number
  motif: readonly number[]
  variation: number
}

/** Driven by one lookahead interval, independently of physics frames (including ?manual). */
export class MusicEngine {
  private readonly synth: Synth
  private readonly master: GainNode
  private readonly duck: GainNode
  private readonly gate: GainNode
  private readonly tracks: Track[] = []
  private selected: ThemeId = "menu"
  private active: Track | undefined
  private visits = 0
  private muted = false
  private hidden = false

  constructor(private readonly ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.synth = new Synth(ctx)
    this.master = ctx.createGain()
    this.master.gain.value = MUSIC_VOLUME
    this.duck = ctx.createGain()
    this.gate = ctx.createGain()
    this.duck.connect(this.master).connect(this.gate).connect(destination)
  }

  play(id: string) {
    // LevelDef.id is a string; unknown/new levels get the menu's gentle fallback.
    const theme: ThemeId = Object.hasOwn(THEMES, id) ? id as ThemeId : "menu"
    if (this.selected === theme) return
    this.selected = theme
    if (this.ctx.state === "running" && !this.hidden && !this.muted) this.transition(this.ctx.currentTime)
  }

  private transition(now: number) {
    for (const track of this.tracks) {
      if (track.retireAt !== Infinity) continue
      track.gain.gain.cancelAndHoldAtTime(now)
      track.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS)
      track.retireAt = now + CROSSFADE_SECONDS
    }
    const theme = THEMES[this.selected]
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)
    gain.connect(this.duck)
    this.active = {
      theme, id: this.selected, gain, rng: random(theme.seed + this.visits++ * 997),
      stepSeconds: 60 / theme.bpm / 4, step: 0, next: now + 0.04,
      retireAt: Infinity, motif: theme.melody[0]!, variation: 0
    }
    this.tracks.push(this.active)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.updateGate()
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden
    this.updateGate()
  }

  private updateGate() {
    const now = this.ctx.currentTime
    this.gate.gain.cancelAndHoldAtTime(now)
    this.gate.gain.linearRampToValueAtTime(this.muted || this.hidden ? 0 : 1, now + 0.12)
  }

  /** `now` can also be stepped ahead while rendering with OfflineAudioContext. */
  tick(now = this.ctx.currentTime) {
    if (this.ctx.state !== "running" && !(this.ctx instanceof OfflineAudioContext)) return
    if (this.hidden || this.muted) return
    if (!this.active || this.active.id !== this.selected) this.transition(now)
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const track = this.tracks[i]!
      // Offline scheduling runs ahead of rendering: keep its faded buses connected
      // until dispose(), so already scheduled audio can actually reach the output.
      if (now > track.retireAt + 2 && !(this.ctx instanceof OfflineAudioContext)) {
        track.gain.disconnect()
        this.tracks.splice(i, 1)
        continue
      }
      // A throttled/background timer skips missed beats instead of bursting late notes.
      if (track.next < now) {
        const missed = Math.ceil((now + 0.02 - track.next) / track.stepSeconds)
        track.step += missed
        track.next += missed * track.stepSeconds
      }
      const horizon = Math.min(now + LOOKAHEAD, track.retireAt)
      while (track.next < horizon) {
        this.step(track)
        track.next += track.stepSeconds
        track.step++
      }
    }
  }

  private step(track: Track) {
    const { theme, rng, gain } = track
    const bar = Math.floor(track.step / 16)
    const beat = track.step % 16
    const phrase = Math.floor(bar / 8)
    const chord = CHORDS[theme.harmony[bar % theme.harmony.length]!]!
    const seconds = track.stepSeconds * 4
    const at = track.next + (beat % 4 === 2 ? seconds * theme.swing : 0)
    // A 32-bar arc includes breathing space, rather than repeating a short busy loop.
    const breathing = bar % 32 >= 30 || (phrase % 4 === 2 && bar % 2 === 1)
    const build = track.id === "mountain" ? Math.min(2, Math.floor(bar % 32 / 8)) : 0

    if (beat === 0) {
      track.motif = theme.melody[(phrase + Math.floor(rng() * theme.melody.length)) % theme.melody.length]!
      track.variation = rng() < 0.3 ? 1 : 0
      this.synth.tone(gain, chord[0], at, seconds * 1.8, 0.11)
      for (let i = 1; i < chord.length; i++) {
        this.synth.tone(gain, chord[i]!, at + i * 0.025, seconds * 3.4, 0.026)
      }
      this.ambience(track, bar, at)
    }
    if (beat === 8 && !breathing) this.synth.tone(gain, chord[0] + 7, at, seconds, 0.055)
    if (!breathing && beat % 2 === 0 && rng() < theme.density + build * 0.06) {
      const note = chord[1 + (Math.floor(beat / 2) + bar) % 3]!
      this.synth.tone(gain, note, at, seconds * 0.7, 0.05, theme.instrument)
    }

    const slot = theme.rhythm.indexOf(beat)
    if (!breathing && slot !== -1 && !(bar % 8 === 6 && slot > 1) && rng() > 0.12) {
      const index = track.motif[(slot + (bar % 2)) % track.motif.length]! + track.variation
      this.synth.tone(gain, SCALE[Math.min(index, SCALE.length - 1)]!, at, seconds * 1.2,
        0.12 + rng() * 0.025 + build * 0.008, theme.instrument)
    }
    // A small answer at the end of occasional eight-bar phrases.
    if (!breathing && bar % 8 === 7 && (beat === 14 || beat === 15) && phrase % 3 === 1) {
      this.synth.tone(gain, SCALE[beat === 14 ? 1 : 0], at, seconds * 0.6, 0.075, theme.instrument)
    }
  }

  private ambience(track: Track, bar: number, at: number) {
    const { gain, rng, theme } = track
    switch (theme.ambience) {
      case "birds":
        if (bar % 4 === 2 && rng() < 0.65) {
          const pitch = 1600 + rng() * 700
          this.synth.chirp(gain, at + 0.4, pitch, 0.16, 0.018)
          this.synth.chirp(gain, at + 0.65, pitch * 1.1, 0.12, 0.014)
        }
        break
      case "water":
        this.synth.noise(gain, at, 60 / theme.bpm * 4.5, 0.022, 700)
        if (bar % 2 === 0) this.synth.chirp(gain, at + 0.3, 430 + rng() * 200, 0.2, 0.018)
        break
      case "crickets":
        if (bar % 3 === 1) {
          for (let i = 0; i < 3; i++) this.synth.chirp(gain, at + i * 0.22, 3000, 0.07, 0.008)
        }
        break
      case "wind":
        if (bar % 2 === 0) this.synth.noise(gain, at, 60 / theme.bpm * 8.5, 0.03, 380)
        break
      case "none": break
    }
  }

  celebrate() {
    if (this.ctx.state !== "running" || this.muted || this.hidden) return
    const at = this.ctx.currentTime
    this.duck.gain.cancelAndHoldAtTime(at)
    this.duck.gain.linearRampToValueAtTime(0.12, at + 0.035)
    this.duck.gain.setValueAtTime(0.12, at + 2.6)
    this.duck.gain.linearRampToValueAtTime(1, at + 3.2)
    // The existing success sound leads; this low C-major answer follows beneath it.
    for (let i = 0; i < 4; i++) {
      this.synth.tone(this.master, [48, 52, 55, 60][i]!, at + 0.85 + i * 0.19, 0.85, 0.12, "marimba")
    }
  }

  dispose() {
    this.synth.dispose()
    for (const track of this.tracks) track.gain.disconnect()
    this.tracks.length = 0
    this.duck.disconnect()
    this.master.disconnect()
    this.gate.disconnect()
  }
}
