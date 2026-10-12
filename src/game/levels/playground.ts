import * as THREE from "three"
import { bounceCoach, runJumpCoach } from "../coaches.ts"
import { Dragonfly, Frog } from "../critters.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Drawbridge, lilyPadMesh, logMesh, mushroom, Seesaw, sign } from "../props.ts"
import { AppleTree, Bell } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { damp, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Bonus: Bear Playground. No puzzles, just a park full of everything from the adventure to play
 * with: a mushroom trampoline park, musical bells, a lily pond with a drifting log, a seesaw up to
 * a treehouse, a stream for running jumps, and an apple tree. Go to the honey pot when you're done.
 */

const BOUNDS = { minX: -42, maxX: 42, minZ: -42, maxZ: 42 }
const WATER = -1
const POND = { x: 21, z: -16, r: 9 }
const STREAM = { z: 24, half: 1.5, x0: -34, x1: -8 }
const TREEHOUSE = { x0: -32, x1: -24, z0: -26, z1: -18, top: 4.5 }

const pondMask = (x: number, z: number) => smoothstep(POND.r + 0.4, POND.r - 0.6, Math.hypot(x - POND.x, z - POND.z))
const streamMask = (x: number, z: number) =>
  smoothstep(STREAM.half + 0.3, STREAM.half - 0.3, Math.abs(z - STREAM.z)) * smoothstep(STREAM.x0 - 1, STREAM.x0 + 1, x) * smoothstep(STREAM.x1 + 1, STREAM.x1 - 1, x)

const height = (x: number, z: number) => {
  const bumps = 0.5 * Math.sin(x * 0.18) * Math.cos(z * 0.16) + 0.3 * Math.sin(x * 0.37 + z * 0.29)
  const open = smoothstep(10, 20, Math.hypot(x, z))
  const water = Math.max(pondMask(x, z), streamMask(x, z))
  let h = (bumps + 0.4) * open * (1 - water) * 0.6
  h -= 2.6 * water
  h += edgeHills(BOUNDS, x, z) * (1 - water)
  return h
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -8, z: 34, radius: 4 },
  { x: 32, z: 30, radius: 5 },
  { x: -34, z: 2, radius: 4.5 },
  { x: 34, z: 2, radius: 4 },
  { x: 4, z: -32, radius: 5 },
  { x: -12, z: -34, radius: 4 },
  { x: 8, z: 10, radius: 3.5 }
]

