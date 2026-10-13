# Bear & Cub 🐻🧸

A cosy, low-poly, co-op browser game for a parent and a little one. Mama Bear (the grown-up)
helps Cub (the kid) get to places she can't reach on her own; Cub then does the important
button-pressing bit to solve the puzzle. It's built to teach controller skills gently:
big on-screen prompts that coach every move, forgiving jumps, and nothing that can really
go wrong (falling in the water is just a splash and a reset).

**Play it:** https://bear-and-cub.kfoenander98.workers.dev

## Play locally

```sh
bun install
bun run dev        # http://localhost:5173
```

Plug in one or two controllers (Xbox / PlayStation / most others work via the Gamepad API).

| | Mama Bear | Cub |
| --- | --- | --- |
| Move | Left stick / d-pad | Left stick / d-pad |
| Jump | A / ✕ | A / ✕ |
| Action (pick up, lift, throw, push, boop, roar) | B / ○ | B / ○ |
| Swipe (hit things at the top of a jump) | X / □ | X / □ |
| Throw Cub (while carrying) / call Cub back | Y / △ | – |
| Pause | Start / Options | Start / Options |

- **Two controllers:** controller 1 is Mama, controller 2 is Cub.
- **One controller / keyboard:** press **Back / Select** (or **Tab**) to switch bears.
- **Keyboard:** WASD move · Space jump · E action · Q swipe · R throw / call · Tab switch · Esc pause.
- **Lost cub?** Mama presses **Y** and Cub hops straight onto her back.
- **Bear hug:** stand close and both roar (B) at the same time. ❤️
- **Name Cub:** press **N** on the title screen and type your little one's name. The game uses it
  everywhere ("Lily: jump and swipe an apple!").
- **Button practice:** press **Y** on the level map. A big button appears ("Press the green A!"),
  press it to grow a flower. Goes through every button and stick direction: a gentle way to learn
  the controller.
- **Hats:** every level you finish unlocks a hat for Cub. Press ▲ / ▼ on the map to try them on.
- Controllers **rumble** on hits, bounces, splashes and hugs (where the browser supports it).
- **Music:** gentle procedural tunes for the menus and every level, with birdsong, water, crickets
  or wind. Press **M** to turn music on or off (remembered).
- **Quiet help:** if she keeps just missing a swipe or a big bounce, the timing window gets a
  little wider each time, so practice always pays off.

## The adventure

Nine adventure levels (five in chapter 1, three in chapter 2, and chapter 3 begins), each teaching a controller skill (see [docs/skills.md](docs/skills.md)),
plus a free-play park.
Every level ends with both bears reaching the honey pot. Berries and butterflies are
hidden everywhere for little explorers, and the level map remembers your best.

| # | Level | Teaches | Puzzles |
| --- | --- | --- | --- |
| 1 | 🌼 Sunny Meadow | Walk, push, jump-then-swipe | Apple-tree practice · Mama lifts Cub onto a ledge to push a boulder · Mama throws Cub over the river to ring the bell |
| 2 | 💦 Creek Hop | Run and jump at the same time | Three streams, each wider · push a tree over as a bridge for Mama · hop up rock pillars and knock down a pinecone to drop a ramp |
| 3 | 🐸 Lily Pond | Landing on little things | Stepping stones · lily pads that sink under Mama · boop the frog to call the turtles up as Mama's path |
| 4 | 🍄 Mushroom Woods | Timing against moving things | Super-bounce (press jump just before you land) over a fence · ride floating logs · seesaw launch · magic mushroom steps |
| 5 | 🍯 Honey Mountain | Everything together | A four-tier climb using every skill, ending with the giant honeycomb |
| 6 | 🌙 Firefly Night (chapter 2) | Light the lanterns | Swipe three lanterns to raise glowing stones · lift Cub up the ridge to boop a sleepy owl (rope ladder for Mama) · throw Cub to the moon-pond island to swipe the moon flower |
| 7 | ❄️ Snowy Slopes (chapter 2) | Steering gently on slippery ice | Ice rink · thin ice floes that crack under Mama · bell → snow bridge · push a giant snowball into a crack (together is faster) |
| 8 | 🍂 Autumn Orchard (chapter 2 finale) | Pick up, carry and put down | Bring Squirrel three golden acorns: one on a hay stack (Mama lifts Cub), one on a stump (super bounce), one hanging in an oak (jump-swipe) · leaf piles to run through |
| 9 | 🏖️ Sunny Beach (chapter 3) | Wait for it… then GO! | Crab crossing with a "Wait… GO!" coach · beach-ball football (B to kick) · Mama lifts Cub up the lighthouse rock to ring the bell · sail to Honey Island |
| ★ | 🎪 Bear Playground | Free play (opens after level 1) | Mushroom trampolines, musical bells, lily pond, seesaw up to a treehouse, a stream for running jumps |

