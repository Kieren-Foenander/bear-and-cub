import { classicStyle } from "./classic/ClassicBear.ts"
import { origamiStyle } from "./origami/OrigamiBear.ts"
import type { BearStyle } from "./types.ts"

/**
 * Every bear art style, in pause-menu order. To add one: build it in its own folder under
 * src/game/models/<style>/ implementing BearStyleModel, export a BearStyle, and list it here.
 */
export const BEAR_STYLES: ReadonlyArray<BearStyle> = [classicStyle, origamiStyle]
