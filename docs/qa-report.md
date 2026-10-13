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

## Round 2

Tested 13 October 2026 exclusively in `/home/kieren/Projects/bears-qa2`, branch `feat/qa2`, on port **5340**. Round 1 fixes were treated as the baseline; its regression suite passes, including the revised lift waiting cue. No push or merge. The Round 2 server is stopped at the end of this pass.

### Result

All nine level playthroughs pass. Six gameplay/presentation issues were fixed, including one acorn-loss softlock. No remaining P1 was found in the tested routes and recovery scenarios. Origami, Toy and Classic were checked at the normal shared game camera, with all nine hats, carrying, throws, jump-swipes and celebration. Both alternate styles also complete the existing Night, Snow, Autumn and Playground journeys.

### Fixed issues

#### QA2-01 — An acorn dropped on hay or a stump disappears inside it

- **Level:** 8, Autumn Orchard. **Severity:** P1 for a central drop. **Fixed:** yes.
- **Repro:** lift Cub onto the hay, pick up its acorn, stand around `(-18, 14)` with feet at `3.2 m`, face south and press B to put it down. Wait four seconds. The acorn settles around `(-18, 0.39, 16.04)`, inside the solid stack. Cub cannot reach it from above; its central location is also beyond either bear's pickup range from the sides. Restarting loses the basket progress.
- **Cause/fix:** falling items used terrain height alone. A downward Rapier query now also finds raised solid tops, ignores both bear capsules, and starts above the previous fall step to prevent tunneling. The acorn remains at the hay top plus its `0.3 m` clearance.
- **Regression:** `qa-acorn-platform-drop.js` failed before the fix. It now drops and retrieves the hay acorn, then drops it on the taller stump. The normal physical Orchard route still completes; `qa-carrying.js` covers ordinary ground drops and delivery.

#### QA2-02 — Switching away from Toy leaves hats enlarged

- **Level:** shared bear models / pause menu. **Severity:** P3. **Fixed:** yes.
- **Repro:** equip any hat, pause, choose Bear look twice: Origami → Toy → Classic. Toy fits hats at about `1.48×` scale for Cub; Classic and Origami inherited that scale rather than their normal `1×` fit.
- **Fix:** restore the normal hat scale when either of those styles fits it. `qa-style-hats.js` cycles every hat through the real pause menu and compares a reused hat with a fresh one. It also checks attachment, both bears switching and save persistence.

#### QA2-03 — Toy removes the party hat's sideways tilt

- **Level:** shared bear models; Playground reward. **Severity:** P3. **Fixed:** yes.
- **Repro:** wear the party hat and select Toy. Its built-in `0.25 rad` sideways tilt becomes zero and stays zero after switching back.
- **Fix:** adjust the wearing pitch without overwriting the other rotation axes. The hat regression now verifies the original tilt throughout all style switches.

#### QA2-04 — Playground's seesaw gives incomplete instructions

- **Level:** 9, Bear Playground. **Severity:** P2. **Fixed:** yes.
- **Repro:** approach the pink end on foot. The raised board stops Cub while the prompt says “Stand on pink!”. After Cub gets on, “Wait for Mama!” appears, but Mama has no prompt explaining the required blue-end jump.
- **Fix:** give Cub “Jump onto pink!” with A, and give Mama “Jump on blue!” while Cub is ready. `qa-playground-seesaw.js` physically approaches the board, follows both jump instructions and lands Cub in the treehouse. Both symptoms failed their assertions before their fixes.

#### QA2-05 — Musical bells stop coaching after one ring

- **Level:** 9, Bear Playground. **Severity:** P2. **Fixed:** yes.
- **Repro:** jump-swipe any musical bell, land, then stay beside it. Its jump/timing prompt disappears permanently although it remains playable.
- **Fix:** opt the Playground bells into repeat coaching. Puzzle bells retain their existing behavior. `qa-playground-bells.js` failed on the second attempt before the fix; it now rings all six bells twice using the visible timing cue and checks the actual tuned-note sequence `-1, 1, 3, 5, 7, 9` on both repetitions.

### Open issues, ranked

#### QA2-06 — Two “Put down” prompts overlap when Cub holds an acorn on Mama

- **Level:** 8, Autumn Orchard / shared carrying. **Severity:** P2, highest remaining usability concern. **Fixed:** yes (after the round): Mama's prompt now says "Put Cub down", the item prompt says "Drop it" and sits 1.4 m to the side.
- **Repro:** swipe the oak acorn down, pick it up as Cub, then have Mama pick up Cub. With both characters centered in the shared camera, their blue/pink B prompts overlap vertically and both say “Put down”. The active bear determines whether B releases Cub or drops the acorn, but the prompts do not name that distinction. Screenshot: `/tmp/shots/qa2-acorn-back.png`.
- **Suggestion:** distinguish “Cub down” and “Acorn down”; trial a minimum **60 px** separation between projected prompt cards, or offset their anchors **0.8 m** to opposite sides. Check keyboard, one-controller switching and two-controller play before choosing the layout. Carrying, throws, delivery and restart remain recoverable.

