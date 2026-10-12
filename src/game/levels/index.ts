import { creek } from "./creek.ts"
import { meadow } from "./meadow.ts"
import { pond } from "./pond.ts"
import type { LevelDef } from "./types.ts"

/** The adventure, in order. Each level teaches one new controller skill (see docs/skills.md). */
export const LEVELS: ReadonlyArray<LevelDef> = [meadow, creek, pond]
