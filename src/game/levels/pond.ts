import * as THREE from "three"
import { Dragonfly, Frog, turtleMesh } from "../critters.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { lilyPadMesh, sign, steppingStone } from "../props.ts"
import { edgeHills } from "../terrain.ts"
import { damp, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Level 3: Lily Pond.
 * Teaches: precise jumping, landing on small things.
 *
 * Both bears hop stepping stones to a little island. Lily pads are too wobbly for Mama (they sink!),
 * so Cub hops the pads to boop a big frog, who calls the turtles up as stepping stones for Mama.
 */

const BOUNDS = { minX: -34, maxX: 34, minZ: -46, maxZ: 40 }
const WATER = -1
const POND = { x: 0, z: -5, ax: 22, az: 17 }
const ISLANDS = [
  { x: -10, z: -3, r: 3.2 }, // stone island
  { x: 9, z: -8, r: 2.8 }, // frog rock
  { x: 18.5, z: -3, r: 1.8 } // berry islet
] as const

const pondDistance = (x: number, z: number) => Math.hypot((x - POND.x) / POND.ax, (z - POND.z) / POND.az)

const height = (x: number, z: number) => {
  const bumps = 0.5 * Math.sin(x * 0.19) * Math.cos(z * 0.15) + 0.3 * Math.sin(x * 0.37 + z * 0.31)
  const corridor = smoothstep(10, 20, Math.abs(x))
  const pond = smoothstep(1.02, 0.9, pondDistance(x, z))
  let h = (bumps + 0.4) * corridor * (1 - smoothstep(1.3, 1.02, pondDistance(x, z)))
  h -= 2.6 * pond
  for (const island of ISLANDS) h += 2.6 * smoothstep(island.r + 0.6, island.r - 0.4, Math.hypot(x - island.x, z - island.z)) * pond
  h += edgeHills(BOUNDS, x, z)
  return h
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -20, z: 26, radius: 5 },
  { x: 20, z: 22, radius: 5 },
  { x: -27, z: 2, radius: 4 },
  { x: 26, z: -10, radius: 4 },
  { x: -20, z: -32, radius: 5 },
  { x: 16, z: -34, radius: 5 }
]

