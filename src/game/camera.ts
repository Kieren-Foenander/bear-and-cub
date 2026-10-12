import * as THREE from "three"
import { clamp, damp } from "./util.ts"

/**
 * One shared camera that keeps both bears in view. It never needs steering,
 * which keeps things simple for little hands.
 */
export class CoopCamera {
  private readonly focus = new THREE.Vector3()
  private zoom = 0
  private trauma = 0
  private time = 0

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  update(dt: number, points: ReadonlyArray<THREE.Vector3>, snap = false) {
    this.time += dt
    const center = new THREE.Vector3()
    for (const p of points) center.add(p)
    center.divideScalar(points.length)

    let spread = 0
    for (const a of points) for (const b of points) spread = Math.max(spread, a.distanceTo(b))
    const targetZoom = clamp(spread, 0, 34)

    if (snap) {
      this.focus.copy(center)
      this.zoom = targetZoom
    } else {
      this.focus.x = damp(this.focus.x, center.x, 3, dt)
      this.focus.y = damp(this.focus.y, center.y, 3, dt)
      this.focus.z = damp(this.focus.z, center.z, 3, dt)
      this.zoom = damp(this.zoom, targetZoom, 2, dt)
    }

    const height = 8.5 + this.zoom * 0.55
    const back = 11 + this.zoom * 0.62
    this.camera.position.set(this.focus.x, this.focus.y + height, this.focus.z + back)
    this.camera.lookAt(this.focus.x, this.focus.y + 0.8, this.focus.z - 1.5)

    this.trauma = Math.max(0, this.trauma - dt * 1.5)
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 0.6
      this.camera.position.x += Math.sin(this.time * 47) * s
      this.camera.position.y += Math.sin(this.time * 53 + 1) * s
    }
  }
}