export const playground: LevelDef = {
  id: "playground",
  title: "Bear Playground",
  teaches: "Free play! Bounce, ring, hop and explore",
  emoji: "🎪",
  unlockAfter: "meadow",
  sky: { color: "#a8e0ff", fog: "#cdeeff" },
  spawn: { mama: [-1.5, 30], cub: [1.5, 29] },
  terrain: { bounds: BOUNDS, height, cell: 1, waterY: WATER },
  build: (api) => {
    const { scene, mama, cub, berries, particles, sound, toast, shake, interactions, surfaces, rapier, world } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const updates: Array<(dt: number) => void> = []

    // --- Mushroom trampoline park (west). ---
    const shroomColors = ["#e5484d", "#c38bff", "#ffb347", "#6fc3ff"]
    const bouncers = [
      [-24, 8],
      [-19, 4],
      [-24, 0],
      [-29, 4]
    ].map(([x, z], i) => {
      const m = mushroom(api, x!, z!, { capRadius: 1.5, height: 0.45, color: shroomColors[i]! })
      surfaces.addBouncer(m.capCollider!, {
        power: 9,
        superPower: 15,
        onBounce: (big) => {
          m.cap.scale.set(1.25, 0.35, 1.25)
          sound(big ? "bigJump" : "jump")
          if (big) particles.burst(new THREE.Vector3(x, m.top, z), { colors: ["#ffffff", shroomColors[i]!], count: 14, speed: 4, up: 2 })
        }
      })
      bounceCoach(interactions, { top: new THREE.Vector3(x, m.top, z), radius: 1.5 })
      berries.add(new THREE.Vector3(x!, m.top + 3, z!), 0)
      berries.add(new THREE.Vector3(x!, m.top + 4.4, z!), 0)
      return m
    })
    updates.push((dt) => {
      for (const m of bouncers) {
        m.cap.scale.x = damp(m.cap.scale.x, 1, 8, dt)
        m.cap.scale.y = damp(m.cap.scale.y, 0.6, 8, dt)
        m.cap.scale.z = m.cap.scale.x
      }
    })
    sign(api, -18, 11, "🍄")

    // --- Musical bells (east): each one a different note. ---
    const rainbow = ["#ff6b6b", "#ffb347", "#ffe066", "#8fe388", "#6fc3ff", "#c38bff"]
    const bells = rainbow.map(
      (color, i) =>
        new Bell(api, at(13 + i * 4, 12), () => {}, "x", { note: i * 2 - 1, color, id: `music-bell-${i}` })
    )
    updates.push((dt) => {
      for (const bell of bells) bell.update(dt)
    })
    sign(api, 11, 16, "🔔")

    // --- Lily pond with a drifting log and a frog to boop (north-east). ---
    const pads: Array<[number, number, number]> = [
      [14, -12, 1.1],
      [16.5, -15, 1],
      [19.5, -12.5, 0.95],
      [22.5, -15.5, 0.9],
      [25.5, -13, 0.9],
      [27.5, -17, 0.85],
      [24.5, -20, 0.85],
      [20.5, -21, 0.9],
      [17, -19.5, 1]
    ]
    for (const [x, z, r] of pads) {
      let sink = 0
      const phase = Math.random() * 10
      surfaces.addPlatform(lilyPadMesh(r, Math.random() > 0.5), rapier.ColliderDesc.cylinder(0.08, r), (t, weight, dt) => {
        sink = damp(sink, weight >= 3 ? 1.8 : weight > 0 ? 0.12 : 0, weight >= 3 ? 2.5 : 6, dt)
        return new THREE.Vector3(x, WATER + 0.12 - sink + Math.sin(t * 1.6 + phase) * 0.04, z)
      })
      berries.add(new THREE.Vector3(x, WATER + 0.12, z), 0.6)
    }
    const raft = new THREE.Vector3()
    surfaces.addPlatform(logMesh(4.5, 0.75), rapier.ColliderDesc.cuboid(2.25, 0.4, 0.95), (t) =>
      raft.set(POND.x + Math.cos(t * 0.25) * 5.5, WATER + 0.05, POND.z + Math.sin(t * 0.25) * 3)
    )
    const frogAt = at(POND.x + POND.r + 2, POND.z - 2)
    const frog = new Frog(scene, frogAt)
    frog.group.rotation.y = -Math.PI / 2
    world.createCollider(rapier.ColliderDesc.ball(0.9).setTranslation(frogAt.x, frogAt.y + 0.6, frogAt.z))
    interactions.add({
      id: "boop-frog-playground",
      who: "cub",
      kind: "press",
      buttons: ["b"],
      label: "Boop!",
      anchor: () => frogAt.clone().add(new THREE.Vector3(0, 2.6, 0)),
      inRange: (bear) => bear.position.distanceTo(frogAt) < 3,
      enabled: () => true,
      onComplete: () => {
        frog.hop()
        sound("croak")
        particles.burst(frogAt.clone().add(new THREE.Vector3(0, 1.5, 0)), { colors: ["#8fe388", "#ffffff"], count: 14, speed: 3 })
      }
    })
    const dragonflies = [new Dragonfly(scene, at(POND.x, POND.z).setY(WATER + 1)), new Dragonfly(scene, at(POND.x - 4, POND.z + 3).setY(WATER + 1), "#c38bff")]
    updates.push((dt) => {
      frog.update(dt)
      for (const d of dragonflies) d.update(dt)
    })

    // --- Seesaw up to the treehouse (north-west). A ramp lets Mama walk up too. ---
    cliff(api, { x0: TREEHOUSE.x0, x1: TREEHOUSE.x1, z0: TREEHOUSE.z0, z1: TREEHOUSE.z1, top: TREEHOUSE.top })
    for (const [x, z] of [[-31, -25], [-25, -25], [-31, -19], [-25, -19]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 5), new THREE.MeshStandardMaterial({ color: "#8a5a36", flatShading: true }))
      post.position.set(x, TREEHOUSE.top + 0.8, z)
      scene.add(post)
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.5, 4), new THREE.MeshStandardMaterial({ color: "#e5484d", flatShading: true }))
    roof.position.set((TREEHOUSE.x0 + TREEHOUSE.x1) / 2, TREEHOUSE.top + 2.7, (TREEHOUSE.z0 + TREEHOUSE.z1) / 2)
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    scene.add(roof)
    berries.ring(new THREE.Vector3(-28, TREEHOUSE.top, -22), 2, 6, () => TREEHOUSE.top)
    const treehouseRamp = new Drawbridge(api, new THREE.Vector3(-24, TREEHOUSE.top, -22), 10, Math.PI / 2, () => {}, 3, Math.asin(TREEHOUSE.top / 10))
    treehouseRamp.lower()
    for (let i = 0; i < 200; i++) treehouseRamp.update(0.05)

    const seesaw = new Seesaw(api, at(-21, -12), 3, 0)
    const launchTarget = new THREE.Vector3(-29, TREEHOUSE.top, -22)
    let launchCooldown = 0
    interactions.add({
      id: "seesaw-cub-playground",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => seesaw.endA.clone().add(new THREE.Vector3(0, 2, 0)),
      inRange: (bear) => bear.position.distanceTo(seesaw.endA) < 4,
      enabled: () => true,
      view: (bear) =>
        seesaw.sideOf(bear.position.clone().setY(bear.feetY)) === -1 ? { buttons: [], label: "Wait for Mama!" } : { buttons: ["move"], label: "Stand on pink!" }
    })
    updates.push((dt) => {
      seesaw.update(dt)
      launchCooldown -= dt
      const cubOnA = seesaw.sideOf(cub.position.clone().setY(cub.feetY)) === -1
      seesaw.rest(cubOnA ? -1 : 0)
      if (launchCooldown <= 0 && mama.justLanded && seesaw.sideOf(mama.position.clone().setY(mama.feetY)) === 1) {
        seesaw.slam()
        shake(0.3)
        sound("smash")
        launchCooldown = 1
        if (cubOnA) {
          const start = cub.position.clone()
          const target = launchTarget.clone().setY(launchTarget.y + cub.spec.halfHeight + cub.spec.radius + 0.1)
          const time = 1.2
          const velocity = target.sub(start).divideScalar(time)
          velocity.y += 0.5 * 22 * time
          cub.launch(velocity)
          sound("throw")
          toast("Wheee!")
        }
      }
    })

    // --- A stream for running jumps (south-west). ---
    runJumpCoach(interactions, { edge: at(-21, STREAM.z + STREAM.half + 0.35), direction: new THREE.Vector3(0, 0, -1), halfWidth: 12 })
    runJumpCoach(interactions, { edge: at(-21, STREAM.z - STREAM.half - 0.35), direction: new THREE.Vector3(0, 0, 1), halfWidth: 12 })
    for (const x of [-28, -21, -14]) berries.arc(at(x, STREAM.z + 2.5), at(x, STREAM.z - 2.5), 3, 1.3)
    sign(api, -10, 28, "🏃")

    // --- Apple tree near the start, and home (the honey pot) at the back. ---
    const appleTree = new AppleTree(api, at(9, 22))
    updates.push((dt) => appleTree.update(dt))
    const home = at(0, -28)
    api.goal(home)
    createTree(api, -3, -33, { scale: 2, kind: "round" })
    sign(api, 3, -24, "🍯")

    berries.ring(at(0, 6), 4, 10, height)
    berries.ring(at(32, 30), 2.5, 5, height)
    berries.ring(at(4, -32), 2.5, 5, height)

    api.nature({
      grass: GRASS,
      butterflies: GRASS,
      flowers: [[-4, 20], [6, 30], [-12, 14], [14, 4], [-6, -6], [6, -10], [30, 22], [-30, 30], [-34, -8], [34, -30], [-14, -26], [10, -26]]
    })
    scatter(api, {
      seed: 606,
      trees: 45,
      rocks: 20,
      blocked: (x, z, margin) =>
        Math.hypot(x, z) < 14 + margin ||
        Math.hypot(x - POND.x, z - POND.z) < POND.r + 4 + margin ||
        (z > STREAM.z - 5 && z < STREAM.z + 5 && x < STREAM.x1 + 3) ||
        (x < -15 && z > -30 && z < 12) ||
        (x > 10 && x < 34 && z > 7 && z < 17) ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        for (const update of updates) update(dt)
      },
      objective: () => ({ text: "Free play! Visit the honey pot to finish.", target: null })
    }
  }
}
