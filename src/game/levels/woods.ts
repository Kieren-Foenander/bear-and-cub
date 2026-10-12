import * as THREE from "three"
import { markStatic } from "../batching.ts"
import { bounceCoach, rideCoach } from "../coaches.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Gate, logMesh, mushroom, Seesaw, sign } from "../props.ts"
import { HangingPinecone } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { damp, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Level 4: Mushroom Woods.
 * Teaches: timing against things that move.
 *
 * Super-bounce on mushrooms (press jump just before you land), ride floating logs across a
 * stream (jump on as the log comes past), then Mama launches Cub off a seesaw onto a cliff where
 * she swipes a magic flower that grows mushroom steps for Mama.
 */

const BOUNDS = { minX: -34, maxX: 34, minZ: -62, maxZ: 40 }
const WATER = -1
const FENCE_Z = 12
const FENCE_HEIGHT = 4.5
const STREAM = { near: 2.5, far: -4.5 }
const CLIFF = { front: -24, top: 5.5 }
const LOG_TOP = WATER + 0.45

const streamMask = (z: number) => smoothstep(STREAM.near + 0.3, STREAM.near - 0.3, z) * smoothstep(STREAM.far - 0.3, STREAM.far + 0.3, z)

const height = (x: number, z: number) => {
  const bumps = 0.5 * Math.sin(x * 0.23) * Math.cos(z * 0.19) + 0.35 * Math.sin(x * 0.41 + z * 0.29)
  const corridor = smoothstep(9, 18, Math.abs(x))
  const dry = 1 - streamMask(z)
  let h = (bumps + 0.4) * corridor * dry
  h -= 2.6 * streamMask(z)
  h += CLIFF.top * smoothstep(CLIFF.front + 0.4, CLIFF.front - 0.4, z)
  h += edgeHills(BOUNDS, x, z) * dry
  return h
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -19, z: 28, radius: 5 },
  { x: 20, z: 24, radius: 4.5 },
  { x: -20, z: -12, radius: 4.5 },
  { x: 21, z: -14, radius: 4.5 },
  { x: -16, z: -44, radius: 5 },
  { x: 16, z: -50, radius: 5 }
]

