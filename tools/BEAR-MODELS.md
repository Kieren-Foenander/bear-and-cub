# Bear & Cub character implementation

This is the procedural fallback: deterministic sculpted ring-profile geometry,
rigid hierarchical joints, and layered procedural animation. There are no GLBs,
external textures, network requests, Blender installation requirements, or asset
loading races. `preloadBearModels()` preserves the existing async startup contract.

## Review and reproduce

```sh
bun install
bunx vite --host --port 5174
```

Open `http://localhost:5174/model-preview.html`. This page is development-only;
Vite's normal production build continues to use the existing game entry point.

- Animation buttons and their printed keys exercise every state.
- Space/4 jumps; press Q during the jump to inspect the upward swipe.
- The speed slider blends walk and run. Front/side/back views inspect the silhouette;
  Game distance checks readability at the approximate shared-camera distance.
- Ride uses the game's existing feet + 1.55 back anchor and the actual Cub scale.
- Sit & yawn advances idle settling; ordinary idle starts sitting after 8 seconds.
- P pauses. In the browser console, `bearPreview.setPaused(true)` and
  `bearPreview.advance(seconds)` provide deterministic animation steps.

Geometry regenerates whenever a `BearModel` is constructed. Edit dimensions and
character details in `src/game/models/rig.ts`, edit ring profiles and static mesh
batching in `src/game/models/shapes.ts`, then reload the preview. Fur, belly and
scarf use `BearLook` directly; the existing `specs.ts` colours are unchanged.
No export command or generated model file is needed.

## Model and animation design

Both bears face +Z with the game-owned root between their feet. Mama's measured
standing dimensions are about 1.46 wide × 1.905 high × 2.458 long. Cub is about
1.38 × 1.895 × 2.388 at scale 1; the existing 0.55 scale applies once, on the root.
Mama's torso reaches y=1.55 at the back anchor. Cub has a larger skull and eyes,
shorter hind legs, rounder torso, blush cheeks and a colour-controlled pink scarf.
Mama has a small flower attached to her left ear. Meshes cast and receive shadows.

`BearModel.animate()` writes reusable target and current pose buffers. Smoothed
mode weights layer idle, speed-based diagonal walk/bounding run, sit, air,
carried and flying poses. Short event envelopes layer swipe (~0.36 s), cheer
(~1.35 s), celebration (~2.1 s), shake (~0.85 s), and landing squash. Exponential
smoothing covers pose transitions, action retriggers and release. Eyes blink on
offset schedules; Mama breathes and twitches her ears, Cub yawns after settling.
The scarf follows the head with a separate trailing pivot.

Flight uses a separate body-centred quaternion pivot for continuous barrel rolls,
with happy spread paws and an open mouth. It blends back to identity after
landing without wrapping Euler angles. All other rotation/scale stays on inner
pivots. The game continues to own root position, yaw and scale. There are no
per-frame allocations inside `animate()` or `applyPose()`.

Static pieces sharing a material and rigid pivot are baked together at
construction. The two-bear preview reports roughly 174 draw calls including the
shadow pass and about 50,746 rendered triangles including shadows, ground and
preview plinth. Headless Chromium uses software WebGL here, so its frame rate is
not a measurement of a normal laptop GPU's 60 fps performance.

## Validation

```sh
bun tools/verify-bears.ts
bunx tsc --noEmit
bun run build
```

The verification script checks exact mesh dimensions, feet at the origin, sitting
hind-paw ground contact, overhead swipe reach for both bears, externally applied
scale, unchanged game-owned root transforms, positive scales and finite matrices
across all modes and event retriggers. Browser review covers every preview pose.
The real game was started with Space and exercised with movement, Tab switching,
Space jumping, Q swiping and E action. Screenshots were captured through the T3
Playwright/Chromium browser and copied into `tools/screenshots/`.

## Files

- `src/game/bearModel.ts`: public contract and blended animation controller.
- `src/game/models/rig.ts`: character proportions, materials and joint hierarchy.
- `src/game/models/shapes.ts`: faceted geometry, tiny curves and static batching.
- `model-preview.html`, `src/modelPreview.ts`: development character studio.
- `tools/verify-bears.ts`: model/animation contract checks.
- `tools/BEAR-MODELS.md`: reproduction and implementation notes.
- `tools/screenshots/*.png`: saved visual review evidence.

No changes outside the owned files are required.
