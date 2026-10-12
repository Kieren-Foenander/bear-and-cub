import * as THREE from "three"
import type { BearId } from "./bear.ts"
import type { Interactions } from "./interactions.ts"

let nextId = 0

/**
 * Coaching for a running jump across a gap: "Run!" while you're standing still, "Keep running!"
 * on the way, and a flashing "JUMP!" right at the edge.
 *
 * `edge` is the take-off point on the near bank, `direction` points across the gap.
 */
export const runJumpCoach = (
  interactions: Interactions,
  options: {
    edge: THREE.Vector3
    direction: THREE.Vector3
    who?: BearId
    /** How far either side of the edge point the coach still helps. */
    halfWidth?: number
    /** Only coach while this is true (e.g. until the puzzle is solved). */
    enabled?: () => boolean
  }
) => {
  const { edge, who = "cub", halfWidth = 4, enabled = () => true } = options
  const direction = options.direction.clone().setY(0).normalize()
  const side = new THREE.Vector3(-direction.z, 0, direction.x)
  const offset = new THREE.Vector3()
  // The prompt slides along the edge to wherever the bear is lined up.
  let lateral = 0
  const anchor = new THREE.Vector3()

  interactions.add({
    id: `run-jump-${nextId++}`,
    who,
    kind: "guide",
    buttons: [],
    label: "Run!",
    anchor: () => anchor.copy(edge).addScaledVector(side, lateral).add(new THREE.Vector3(0, 2.2, 0)),
    inRange: (bear) => {
      offset.subVectors(bear.position, edge)
      const along = offset.dot(direction)
      const across = offset.dot(side)
      const inside = along > -7 && along < 0.5 && Math.abs(across) < halfWidth && Math.abs(bear.feetY - edge.y) < 1
      if (inside) lateral = across
      return inside
    },
    enabled,
    view: (bear) => {
      if (bear.mode !== "walk") return null
      if (!bear.grounded) return { buttons: ["move"], label: "Wheee!" }
      offset.subVectors(bear.position, edge)
      const toEdge = -offset.dot(direction)
      const speedAcross = bear.velocity.x * direction.x + bear.velocity.z * direction.z
      if (speedAcross > 3.5 && toEdge < 1.6) return { buttons: ["a"], label: "JUMP!", now: true }
      if (speedAcross > 2) return { buttons: ["move"], label: "Keep running!" }
      return { buttons: ["move"], label: "Run!" }
    }
  })
}
