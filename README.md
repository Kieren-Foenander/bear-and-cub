# Bear & Cub 🐻🧸

A cosy, low-poly, co-op browser game for a parent and a little one. Mama Bear (the grown-up)
helps Cub (the kid) get to places she can't reach on her own; Cub then does the important
button-pressing bit to solve the puzzle. It's built to teach controller skills gently:
big on-screen prompts, forgiving jumps, nothing that can really go wrong.

## Play

```sh
bun install
bun run dev        # http://localhost:5173
```

Plug in one or two controllers (Xbox / PlayStation / most others work via the Gamepad API).

| | Mama Bear | Cub |
| --- | --- | --- |
| Move | Left stick / d-pad | Left stick / d-pad |
| Jump | A / ✕ | A / ✕ |
| Action (pick up, lift, throw, push, roar) | B / ○ | B / ○ |
| Swipe | X / □ | X / □ |
| Free throw (while carrying Cub) | Y / △ | – |

- **Two controllers:** controller 1 is Mama, controller 2 is Cub.
- **One controller / keyboard:** press **Back / Select** (or **Tab**) to switch bears.
- **Keyboard:** WASD move · Space jump · E action · Q swipe · R throw · Tab switch.

### The adventure so far

0. **The apple tree (practice):** Cub jumps and swipes an apple **at the top of her jump**.
   The prompt goes `Jump!` → `Get ready…` → a flashing `NOW!`. Apples grow back, so she can
   keep trying, and Mama can show her how.
1. **The tall rock:** Mama picks Cub up and lifts her onto the ledge (stand on the glowing paw
   circle). Cub pushes the boulder (mash B) and it smashes the wooden barricade.
2. **The river:** Mama throws Cub across from the paw circle. Cub jumps and rings the bell
   (same jump-then-swipe timing, a bit stricter), which lowers the bridge.
3. **The honey tree:** get both bears there for a celebration.

Off the path: walk through flowers (they play notes), and hunt for butterflies hiding in the
tall grass. Falling in the river is just a splash and a reset.

The plan for teaching new skills over later levels is in [docs/skills.md](docs/skills.md).

## How it's built

- **[three.js](https://threejs.org)** for rendering. Everything is procedural flat-shaded
  geometry; there are no model files yet.
- **[Rapier](https://rapier.rs)** (WASM) for physics: kinematic character controllers for the
  bears, dynamic bodies for debris.
- **[Effect](https://effect.website) v4** for the app shell. The renderer, physics world, input,
  audio and HUD are `Context.Service`s with `Layer`s, and their resources (canvas, event
  listeners, AudioContext, WASM world) are scoped. On Vite hot reload the main fiber is
  interrupted, so everything is torn down cleanly before the new version starts. The per-frame
  game loop is plain mutable TypeScript, because allocating Effects 60 times a second isn't worth it.

```
src/
  main.ts              composes the layers and launches the game
  services/            Effect services: Renderer, Physics, Input, Sound, Hud
  game/
    Game.ts            frame loop + wiring
    bear.ts            bear movement (Rapier character controller), carry/launch
    bearModel.ts       the low-poly bear and its animations
    coop.ts            Mama's pick up / lift / throw / put down
    interactions.ts    "stand here and press this" prompts (press, mash, coaching guides)
    swipe.ts           swipe reach + timing coach (jump, then swipe at the top)
    swipeThings.ts     the bell and the practice apple tree
    level.ts           cliffs, boulder + barricade, lever + bridge, honey tree, scenery
    terrain.ts         heightmap ground, river, water
    nature.ts          trees, rocks, grass, flowers, butterflies
    controls.ts        which controller drives which bear
    camera.ts          shared camera that keeps both bears in view
    hud.ts, prompts.ts big friendly UI
```

## Deploy (Cloudflare Workers)

Live at **https://bear-and-cub.kfoenander98.workers.dev**

It's a static site served by Workers static assets (`wrangler.jsonc`):

```sh
bunx wrangler login   # once
bun run deploy
```
