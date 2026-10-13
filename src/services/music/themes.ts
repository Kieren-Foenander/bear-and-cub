export type ThemeId = "menu" | "meadow" | "creek" | "pond" | "woods" | "mountain" | "playground" | "night" | "snow"
export type Instrument = "felt" | "pluck" | "marimba"
export type Ambience = "birds" | "water" | "crickets" | "wind" | "none"

export interface Theme {
  readonly bpm: number
  readonly instrument: Instrument
  readonly ambience: Ambience
  readonly melody: readonly (readonly number[])[]
  readonly rhythm: readonly number[]
  readonly harmony: readonly number[]
  readonly density: number
  readonly swing: number
  readonly seed: number
}

/** All melodies share the flowers' C-major pentatonic; numbers index SCALE. */
export const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81] as const
/** C, Am, Fmaj7, Gsus: gentle open harmony, with no sharp leading tone. */
export const CHORDS = [
  [48, 60, 64, 67], [45, 57, 60, 64], [41, 53, 57, 64], [43, 55, 60, 62]
] as const

export const THEMES: Record<ThemeId, Theme> = {
  menu: {
    bpm: 82, instrument: "felt", ambience: "none", density: 0.38, swing: 0.06, seed: 11,
    melody: [[2, 3, 4, 3, 1, 0], [0, 2, 3, 5, 4, 2], [2, 1, 0, 1, 2, 0]],
    rhythm: [0, 3, 6, 8, 11, 14], harmony: [0, 0, 1, 3, 2, 0, 3, 0]
  },
  meadow: {
    bpm: 96, instrument: "felt", ambience: "birds", density: 0.56, swing: 0.12, seed: 23,
    melody: [[0, 2, 3, 2, 4, 3], [2, 3, 5, 4, 3, 0], [0, 1, 2, 4, 3, 2]],
    rhythm: [0, 2, 6, 8, 10, 14], harmony: [0, 2, 0, 3, 1, 2, 3, 0]
  },
  creek: {
    bpm: 90, instrument: "pluck", ambience: "water", density: 0.62, swing: 0.08, seed: 37,
    melody: [[3, 1, 2, 4, 2, 0], [2, 4, 3, 5, 3, 1], [4, 2, 3, 1, 2, 0]],
    rhythm: [0, 3, 5, 8, 11, 13], harmony: [0, 3, 1, 0, 2, 1, 3, 0]
  },
  pond: {
    bpm: 64, instrument: "marimba", ambience: "water", density: 0.28, swing: 0, seed: 51,
    melody: [[4, 3, 2, 0], [2, 4, 5, 3], [3, 1, 2, 0]],
    rhythm: [0, 5, 8, 13], harmony: [0, 0, 2, 2, 1, 1, 3, 0]
  },
  woods: {
    bpm: 76, instrument: "pluck", ambience: "crickets", density: 0.36, swing: 0.04, seed: 67,
    melody: [[4, 2, 1, 2, 0], [2, 0, 3, 1, 0], [0, 2, 4, 3, 2]],
    rhythm: [0, 4, 7, 10, 14], harmony: [1, 1, 2, 0, 1, 2, 3, 0]
  },
  mountain: {
    bpm: 92, instrument: "marimba", ambience: "wind", density: 0.48, swing: 0.03, seed: 83,
    melody: [[0, 2, 3, 4, 5, 3], [2, 3, 4, 5, 3, 2], [3, 4, 5, 7, 5, 3]],
    rhythm: [0, 3, 6, 8, 11, 14], harmony: [0, 3, 2, 0, 1, 2, 3, 0]
  },
  night: {
    bpm: 66, instrument: "felt", ambience: "crickets", density: 0.3, swing: 0.05, seed: 113,
    melody: [[4, 2, 3, 1, 0], [2, 3, 5, 4, 2], [3, 2, 1, 2, 0]],
    rhythm: [0, 4, 8, 11, 14], harmony: [1, 1, 0, 3, 2, 1, 3, 0]
  },
  snow: {
    bpm: 84, instrument: "marimba", ambience: "wind", density: 0.42, swing: 0.06, seed: 131,
    melody: [[5, 4, 2, 4, 3, 0], [2, 3, 4, 5, 7, 5], [4, 3, 2, 1, 2, 0]],
    rhythm: [0, 2, 6, 8, 12, 14], harmony: [0, 2, 3, 0, 1, 3, 2, 0]
  },
  playground: {
    bpm: 104, instrument: "marimba", ambience: "birds", density: 0.6, swing: 0.14, seed: 97,
    melody: [[0, 2, 4, 2, 5, 4], [4, 5, 7, 5, 4, 2], [2, 4, 3, 2, 1, 0]],
    rhythm: [0, 2, 4, 8, 10, 12], harmony: [0, 1, 3, 0, 0, 2, 3, 0]
  }
}

/** Stable, cheap randomness gives each visit a coherent, reproducible musical journey. */
export function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}
