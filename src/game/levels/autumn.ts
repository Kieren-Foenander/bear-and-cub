import * as THREE from "three"
import { Carrying } from "../carry.ts"
import { bounceCoach } from "../coaches.ts"
import { Squirrel } from "../critters.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Gate, mushroom, sign } from "../props.ts"
import { CUB } from "../specs.ts"
import { hangHeight } from "../swipe.ts"
import { edgeHills } from "../terrain.ts"
import { damp, flat, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Chapter 2 finale, Level 8: Autumn Orchard.
 * Teaches: picking things up, carrying them, and putting them down (B to grab, B to drop),
 * using every earlier skill to reach the three golden acorns Squirrel needs.
 */

const BOUNDS = { minX: -34, maxX: 34, minZ: -56, maxZ: 40 }
const GATE_Z = 0
const BASKET = new THREE.Vector3(2.2, 0, 12)
const HAY = { x0: -21, x1: -15, z0: 13, z1: 19, top: 3.2 }
const STUMP = { x0: 16, x1: 22, z0: 9, z1: 15, top: 4.2 }
const HANGING = new THREE.Vector3(13.6, 0, 27.6)

const height = (x: number, z: number) => {
  const bumps = 0.5 * Math.sin(x * 0.19) * Math.cos(z * 0.15) + 0.3 * Math.sin(x * 0.39 + z * 0.29)
  const corridor = smoothstep(9, 18, Math.abs(x))
  return (bumps + 0.4) * corridor + edgeHills(BOUNDS, x, z)
}

const GRASS: ReadonlyArray<Patch> = [
  { x: -24, z: 30, radius: 4.5 },
  { x: 25, z: 2, radius: 4.5 },
  { x: -24, z: -2, radius: 4.5 },
  { x: -18, z: -30, radius: 5 },
  { x: 19, z: -34, radius: 5 }
]

const goldenAcorn = () => {
  const group = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: "#ffcf3f", emissive: "#d99a10", emissiveIntensity: 0.35, flatShading: true, metalness: 0.2, roughness: 0.5 })
  const nut = mesh(new THREE.IcosahedronGeometry(0.3, 1), gold)
  nut.scale.set(1, 1.25, 1)
  const cap = mesh(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), flat("#8a5a36"))
  cap.position.y = 0.18
  const stem = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 4), flat("#6b4a2a"))
  stem.position.y = 0.42
  group.add(nut, cap, stem)
  return group
}

