import * as THREE from "three"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Debris, Drawbridge, sign } from "../props.ts"
import { AppleTree, Bell } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { flat, jitter, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Level 1: Sunny Meadow.
 * Teaches: moving, pressing buttons, mashing (push the boulder), and the jump-then-swipe timing
 * (apple tree practice → ring the bell).
 */

const BOUNDS = { minX: -46, maxX: 46, minZ: -74, maxZ: 42 }
const RIVER_HALF_WIDTH = 6
const riverZ = (x: number) => -21 + 1.5 * Math.sin(x * 0.09)
const distanceToRiver = (x: number, z: number) => Math.abs(z - riverZ(x))
const pathX = (z: number) => 1.2 * Math.sin(z * 0.15)

const height = (x: number, z: number) => {
  const bumps =
    0.6 * Math.sin(x * 0.17) * Math.cos(z * 0.13) + 0.35 * Math.sin(x * 0.37 + z * 0.29) + 0.25 * Math.cos(z * 0.41 - x * 0.11)
  // Keep the middle corridor flat so puzzle spots are predictable; let the sides roll.
  const corridor = smoothstep(10, 22, Math.abs(x))
  const river = distanceToRiver(x, z)
  let h = (bumps + 0.4) * corridor * smoothstep(RIVER_HALF_WIDTH, 9, river)
  h -= 3 * smoothstep(RIVER_HALF_WIDTH, 3.5, river)
  // Edge hills, but not across the river (or they'd make a sneaky land bridge).
  h += edgeHills(BOUNDS, x, z) * smoothstep(RIVER_HALF_WIDTH, RIVER_HALF_WIDTH + 4, river)
  return h
}

const WALL = { z: -6, hz: 2, top: 8, ledgeTop: 3.2, gapHalf: 2, ledgeX: [2, 10] as const }
const BRIDGE_X = -9

const SPOTS = {
  lift: new THREE.Vector3(6, 0, -1.6),
  liftTarget: new THREE.Vector3(6.8, 3.2, -6.2),
  throw: new THREE.Vector3(0, 0, -11.5),
  throwTarget: new THREE.Vector3(0.5, 0, -30.5),
  appleTree: new THREE.Vector3(-6, 0, 15),
  bell: new THREE.Vector3(5, 0, -32),
  honey: new THREE.Vector3(0, 0, -52)
}
for (const spot of [SPOTS.lift, SPOTS.throw, SPOTS.throwTarget, SPOTS.appleTree, SPOTS.bell, SPOTS.honey]) {
  spot.y = height(spot.x, spot.z)
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -16, z: 22, radius: 6 },
  { x: 17, z: 14, radius: 5.5 },
  { x: -20, z: 5, radius: 5 },
  { x: 22, z: 26, radius: 4.5 },
  { x: -24, z: -13, radius: 5 },
  { x: 21, z: -12, radius: 5 },
  { x: -17, z: -38, radius: 6 },
  { x: 19, z: -45, radius: 6 },
  { x: -4, z: -62, radius: 5 }
]

