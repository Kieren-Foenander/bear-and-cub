import * as THREE from "three"
import { bounceCoach } from "../coaches.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Drawbridge, mushroom, sign } from "../props.ts"
import { Bell, HangingPinecone } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { clamp, damp, flat, jitter, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Level 5: Honey Mountain — the finale.
 * Uses everything: lifting, jump-and-swipe, precise hops, super bounces and riding moving stones.
 *
 * Tier 0 → 1: Mama lifts Cub up; Cub swipes a pinecone to drop a ramp for Mama.
 * Tier 1:     Cub hops wobbly stones over a crevasse (they crumble under Mama) and rings a bell → bridge.
 * Tier 1 → 2: Cub super-bounces up; swipes a magic flower → mushroom steps for Mama.
 * Tier 2 → 3: Both ride rising stones to the summit.
 * Summit:     Cub knocks the giant honeycomb out of the honey tree. Hooray!
 */

const BOUNDS = { minX: -30, maxX: 30, minZ: -52, maxZ: 40 }
const WATER = -1
const TIERS = [
  { front: 16, y: 3.2 },
  { front: 0, y: 7 },
  { front: -16, y: 11 }
] as const
const CREVASSE = { z: 8, half: 2.5 }

const crevasseMask = (z: number) => smoothstep(CREVASSE.half + 0.2, CREVASSE.half - 0.2, Math.abs(z - CREVASSE.z))

const height = (x: number, z: number) => {
  const bumps = 0.4 * Math.sin(x * 0.23) * Math.cos(z * 0.21) + 0.25 * Math.sin(x * 0.43 + z * 0.31)
  const corridor = smoothstep(10, 18, Math.abs(x))
  let h = 0
  let below = 0
  for (const tier of TIERS) {
    const step = smoothstep(tier.front + 0.4, tier.front - 0.4, z)
    h += (tier.y - below) * step
    below = tier.y
  }
  h += (bumps + 0.3) * corridor
  const crevasse = crevasseMask(z)
  h -= (TIERS[0].y + 2.5) * crevasse
  h += edgeHills(BOUNDS, x, z, 10) * (1 - crevasse)
  return h
}

const tierOf = (feetY: number) => (feetY > TIERS[2].y - 0.6 ? 3 : feetY > TIERS[1].y - 0.6 ? 2 : feetY > TIERS[0].y - 0.6 ? 1 : 0)

const GRASS: ReadonlyArray<Patch> = [
  { x: -18, z: 30, radius: 5 },
  { x: 18, z: 27, radius: 4.5 },
  { x: -18, z: 12, radius: 3.5 },
  { x: 19, z: -6, radius: 4 },
  { x: -17, z: -30, radius: 4.5 },
  { x: 16, z: -40, radius: 4.5 }
]

export const mountain: LevelDef = {
  id: "mountain",
  title: "Honey Mountain",
  teaches: "Everything together — the big climb!",
  emoji: "🍯",
  finale: true,
  sky: { color: "#ffd9a8", fog: "#ffe8cc" },
  spawn: { mama: [-1.5, 33], cub: [1.5, 32] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 0.8,
    waterY: WATER,
    grass: ["#86c45a", "#7dbb52", "#8fcc63", "#79b84f"],
    hill: "#6aa84f"
  },
  build: (api) => {
    const { mama, cub, coop, berries, particles, sound, toast, shake, interactions, surfaces, rapier } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)

    // Rocky cliff faces at each tier (the crevasse is cut out of the first one).
    cliff(api, { x0: -40, x1: 40, z0: CREVASSE.z + CREVASSE.half, z1: TIERS[0].front, top: TIERS[0].y - 0.6 }, { cap: null })
    cliff(api, { x0: -40, x1: 40, z0: TIERS[1].front, z1: CREVASSE.z - CREVASSE.half, top: TIERS[0].y - 0.6 }, { cap: null })
    cliff(api, { x0: -40, x1: 40, z0: TIERS[2].front, z1: TIERS[1].front, top: TIERS[1].y - 0.6 }, { cap: null })
    cliff(api, { x0: -40, x1: 40, z0: -60, z1: TIERS[2].front, top: TIERS[2].y - 0.6 }, { cap: null })

    // --- Tier 0 → 1: lift Cub up, she swipes a pinecone and a ramp drops for Mama. ---
    coop.addSpot({
      id: "mountain-lift",
      kind: "lift",
      at: at(5, 18.6),
      target: new THREE.Vector3(5.5, TIERS[0].y, 13.2),
      time: 0.9,
      active: () => tierOf(cub.feetY) === 0 && !ramp.down
    })
    const ramp = new Drawbridge(
      api,
      new THREE.Vector3(-8, TIERS[0].y, TIERS[0].front),
      8,
      0,
      () => {
        sound("smash")
        shake(0.4)
      },
      3.4,
      Math.asin(TIERS[0].y / 8)
    )
    const pinecone = new HangingPinecone(api, new THREE.Vector3(-2, TIERS[0].y, 13), () => {
      ramp.lower()
      toast("The ramp is coming down!")
    })
    sign(api, 8, 20, "🏔️")

    // --- Tier 1: wobbly stones over the crevasse. They hold Cub but crumble under Mama. ---
    const stones = [
      { x: 3.5, z: 9.6, r: 0.7 },
      { x: 5.4, z: 8.1, r: 0.65 },
      { x: 3.8, z: 6.5, r: 0.65 }
    ]
    for (const [i, s] of stones.entries()) {
      const object = new THREE.Group()
      const rock = mesh(jitter(new THREE.CylinderGeometry(s.r, s.r * 0.8, 5, 7, 2), 0.05), flat("#9d978b"))
      rock.position.y = -2.5
      const moss = mesh(new THREE.CylinderGeometry(s.r * 0.9, s.r * 0.9, 0.1, 7), flat("#7fbf58"))
      object.add(rock, moss)
      let sink = 0
      const base = new THREE.Vector3(s.x, TIERS[0].y - 0.05, s.z)
      surfaces.addPlatform(object, rapier.ColliderDesc.cylinder(2.5, s.r).setTranslation(0, -2.5, 0), (t, weight, dt) => {
        // Heavy Mama makes them crumble down; Cub just makes them wobble.
        sink = damp(sink, weight >= 3 ? 6 : 0, weight >= 3 ? 1.5 : 3, dt)
        const wobble = weight > 0 ? Math.sin(t * 9 + i) * 0.03 : 0
        return new THREE.Vector3(base.x + wobble, base.y - sink, base.z)
      })
      berries.add(new THREE.Vector3(s.x, TIERS[0].y, s.z), 0.6)
    }
    const bridge = new Drawbridge(api, new THREE.Vector3(-6, TIERS[0].y, CREVASSE.z - CREVASSE.half - 0.4), CREVASSE.half * 2 + 1.2, 0, () => {
      sound("smash")
      shake(0.3)
    })
    const bellAt = at(8, 3)
    const bell = new Bell(
      api,
      bellAt,
      () => {
        bridge.lower()
        toast("Ding! A bridge for Mama!")
      },
      "z"
    )

    // --- Tier 1 → 2: Cub super-bounces up; the magic flower grows mushroom steps for Mama. ---
    const shroomAt = at(2, 1.8)
    const bouncy = mushroom(api, shroomAt.x, shroomAt.z, { capRadius: 1.5, height: 0.45, color: "#c38bff" })
    surfaces.addBouncer(bouncy.capCollider!, {
      power: 9,
      superPower: 15,
      onBounce: (big) => {
        bouncy.cap.scale.set(1.25, 0.35, 1.25)
        sound(big ? "bigJump" : "jump")
        if (big) particles.burst(new THREE.Vector3(shroomAt.x, bouncy.top, shroomAt.z), { colors: ["#ffffff", "#ffe066", "#c38bff"], count: 18, speed: 4, up: 2 })
      }
    })
    bounceCoach(interactions, { top: new THREE.Vector3(shroomAt.x, bouncy.top, shroomAt.z), radius: 1.5, enabled: () => tierOf(cub.feetY) === 1 && !grown })
    berries.arc(new THREE.Vector3(shroomAt.x, bouncy.top, shroomAt.z), new THREE.Vector3(2, TIERS[1].y, -2.5), 3, 4)

    const stepSpots = [
      { x: -14, z: 2.6 },
      { x: -12, z: 2.2 },
      { x: -10, z: 1.8 },
      { x: -8, z: 1.4 },
      { x: -6, z: 1 }
    ]
    const steps = stepSpots.map((spot, i) => {
      const rise = ((TIERS[1].y - TIERS[0].y) * (i + 1)) / stepSpots.length
      const step = mushroom(api, spot.x, spot.z, { capRadius: 1.3, height: rise - 0.71 + 0.05, color: "#d9a26a", solid: false })
      step.group.scale.setScalar(0.01)
      return { step, spot, grow: 0, delay: i * 0.35, solid: false }
    })
    let grown = false
    let growTime = 0
    const flower = new HangingPinecone(
      api,
      new THREE.Vector3(0, TIERS[1].y, -4),
      () => {
        grown = true
        sound("found")
        toast("Magic mushroom steps!")
      },
      1.6,
      "bellflower"
    )

    // --- Tier 2 → 3: stone lifts that rise and fall. Hop on at the bottom, ride up. ---
    const lifts = [-4, 4].map((x, i) => {
      const object = new THREE.Group()
      const slab = mesh(jitter(new THREE.CylinderGeometry(1.5, 1.3, 0.6, 8), 0.04), flat("#b8ae9c"))
      const moss = mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 8), flat("#8fcc63"))
      moss.position.y = 0.3
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.25, 24),
        new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.8, depthWrite: false })
      )
      glow.rotation.x = -Math.PI / 2
      glow.position.y = 0.36
      object.add(slab, moss, glow)
      const position = new THREE.Vector3()
      const z = TIERS[2].front + 1.7
      let clock = i * 7.5
      const low = TIERS[1].y - 0.3
      const high = TIERS[2].y - 0.3
      const heightAtTime = (t: number) => low + (high - low) * (clamp(Math.sin(t * 0.42) * 1.7, -1, 1) * 0.5 + 0.5)
      const platform = surfaces.addPlatform(object, rapier.ColliderDesc.cylinder(0.3, 1.45), (_t, _weight, dt) => {
        // Waits at the bottom and the top, glides in between. Never comes down on a bear underneath.
        const next = heightAtTime(clock + dt)
        const underneath = [mama, cub].some(
          (bear) => Math.hypot(bear.position.x - x, bear.position.z - z) < 1.45 + bear.spec.radius && bear.position.y < position.y - 0.2
        )
        if (!(next < position.y && underneath)) clock += dt
        return position.set(x, heightAtTime(clock), z)
      })
      position.set(x, heightAtTime(clock), z)
      berries.add(new THREE.Vector3(x, TIERS[2].y + 1.5, TIERS[2].front + 1.7), 0)
      return { platform, glow }
    })
    interactions.add({
      id: "ride-lifts",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => at(0, TIERS[2].front + 4).setY(TIERS[1].y + 2.5),
      inRange: (bear) => tierOf(bear.feetY) === 2 && bear.position.z < TIERS[2].front + 6 && bear.surfaceBelow === undefined,
      enabled: () => true,
      view: (bear) => {
        const nearest = lifts.reduce((a, b) =>
          Math.abs(a.platform.object.position.x - bear.position.x) < Math.abs(b.platform.object.position.x - bear.position.x) ? a : b
        )
        const down = nearest.platform.object.position.y < TIERS[1].y + 0.2
        return down ? { buttons: ["a"], label: "Hop on!", now: true } : { buttons: [], label: "Wait for the stone…" }
      }
    })

    // --- Summit: the honey tree and the giant honeycomb. ---
    const summit = at(0, -36)
    createTree(api, summit.x - 1.5, summit.z - 3, { scale: 2.4, kind: "round" })
    let honeyDown = false
    const honeycomb = new HangingPinecone(
      api,
      new THREE.Vector3(summit.x + 2, TIERS[2].y, summit.z + 1),
      () => {
        honeyDown = true
        sound("success")
        shake(0.4)
        toast("HONEY!!!")
        for (let i = 0; i < 3; i++) {
          particles.burst(new THREE.Vector3(summit.x + 2, TIERS[2].y + 2, summit.z + 1), {
            colors: ["#ffc21a", "#ffe066", "#f2b632"],
            count: 30,
            speed: 6,
            up: 5,
            size: 0.18,
            life: 2
          })
        }
      },
      1.6,
      "beehive"
    )
    api.goal(new THREE.Vector3(summit.x - 2, 0, summit.z + 3), () => honeyDown)

    // Goodies.
    berries.line(at(0, 30), at(4, 21), 4, height)
    berries.ring(at(-18, 30), 2, 4, height)
    berries.ring(at(19, -6), 1.8, 4, height)
    berries.ring(at(-16, -30), 2, 5, height)
    berries.line(at(-12, -20), at(12, -20), 5, height)

    api.nature({
      grass: GRASS,
      butterflies: GRASS,
      flowers: [[-6, 28], [8, 26], [-14, 20], [12, 12], [-12, -8], [10, -10], [-8, -28], [9, -30], [-10, -44], [10, -44]]
    })
    scatter(api, {
      seed: 505,
      trees: 40,
      rocks: 30,
      kinds: ["pine", "pine", "round"],
      blocked: (x, z, margin) =>
        Math.abs(x) < 15 + margin ||
        TIERS.some((t) => Math.abs(z - t.front) < 3 + margin) ||
        crevasseMask(z) > 0 ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        ramp.update(dt)
        bridge.update(dt)
        pinecone.update(dt)
        flower.update(dt)
        honeycomb.update(dt)
        bell.update(dt)
        bouncy.cap.scale.x = damp(bouncy.cap.scale.x, 1, 8, dt)
        bouncy.cap.scale.y = damp(bouncy.cap.scale.y, 0.6, 8, dt)
        bouncy.cap.scale.z = bouncy.cap.scale.x
        for (const lift of lifts) {
          const down = lift.platform.object.position.y < TIERS[1].y + 0.2
          ;(lift.glow.material as THREE.MeshBasicMaterial).opacity = down ? 0.9 : 0.25
        }
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
              particles.burst(new THREE.Vector3(s.spot.x, s.step.top, s.spot.z), { colors: ["#fff36b", "#ffffff"], count: 10, speed: 3 })
            }
          }
        }
      },
      objective: () => {
        const cubTier = tierOf(cub.feetY)
        const mamaTier = tierOf(mama.feetY)
        if (!ramp.down) {
          if (cubTier === 0) return { text: "Mama: lift Cub up the cliff!", target: at(5, 18.6).add(new THREE.Vector3(0, 3.5, 0)) }
          return { text: "Cub: jump and swipe the pinecone!", target: new THREE.Vector3(-2, TIERS[0].y + 4.5, 13) }
        }
        if (mamaTier === 0) return { text: "Mama: walk up the ramp!", target: new THREE.Vector3(-8, TIERS[0].y + 2, TIERS[0].front + 4) }
        if (!bridge.down) {
          if (cub.position.z > CREVASSE.z - CREVASSE.half) return { text: "Cub: hop across the wobbly stones!", target: new THREE.Vector3(stones[0]!.x, TIERS[0].y + 2.5, stones[0]!.z) }
          return { text: "Cub: jump and ring the bell!", target: bellAt.clone().add(new THREE.Vector3(0, 4.5, 0)) }
        }
        if (mama.position.z > CREVASSE.z - CREVASSE.half && mamaTier === 1) return { text: "Mama: cross the bridge!", target: new THREE.Vector3(-6, TIERS[0].y + 2.5, CREVASSE.z) }
        if (!grown) {
          if (cubTier < 2) return { text: "Cub: big bounce up the cliff!", target: new THREE.Vector3(shroomAt.x, bouncy.top + 3, shroomAt.z) }
          return { text: "Cub: jump and swipe the magic flower!", target: new THREE.Vector3(0, TIERS[1].y + 4.5, -4) }
        }
        if (mamaTier < 2) return { text: "Mama: climb the mushroom steps!", target: new THREE.Vector3(-14, TIERS[0].y + 3, 2.6) }
        if (cubTier < 3 || mamaTier < 3) return { text: "Ride the moving stones to the top!", target: new THREE.Vector3(0, TIERS[2].y + 2, TIERS[2].front + 1.7) }
        if (!honeyDown) return { text: "Cub: knock down the giant honeycomb!", target: new THREE.Vector3(summit.x + 2, TIERS[2].y + 5, summit.z + 1) }
        return { text: "Both bears to the honey pot!", target: new THREE.Vector3(summit.x - 2, TIERS[2].y + 3.5, summit.z + 3) }
      }
    }
  }
}
