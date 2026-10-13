import * as THREE from "three"
import { Fireflies, Owl } from "../critters.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Drawbridge, lilyPadMesh, mushroom, sign } from "../props.ts"
import { HangingPinecone, Lantern } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { damp, flat, jitter, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Chapter 2, Level 6: Firefly Night.
 * Uses: jump-and-swipe (lanterns), lifting, booping, throwing, little hops.
 *
 * Cub lights three lanterns and glowing stones rise from the stream. Mama lifts Cub up the
 * ridge, where she boops a sleepy owl who drops a rope ladder for Mama. Then Mama throws Cub to
 * an island in the moon pond, where she swipes the moon flower to lower a bridge for Mama.
 */

const BOUNDS = { minX: -32, maxX: 32, minZ: -62, maxZ: 40 }
const WATER = -1
const GULLY = { z: 12, half: 3 }
const RIDGE = { front: -10, top: 3.4, back: -16, foot: -24 }
const POND = { x: 0, z: -34, r: 7.5 }
const ISLAND = { x: 0, z: -34, r: 2.4 }

const gullyMask = (z: number) => smoothstep(GULLY.half + 0.4, GULLY.half - 0.4, Math.abs(z - GULLY.z))
const pondMask = (x: number, z: number) => smoothstep(POND.r + 0.4, POND.r - 0.6, Math.hypot(x - POND.x, z - POND.z))

const height = (x: number, z: number) => {
  const bumps = 0.45 * Math.sin(x * 0.2) * Math.cos(z * 0.17) + 0.3 * Math.sin(x * 0.41 + z * 0.3)
  const corridor = smoothstep(10, 18, Math.abs(x))
  const ridge = RIDGE.top * smoothstep(RIDGE.front + 0.4, RIDGE.front - 0.4, z) * smoothstep(RIDGE.foot, RIDGE.back, z)
  const water = Math.max(gullyMask(z), pondMask(x, z))
  let h = (bumps + 0.4) * corridor * (1 - water) + ridge
  h -= 2.6 * water
  h += 2.6 * smoothstep(ISLAND.r + 0.5, ISLAND.r - 0.5, Math.hypot(x - ISLAND.x, z - ISLAND.z))
  h += edgeHills(BOUNDS, x, z) * (1 - water)
  return h
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -18, z: 28, radius: 5 },
  { x: 19, z: 22, radius: 4.5 },
  { x: -20, z: -2, radius: 4 },
  { x: 20, z: -4, radius: 4 },
  { x: -17, z: -46, radius: 5 },
  { x: 17, z: -48, radius: 5 }
]