export const pond: LevelDef = {
  id: "pond",
  title: "Lily Pond",
  teaches: "Land your jumps on little lily pads",
  emoji: "🐸",
  sky: { color: "#a6dcff", fog: "#c8ecff" },
  spawn: { mama: [-8.5, 24], cub: [-11.5, 23] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 1,
    waterY: WATER,
    waterColor: "#56c2d6"
  },
  build: (api) => {
    const { scene, mama, cub, berries, particles, sound, toast, interactions, surfaces, rapier } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const near2d = (bear: typeof cub, x: number, z: number, r: number) => Math.hypot(bear.position.x - x, bear.position.z - z) < r
    const onIsland = (bear: typeof cub, i: number) => near2d(bear, ISLANDS[i]!.x, ISLANDS[i]!.z, ISLANDS[i]!.r + 0.4) && bear.feetY > WATER + 0.5

    // --- Stepping stones from the south shore to the stone island (both bears). ---
    const stones = [
      { x: -10, z: 7.2, r: 1.25 },
      { x: -10.4, z: 3.6, r: 1.15 }
    ]
    for (const s of stones) {
      steppingStone(api, s.x, s.z, s.r, WATER + 0.55)
      berries.add(new THREE.Vector3(s.x, WATER + 0.55, s.z), 0.6)
    }
    sign(api, -13, 12, "🪨")

    // --- Lily pads: they bob, dip a little under Cub, and sink right under Mama. ---
    const padPlatforms: Array<ReturnType<typeof surfaces.addPlatform>> = []
    const lilyPad = (x: number, z: number, r: number, drift?: { dx: number; speed: number }) => {
      let sink = 0
      const phase = Math.random() * 10
      const base = new THREE.Vector3(x, WATER + 0.12, z)
      const platform = surfaces.addPlatform(lilyPadMesh(r, Math.random() > 0.5), rapier.ColliderDesc.cylinder(0.08, r), (t, weight, dt) => {
        sink = damp(sink, weight >= 3 ? 1.8 : weight > 0 ? 0.12 : 0, weight >= 3 ? 2.5 : 6, dt)
        const sway = drift ? Math.sin(t * drift.speed + phase) * drift.dx : 0
        return new THREE.Vector3(base.x + sway, base.y - sink + Math.sin(t * 1.6 + phase) * 0.04, base.z)
      })
      padPlatforms.push(platform)
      berries.add(new THREE.Vector3(x, WATER + 0.12, z), 0.6)
      return platform
    }
    // Stone island → frog rock: getting smaller as you go.
    lilyPad(-4.9, -3.8, 1.1)
    lilyPad(-1.8, -5, 1)
    lilyPad(1.4, -6.2, 0.9)
    lilyPad(4.4, -7.3, 0.8)
    // Frog rock → north shore: smaller still.
    lilyPad(9.4, -12.4, 0.85)
    lilyPad(8.6, -15.3, 0.8)
    lilyPad(9.3, -18.1, 0.75)
    // Bonus: a drifting pad out to a little berry islet.
    lilyPad(14.3, -4.5, 1, { dx: 1.5, speed: 0.9 })
    berries.ring(at(ISLANDS[2].x, ISLANDS[2].z), 1, 4, height)
    sign(api, -7.6, -0.6, "🧸", -Math.PI / 2)

    // --- The frog. Boop it and the turtles come up. ---
    const frogAt = at(ISLANDS[1].x + 0.6, ISLANDS[1].z - 0.4)
    const frog = new Frog(scene, frogAt)
    frog.group.rotation.y = -Math.PI * 0.75
    api.world.createCollider(rapier.ColliderDesc.ball(0.9).setTranslation(frogAt.x, frogAt.y + 0.6, frogAt.z))
    let booped = false
    interactions.add({
      id: "boop-frog",
      who: "cub",
      kind: "press",
      buttons: ["b"],
      label: "Boop!",
      anchor: () => frogAt.clone().add(new THREE.Vector3(0, 2.6, 0)),
      inRange: (bear) => near2d(bear, frogAt.x, frogAt.z, 2.8),
      enabled: () => !booped,
      onComplete: () => {
        booped = true
        frog.hop()
        sound("croak")
        toast("Ribbit! Here come the turtles!")
        particles.burst(frogAt.clone().add(new THREE.Vector3(0, 1.5, 0)), { colors: ["#8fe388", "#ffffff"], count: 20, speed: 4 })
      }
    })

    // --- Turtles: they surface one by one to make a path for Mama. ---
    let risenFor = 0
    const turtles = [
      { x: -10, z: -8.6 },
      { x: -10.5, z: -12.2 },
      { x: -10, z: -15.8 }
    ]
    turtles.forEach((spot, i) => {
      const object = turtleMesh(1.3)
      object.rotation.y = Math.PI + (i - 1) * 0.4
      let rise = 0
      let splashed = false
      surfaces.addPlatform(object, rapier.ColliderDesc.cylinder(0.22, 1.3).setTranslation(0, 0.05, 0), (t, _weight, dt) => {
        const ready = booped && risenFor > 1 + i * 0.7
        rise = damp(rise, ready ? 1 : 0, 2.5, dt)
        if (ready && !splashed && rise > 0.6) {
          splashed = true
          sound("splashSmall")
          particles.burst(new THREE.Vector3(spot.x, WATER + 0.2, spot.z), { colors: ["#ffffff", "#bfe8ff"], count: 16, speed: 3, up: 3 })
        }
        return new THREE.Vector3(spot.x, WATER - 1.8 + rise * 2.05 + Math.sin(t * 1.3 + i) * 0.03 * rise, spot.z)
      })
    })

    // --- North shore: the honey. ---
    const honey = at(0, -31)
    api.goal(honey, () => booped)
    createTree(api, -3, -36, { scale: 1.8, kind: "round" })
    berries.line(at(-6, -24), at(-2, -28), 3, height)
    berries.ring(at(-20, -32), 2, 4, height)
    berries.ring(at(20, 22), 2, 4, height)

    const dragonflies = [new Dragonfly(scene, at(0, 0).setY(WATER + 1)), new Dragonfly(scene, at(-14, -12).setY(WATER + 1), "#c38bff"), new Dragonfly(scene, at(12, 4).setY(WATER + 1), "#ff9a4d")]

    api.nature({
      grass: GRASS,
      butterflies: GRASS,
      flowers: [[-4, 20], [6, 26], [-16, 14], [14, 14], [-24, -12], [24, 4], [-8, -26], [8, -27]]
    })
    scatter(api, {
      seed: 303,
      trees: 40,
      rocks: 20,
      blocked: (x, z, margin) =>
        pondDistance(x, z) < 1.25 + margin * 0.05 ||
        (Math.abs(x + 10) < 6 && z > 8 && z < 30) ||
        Math.hypot(x - honey.x, z - honey.z) < 8 + margin ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    let reachedIsland = false
    let heavyCooldown = 0
    return {
      update: (dt) => {
        frog.update(dt)
        for (const d of dragonflies) d.update(dt)
        if (booped) risenFor += dt
        if (onIsland(cub, 0)) reachedIsland = true
        heavyCooldown -= dt
        if (heavyCooldown <= 0 && mama.surfaceBelow && padPlatforms.includes(mama.surfaceBelow as (typeof padPlatforms)[number])) {
          heavyCooldown = 4
          toast("Too heavy, Mama!")
          sound("splashSmall")
        }
      },
      objective: () => {
        if (!reachedIsland) return { text: "Hop across the stepping stones!", target: new THREE.Vector3(stones[0]!.x, WATER + 3, stones[0]!.z) }
        if (!booped) {
          if (near2d(cub, frogAt.x, frogAt.z, 4)) return { text: "Cub: boop the frog!", target: frogAt.clone().add(new THREE.Vector3(0, 4, 0)) }
          return { text: "Cub: hop on the lily pads to the frog!", target: frogAt.clone().add(new THREE.Vector3(0, 4, 0)) }
        }
        if (mama.position.z > -18.5) return { text: "Mama: hop across the turtles!", target: new THREE.Vector3(turtles[0]!.x, WATER + 3, turtles[0]!.z) }
        if (cub.position.z > -19.5) return { text: "Cub: hop the lily pads to Mama!", target: new THREE.Vector3(9.4, WATER + 3, -12.4) }
        return { text: "Both bears to the honey pot!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