## How it's built

- **[three.js](https://threejs.org)** for rendering. Everything is procedural flat-shaded
  geometry, including the rigged, animated bears (`src/game/models/`); there are no model files.
- **[Rapier](https://rapier.rs)** (WASM) for physics: kinematic character controllers for the
  bears, moving/sinking/bouncy surfaces, dynamic debris.
- **[Effect](https://effect.website) v4** for the app shell. The renderer, physics engine, input,
  audio, save data and HUD are `Context.Service`s with `Layer`s, and their resources (canvas,
  listeners, AudioContext) are scoped, so Vite hot reload tears everything down cleanly.
  Saved progress is validated with `Schema` on load. The per-frame game loop is plain mutable
  TypeScript, because allocating Effects 60 times a second isn't worth it.

```
src/
  main.ts                composes the layers and launches the game
  services/              Effect services: Renderer, Physics, Input, Sound, Music, Save, Hud
  services/music/        procedural music: themes, synth voices, scheduler
  game/
    Game.ts              the session: menus, saving, loading levels, frame loop
    stage.ts             one running level (its own scene + physics world)
    levels/              one file per level + the LevelDef types
    bear.ts              bear movement (character controller, platforms, bouncing)
    bearModel.ts         bear model + animation (rig in models/)
    coop.ts              Mama's pick up / lift / throw / call, and lift/throw spots
    interactions.ts      "stand here and press this" prompts (press, mash, coaching guides)
    coaches.ts           timing coaches: running jumps, bounces, riding moving things
    swipe.ts             swipe reach + the jump-then-swipe coach
    swipeThings.ts       bell, apple tree, hanging pinecone / flower / honeycomb
    props.ts             cliffs, bridges, ramps, gates, seesaws, mushrooms, stones…
    surfaces.ts          moving / sinking platforms and bouncy mushrooms
    terrain.ts           heightmap ground + water
    nature.ts            trees, rocks, grass, flowers, butterflies
    critters.ts          frog, turtles, dragonflies
    collectibles.ts      berries
    hats.ts              Cub's unlockable hats
    batching.ts          merges static scenery into a few draw calls
    menus.ts, hud.ts, prompts.ts   big friendly UI
```

## Developing

- `?level=3` jumps straight into a level; `?unlock` unlocks every level on the map.
- `/model-preview.html` (dev server only) shows both bears with buttons for every animation.
- `bun run playtest` (with `bun run dev` running on port 5173) plays every level start to
  finish headlessly with scripted input and checks each one completes. `bun run playtest:qa`
  runs the QA regressions (menus/saving, recovery after falling in, coaching prompts, emulated
  controllers…). See [docs/qa-report.md](docs/qa-report.md) for the QA pass. Tests live in
  `tools/tests/`; `bun tools/playtest.ts <test.js> --url <url>` runs one and can save
  screenshots to `/tmp/shots/`.

## Deploy (Cloudflare Workers)

A static site served by Workers static assets (`wrangler.jsonc`):

```sh
bunx wrangler login   # once
bun run deploy
```
