import assert from "node:assert/strict"
import * as THREE from "three"
import { BearModel, MODEL_HEIGHT, preloadBearModels } from "../src/game/bearModel.ts"
import type { BearAnimState } from "../src/game/bearModel.ts"
import { MAMA, CUB } from "../src/game/specs.ts"

/** Exact vertex bounds, rather than transformed axis-aligned geometry boxes. */
const bounds = (root: THREE.Object3D): THREE.Box3 => {
  root.updateWorldMatrix(true, true)
  const box = new THREE.Box3()
  const vertex = new THREE.Vector3()
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const positions = node.geometry.getAttribute("position")
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld)
      box.expandByPoint(vertex)
    }
  })
  return box
}
const state: BearAnimState = { speed: 0, maxSpeed: 6, grounded: true, carried: false, flying: false, verticalVelocity: 0 }
const advance = (bear: BearModel, seconds: number): void => { for (let i = 0; i < seconds * 120; i++) bear.animate(1 / 120, state) }
await preloadBearModels()
for (const spec of [MAMA, CUB]) {
  const bear = new BearModel(spec.look, 1)
  const initial = bounds(bear.root)
  const size = initial.getSize(new THREE.Vector3())
  console.log(`${spec.id} rest: width ${size.x.toFixed(3)}, height ${size.y.toFixed(3)}, length ${size.z.toFixed(3)}, feet ${initial.min.y.toFixed(3)}`)
  assert(Math.abs(size.y - MODEL_HEIGHT) < 0.09, "ear tips match capsule height")
  assert(size.x <= 1.5 && size.z <= 2.5, "rest silhouette fits expected dimensions")
  assert(Math.abs(initial.min.y) < 0.02, "feet rest at the origin")
  state.speed = 0
  advance(bear, 10)
  for (const name of ["hind-left", "hind-right"]) {
    const foot = bounds(bear.root.getObjectByName(name)!).min.y
    assert(Math.abs(foot) < 0.025, "sitting hind paws touch the floor")
  }
  state.speed = 0.1
  advance(bear, 2)
  state.speed = 0
  bear.swipe()
  let swipeHeight = 0
  for (let i = 0; i < 45; i++) {
    bear.animate(1 / 120, state)
    swipeHeight = Math.max(swipeHeight, bounds(bear.root.getObjectByName("front-right")!).max.y)
  }
  console.log(`${spec.id} swipe reaches ${swipeHeight.toFixed(3)}`)
  assert(swipeHeight > 1.95, "front paw reaches above standing ear tips")

  // Public animation events and mode transitions preserve externally set transforms.
  bear.root.position.set(4, 2, -3)
  bear.root.rotation.y = 1.2
  bear.root.scale.setScalar(spec.scale)
  const rootMatrix = bear.root.matrix.clone()
  bear.root.updateMatrix()
  rootMatrix.copy(bear.root.matrix)
  for (const action of ["cheer", "celebrate", "shake", "swipe"] as const) {
    bear[action]()
    advance(bear, 0.12)
    bear[action]() // retrigger during the attack/release
    advance(bear, 2.5)
  }
  for (const mode of ["walk", "run", "rise", "fall", "carried", "flying", "idle"] as const) {
    state.speed = mode === "walk" ? 2 : mode === "run" ? 6 : 0
    state.grounded = mode !== "rise" && mode !== "fall" && mode !== "flying"
    state.carried = mode === "carried"
    state.flying = mode === "flying"
    state.verticalVelocity = mode === "rise" ? 7 : mode === "fall" ? -5 : 0
    if (mode === "idle") bear.land(1)
    advance(bear, 1.5)
    bear.root.traverse(node => {
      node.updateMatrix()
      assert(node.matrix.elements.every(Number.isFinite), `${spec.id}/${mode}: finite transform`)
      assert(node.scale.x > 0 && node.scale.y > 0 && node.scale.z > 0, "no inverted squash")
    })
    assert.deepEqual(bear.root.matrix.elements, rootMatrix.elements, "game owns root transform")
  }
  const resting = new BearModel(spec.look, spec.scale)
  const scaledHeight = bounds(resting.root).getSize(new THREE.Vector3()).y
  assert(Math.abs(scaledHeight - MODEL_HEIGHT * spec.scale) < 0.09 * spec.scale, "external scale applies once")
  state.grounded = true
  state.carried = state.flying = false
  state.verticalVelocity = state.speed = 0
}
console.log("Bear contracts, dimensions, swipe reach, action retriggers and all animation transitions passed.")
