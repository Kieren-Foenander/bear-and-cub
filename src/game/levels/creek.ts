import * as THREE from "three"
import { runJumpCoach } from "../coaches.ts"
import { createTree, scatter, type Patch } from "../nature.ts"
import { cliff, Drawbridge, FallingTree, sign, steppingStone } from "../props.ts"
import { HangingPinecone } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Level 2: Creek Hop.
 * Teaches: moving and jumping at the same time (a running jump).
 *
 * Three streams, each wider than the last. The first two both bears can jump; the third only a
 * running-jump Cub can clear, so she pushes an old tree over as a bridge for Mama. Then Cub
 * hops up rock pillars to a plateau and swipes a pinecone that drops a ramp for Mama.
 */

const BOUNDS = { minX: -34, maxX: 34, minZ: -64, maxZ: 40 }
const CREEKS = [
  { z: 18, width: 1.8 },
  { z: 6, width: 3 },
  { z: -8, width: 4.6 }
] as const
const BANK = 0.35
const PLATEAU = { front: -33, top: 6 }

/** 1 inside a creek, 0 on dry land. */
const creekMask = (z: number) => {
  let mask = 0
  for (const creek of CREEKS) mask = Math.max(mask, smoothstep(creek.width / 2 + BANK, creek.width / 2 - BANK, Math.abs(z - creek.z)))
  return mask
}

const height = (x: number, z: number) => {
  const bumps = 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.17) + 0.3 * Math.sin(x * 0.4 + z * 0.33)
  const corridor = smoothstep(9, 18, Math.abs(x))
  const dry = 1 - creekMask(z)
  let h = (bumps + 0.4) * corridor * dry
  h -= 2.6 * creekMask(z)
  h += PLATEAU.top * smoothstep(PLATEAU.front + 0.4, PLATEAU.front - 0.4, z)
  h += edgeHills(BOUNDS, x, z) * dry
  return h
}

/** Where you take off for each creek (on the near, +z side). */
const edgeZ = (creek: (typeof CREEKS)[number]) => creek.z + creek.width / 2 + BANK

const GRASS: ReadonlyArray<Patch> = [
  { x: -18, z: 28, radius: 5 },
  { x: 19, z: 24, radius: 5 },
  { x: -20, z: 0, radius: 4.5 },
  { x: 21, z: -2, radius: 5 },
  { x: -19, z: -22, radius: 5 },
  { x: 18, z: -48, radius: 5 }
]

