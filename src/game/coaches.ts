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

/**
 * Coaching for a bouncy mushroom: "Jump on!" when you're next to it, then a flashing "NOW!" just
 * before you land on it so you press jump at the right moment for a super bounce.
 */
export const bounceCoach = (
  interactions: Interactions,
  options: { top: THREE.Vector3; radius: number; who?: BearId; enabled?: () => boolean; window?: number }
) => {
  const { top, radius, who = "cub", enabled = () => true, window = 0.24 } = options
  const anchor = top.clone().add(new THREE.Vector3(0, 3.2, 0))
  interactions.add({
    id: `bounce-${nextId++}`,
    who,
    kind: "guide",
    buttons: [],
    label: "",
    anchor: () => anchor,
    inRange: (bear) => Math.hypot(bear.position.x - top.x, bear.position.z - top.z) < radius + 2.5,
    enabled,
    view: (bear) => {
      if (bear.mode !== "walk") return null
      const over = Math.hypot(bear.position.x - top.x, bear.position.z - top.z) < radius + 0.3
      if (bear.grounded && !over) return { buttons: ["a"], label: "Jump on!" }
      if (!over || bear.velocity.y > 0) return { buttons: ["a"], label: "Bounce!" }
      const fallSpeed = Math.max(0.1, -bear.velocity.y)
      const timeToLand = (bear.feetY - top.y) / fallSpeed
      // Matches the bear's own (adaptive) super-bounce window.
      if (timeToLand < window + Math.min(3, bear.bounceAssist) * 0.08) return { buttons: ["a"], label: "NOW!", now: true }
      return { buttons: ["a"], label: "Get ready…" }
    }
  })
}

/**
 * Coaching for hopping onto something that moves past (a floating log): "Wait…" until it's in
 * front of you, then a flashing "JUMP!".
 */
export const rideCoach = (
  interactions: Interactions,
  options: {
    /** The edge you jump from: anywhere along this line (fixed z) between minX and maxX. */
    edgeZ: number
    minX: number
    maxX: number
    y: number
    /** -1 if you jump towards -z. */
    direction: 1 | -1
    /** Where the thing you're aiming for is right now. */
    target: () => THREE.Vector3
    /** How fast it's moving (so we can tell you to jump a little early). */
    velocity: () => THREE.Vector3
    /** How far either side of the bear the target can be and still be a good jump. */
    catchWidth: number
    who?: BearId
    enabled?: () => boolean
  }
) => {
  const { edgeZ, minX, maxX, y, direction, target, velocity, catchWidth, who = "cub", enabled = () => true } = options
  const anchor = new THREE.Vector3()
  let lastX = 0
  interactions.add({
    id: `ride-${nextId++}`,
    who,
    kind: "guide",
    buttons: [],
    label: "",
    anchor: () => anchor.set(lastX, y + 2.4, edgeZ),
    inRange: (bear) => {
      const along = (bear.position.z - edgeZ) * -direction
      const inside = along > -3 && along < 0.6 && bear.position.x > minX && bear.position.x < maxX && Math.abs(bear.feetY - y) < 1
      if (inside) lastX = bear.position.x
      return inside
    },
    enabled,
    view: (bear) => {
      if (bear.mode !== "walk" || !bear.grounded) return null
      // Where will it be by the time we land on it?
      const flightTime = 0.5
      const lead = target().x + velocity().x * flightTime - bear.position.x
      if (Math.abs(lead) < catchWidth) return { buttons: ["a"], label: "JUMP!", now: true }
      return { buttons: [], label: "Wait for the log…" }
    }
  })
}
