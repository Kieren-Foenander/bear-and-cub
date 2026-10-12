# Skill ladder

The game exists to teach controller skills, one small step at a time. Each new skill is
practised somewhere safe (where failing costs nothing) before a puzzle depends on it.

Rule of thumb: **sequences and timing, not chords.** Pressing several buttons at once isn't
a skill young players need yet. Pressing the right button at the right moment is.

| # | Skill | Where it's taught | Status |
| --- | --- | --- | --- |
| 1 | Move with the stick | Meadow: flowers play notes, butterflies hide in grass | ✅ |
| 2 | Single press (A jump, B action) | Roar anywhere, push the boulder | ✅ |
| 3 | Repeated presses (mash) | Push the boulder: B × 3 | ✅ |
| 4 | **Timing: jump, then swipe at the top** | Apple tree (practice, apples grow back) → bell at the river | ✅ |
| 5 | Move + jump together (running jump) | Small gap / log you have to run at | next |
| 6 | Precision landing | Stepping stones / lily pads across a pond | planned |
| 7 | Timing against something moving | Rolling logs, swinging vines, bouncing mushrooms | planned |
| 8 | Combining it all | Short "obstacle course" sections with Mama helping | planned |

## How the timing mechanic works

- **X swipes.** The paw has a real reach (`swipe.ts`): a target is hit only if it's within
  `horizontalReach` sideways and `verticalReach` up/down of the paw at the moment of the swipe.
- **Targets hang at "top of the jump" height.** `hangHeight(CUB, lift)` places them so the paw
  reaches them `lift` metres into a jump. With the cub's jump that's ~1.6–1.65.
- **The cub gets extra hang time at the top of her jump** (`apexFloat`), which widens the window.
  It's switched off while she's being thrown, so Mama's throws stay accurate.
- **Coaching prompt** for each target: `A Jump!` → `X Get ready…` → a big flashing **`NOW!`**
  while she's in reach. A miss explains itself: "Jump first!", "Wait for the top!",
  "Too late, try again!". The target also glows when it's reachable.

### Measured windows (60 fps)

| Target | `verticalReach` | Time in reach per jump |
| --- | --- | --- |
| Apples (practice) | 0.45 | ~0.73 s |
| Bell (puzzle) | 0.32 | ~0.63 s |

To make later levels harder, lower `verticalReach`, or give a target less `apexFloat` help.
To make them easier, raise `verticalReach`.
