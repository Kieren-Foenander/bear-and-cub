import { creek } from "./creek.ts"
import { meadow } from "./meadow.ts"
import { mountain } from "./mountain.ts"
import { night } from "./night.ts"
import { playground } from "./playground.ts"
import { pond } from "./pond.ts"
import { woods } from "./woods.ts"
import type { LevelDef } from "./types.ts"

/** The adventure, in order. Each level teaches one new controller skill (see docs/skills.md). */
export const LEVELS: ReadonlyArray<LevelDef> = [meadow, creek, pond, woods, mountain, night, playground]
