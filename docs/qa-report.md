# Bear & Cub QA report

Tested 13 October 2026 in `/home/kieren/Projects/bears-qa`, branch `feat/qa-fixes`, against Vite on port **5320**. No push or merge.

## Summary

All five required playthroughs pass. Five small bugs were fixed: missing log coaching on the approach bank, a stale Pond objective after a shortcut, input leaking into the win celebration, a missing favicon, and a seesaw cue that omitted the necessary jump. Added focused regression coverage and repaired the full Woods test's steering.

No unrecoverable progression softlock was observed. The most important open issue is the Mountain lift: a bear waiting underneath stops its descent while the coach tells Cub to keep waiting. Two lesser concerns remain: calling a nearby Cub across a height difference silently does nothing, and the smallest landing targets need a preschool playtest before deciding whether to enlarge them.

Severity: **P1** blocks progression without restarting; **P2** misleading or likely to frustrate; **P3** minor usability/polish or a tuning candidate. No P1 found in the scenarios tested.

## Fixed issues

### QA-01 — Log coach faces the wrong side of the bank

- **Level:** 4, Mushroom Woods. **Severity:** P2. **Fixed:** yes.
- **Reproduce before the fix:** open the gate, then stand Cub on dry ground at `x=0`, `z=5`, `4`, or `3.3`, approaching the stream at `z=2.5`. Neither log timing prompt appears.
- **Cause/fix:** `rideCoach` reversed the approach direction. Corrected its signed distance so the existing three-metre approach range covers the near bank. No platform speed or jump physics changed.
- **Verification:** `qa-coaches.js` failed before the fix and now checks dry-bank coaching plus both “Wait for the log…” and flashing “JUMP!” over 1,000 frames. The full physical Woods route also completes.
- **Screenshot:** `/tmp/shots/qa-log-bank-coach.png` (after fix).

### QA-02 — Frog shortcut leaves the objective pointing backwards

- **Level:** 3, Lily Pond. **Severity:** P2. **Fixed:** yes.
- **Reproduce before the fix:** take Cub along the outer east shore via approximately `(24,23) → (24,-27) → (9,-22)`. Hop north-to-south along the pads at `(9.3,-18.1)`, `(8.6,-15.3)`, `(9.4,-12.4)` to the frog rock; boop the frog. Never visit the first island at `(-10,-3)`.
- **Observed:** turtles rise, but the objective remains “Hop across the stepping stones!” and its arrow points to the first stone.
- **Fix:** require the initial-island objective only while the frog has not been booped. After booping, direct Mama to the turtle path.
- **Verification:** the actual perimeter-and-reverse-pad route succeeds. `qa-pond-shortcut.js` checks the real boop input, objective, and arrow target `(-10,-8.6)` with the island unvisited. The normal Pond route still completes.
- **Screenshot:** `/tmp/shots/qa-pond-shortcut.png` (after fix).

### QA-03 — Movement and free throws continue during the win celebration

- **Level:** shared stage logic, all levels. **Severity:** P2. **Fixed:** yes.
- **Reproduce before the fix:** reach an open honey goal with both bears, then keep holding movement during the three-second celebration. Alternatively win while Mama carries Cub, then press Y/R. Mama can walk away or throw Cub while the game is celebrating.
- **Cause/fix:** bear pads were captured before routed input was cleared. Clear routed input first so movement and co-op actions receive no input during the celebration.
- **Verification:** `qa-celebration.js` failed before the fix. It now checks ignored movement, ignored free throw during a carried win, and eventual completion.

### QA-04 — Browser console reports a missing favicon

- **Level:** shared page shell. **Severity:** P3. **Fixed:** yes.
- **Reproduce before the fix:** open the game in Chromium. Console reports `404` for `http://localhost:5320/favicon.ico`.
- **Fix:** provide `public/favicon.svg` and declare it in `index.html`.
- **Verification:** repeated browser navigation and reload no longer report this error; the production build succeeds. No other runtime exception or console error appeared in final regression runs.

### QA-05 — Pink seesaw instruction encourages walking into an unclimbable board

- **Level:** 4, Mushroom Woods. **Severity:** P2. **Fixed:** yes.
- **Reproduce before the fix:** walk Cub to the pink end from the south. The board's collider top is about `0.6 m`, above Cub's approximately `0.29 m` automatic step height. Cub stops near `(-6.3,-13.76)`, while the coach says “Stand on pink!” with a movement glyph.
- **Fix:** say “Jump onto pink!” with the jump button; update the objective to match. Preserve the board and launch physics.
- **Verification:** `qa-seesaw.js` failed before the fix. It checks the required jump instruction, then uses a physical hop to reach “Hold on tight!”. The full Woods route launches Cub and completes.

## Open issues, ranked

### QA-06 — Waiting below a high stone lift prevents it ever arriving

- **Level:** 5, Honey Mountain. **Severity:** P2, highest open priority. **Fixed:** no; requires a design decision about the waiting area/coaching.
- **Reproduce:** complete the first three puzzle sections normally until both bears are on tier 2. At the left lift, wait for it to be high, then walk Cub under its centre at approximately `(-4,-14.3)` and release the controls.
- **Observed:** the lift stays at `y=10.7` and the prompt remains “Wait for the stone…”. Reproduced for **30 simulated seconds** on the physical level route. Walking back to `z=-11.8` lets it descend to `y=6.7` again. Movement remains possible, so this is a misleading waiting trap rather than an irreversible softlock.
- **Cause:** the anti-crush check pauses descent whenever a bear stands underneath; the coach does not explain this condition.
- **Suggested fix:** add a visible waiting marker **2.5 m south** of each lift (`x=±4`, `z=-11.8`). When a bear blocks descent, show “Step back to the paw!” instead of “Wait…”. Keep the anti-crush protection. The current exclusion radius is `1.45 + bear.radius`: `1.85 m` for Cub and `2.15 m` for Mama, so the tested marker is outside both.
- **Screenshot:** `/tmp/shots/qa-lift-wait-stall.png`, captured after reaching the lifts through the normal puzzle route.