export const creek: LevelDef = {
  id: "creek",
  title: "Creek Hop",
  teaches: "Run and jump at the same time",
  emoji: "💦",
  spawn: { mama: [-1.5, 32], cub: [1.5, 31] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 0.8,
    color: (x, z, y) => (y > -0.1 && y < 0.5 && Math.abs(x - 1.5 * Math.sin(z * 0.2)) < 1.4 && creekMask(z) === 0 ? "#d9b77e" : null)
  },
  build: (api) => {
    const { mama, cub, berries, particles, sound, toast, shake, interactions } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const across = (bear: typeof cub, index: number) => bear.position.z < CREEKS[index]!.z - CREEKS[index]!.width / 2

    // --- Three streams. A sign, coaching at every edge, and berry arcs that show the jump. ---
    sign(api, 3.5, edgeZ(CREEKS[0]) + 3, "🏃")
    CREEKS.forEach((c, i) => {
      runJumpCoach(interactions, {
        edge: at(0, edgeZ(c)),
        direction: new THREE.Vector3(0, 0, -1),
        halfWidth: 14,
        enabled: () => !across(cub, i)
      })
      const near = at(0, edgeZ(c) + 0.5)
      const far = at(0, c.z - c.width / 2 - BANK - 0.5)
      berries.arc(near, far, i + 2, 1.4)
    })

    // --- The old tree: Cub pushes it over the big stream so Mama can cross. ---
    const big = CREEKS[2]
    const treeBase = at(-7, big.z - big.width / 2 - BANK - 1.4)
    const tree = new FallingTree(api, treeBase, big.width + BANK * 2 + 4.5, 0, () => {
      sound("smash")
      shake(0.6)
      particles.burst(treeBase.clone().add(new THREE.Vector3(0, 0.5, 4)), { colors: ["#c8b08a", "#e8dcc4"], count: 30, speed: 5 })
      toast("A log bridge for Mama!")
    })
    interactions.add({
      id: "push-tree",
      who: "cub",
      kind: "mash",
      buttons: ["b"],
      count: 4,
      label: "Push!",
      anchor: () => treeBase.clone().add(new THREE.Vector3(0, 3, 0)),
      inRange: (bear) => bear.position.distanceTo(treeBase) < 2.8 && across(bear, 2),
      enabled: () => !tree.falling,
      onStep: () => {
        tree.nudge()
        sound("push")
        particles.burst(treeBase.clone().add(new THREE.Vector3(0, 0.3, 0)), { colors: ["#cbb79a", "#7a5634"], count: 6, speed: 2, up: 1 })
      },
      onComplete: () => {
        tree.fall()
        sound("push")
      }
    })

    // --- Rock pillars up to the plateau (too tall a step for Mama), and the pinecone that drops a ramp. ---
    const pillars = [
      { x: 6, z: -22.4, top: 1.5 },
      { x: 6, z: -26.7, top: 3 },
      { x: 6, z: -31, top: 4.5 }
    ]
    for (const p of pillars) {
      steppingStone(api, p.x, p.z, 1.4, p.top)
      berries.add(new THREE.Vector3(p.x, p.top, p.z), 0.8)
    }
    cliff(api, { x0: -40, x1: 40, z0: -70, z1: PLATEAU.front, top: PLATEAU.top - 0.6 }, { cap: null })

    const rampX = -8
    const rampLength = 13
    const ramp = new Drawbridge(
      api,
      new THREE.Vector3(rampX, PLATEAU.top, PLATEAU.front),
      rampLength,
      0,
      () => {
        sound("smash")
        shake(0.4)
        particles.burst(ramp.tip, { colors: ["#e8dcc4", "#c8b08a"], count: 25, speed: 4 })
      },
      3.4,
      Math.asin(PLATEAU.top / rampLength)
    )
    const pinecone = new HangingPinecone(api, new THREE.Vector3(-3, PLATEAU.top, PLATEAU.front - 4), () => {
      ramp.lower()
      toast("The ramp is coming down!")
    })
    const onPlateau = (bear: typeof cub) => bear.feetY > PLATEAU.top - 0.5

    // --- Goal and goodies up on the plateau. ---
    const honey = new THREE.Vector3(0, PLATEAU.top, -50)
    api.goal(honey, () => ramp.down)
    createTree(api, -4, -55, { scale: 1.8, kind: "round" })
    berries.ring(new THREE.Vector3(12, PLATEAU.top, -46), 2.5, 5, () => PLATEAU.top)
    berries.ring(at(-19, -22), 2, 4, height)
    berries.ring(at(21, -2), 2, 4, height)
    berries.line(at(-20, 30), at(-14, 34), 3, height)

    api.nature({
      grass: GRASS,
      butterflies: GRASS,
      flowers: [[-6, 26], [7, 30], [-9, 12], [10, 12], [-12, -2], [11, -16], [-10, -28], [14, -26], [6, -45], [-12, -48]]
    })
    scatter(api, {
      seed: 202,
      trees: 40,
      rocks: 24,
      blocked: (x, z, margin) =>
        Math.abs(x) < 10 + margin ||
        creekMask(z) > 0 ||
        CREEKS.some((c) => Math.abs(z - c.z) < c.width / 2 + 2 + margin) ||
        Math.abs(z - PLATEAU.front) < 4 + margin ||
        GRASS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin)
    })

    return {
      update: (dt) => {
        tree.update(dt)
        ramp.update(dt)
        pinecone.update(dt)
      },
      objective: () => {
        const mamaAcrossBig = across(mama, 2)
        if (!across(cub, 0)) return { text: "Run and jump over the stream!", target: at(0, edgeZ(CREEKS[0]) + 3) }
        if (!across(cub, 1)) return { text: "Run, run, JUMP! The next stream!", target: at(0, edgeZ(CREEKS[1]) + 3) }
        if (!tree.falling) {
          if (!across(cub, 2)) return { text: "Cub: run fast and jump the big stream!", target: at(0, edgeZ(CREEKS[2]) + 3) }
          return { text: "Cub: push the old tree!", target: treeBase.clone().add(new THREE.Vector3(0, 6, 0)) }
        }
        if (!mamaAcrossBig) return { text: "Mama: walk across the log!", target: treeBase.clone().add(new THREE.Vector3(0, 3, 4)) }
        if (!ramp.down) {
          if (onPlateau(cub)) return { text: "Cub: jump and swipe the pinecone!", target: new THREE.Vector3(-3, PLATEAU.top + 4.5, PLATEAU.front - 4) }
          return { text: "Cub: jump up the rocks!", target: new THREE.Vector3(pillars[0]!.x, pillars[0]!.top + 2.5, pillars[0]!.z) }
        }
        return { text: "Both bears to the honey pot!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }

  }
}