#### QA2-07 — Neighboring thin floes can keep Mama supported indefinitely

- **Level:** 7, Snowy Slopes. **Severity:** P3, rule consistency. **Fixed:** yes (after the round): each floe checks Mama's whole footprint and keeps cracking for 0.9 s, regression `qa-thin-ice.js`.
- **Repro:** keep Cub away from the approach (e.g. `(-5, 3.5)`), walk Mama from `(2, 2.6)` toward `(3.5, -1.9)`, release the stick and wait **30 seconds**. Mama remains around `(2.65, -1.9)`, feet near **`-0.43 m`**, on the adjoining floe edges instead of falling in. A separate center landing at `(3.5, -1.9)` also survives 30 seconds. Screenshot: `/tmp/shots/qa2-mama-thin-ice-wait.png`.
- **Evidence:** floes are **3.1 m** wide and centers are **2.2 m** apart along z, with lateral offsets. Mama's **0.7 m** capsule can be supported by a neighboring collider while the center ground ray assigns her weight to another floe. Their sinking behavior therefore does not reliably enforce “too thin for Mama”. No unsafe checkpoint or progression softlock was observed; falling into exposed water respawns her locally.
- **Suggestion:** account for Mama's overlap with each floe's footprint (half-width **`1.55 + 0.70 m`**, feet within **0.5 m** above its top) and trial a **0.8–1.0 s** heavy-load latch through brief contact gaps. Preserve the broad floes and Cub's safety; shrinking them would make the child's task harder. Test this with Cub beside/on Mama before adopting it.

### Coverage and limits

- **Night:** all three coached lantern swipes, glowing stones with both bears, lift, owl boop and ladder, island throw, moon-flower swipe, pads and finale. A glowing stone never replaces the bank checkpoint; a splash returns Cub locally. Fireflies and the owl/lantern changes were inspected in the gameplay captures.
- **Snow:** rink berries, all floes with Cub, bell and Mama's bridge, snowball and cabin. Cub can linger safely on a floe; both bears recover from exposed water. Sampled coast after releasing movement: about **1.36 m on ice**, **0.35–0.38 m on snow**, and **0.38 m in Orchard**, confirming traction resets on level changes. Sustained snowball pushes take **6.82 s Mama alone**, **6.90 s Cub alone**, **3.83 s together** in the tested setups. Snowfall renders without invalid positions or browser errors.
- **Orchard:** the complete physical three-acorn route, super bounce, jump-swipe, Squirrel's responses, basket count, gate and honey; both bear pickups, ground/platform drops, repeated delivery button, ledge fall, Cub holding an acorn while carried/thrown, and pause-menu restart while Mama carries both Cub and the last acorn. Restart clears the carried state and restores all items and basket progress. Orchard has no playable water: water behavior was checked using a real `Carrying` instance and B interactions added to Night, stepping its update with the stage; Cub's splash and Mama splashing with Cub on her back retain the held item.
- **Playground:** all musical bells twice, physical seesaw jump/launch, shared mushroom/pond/stream systems through their existing regressions and playground route, repeat play and honey completion. The existing Playground journey uses setup placements for the seesaw and honey; it is not an entirely physical park exploration route.
- **Art:** screenshots for walking, airborne swipe, back riding, airborne throw and celebration in all three styles; live switches while carried; all **27 style/hat combinations** visually inspected. After the fixes, no missing body parts, conspicuous floating hats, ground penetration or broken pose was found in the sampled normal-camera views. Camera distance makes small facial/hat details hard to assess. Style switches intentionally change appearance; animation poses can ease in after switching. This is sampled inspection, not exhaustive frame-by-frame proof against all popping.
- **Flow/audio:** chapter 2 prerequisites, Playground after Meadow, new hats and auto-equipping/save, both finale credit screens and map returns, restart and music mute. New themes select correctly in the real session. Six seconds of each new theme were also rendered through the actual music engine and synth with `OfflineAudioContext`: finite, non-silent samples, peaks below **0.044**, no clipping. This checks generated audio, not subjective musical quality.
- **Harness:** browser console errors and uncaught exceptions now fail playtests; the all-level shell runner now honors the harness exit code instead of accepting an earlier “done” line after a later failure. Temporary test-setup errors (including using `placeAt` to simulate a splash and its deliberate checkpoint reset) were corrected, not reported as gameplay bugs.

Physical controllers and a preschool player were not available. Ice steering and super-bounce learning still need that child trial; script success cannot establish that they are fun or frustration-free. No new child-facing timing was tightened in this pass.

Final checks: `bun run build`, `bash tools/playtest-all.sh 5340`, and `bash tools/playtest-qa.sh 5340`. All nine normal routes, eight alternate-style chapter 2 routes and the expanded QA suite pass. Screenshots and logs remain temporary under `/tmp/shots/` and `/tmp/bears-qa2-*.log`; no binary artifacts are committed.
