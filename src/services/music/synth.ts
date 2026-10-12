import type { Instrument } from "./themes.ts"
import { random } from "./themes.ts"

const FLOOR = 0.00001
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Small additive voices. No samples, downloads, per-note timers, or permanent oscillators. */
export class Synth {
  private readonly sources = new Map<AudioScheduledSourceNode, readonly AudioNode[]>()
  private noiseBuffer: AudioBuffer | undefined

  constructor(private readonly ctx: BaseAudioContext) {}

  private track(source: AudioScheduledSourceNode, nodes: readonly AudioNode[], end: number) {
    this.sources.set(source, nodes)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
    source.stop(end)
  }

  tone(out: AudioNode, midi: number, at: number, duration: number, volume: number, instrument: Instrument = "felt") {
    const freq = frequency(midi)
    // The higher marimba partial is brief, leaving a round, quiet fundamental.
    const ratios = instrument === "marimba" ? [1, 4] : [1, 2]
    for (let i = 0; i < ratios.length; i++) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const length = i === 0 ? duration : duration * 0.35
      osc.type = instrument === "pluck" && i === 0 ? "triangle" : "sine"
      osc.frequency.value = freq * ratios[i]!
      gain.gain.setValueAtTime(FLOOR, at)
      gain.gain.exponentialRampToValueAtTime(Math.max(FLOOR, volume * (i === 0 ? 1 : 0.12)), at + 0.012)
      gain.gain.exponentialRampToValueAtTime(FLOOR, at + length)
      osc.connect(gain).connect(out)
      osc.start(at)
      this.track(osc, [gain], at + length + 0.02)
    }
  }

  chirp(out: AudioNode, at: number, pitch: number, duration: number, volume: number) {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.frequency.setValueAtTime(pitch, at)
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.3, at + duration * 0.35)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, at + duration)
    gain.gain.setValueAtTime(FLOOR, at)
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + duration)
    osc.connect(gain).connect(out)
    osc.start(at)
    this.track(osc, [gain], at + duration + 0.02)
  }

  noise(out: AudioNode, at: number, duration: number, volume: number, cutoff: number, bandpass = false) {
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      const rng = random(101)
      for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1
    }
    const source = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    source.buffer = this.noiseBuffer
    source.loop = true
    filter.type = bandpass ? "bandpass" : "lowpass"
    filter.frequency.setValueAtTime(cutoff, at)
    filter.frequency.linearRampToValueAtTime(cutoff * 0.65, at + duration)
    filter.Q.value = bandpass ? 2 : 0.5
    gain.gain.setValueAtTime(FLOOR, at)
    gain.gain.linearRampToValueAtTime(volume, at + duration * 0.25)
    gain.gain.linearRampToValueAtTime(FLOOR, at + duration)
    source.connect(filter).connect(gain).connect(out)
    source.start(at)
    this.track(source, [filter, gain], at + duration + 0.02)
  }

  dispose() {
    for (const [source, nodes] of this.sources) {
      source.onended = null
      source.stop()
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
    this.sources.clear()
  }
}