export const night: LevelDef = {
  id: "night",
  title: "Firefly Night",
  teaches: "Light the lanterns under the stars",
  emoji: "🌙",
  unlockAfter: "mountain",
  sky: {
    color: "#1b2350",
    fog: "#232c5c",
    fogNear: 28,
    fogFar: 95,
    hemisphere: { sky: "#8a9ce8", ground: "#2b3b2e", intensity: 1.45 },
    sun: { color: "#c8d8ff", intensity: 1.2 }
  },
  spawn: { mama: [-1.5, 31], cub: [1.5, 30] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 0.9,
    waterY: WATER,
    waterColor: "#2f5d9a",
    grass: ["#3f6b4f", "#3a6449", "#457556", "#36604a"],
    hill: "#2f5240",
    rock: "#5d6680"
  },
  build: (api) => {
    const { scene, mama, cub, coop, berries, particles, sound, toast, shake, interactions, surfaces, rapier, world } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const updates: Array<(dt: number) => void> = []
    berries.glow(0.7)

    // --- Three lanterns; each one lit raises a glowing stone in the stream. ---
    const stones = [
      { x: 0, z: 14, r: 1.25, top: -0.05 },
      { x: 0.6, z: 11.6, r: 1.25, top: 0.1 },
      { x: -0.2, z: 9.4, r: 1.25, top: -0.05 }
    ]
    const lanterns = [-9, -4.5, 4.5].map((x, i) => {
      let rise = 0
      const stone = stones[i]!
      const object = new THREE.Group()
      const rock = mesh(jitter(new THREE.CylinderGeometry(stone.r, stone.r * 1.1, 3, 8, 2), 0.05), flat("#5d6680"))
      rock.position.y = -1.5
      const glowTop = new THREE.Mesh(
        new THREE.CylinderGeometry(stone.r * 0.9, stone.r * 0.9, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: "#9fffd8", emissive: "#5fffc0", emissiveIntensity: 1.2, flatShading: true })
      )
      glowTop.position.y = 0.02
      object.add(rock, glowTop)
      const lantern: Lantern = new Lantern(api, at(x, GULLY.z + GULLY.half + 4), () => {
        toast(`${lanterns.filter((l) => l.lit).length} / 3 lanterns lit!`)
        particles.burst(new THREE.Vector3(stone.x, WATER + 0.5, stone.z), { colors: ["#9fffd8", "#ffffff"], count: 20, speed: 3, up: 3 })
      })
      surfaces.addPlatform(object, rapier.ColliderDesc.cylinder(1.5, stone.r).setTranslation(0, -1.5, 0), (_t, _weight, dt) => {
        rise = damp(rise, lantern.lit ? 1 : 0, 2.5, dt)
        return new THREE.Vector3(stone.x, stone.top - 3.2 * (1 - rise), stone.z)
      })
      updates.push((dt) => lantern.update(dt))
      return lantern
    })
    const allLit = () => lanterns.every((l) => l.lit)
    sign(api, 10, GULLY.z + GULLY.half + 6, "🏮")

    // --- The ridge: Mama lifts Cub up; Cub boops the owl, who drops a rope ladder. ---
    cliff(api, { x0: -40, x1: 40, z0: RIDGE.back, z1: RIDGE.front, top: RIDGE.top - 0.6 }, { rock: "#5d6680", cap: null })
    coop.addSpot({
      id: "night-lift",
      kind: "lift",
      at: at(6, RIDGE.front + 2.4),
      target: new THREE.Vector3(6.5, RIDGE.top, RIDGE.front - 2.8),
      time: 0.9,
      active: () => allLit() && cub.feetY < RIDGE.top - 0.6 && !ladder.down
    })
    const stumpAt = new THREE.Vector3(1, RIDGE.top, -13)
    const stump = mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.2, 9), flat("#6b4a2a"))
    stump.position.set(stumpAt.x, RIDGE.top + 0.6, stumpAt.z)
    scene.add(stump)
    world.createCollider(rapier.ColliderDesc.cylinder(0.6, 1).setTranslation(stumpAt.x, RIDGE.top + 0.6, stumpAt.z))
    const owl = new Owl(scene, stumpAt.clone().setY(RIDGE.top + 1.2), new THREE.Vector3(-30, 18, -40))
    updates.push((dt) => owl.update(dt))
    const ladder = new Drawbridge(api, new THREE.Vector3(-7, RIDGE.top, RIDGE.front), 8, 0, () => {
      sound("smash")
      shake(0.3)
    }, 3, Math.asin(RIDGE.top / 8))
    updates.push((dt) => ladder.update(dt))
    interactions.add({
      id: "boop-owl",
      who: "cub",
      kind: "press",
      buttons: ["b"],
      label: "Boop!",
      anchor: () => stumpAt.clone().add(new THREE.Vector3(0, 3.6, 0)),
      inRange: (bear) => Math.hypot(bear.position.x - stumpAt.x, bear.position.z - stumpAt.z) < 2.8 && bear.feetY > RIDGE.top - 0.6,
      enabled: () => !owl.awake,
      onComplete: () => {
        owl.wake()
        sound("croak")
        toast("Hoo-hoo! A ladder for Mama!")
        ladder.lower()
      }
    })

    // --- The moon pond: Mama throws Cub to the island; Cub swipes the moon flower. ---
    const throwAt = at(0, POND.z + POND.r + 3.5)
    coop.addSpot({
      id: "night-throw",
      kind: "throw",
      at: throwAt,
      target: at(ISLAND.x, ISLAND.z + 0.6),
      time: 1.1,
      active: () => owl.awake && !bridge.down && !onIsland(cub)
    })
    const onIsland = (bear: typeof cub) => Math.hypot(bear.position.x - ISLAND.x, bear.position.z - ISLAND.z) < ISLAND.r + 0.3 && bear.feetY > WATER + 0.4
    const bridgeHalf = Math.sqrt(POND.r * POND.r - 36)
    const bridge = new Drawbridge(api, new THREE.Vector3(6, 0, POND.z - bridgeHalf - 1), bridgeHalf * 2 + 2, 0, () => {
      sound("smash")
      shake(0.3)
    })
    updates.push((dt) => bridge.update(dt))
    const moonflower = new HangingPinecone(
      api,
      at(ISLAND.x - 0.9, ISLAND.z + 0.6),
      () => {
        bridge.lower()
        toast("The moon flower glows! A bridge!")
        particles.burst(at(ISLAND.x, ISLAND.z).setY(2.5), { colors: ["#c8d8ff", "#ffffff", "#9fffd8"], count: 40, speed: 5, up: 3, gravity: 0.05 })
      },
      1.6,
      "bellflower"
    )
    updates.push((dt) => moonflower.update(dt))
    // Lily pads from the island to the far shore, for Cub.
    for (const [x, z, r] of [[1.3, -37.6, 0.95], [0.9, -39.7, 0.95]] as const) {
      let sink = 0
      const phase = Math.random() * 10
      surfaces.addPlatform(lilyPadMesh(r, true), rapier.ColliderDesc.cylinder(0.08, r), (t, weight, dt) => {
        sink = damp(sink, weight >= 3 ? 1.8 : weight > 0 ? 0.12 : 0, weight >= 3 ? 2.5 : 6, dt)
        return new THREE.Vector3(x, WATER + 0.12 - sink + Math.sin(t * 1.6 + phase) * 0.04, z)
      })
      berries.add(new THREE.Vector3(x, WATER + 0.12, z), 0.6)
    }

    // --- The glowing mushroom grove and the honey. ---
    const honey = at(0, -52)
    api.goal(honey, () => bridge.down)
    for (const [x, z, r, color] of [[-4, -55, 1.6, "#7fd8ff"], [4.5, -56, 1.2, "#c38bff"], [-7, -51, 0.9, "#9fffd8"], [7, -50, 1, "#ff9ad5"]] as const) {
      const m = mushroom(api, x, z, { capRadius: r, height: r * 1.4, color })
      m.cap.material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true })
    }

    // Fireflies everywhere, and plenty over the water.
    const swarms = [
      new Fireflies(scene, at(0, 22).setY(0.5), new THREE.Vector3(30, 3, 14), 50),
      new Fireflies(scene, at(0, GULLY.z).setY(WATER + 0.5), new THREE.Vector3(24, 2, 6), 30, "#b0ffe0"),
      new Fireflies(scene, at(0, -2).setY(0.5), new THREE.Vector3(30, 3, 12), 40),
      new Fireflies(scene, at(POND.x, POND.z).setY(WATER + 0.6), new THREE.Vector3(16, 2.5, 16), 50),
      new Fireflies(scene, at(0, -52).setY(0.6), new THREE.Vector3(24, 3, 12), 40, "#ffd0f0")
    ]
    updates.push((dt) => {
      for (const swarm of swarms) swarm.update(dt)
    })

    berries.line(at(0, 27), at(0, 19.5), 4, height)
    berries.ring(at(-18, 28), 2.2, 5, height)
    berries.ring(at(20, -4), 2, 4, height)
    berries.line(at(-5, -14), at(5, -14), 4, () => RIDGE.top)
    berries.ring(at(-17, -46), 2.5, 5, height)
    createTree(api, 3, -58, { scale: 2, kind: "round" })

    api.nature({ grass: GRASS, flowers: [[-6, 26], [7, 28], [-12, 18], [12, 18], [-10, 0], [10, -2], [-8, -44], [9, -45]] })
    scatter(api, {
      seed: 707,
      trees: 50,
      rocks: 20,
      kinds: ["pine", "pine", "round"],
      blocked: (x, z, margin) =>
        Math.abs(x) < 11 + margin ||
        gullyMask(z) > 0 ||
        Math.abs(z - RIDGE.front) < 4 + margin ||
        Math.hypot(x - POND.x, z - POND.z) < POND.r + 3 + margin ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        for (const update of updates) update(dt)
      },
      objective: () => {
        if (!allLit()) {
          const unlit = lanterns.filter((l) => !l.lit).length
          return { text: `Cub: jump and swipe the lanterns! (${3 - unlit}/3)`, target: null }
        }
        if (!owl.awake) {
          if (cub.feetY > RIDGE.top - 0.6) return { text: "Cub: boop the sleepy owl!", target: stumpAt.clone().add(new THREE.Vector3(0, 5, 0)) }
          if (cub.position.z > GULLY.z - GULLY.half) return { text: "Hop across the glowing stones!", target: new THREE.Vector3(0, 2.5, GULLY.z) }
          return { text: "Mama: lift Cub up the cliff!", target: at(6, RIDGE.front + 2.4).add(new THREE.Vector3(0, 3.5, 0)) }
        }
        if (mama.feetY < RIDGE.top - 0.6 && mama.position.z > RIDGE.front) return { text: "Mama: climb the rope ladder!", target: new THREE.Vector3(-7, RIDGE.top + 1, RIDGE.front + 4) }
        if (!bridge.down) {
          if (onIsland(cub)) return { text: "Cub: jump and swipe the moon flower!", target: at(ISLAND.x, ISLAND.z).setY(5) }
          return { text: "Mama: throw Cub to the island!", target: throwAt.clone().add(new THREE.Vector3(0, 3.5, 0)) }
        }
        return { text: "Off to the glowing mushrooms!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