export const woods: LevelDef = {
  id: "woods",
  title: "Mushroom Woods",
  teaches: "Bounce and jump at just the right time",
  emoji: "🍄",
  sky: { color: "#bcd9f2", fog: "#cfe3f0" },
  spawn: { mama: [-1.5, 34], cub: [1.5, 33] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 0.9,
    waterY: WATER,
    grass: ["#5fae4a", "#58a544", "#66b651", "#4f9e40"],
    hill: "#4a8a3a",
    color: (x, z, y) => (y > -0.1 && y < 0.6 && Math.abs(x - 1.2 * Math.sin(z * 0.17)) < 1.4 && streamMask(z) === 0 && z > CLIFF.front ? "#c9a46a" : null)
  },
  build: (api) => {
    const { mama, cub, berries, particles, sound, toast, shake, interactions, surfaces, rapier } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    let bigBounces = 0

    const bouncy = (x: number, z: number, color: string, capRadius = 1.5, h = 0.45) => {
      const m = mushroom(api, x, z, { capRadius, height: h, color })
      surfaces.addBouncer(m.capCollider!, {
        power: 9,
        superPower: 15,
        onBounce: (big) => {
          m.cap.scale.set(1.25, 0.35, 1.25)
          sound(big ? "bigJump" : "jump")
          if (big) {
            bigBounces++
            particles.burst(new THREE.Vector3(x, m.top, z), { colors: ["#ffffff", "#ffe066", color], count: 18, speed: 4, up: 2 })
          }
        }
      })
      return m
    }

    // --- Practice mushroom with berries stacked up high: only a big bounce gets them all. ---
    const practice = bouncy(-6, 22, "#e5484d")
    for (const lift of [2.5, 3.5, 4.5]) berries.add(new THREE.Vector3(-6, practice.top + lift, 22), 0)
    bounceCoach(interactions, { top: new THREE.Vector3(-6, practice.top, 22), radius: 1.4 })
    sign(api, -3, 25, "🍄")

    // --- The fence: bounce over it, then open the gate from the other side. ---
    const gate = new Gate(api, at(0, FENCE_Z), 2.2, FENCE_HEIGHT, { minX: -34, maxX: 34 })
    const fenceShroom = bouncy(5, FENCE_Z + 2.6, "#c38bff")
    bounceCoach(interactions, { top: new THREE.Vector3(5, fenceShroom.top, FENCE_Z + 2.6), radius: 1.4, enabled: () => !gate.open && cub.position.z > FENCE_Z })
    berries.arc(new THREE.Vector3(5, fenceShroom.top, FENCE_Z + 2), new THREE.Vector3(4, 0, FENCE_Z - 3), 4, 6)
    interactions.add({
      id: "open-gate",
      who: "cub",
      kind: "press",
      buttons: ["b"],
      label: "Open!",
      anchor: () => at(0, FENCE_Z).add(new THREE.Vector3(0, FENCE_HEIGHT + 0.8, 0)),
      inRange: (bear) => bear.position.z < FENCE_Z && bear.position.z > FENCE_Z - 3.5 && Math.abs(bear.position.x) < 3.5,
      enabled: () => !gate.open,
      onComplete: () => {
        gate.openUp()
        sound("creak")
        toast("The gate is open!")
      }
    })

    // --- The stream: two floating logs drift side to side. Hop on, ride, hop off. ---
    const lanes = [
      { z: 1.1, phase: 0, speed: 0.42, amp: 5 },
      { z: -2.4, phase: 2.2, speed: 0.36, amp: 5 }
    ]
    const logs = lanes.map((lane) => {
      const object = logMesh(5, 0.75)
      const position = new THREE.Vector3()
      const velocity = new THREE.Vector3()
      const platform = surfaces.addPlatform(object, rapier.ColliderDesc.cuboid(2.5, 0.4, 0.95), (t) => {
        velocity.set(Math.cos(t * lane.speed + lane.phase) * lane.amp * lane.speed, 0, 0)
        return position.set(Math.sin(t * lane.speed + lane.phase) * lane.amp, LOG_TOP - 0.4 + Math.sin(t * 2 + lane.phase) * 0.04, lane.z)
      })
      return { lane, platform, velocity }
    })
    rideCoach(interactions, {
      edgeZ: STREAM.near,
      minX: -8,
      maxX: 8,
      y: 0,
      direction: -1,
      target: () => logs[0]!.platform.object.position,
      velocity: () => logs[0]!.velocity,
      catchWidth: 1.5,
      enabled: () => gate.open
    })
    rideCoach(interactions, {
      edgeZ: lanes[0]!.z - 0.95,
      minX: -9,
      maxX: 9,
      y: LOG_TOP,
      direction: -1,
      target: () => logs[1]!.platform.object.position,
      velocity: () => logs[1]!.velocity,
      catchWidth: 1.6,
      enabled: () => gate.open
    })
    for (const x of [-4, 0, 4]) berries.add(new THREE.Vector3(x, LOG_TOP, -6.2), 0.5)

    // --- The seesaw: Cub on the pink end, Mama jumps on the blue end. Up goes Cub! ---
    const seesaw = new Seesaw(api, at(-4, -15), 3, 0)
    const launchTarget = new THREE.Vector3(-5.5, CLIFF.top, CLIFF.front - 3.5)
    const onEnd = (bear: typeof cub, end: THREE.Vector3) => Math.hypot(bear.position.x - end.x, bear.position.z - end.z) < 1.1 && Math.abs(bear.feetY - end.y) < 0.6
    interactions.add({
      id: "seesaw-cub",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => seesaw.endA.clone().add(new THREE.Vector3(0, 2, 0)),
      inRange: (bear) => bear.position.distanceTo(seesaw.endA) < 5 && bear.feetY < CLIFF.top - 1,
      enabled: () => true,
      view: (bear) => (onEnd(bear, seesaw.endA) ? { buttons: [], label: "Hold on tight!" } : { buttons: ["a"], label: "Jump onto pink!" })
    })
    interactions.add({
      id: "seesaw-mama",
      who: "mama",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => seesaw.endB.clone().add(new THREE.Vector3(0, 2.6, 0)),
      inRange: (bear) => bear.position.distanceTo(seesaw.endB) < 5,
      enabled: () => onEnd(cub, seesaw.endA),
      view: () => ({ buttons: ["a"], label: "Jump on blue!" })
    })
    let launchCooldown = 0

    // --- Up on the cliff: the magic flower grows mushroom steps for Mama. ---
    cliff(api, { x0: -40, x1: 40, z0: -70, z1: CLIFF.front, top: CLIFF.top - 0.6 }, { cap: null })
    const steps = [0.85, 1.7, 2.55, 3.4, 4.25, 5.1].map((top, i) => {
      const z = -12 - i * 2
      const step = mushroom(api, 9, z, { capRadius: 1.3, height: top - 0.71, color: "#d9a26a", solid: false })
      step.group.scale.setScalar(0.01)
      return { step, grow: 0, delay: i * 0.35, solid: false }
    })
    let grown = false
    let growTime = 0
    const flower = new HangingPinecone(
      api,
      new THREE.Vector3(-1, CLIFF.top, CLIFF.front - 4),
      () => {
        grown = true
        sound("found")
        toast("Magic mushroom steps!")
      },
      1.6,
      "bellflower"
    )
    const onCliff = (bear: typeof cub) => bear.feetY > CLIFF.top - 0.5

    // --- Goal. ---
    const honey = new THREE.Vector3(0, CLIFF.top, -42)
    api.goal(honey, () => grown)
    createTree(api, -4, -47, { scale: 1.9, kind: "round" })
    berries.ring(new THREE.Vector3(12, CLIFF.top, -36), 2.5, 5, () => CLIFF.top)
    berries.ring(at(-20, -12), 2, 4, height)
    berries.ring(at(20, 24), 2, 4, height)
    berries.line(at(-1, 30), at(-1, 18), 4, height)

    // Little decorative mushrooms everywhere.
    const colors = ["#e5484d", "#c38bff", "#ffb347", "#ff6fa8"]
    for (let i = 0; i < 28; i++) {
      const x = (Math.random() - 0.5) * 56
      const z = -55 + Math.random() * 90
      if (Math.abs(x) < 9 || streamMask(z) > 0 || Math.abs(z - FENCE_Z) < 2 || Math.abs(z - CLIFF.front) < 2) continue
      markStatic(mushroom(api, x, z, { capRadius: 0.3 + Math.random() * 0.3, height: 0.3 + Math.random() * 0.3, color: colors[i % colors.length]!, solid: false }).group)
    }

    api.nature({ grass: GRASS, butterflies: GRASS, flowers: [[-8, 28], [8, 30], [-12, 6], [12, 7], [-9, -10], [12, -18], [-8, -35], [9, -40]] })
    scatter(api, {
      seed: 404,
      trees: 60,
      rocks: 20,
      kinds: ["pine", "pine", "pine", "round"],
      blocked: (x, z, margin) =>
        Math.abs(x) < 11 + margin ||
        streamMask(z) > 0 ||
        Math.abs(z - FENCE_Z) < 3 + margin ||
        Math.abs(z - CLIFF.front) < 4 + margin ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        gate.update(dt)
        seesaw.update(dt)
        flower.update(dt)
        for (const m of [practice, fenceShroom]) {
          m.cap.scale.x = damp(m.cap.scale.x, 1, 8, dt)
          m.cap.scale.y = damp(m.cap.scale.y, 0.6, 8, dt)
          m.cap.scale.z = m.cap.scale.x
        }

        // Seesaw: lean towards whoever is standing on it; launch Cub when Mama lands on blue.
        launchCooldown -= dt
        const cubOnA = onEnd(cub, seesaw.endA)
        seesaw.rest(cubOnA ? -1 : 0)
        const mamaFeet = mama.position.clone().setY(mama.feetY)
        if (launchCooldown <= 0 && mama.justLanded && seesaw.sideOf(mamaFeet) === 1) {
          seesaw.slam()
          shake(0.3)
          sound("smash")
          launchCooldown = 1
          if (cubOnA) {
            const start = cub.position.clone()
            const target = launchTarget.clone().setY(launchTarget.y + cub.spec.halfHeight + cub.spec.radius + 0.1)
            const time = 1.3
            const velocity = target.sub(start).divideScalar(time)
            velocity.y += 0.5 * 22 * time
            cub.launch(velocity)
            sound("throw")
            toast("Wheee!")
          }
        }

        // Magic steps grow one after another.
        if (grown) {
          growTime += dt
          for (const s of steps) {
            if (growTime < s.delay) continue
            s.grow = Math.min(1, s.grow + dt * 1.8)
            const pop = s.grow < 1 ? 1 + Math.sin(s.grow * Math.PI) * 0.15 : 1
            s.step.group.scale.setScalar(Math.max(0.01, s.grow * pop))
            if (s.grow >= 1 && !s.solid) {
              s.solid = true
              s.step.makeSolid()
              sound("pop")
              particles.burst(new THREE.Vector3(9, s.step.top, s.step.group.position.z), { colors: ["#fff36b", "#ffffff"], count: 10, speed: 3 })
            }
          }
        }
      },
      objective: () => {
        if (!gate.open) {
          if (cub.position.z < FENCE_Z) return { text: "Cub: open the gate for Mama!", target: at(0, FENCE_Z).add(new THREE.Vector3(0, FENCE_HEIGHT + 2.5, 0)) }
          if (bigBounces === 0) return { text: "Cub: do a big bounce on the mushroom!", target: new THREE.Vector3(-6, practice.top + 3, 22) }
          return { text: "Cub: big bounce over the fence!", target: new THREE.Vector3(5, fenceShroom.top + 3, FENCE_Z + 2.6) }
        }
        const pastStream = (bear: typeof cub) => bear.position.z < STREAM.far - 0.5 || onCliff(bear)
        if (!pastStream(cub) || !pastStream(mama)) return { text: "Ride the floating logs over the stream!", target: new THREE.Vector3(0, LOG_TOP + 3, lanes[0]!.z) }
        if (!onCliff(cub)) {
          if (onEnd(cub, seesaw.endA)) return { text: "Mama: jump on the blue end!", target: seesaw.endB.clone().add(new THREE.Vector3(0, 3, 0)) }
          return { text: "Cub: jump onto the pink end of the seesaw!", target: seesaw.endA.clone().add(new THREE.Vector3(0, 3, 0)) }
        }
        if (!grown) return { text: "Cub: jump and swipe the magic flower!", target: new THREE.Vector3(-1, CLIFF.top + 4.5, CLIFF.front - 4) }
        if (!onCliff(mama)) return { text: "Mama: climb the mushroom steps!", target: new THREE.Vector3(9, 4, -14) }
        return { text: "Both bears to the honey pot!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
