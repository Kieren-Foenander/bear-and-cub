import * as THREE from "three"
import { markStatic } from "../batching.ts"
import { Crab } from "../critters.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Gate, sign } from "../props.ts"
import { Bell } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { flat, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Chapter 3, Level 9: Sunny Beach.
 * Teaches: waiting for the right moment, then going (crab crossing), plus a kick-about.
 *
 * Wait for the crabs to scuttle past, then GO. Kick the beach ball into the net to open the
 * sandcastle gate. Mama lifts Cub onto the lighthouse rock to ring the bell, and a little boat
 * comes to carry both bears to Honey Island.
 */

const BOUNDS = { minX: -34, maxX: 34, minZ: -60, maxZ: 40 }
const WATER = -1
const GAP = { z0: 14, z1: 20, half: 3 }
const LANES = [
  { z: 15.6, period: 4.4, phase: 0 },
  { z: 17, period: 3.8, phase: 0.45 },
  { z: 18.4, period: 5, phase: 0.2 }
]
const NET = { z: -9.6, half: 2.4 }
const WALL_Z = -12
const ROCK = { x0: 3, x1: 10, z0: -36, z1: -29, top: 3.2 }
const ISLAND = { x: 25, z: -46, r: 4.2 }
const DOCK = new THREE.Vector3(15.6, 0, -40)
const ISLAND_DOCK = new THREE.Vector3(20.6, 0, -44.6)

const seaMask = (x: number) => smoothstep(13, 19, x)

const height = (x: number, z: number) => {
  const bumps = 0.25 * Math.sin(x * 0.21) * Math.cos(z * 0.17) + 0.15 * Math.sin(x * 0.43 + z * 0.31)
  const sea = seaMask(x)
  let h = (bumps + 0.2) * (1 - sea) - 3 * sea
  // A gentle sandy beach all round the island, so you can walk straight up off the boat.
  h += 3.4 * smoothstep(ISLAND.r + 4, ISLAND.r - 1, Math.hypot(x - ISLAND.x, z - ISLAND.z)) * sea
  h += edgeHills(BOUNDS, x, z) * (1 - sea)
  return h
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -24, z: 30, radius: 4 },
  { x: -26, z: 2, radius: 4 },
  { x: -22, z: -30, radius: 4.5 }
]

