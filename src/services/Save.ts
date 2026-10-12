import { Context, Layer, Option, Schema } from "effect"

const LevelResult = Schema.Struct({
  done: Schema.Boolean,
  berries: Schema.Number,
  berriesTotal: Schema.Number,
  butterflies: Schema.Number,
  butterfliesTotal: Schema.Number
})
export type LevelResult = typeof LevelResult.Type

const Progress = Schema.Struct({
  version: Schema.Literal(1),
  levels: Schema.Record(Schema.String, LevelResult),
  /** What the little one wants Cub to be called. */
  cubName: Schema.optional(Schema.String)
})
export type Progress = typeof Progress.Type

const decodeProgress = Schema.decodeUnknownOption(Schema.fromJsonString(Progress))

const KEY = "bear-and-cub/progress"
const empty = (): Progress => ({ version: 1, levels: {} })

/** Remembers which levels you've finished and your best berry / butterfly counts. */
export class Save extends Context.Service<Save, {
  readonly load: () => Progress
  readonly save: (progress: Progress) => void
}>()("bears/services/Save") {
  static readonly layer = Layer.succeed(
    Save,
    Save.of({
      // A missing, corrupt or out-of-date save just starts fresh rather than crashing.
      load: () => {
        let raw: string | null = null
        try {
          raw = localStorage.getItem(KEY)
        } catch {
          // Storage blocked: play without saving.
        }
        return raw === null ? empty() : Option.getOrElse(decodeProgress(raw), empty)
      },
      save: (progress) => {
        try {
          localStorage.setItem(KEY, JSON.stringify(progress))
        } catch {
          // Private browsing or full storage: progress just won't persist.
        }
      }
    })
  )
}

/** Merge a new result with the best previous one. */
export const recordResult = (progress: Progress, id: string, result: LevelResult): Progress => {
  const before = progress.levels[id]
  return {
    ...progress,
    levels: {
      ...progress.levels,
      [id]: before
        ? {
            done: true,
            berries: Math.max(before.berries, result.berries),
            berriesTotal: result.berriesTotal,
            butterflies: Math.max(before.butterflies, result.butterflies),
            butterfliesTotal: result.butterfliesTotal
          }
        : result
    }
  }
}
