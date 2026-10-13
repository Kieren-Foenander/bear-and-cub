# Skill ladder

The game exists to teach controller skills, one small step at a time. Each new skill is
practised somewhere safe (where failing costs nothing) before a puzzle depends on it.

Rule of thumb: **sequences and timing, not chords.** Pressing several buttons at once isn't
a skill young players need yet. Pressing the right button at the right moment is.

| # | Skill | Where it's taught | Status |
| --- | --- | --- | --- |
| 1 | Move with the stick | Every level: flowers play notes, butterflies hide in grass, berry trails | ✅ |
| 2 | Single press (A jump, B action) | Roar anywhere, boop the frog, open the gate | ✅ |
| 3 | Repeated presses (mash) | Push the boulder (L1), push the old tree (L2) | ✅ |
| 4 | **Timing: jump, then swipe at the top** | Apple tree (L1 practice) → bell, pinecones, magic flower, honeycomb | ✅ |
| 5 | Move + jump together (running jump) | Creek Hop (L2): three streams, each wider, with a run-up coach | ✅ |
| 6 | Precision landing | Lily Pond (L3): stones and shrinking lily pads; wobbly stones (L5) | ✅ |
| 7 | Timing against something moving | Mushroom Woods (L4): super bounce, floating logs; stone lifts (L5) | ✅ |
| 8 | Combining it all | Honey Mountain (L5), Firefly Night (L6) | ✅ |
| 9 | Gentle steering (small stick movements) | Snowy Slopes (L7): slippery ice rink, thin ice floes | ✅ |
| 10 | Holding a direction (sustained push) | Snowy Slopes (L7): pushing the giant snowball, ideally together | ✅ |

## Coaches

Every skill has a coach (`coaches.ts`, `swipe.ts`) that changes the on-screen prompt as she
plays, so the game teaches the timing instead of just testing it:

- **Running jump:** `🕹️ Run!` → `Keep running!` → flashing **`JUMP!`** at the edge.
- **Super bounce:** `Jump on!` → `Get ready…` → flashing **`NOW!`** just before landing.
- **Riding a log:** `Wait for the log…` → flashing **`JUMP!`** when it'll be in front of you
  on landing (it accounts for the log's speed).
- **Swipe:** `Jump!` → `Get ready…` → flashing **`NOW!`** while in reach, with miss hints.

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