export const beach: LevelDef = {
  id: "beach",
  title: "Sunny Beach",
  teaches: "Wait for it… then GO!",
  emoji: "🏖️",
  unlockAfter: "autumn",
  sky: { color: "#8fd3ff", fog: "#bfe8ff", hemisphere: { sky: "#e6f6ff", ground: "#e8d29a", intensity: 1.5 }, sun: { color: "#fff6dc", intensity: 2.5 } },
  spawn: { mama: [-1.5, 33], cub: [1.5, 32] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 1.1,
    waterY: WATER,
    waterColor: "#3fb8d6",
    grass: ["#f2dda4", "#ead398", "#f6e3b0", "#e6cc8c"],
    hill: "#d8bf82",
    rock: "#a89d8d"
  },
  build: (api) => {
    const { scene, rapier, world, mama, cub, coop, berries, particles, sound, toast, shake, interactions, surfaces } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const updates: Array<(dt: number) => void> = []

    // --- Crab crossing: rocks either side of a sandy gap, crabs scuttling across it. ---
    cliff(api, { x0: -40, x1: -GAP.half, z0: GAP.z0, z1: GAP.z1, top: 2.6 }, { rock: "#b9ab92", cap: "#e6cc8c" })
    cliff(api, { x0: GAP.half, x1: 22, z0: GAP.z0, z1: GAP.z1, top: 2.6 }, { rock: "#b9ab92", cap: "#e6cc8c" })
    const crabs = LANES.map((lane) => new Crab(scene, at(-GAP.half + 0.5, lane.z), at(GAP.half - 0.5, lane.z), lane.period, lane.phase))
    const bumpCooldown = { mama: 0, cub: 0 }
    updates.push((dt) => {
      for (const crab of crabs) crab.update(dt)
      for (const bear of [mama, cub]) {
        bumpCooldown[bear.spec.id] -= dt
        if (bumpCooldown[bear.spec.id] > 0 || bear.mode !== "walk") continue
        for (const crab of crabs) {
          if (Math.hypot(bear.position.x - crab.position.x, bear.position.z - crab.position.z) < 0.8 + bear.spec.radius) {
            // A gentle pinch: hop back to where you started (no harm done).
            bumpCooldown[bear.spec.id] = 1.2
            bear.launch(new THREE.Vector3(0, 5, bear.position.z > crab.position.z ? 4 : -4))
            sound("miss")
            toast("Oops! Wait for the crab!")
            break
          }
        }
      }
    })
    // "Wait…" / "GO!" coach: is the way straight ahead going to be clear?
    const clearAhead = (x: number, z: number, speed: number) =>
      crabs.every((crab, i) => {
        const lane = LANES[i]!
        const eta = Math.max(0, (z - lane.z) / speed)
        const later = crab.positionAt(eta)
        return Math.abs(later.x - x) > 1.9
      })
    interactions.add({
      id: "crab-coach",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => new THREE.Vector3(cub.position.x, 3, GAP.z1 + 0.5),
      inRange: (bear) => bear.position.z > GAP.z1 - 0.3 && bear.position.z < GAP.z1 + 4 && Math.abs(bear.position.x) < GAP.half + 1,
      enabled: () => true,
      view: (bear) => (clearAhead(bear.position.x, bear.position.z, 3.2) ? { buttons: ["move"], label: "GO GO GO!", now: true } : { buttons: [], label: "Wait for the crabs…" })
    })
    sign(api, 4.5, GAP.z1 + 2.5, "🦀")

    // --- Beach-ball football: kick it into the net to open the sandcastle gate. ---
    const ballRadius = 0.75
    const ballStart = new THREE.Vector3(0, ballRadius + 0.5, 4)
    const ball = new THREE.Group()
    const stripes = ["#ff6b6b", "#ffffff", "#6fc3ff", "#ffffff", "#ffe066", "#ffffff"]
    for (let i = 0; i < stripes.length; i++) {
      const wedge = mesh(new THREE.SphereGeometry(ballRadius, 12, 8, (i / stripes.length) * Math.PI * 2, (Math.PI * 2) / stripes.length), flat(stripes[i]!))
      ball.add(wedge)
    }
    scene.add(ball)
    const ballBody = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic().setTranslation(ballStart.x, ballStart.y, ballStart.z).setLinearDamping(0.5).setAngularDamping(0.6)
    )
    world.createCollider(rapier.ColliderDesc.ball(ballRadius).setDensity(0.25).setRestitution(0.55).setFriction(0.6), ballBody)
    const ballPosition = new THREE.Vector3()
    let scored = false
    let outTime = 0
    for (const bear of [mama, cub]) {
      interactions.add({
        id: `kick-${bear.spec.id}`,
        who: bear.spec.id,
        kind: "press",
        buttons: ["b"],
        label: "Kick!",
        anchor: () => ballPosition.clone().add(new THREE.Vector3(0, 1.6, 0)),
        inRange: (b) => b.position.distanceTo(ballPosition) < ballRadius + b.spec.radius + 1.1,
        enabled: () => !scored && bear.mode === "walk",
        onComplete: (b) => {
          // Kick towards where you're facing, with a little lift.
          const power = b.spec.id === "mama" ? 8 : 7
          const impulse = b.forward.multiplyScalar(power).setY(2.5).multiplyScalar(ballBody.mass())
          ballBody.applyImpulse(impulse, true)
          b.model.swipe()
          sound("push")
        }
      })
    }
    // The net.
    const white = flat("#ffffff")
    for (const side of [-1, 1]) {
      const post = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.3, 6), white)
      post.position.set(side * NET.half, 1.15, NET.z)
      scene.add(post)
      world.createCollider(rapier.ColliderDesc.cylinder(1.15, 0.12).setTranslation(side * NET.half, 1.15, NET.z))
    }
    const bar = mesh(new THREE.CylinderGeometry(0.1, 0.1, NET.half * 2, 6), white)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, 2.3, NET.z)
    scene.add(bar)
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(NET.half * 2, 2.3, 8, 5),
      new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.6 })
    )
    net.position.set(0, 1.15, NET.z - 1.3)
    scene.add(net)
    const gate = new Gate(api, at(-8, WALL_Z), 2.2, 2.6, { minX: -34, maxX: 16 })
    updates.push((dt) => {
      gate.update(dt)
      const t = ballBody.translation()
      const r = ballBody.rotation()
      ballPosition.set(t.x, t.y, t.z)
      ball.position.copy(ballPosition)
      ball.quaternion.set(r.x, r.y, r.z, r.w)
      if (!scored && t.z < NET.z - 0.3 && Math.abs(t.x) < NET.half - 0.1) {
        scored = true
        gate.openUp()
        sound("success")
        shake(0.4)
        toast("GOAL!!! ⚽")
        for (let i = 0; i < 3; i++) {
          particles.burst(new THREE.Vector3((i - 1) * 1.5, 2.5, NET.z), { colors: ["#ff6b6b", "#ffe066", "#6fc3ff", "#ffffff"], count: 30, speed: 7, up: 5, life: 2 })
        }
      }
      // Rolled into the sea? Pop it back.
      outTime = t.y < WATER - 0.2 || t.x > 16 ? outTime + dt : 0
      if (outTime > 1.2) {
        outTime = 0
        ballBody.setTranslation(ballStart, true)
        ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        particles.burst(ballStart, { colors: ["#ffffff"], count: 12, speed: 3 })
      }
    })
    // Sandcastles to make it feel like a beach.
    const castle = (x: number, z: number) => {
      const group = new THREE.Group()
      const sand = flat("#e6cc8c")
      const base = mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), sand)
      base.position.y = 0.4
      group.add(base)
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as const) {
        const tower = mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 6), sand)
        tower.position.set(dx, 0.6, dz)
        group.add(tower)
      }
      const flag = mesh(new THREE.ConeGeometry(0.15, 0.3, 3), flat("#ff6b6b"))
      flag.position.set(0, 1.5, 0)
      flag.rotation.z = Math.PI / 2
      group.add(flag)
      group.position.copy(at(x, z))
      scene.add(markStatic(group))
    }
    castle(-6, -9)
    castle(6, -8)
    castle(-14, 6)

    // --- The lighthouse rock: Mama lifts Cub up to ring the bell; the boat comes. ---
    cliff(api, ROCK, { rock: "#a89d8d", cap: "#e6cc8c" })
    const tower = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const ring = mesh(new THREE.CylinderGeometry(1.1 - i * 0.12, 1.2 - i * 0.12, 1.4, 10), flat(i % 2 ? "#ffffff" : "#e5484d"))
      ring.position.y = 0.7 + i * 1.4
      tower.add(ring)
    }
    const lamp = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 10), new THREE.MeshStandardMaterial({ color: "#fff3b0", emissive: "#ffd84d", emissiveIntensity: 0.9 }))
    lamp.position.y = 6.2
    const roof = mesh(new THREE.ConeGeometry(0.9, 0.8, 10), flat("#e5484d"))
    roof.position.y = 7
    tower.add(lamp, roof)
    tower.position.set(8.6, ROCK.top, -34.6)
    scene.add(markStatic(tower))
    world.createCollider(rapier.ColliderDesc.cylinder(3.5, 1.2).setTranslation(8.6, ROCK.top + 3.5, -34.6))
    coop.addSpot({
      id: "lighthouse",
      kind: "lift",
      at: at(5.5, ROCK.z1 + 2.4),
      target: new THREE.Vector3(5.5, ROCK.top, -31.8),
      time: 0.9,
      active: () => scored && boatState === "away" && cub.feetY < ROCK.top - 0.6
    })
    let boatState: "away" | "coming" | "docked" | "sailing" | "arrived" = "away"
    const bell = new Bell(api, new THREE.Vector3(5.2, ROCK.top, -33.6), () => {
      boatState = "coming"
      toast("Ding ding! Here comes the boat!")
    })
    updates.push((dt) => bell.update(dt))

    // --- The boat and the pier. ---
    const pier = mesh(new THREE.BoxGeometry(5, 0.3, 2.4), flat("#a0683c"))
    pier.position.set(12.4, 0.05, DOCK.z)
    scene.add(pier)
    world.createCollider(rapier.ColliderDesc.cuboid(2.5, 0.15, 1.2).setTranslation(12.4, 0.05, DOCK.z))
    for (const [x, z] of [[10.4, -38.9], [14.4, -38.9], [10.4, -41.1], [14.4, -41.1]] as const) {
      const leg = mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 5), flat("#7d4f2c"))
      leg.position.set(x, -1.4, z)
      scene.add(leg)
    }
    const boat = new THREE.Group()
    const hull = mesh(new THREE.BoxGeometry(3.6, 0.8, 2.6), flat("#e5484d"))
    hull.position.y = -0.4
    const trim = mesh(new THREE.BoxGeometry(3.7, 0.15, 2.7), flat("#ffffff"))
    trim.position.y = 0.02
    const mast = mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), flat("#8a5a36"))
    mast.position.set(-1.2, 1.5, 0)
    const sail = mesh(new THREE.ConeGeometry(1, 2.2, 3), flat("#fff8e8"))
    sail.position.set(-1.2, 1.9, 0.4)
    sail.rotation.set(0, Math.PI / 2, 0)
    sail.scale.set(0.15, 1, 1)
    boat.add(hull, trim, mast, sail)
    let progress = 0
    let aboardTime = 0
    const seats = new Map<typeof cub, THREE.Vector3>()
    const boatPosition = new THREE.Vector3()
    surfaces.addPlatform(boat, rapier.ColliderDesc.cuboid(1.8, 0.4, 1.3).setTranslation(0, -0.4, 0), (t, weight, dt) => {
      if (boatState === "coming") {
        progress = Math.min(1, progress + dt / 6)
        if (progress >= 1) boatState = "docked"
      } else if (boatState === "docked") {
        aboardTime = weight >= 5 ? aboardTime + dt : 0
        if (aboardTime > 1) {
          boatState = "sailing"
          toast("All aboard! ⛵")
          sound("success")
          // Both bears sit tight for the trip (nobody topples overboard).
          for (const bear of [mama, cub]) seats.set(bear, bear.position.clone().sub(boatPosition))
        }
      } else if (boatState === "sailing") {
        progress = Math.max(0, progress - dt / 7)
        if (progress <= 0) {
          boatState = "arrived"
          seats.clear()
        }
      }
      const eased = progress * progress * (3 - 2 * progress)
      boatPosition.lerpVectors(ISLAND_DOCK, DOCK, eased)
      boatPosition.y = Math.sin(t * 1.4) * 0.05
      return boatPosition
    })
    updates.push(() => {
      boat.rotation.z = Math.sin(performance.now() / 700) * 0.03
      for (const [bear, offset] of seats) {
        bear.velocity.set(0, 0, 0)
        bear.teleport(boatPosition.clone().add(offset))
      }
    })
    interactions.add({
      id: "boat-hop",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => boatPosition.clone().add(new THREE.Vector3(0, 3, 0)),
      inRange: (bear) => boatState === "docked" && bear.position.distanceTo(boatPosition) < 6,
      enabled: () => boatState === "docked",
      view: () => ({ buttons: ["move"], label: "Hop on the boat!" })
    })

    // --- Honey Island. ---
    const honey = at(ISLAND.x + 0.5, ISLAND.z - 0.5)
    api.goal(honey, () => boatState === "arrived")
    createTree(api, ISLAND.x + 2, ISLAND.z - 2.4, { scale: 1.5, kind: "round" })

    // Palm-ish trees and goodies.
    berries.line(at(0, 29), at(0, 22), 4, height)
    berries.line(at(-1, 10), at(1, -4), 5, height)
    berries.ring(at(-24, 30), 2, 5, height)
    berries.ring(at(-26, 2), 2, 4, height)
    berries.line(at(-8, -16), at(4, -26), 5, height)
    berries.ring(new THREE.Vector3(6.5, ROCK.top, -32.5), 1, 3, () => ROCK.top)

    api.nature({ grass: GRASS, butterflies: GRASS, flowers: [[-8, 30], [-12, 20], [-10, -20], [-4, -28]] })
    scatter(api, {
      seed: 1010,
      trees: 26,
      rocks: 24,
      kinds: ["round"],
      blocked: (x, z, margin) =>
        x > 10 ||
        Math.abs(x) < 9 + margin ||
        (z > GAP.z0 - 2 && z < GAP.z1 + 2) ||
        Math.abs(z - WALL_Z) < 3 ||
        (x > 0 && z < -26) ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        for (const update of updates) update(dt)
      },
      objective: () => {
        if (cub.position.z > GAP.z0 - 0.5 || mama.position.z > GAP.z0 - 0.5) return { text: "Wait for the crabs… then GO!", target: new THREE.Vector3(0, 3.5, GAP.z1) }
        if (!scored) return { text: "Kick the beach ball into the net!", target: ballPosition.clone().add(new THREE.Vector3(0, 2.8, 0)) }
        if (boatState === "away") {
          if (cub.feetY > ROCK.top - 0.6) return { text: "Cub: ring the lighthouse bell!", target: new THREE.Vector3(5.2, ROCK.top + 4.5, -33.6) }
          return { text: "Mama: lift Cub up the lighthouse rock!", target: at(5.5, ROCK.z1 + 2.4).add(new THREE.Vector3(0, 3.5, 0)) }
        }
        if (boatState === "coming") return { text: "Here comes the boat!", target: boatPosition.clone().add(new THREE.Vector3(0, 3, 0)) }
        if (boatState === "docked") return { text: "Both bears hop on the boat!", target: boatPosition.clone().add(new THREE.Vector3(0, 3, 0)) }
        if (boatState === "sailing") return { text: "Sailing to Honey Island! ⛵", target: null }
        return { text: "Both bears to the honey!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