export const autumn: LevelDef = {
  id: "autumn",
  title: "Autumn Orchard",
  teaches: "Pick up, carry and put down",
  emoji: "🍂",
  unlockAfter: "snow",
  finale: true,
  sky: { color: "#ffe2b8", fog: "#ffeccd", hemisphere: { sky: "#fff0d6", ground: "#b8862e", intensity: 1.4 }, sun: { color: "#ffd9a0", intensity: 2.3 } },
  spawn: { mama: [-1.5, 33], cub: [1.5, 32] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 1.2,
    grass: ["#c9a24a", "#bf9640", "#d4ad55", "#b88d3a"],
    hill: "#a07a35",
    rock: "#8f8270",
    color: (x, z, y) => (y > -0.1 && y < 0.6 && Math.abs(x - 1.3 * Math.sin(z * 0.16)) < 1.4 && z < 30 ? "#a8794a" : null)
  },
  build: (api) => {
    const { scene, mama, cub, coop, berries, particles, sound, toast, interactions, surfaces, terrain } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const updates: Array<(dt: number) => void> = []
    const carrying = new Carrying(interactions, [mama, cub], terrain, particles, sound)
    updates.push((dt) => carrying.update(dt))

    // --- Squirrel, the big oak and the basket. ---
    createTree(api, -3.5, 8.5, { scale: 2.3, kind: "round", autumn: true })
    const squirrel = new Squirrel(scene, at(-0.8, 12.6))
    squirrel.group.rotation.y = Math.PI * 0.15
    updates.push((dt) => squirrel.update(dt))
    const basket = new THREE.Group()
    const weave = mesh(new THREE.CylinderGeometry(0.8, 0.6, 0.7, 10, 1, true), flat("#c08a4a"))
    weave.position.y = 0.35
    const rim = mesh(new THREE.TorusGeometry(0.8, 0.08, 5, 14), flat("#9a6a3a"))
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.7
    const bottom = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 10), flat("#9a6a3a"))
    bottom.position.y = 0.03
    basket.add(weave, rim, bottom)
    basket.position.copy(at(BASKET.x, BASKET.z))
    scene.add(basket)
    let delivered = 0
    const gate = new Gate(api, at(0, GATE_Z), 2.4, 3, { minX: -34, maxX: 34 })
    updates.push((dt) => gate.update(dt))
    carrying.addZone({
      at: at(BASKET.x, BASKET.z),
      radius: 3.2,
      label: "Put in!",
      accepts: () => true,
      onDeliver: () => {
        delivered++
        squirrel.cheer()
        toast(delivered < 3 ? `Thank you! (${delivered}/3)` : "All three! Squirrel opens the gate!")
        if (delivered >= 3) {
          gate.openUp()
          sound("success")
        }
      }
    })
    sign(api, 5, 15, "🐿️")

    // --- Acorn 1: on top of the hay stack. Mama lifts Cub up. ---
    cliff(api, HAY, { rock: "#e0b84a", cap: "#f2d27a" })
    coop.addSpot({ id: "hay", kind: "lift", at: at(-18, HAY.z1 + 2.5), target: new THREE.Vector3(-18.3, HAY.top, 15.6), time: 0.85, active: () => acornHay.state === "ground" && acornHay.object.position.y > 2 })
    const acornHay = carrying.add("hay", goldenAcorn(), new THREE.Vector3(-16.6, HAY.top + 0.3, 15))
    scene.add(acornHay.object)

    // --- Acorn 2: on the big stump. Super-bounce up from the mushroom. ---
    cliff(api, STUMP, { rock: "#7a5634", cap: "#8a6a3a" })
    const shroom = mushroom(api, 14.1, 12, { capRadius: 1.5, height: 0.45, color: "#e5484d" })
    surfaces.addBouncer(shroom.capCollider!, {
      power: 9,
      superPower: 15,
      onBounce: (big) => {
        shroom.cap.scale.set(1.25, 0.35, 1.25)
        sound(big ? "bigJump" : "jump")
      }
    })
    updates.push((dt) => {
      shroom.cap.scale.x = damp(shroom.cap.scale.x, 1, 8, dt)
      shroom.cap.scale.y = damp(shroom.cap.scale.y, 0.6, 8, dt)
      shroom.cap.scale.z = shroom.cap.scale.x
    })
    bounceCoach(interactions, { top: new THREE.Vector3(14.1, shroom.top, 12), radius: 1.5 })
    const acornStump = carrying.add("stump", goldenAcorn(), new THREE.Vector3(19.5, STUMP.top + 0.3, 12))
    scene.add(acornStump.object)

    // --- Acorn 3: hanging in an oak. Jump and swipe it down, then pick it up. ---
    createTree(api, HANGING.x + 0.4, HANGING.z + 2.2, { scale: 1.5, kind: "round", autumn: true })
    const hangGround = height(HANGING.x, HANGING.z)
    const hangTarget = new THREE.Vector3(HANGING.x, hangGround + hangHeight(CUB, 1.6), HANGING.z)
    const hanging = goldenAcorn()
    hanging.position.copy(hangTarget)
    scene.add(hanging)
    const string = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 3), flat("#6b4a2a"), { castShadow: false })
    string.position.copy(hangTarget).add(new THREE.Vector3(0, 1, 0))
    scene.add(string)
    let acornTree: ReturnType<typeof carrying.add> | null = null
    api.swipes.add(
      {
        id: "acorn-tree",
        who: ["cub", "mama"],
        position: () => hangTarget,
        horizontalReach: 1.1,
        verticalReach: 0.42,
        enabled: () => acornTree === null,
        onHit: () => {
          scene.remove(hanging, string)
          acornTree = carrying.add("tree", goldenAcorn(), hangTarget.clone())
          scene.add(acornTree.object)
          carrying.fall(acornTree, hangTarget.clone())
          sound("pop")
          particles.burst(hangTarget, { colors: ["#e07a2e", "#f2b632", "#d9502b"], count: 20, speed: 3, up: 1 })
        }
      },
      { who: "cub" }
    )

    // --- Leaf piles: run through them! ---
    const piles: Array<{ at: THREE.Vector3; cooldown: number; mesh: THREE.Mesh }> = []
    const leafColors = ["#e07a2e", "#f2a03a", "#d9502b", "#f4c64a"]
    for (const [x, z] of [[-6, 26], [6, 22], [-10, 6], [8, 4], [-5, -12], [7, -18], [-9, -28], [4, -30], [24, 20], [-26, 14]] as const) {
      const pile = mesh(new THREE.SphereGeometry(1.1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), flat(leafColors[(x + z + 40) % 4]!))
      pile.scale.y = 0.45
      pile.position.copy(at(x, z))
      scene.add(pile)
      piles.push({ at: at(x, z), cooldown: 0, mesh: pile })
    }
    updates.push((dt) => {
      for (const pile of piles) {
        pile.cooldown -= dt
        pile.mesh.scale.y = damp(pile.mesh.scale.y, 0.45, 3, dt)
        for (const bear of [mama, cub]) {
          if (pile.cooldown <= 0 && Math.hypot(bear.position.x - pile.at.x, bear.position.z - pile.at.z) < 1.3) {
            pile.cooldown = 1
            pile.mesh.scale.y = 0.2
            sound("swipe")
            particles.burst(pile.at.clone().add(new THREE.Vector3(0, 0.4, 0)), { colors: leafColors, count: 22, speed: 4, up: 4, gravity: 0.15, life: 1.8 })
          }
        }
      }
    })

    // --- Through the gate: the honey. ---
    const honey = at(0, -38)
    api.goal(honey, () => gate.open)
    createTree(api, -3, -43, { scale: 2, kind: "round", autumn: true })

    berries.line(at(0, 29), at(0, 18), 5, height)
    berries.line(at(-14, 20), at(-10, 24), 3, height)
    berries.ring(at(-24, 30), 2, 5, height)
    berries.ring(at(25, 2), 2, 4, height)
    berries.line(at(0, -6), at(0, -30), 6, height)
    berries.ring(at(19, -34), 2.5, 5, height)

    api.nature({ grass: GRASS, butterflies: GRASS, flowers: [[-8, 30], [9, 30], [-12, 4], [12, -4], [-8, -22], [9, -26]] })
    scatter(api, {
      seed: 909,
      trees: 50,
      rocks: 18,
      autumn: true,
      kinds: ["round", "round", "pine"],
      blocked: (x, z, margin) =>
        Math.abs(x) < 10 + margin ||
        Math.abs(z - GATE_Z) < 3 + margin ||
        (x < -12 && x > -24 && z > 10 && z < 24) ||
        (x > 12 && x < 25 && z > 6 && z < 33) ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    const nearestAcorn = (): THREE.Vector3 | null => {
      const available = [acornHay, acornStump, acornTree].filter((a) => a !== null && a.state === "ground").map((a) => a!.object.position)
      if (acornTree === null) available.push(hangTarget)
      if (available.length === 0) return null
      return available.reduce((a, b) => (a.distanceToSquared(cub.position) < b.distanceToSquared(cub.position) ? a : b))
    }

    return {
      update: (dt) => {
        for (const update of updates) update(dt)
      },
      objective: () => {
        if (delivered < 3) {
          if (carrying.heldBy(cub) || carrying.heldBy(mama)) return { text: "Bring the golden acorn to Squirrel!", target: at(BASKET.x, BASKET.z).add(new THREE.Vector3(0, 3, 0)) }
          const next = nearestAcorn()
          return { text: `Find golden acorns for Squirrel! (${delivered}/3)`, target: next ? next.clone().add(new THREE.Vector3(0, 2.5, 0)) : null }
        }
        return { text: "Through the gate to the honey!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