export const meadow: LevelDef = {
  id: "meadow",
  title: "Sunny Meadow",
  teaches: "Walk, push, and jump-then-swipe",
  emoji: "🌼",
  spawn: { mama: [-1.5, 26], cub: [1.5, 25] },
  terrain: {
    bounds: BOUNDS,
    height,
    color: (x, z, y) =>
      y > -0.2 && z < 30 && z > -56 && distanceToRiver(x, z) > RIVER_HALF_WIDTH && Math.abs(x - pathX(z)) < 1.6 ? "#d9b77e" : null
  },
  build: (api) => {
    const { scene, rapier, world, particles, sound, toast, shake, cub, coop, berries } = api

    // --- Cliffs: a wall across the map with a gap (blocked by a barricade) and a lower ledge. ---
    cliff(api, { x0: -46, x1: -WALL.gapHalf, z0: WALL.z - WALL.hz, z1: WALL.z + WALL.hz, top: WALL.top })
    cliff(api, { x0: WALL.ledgeX[0], x1: WALL.ledgeX[1], z0: WALL.z - WALL.hz, z1: WALL.z + WALL.hz, top: WALL.ledgeTop })
    // A tall back wall on the ledge so the cub can't wander off the far side.
    cliff(api, { x0: WALL.gapHalf - 0.01, x1: WALL.ledgeX[1], z0: WALL.z - WALL.hz - 0.6, z1: WALL.z - WALL.hz + 0.6, top: WALL.top })
    cliff(api, { x0: WALL.ledgeX[1], x1: 46, z0: WALL.z - WALL.hz, z1: WALL.z + WALL.hz, top: WALL.top })

    // --- Practice: an apple tree near the start teaches "jump, then swipe at the top". ---
    const appleTree = new AppleTree(api, SPOTS.appleTree)
    sign(api, SPOTS.appleTree.x + 2.8, SPOTS.appleTree.z + 2, "🍎")

    // --- Puzzle 1: Mama lifts Cub onto the ledge; Cub pushes the boulder onto the barricade. ---
    coop.addSpot({ id: "ledge", kind: "lift", at: SPOTS.lift, target: SPOTS.liftTarget, time: 0.85, active: () => !barricadeBroken && cub.feetY < WALL.ledgeTop - 0.5 })

    const boulderStart = new THREE.Vector3(3.3, WALL.ledgeTop + 0.9, WALL.z)
    const boulder = mesh(jitter(new THREE.DodecahedronGeometry(0.95, 1), 0.08), flat("#8f8a80"))
    boulder.position.copy(boulderStart)
    scene.add(boulder)
    const boulderCollider = world.createCollider(rapier.ColliderDesc.ball(0.9).setTranslation(boulderStart.x, boulderStart.y, boulderStart.z))
    let boulderPush = 0
    let boulderFall = -1
    let barricadeBroken = false

    const barricade = new THREE.Group()
    barricade.position.set(0, 0, WALL.z)
    const wood = flat("#a0683c")
    const darkWood = flat("#7d4f2c")
    for (let i = 0; i < 5; i++) {
      const plank = mesh(new THREE.BoxGeometry(0.72, 3.2, 0.25), i % 2 ? wood : darkWood)
      plank.position.set(-1.6 + i * 0.8, 1.6, 0)
      plank.rotation.z = (i - 2) * 0.03
      barricade.add(plank)
    }
    for (const [y, angle] of [[1, 0.35], [2.2, -0.35]] as const) {
      const brace = mesh(new THREE.BoxGeometry(4.4, 0.35, 0.25), wood)
      brace.position.set(0, y, 0.25)
      brace.rotation.z = angle
      barricade.add(brace)
    }
    scene.add(barricade)
    // Taller than it looks, so nobody can hop over it from the ledge.
    const barricadeCollider = world.createCollider(rapier.ColliderDesc.cuboid(WALL.gapHalf, 4, 0.5).setTranslation(0, 3, WALL.z))
    const debris = new Debris(api, (at) => particles.burst(at, { colors: ["#e8dcc4", "#ffffff"], count: 6, speed: 2, up: 1 }))

    api.interactions.add({
      id: "push-boulder",
      who: "cub",
      kind: "mash",
      buttons: ["b"],
      count: 3,
      label: "Push!",
      anchor: () => boulder.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
      inRange: (bear) => bear.feetY > WALL.ledgeTop - 0.6 && bear.position.distanceTo(boulder.position) < 2.6,
      enabled: () => boulderFall < 0 && !barricadeBroken,
      onStep: () => {
        boulderPush += 1
        sound("push")
        particles.burst(boulder.position.clone().setY(WALL.ledgeTop + 0.1), { colors: ["#cbb79a", "#a99a85"], count: 8, speed: 2, up: 1 })
      },
      onComplete: () => {
        boulderFall = 0
        sound("push")
      }
    })

    const smash = () => {
      barricadeBroken = true
      world.removeCollider(barricadeCollider, true)
      world.removeCollider(boulderCollider, true)
      for (const child of [...barricade.children]) {
        const { width, height: h, depth } = ((child as THREE.Mesh).geometry as THREE.BoxGeometry).parameters
        debris.fling(child, new THREE.Vector3(width, h, depth), new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, -4 - Math.random() * 3))
      }
      scene.remove(boulder)
      for (let i = 0; i < 7; i++) {
        const size = 0.3 + Math.random() * 0.25
        const chunk = mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.15), flat("#8f8a80"))
        chunk.position.copy(boulder.position).add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5))
        scene.add(chunk)
        debris.fling(chunk, new THREE.Vector3(size, size, size).multiplyScalar(1.4), new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, -1.5 - Math.random() * 2), 2 + Math.random())
      }
      particles.burst(new THREE.Vector3(0, 1.5, WALL.z), { colors: ["#c8b08a", "#a0683c", "#8f8a80", "#e8dcc4"], count: 45, speed: 7, up: 4, size: 0.18, life: 1.6 })
      sound("smash")
      shake(0.8)
      toast("CRASH!")
    }

    // --- Puzzle 2: Mama throws Cub over the river; Cub rings the bell; the bridge comes down. ---
    coop.addSpot({ id: "river", kind: "throw", at: SPOTS.throw, target: SPOTS.throwTarget, time: 1.25, active: () => barricadeBroken && !bridge.down && !acrossRiver() })
    const hingeZ = riverZ(BRIDGE_X) - RIVER_HALF_WIDTH - 1.2
    const bridge = new Drawbridge(api, new THREE.Vector3(BRIDGE_X, height(BRIDGE_X, hingeZ), hingeZ), RIVER_HALF_WIDTH * 2 + 2.4, 0, () => {
      sound("smash")
      shake(0.3)
      particles.burst(bridge.tip, { colors: ["#e8dcc4", "#c8b08a"], count: 25, speed: 4 })
    })
    const bell = new Bell(api, SPOTS.bell, () => {
      bridge.lower()
      toast("Ding! The bridge is coming down!")
    }, "z")
    const acrossRiver = () => cub.position.z < riverZ(cub.position.x) - RIVER_HALF_WIDTH + 0.5

    // --- The honey tree at the end. ---
    api.goal(SPOTS.honey, () => bridge.down)
    createTree(api, SPOTS.honey.x - 2.5, SPOTS.honey.z - 2, { scale: 1.9, kind: "round" })
    const hive = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.55 - Math.abs(i - 1.5) * 0.12, 0.22, 6, 10), flat(i % 2 ? "#f2b632" : "#e09b1d"))
      ring.rotation.x = Math.PI / 2
      ring.position.y = -i * 0.32
      hive.add(ring)
    }
    hive.position.set(SPOTS.honey.x - 1.5, SPOTS.honey.y + 4.6, SPOTS.honey.z - 2)
    scene.add(hive)

    // --- Berries: a trail up the path, a few hidden off to the sides, and some by the honey. ---
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    berries.line(at(pathX(20), 20), at(pathX(4), 4), 5, height)
    berries.ring(at(-16, 22), 2.5, 5, height)
    berries.ring(at(21, -12), 2, 4, height)
    berries.line(at(-1, -36), at(-1, -46), 4, height)
    berries.ring(at(19, -45), 2.5, 4, height)
    berries.add(at(8.5, -6.5).setY(WALL.ledgeTop), 0.7) // A reward for whoever gets up on the ledge.

    api.nature({
      grass: GRASS,
      butterflies: GRASS,
      flowers: [[-6, 20], [7, 24], [-10, 8], [9, 4], [-4, 29], [12, 18], [-12, -16], [10, -14], [-7, -34], [8, -38], [-10, -52], [11, -56], [26, 2], [-28, 30]]
    })

    scatter(api, {
      seed: 1234,
      trees: 55,
      rocks: 35,
      blocked: (x, z, margin) =>
        Math.abs(x - pathX(z)) < 8 + margin ||
        distanceToRiver(x, z) < RIVER_HALF_WIDTH + 2.5 + margin ||
        Math.abs(z - WALL.z) < WALL.hz + 2 + margin ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin) ||
        (Math.abs(x - BRIDGE_X) < 4 && Math.abs(z - riverZ(BRIDGE_X)) < 12) ||
        height(x, z) > 3
    })

    return {
      update: (dt) => {
        appleTree.update(dt)
        bell.update(dt)
        bridge.update(dt)
        debris.update(dt)
        // Boulder wobbles as the cub pushes, then rolls off the ledge onto the barricade.
        if (boulderFall < 0) {
          boulder.position.x += (boulderStart.x - boulderPush * 0.12 - boulder.position.x) * Math.min(1, dt * 10)
          boulder.rotation.z += (boulderPush * 0.25 - boulder.rotation.z) * Math.min(1, dt * 10)
        } else if (!barricadeBroken) {
          boulderFall += dt
          const rollTime = 0.45
          const dropTime = 0.4
          if (boulderFall < rollTime) {
            const t = boulderFall / rollTime
            boulder.position.x = THREE.MathUtils.lerp(boulderStart.x - 0.36, WALL.ledgeX[0] - 0.2, t * t)
          } else {
            const t = Math.min(1, (boulderFall - rollTime) / dropTime)
            boulder.position.x = THREE.MathUtils.lerp(WALL.ledgeX[0] - 0.2, 0.3, t)
            boulder.position.y = THREE.MathUtils.lerp(boulderStart.y, 2.6, t * t)
            if (t >= 1) smash()
          }
          boulder.rotation.z += dt * 8
        }
      },
      objective: () => {
        if (!barricadeBroken) {
          if (appleTree.cubHits === 0 && cub.feetY < WALL.ledgeTop - 0.6) {
            return { text: "Cub: jump and swipe an apple!", target: SPOTS.appleTree.clone().add(new THREE.Vector3(0, 6, 0)) }
          }
          if (cub.feetY > WALL.ledgeTop - 0.6) return { text: "Cub: push the big rock!", target: boulder.position.clone().add(new THREE.Vector3(0, 2.6, 0)) }
          return { text: "Mama: lift Cub up onto the rock!", target: SPOTS.lift.clone().add(new THREE.Vector3(0, 3.5, 0)) }
        }
        if (!bridge.down) {
          if (acrossRiver()) return { text: "Cub: jump and ring the bell!", target: SPOTS.bell.clone().add(new THREE.Vector3(0, 5, 0)) }
          return { text: "Mama: throw Cub over the river!", target: SPOTS.throw.clone().add(new THREE.Vector3(0, 3.5, 0)) }
        }
        return { text: "Both bears to the honey pot!", target: SPOTS.honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