### QA-07 — Nearby Cub across a ledge cannot be called back

- **Level:** shared co-op, reproduced in 1, Sunny Meadow. **Severity:** P3. **Fixed:** no; rescue-button policy needs a design decision.
- **Reproduce:** Mama stands at the lift paw near `(6,-1.6)`; Cub stands at the ledge's near edge around `(6,-4.4)`, feet at `y=3.2`. Press Y/R as Mama.
- **Observed:** nothing happens. Measured centre distance **3.946 m**, below the call's four-metre cutoff, but the `3.2 m` height difference also prevents normal pickup. Mama stepping backwards, or Cub jumping down, recovers the situation.
- **Suggested fix:** permit a call within four metres when the feet-height difference exceeds the pickup allowance of **1.2 m**. Alternatively make calls always work for a walking Cub and retain normal pickup as the nearby action. A short explanatory cue would also help if the cutoff is intentional.

### QA-08 — Small late-game landing targets need a child trial

- **Level:** 5 wobbly stones; secondarily 3's final pads. **Severity:** P3 tuning candidate, **not a confirmed gameplay bug**. **Fixed:** no.
- **Reproduce/evaluate:** ask a preschool player to hop the Mountain stones without Mama carrying her, and the final Pond pads; note repeated misses and whether coaching lets her recover confidently.
- **Evidence:** Mountain stone radii are `0.70 / 0.65 / 0.65 m` against Cub's `0.40 m` capsule radius, with `0.03 m` horizontal wobble. The scripts can land successfully, but this does not establish ease for a four-year-old. Collider overlap makes the actual landing tolerance wider than simple radius subtraction.
- **Suggested initial tuning if misses are frequent:** Mountain radii **`0.95 / 0.90 / 0.90 m`**; smallest Pond pad **`0.75 → 0.90 m`**. Preserve Mama's sinking/crumbling behavior. If mushroom timing causes repeated misses, trial the existing super-bounce allowance at **`0.28 → 0.35 s`** and its coach window at **`0.24 → 0.30 s`** together.
- **Positive timing result:** at full running speed, Cub cleared Creek's widest stream when jump was pressed from **1.6 m before** its configured edge through **0.2 m after** it, in the sampled timings. This supports retaining the current Creek timing initially; it is not a measured continuous success interval.

## Coverage and verification

Read `README.md`, `docs/skills.md`, the harness, all five level definitions, and shared movement, interactions, co-op, coaches, menus and saving code. Used manual frame stepping and targeted setup teleports alongside full physical routes. A steering script failing a straight-line route was investigated before treating it as a game bug.

- **Meadow:** apple practice, lift/boulder, throw/bell/bridge, honey completion; bad free throw and local river respawn; nearby-height call limitation.
- **Creek:** all three running jumps, tree bridge, pillar climb, pinecone/ramp and completion; local respawn and sampled early/late jump timing.
- **Pond:** normal stones/pads/frog/turtles route; Mama sinking on a pad; both island checkpoints; east-shore shortcut and reverse pads.
- **Woods:** practice super bounce, fence/gate, both bears riding both logs, seesaw, magic flower, mushroom steps and honey; dry-bank coaching and moving-log checkpoint exclusion.
- **Mountain:** normal tier progression and summit completion; Mama sinking on a wobbly stone without saving it as a checkpoint; lift waiting trap after the real route; local crevasse respawn.
- **Recovery:** both bears return to recent dry ground in every level, not the initial spawn; Cub on moving/sinking platforms does not save those as respawns; calls and free throws return control.
- **Collectibles:** ordinary ground berries were approached from four sides. An apparent bonus-islet failure was a test setup in water; all four islet berries were subsequently collected from the island. All **36 butterflies** were found using local exploration setups. Full routes exercise airborne rewards, but no exhaustive all-collectibles physical route was built. No unreachable collectible was confirmed.
- **Flow:** title, locked map selection, launch, pause freeze/resume, restart, map return, all completion cards, next-level selection/unlocking, credits and map return; save-service round trip and corrupt-save fallback. A separate same-browser-context reload restored Meadow completion, selected Creek and left exactly three locked cards.
- **Controllers:** emulated standard Xbox/DualSense pads through `navigator.getGamepads`: independent simultaneous movement/jumps, either player pausing/resuming, one-controller Back switching and disconnection. Physical controllers and an actual preschool player were not available in this test environment.

Final checks:

```sh
bunx tsc --noEmit
bash tools/playtest-all.sh 5320
bash tools/playtest-qa.sh 5320
bunx vite build
```

Required suite: **✅ meadow · ✅ creek · ✅ pond · ✅ woods2 · ✅ mountain**.
Focused QA suite: all regressions and the full `woods.js` journey pass. The repaired Woods script now stops movement at its landing targets, hops onto the raised seesaw and explicitly fails if the level does not complete. Its previous overshoots were harness failures, not game softlocks.

Screenshots and exploratory logs are temporary artifacts under `/tmp/shots/` and `/tmp/bears-qa-*.log`, not committed binary files. The QA Vite server remains on port 5320 for follow-up.
