import * as THREE from "three"
import { damp, flat, mesh } from "./util.ts"

/** A big friendly frog. `hop()` makes it jump with joy. */
export class Frog {
  readonly group = new THREE.Group()
  private readonly body = new THREE.Group()
  private hopTime = 0
  private time = Math.random() * 10

  constructor(scene: THREE.Scene, at: THREE.Vector3, scale = 1.4) {
    const green = flat("#5cbf4a")
    const belly = flat("#d8f0a8")
    const dark = flat("#1e2a18")
    const torso = mesh(new THREE.IcosahedronGeometry(0.6, 1), green)
    torso.scale.set(1, 0.7, 1.1)
    torso.position.y = 0.45
    const tummy = mesh(new THREE.IcosahedronGeometry(0.45, 1), belly)
    tummy.scale.set(1, 0.6, 0.9)
    tummy.position.set(0, 0.35, 0.25)
    this.body.add(torso, tummy)
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.IcosahedronGeometry(0.2, 1), green)
      eye.position.set(side * 0.3, 0.85, 0.3)
      const pupil = mesh(new THREE.IcosahedronGeometry(0.1, 1), dark)
      pupil.position.set(side * 0.32, 0.88, 0.47)
      const leg = mesh(new THREE.IcosahedronGeometry(0.3, 0), green)
      leg.scale.set(0.8, 0.5, 1.4)
      leg.position.set(side * 0.55, 0.2, -0.2)
      const foot = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), green)
      foot.position.set(side * 0.35, 0.03, 0.45)
      this.body.add(eye, pupil, leg, foot)
    }
    const smile = mesh(new THREE.TorusGeometry(0.25, 0.03, 4, 10, Math.PI), dark, { castShadow: false })
    smile.rotation.set(0, 0, Math.PI)
    smile.position.set(0, 0.55, 0.62)
    this.body.add(smile)
    this.group.add(this.body)
    this.group.position.copy(at)
    this.group.scale.setScalar(scale)
    scene.add(this.group)
  }

  hop() {
    this.hopTime = 1
  }

  update(dt: number) {
    this.time += dt
    this.hopTime = Math.max(0, this.hopTime - dt * 1.4)
    const hop = Math.abs(Math.sin(this.hopTime * Math.PI * 3)) * this.hopTime
    this.body.position.y = hop * 1.2
    // Throat puffing while idle.
    this.body.scale.set(1, 1 + Math.sin(this.time * 4) * 0.03, 1)
  }
}

/** A turtle that can surface to be a stepping stone. The caller turns it into a platform. */
export const turtleMesh = (radius: number) => {
  const group = new THREE.Group()
  const shell = mesh(new THREE.SphereGeometry(radius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), flat("#5a8a3a"))
  shell.scale.y = 0.45
  group.add(shell)
  const rim = mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 0.95, 0.15, 8), flat("#c9b26a"))
  rim.position.y = 0.02
  group.add(rim)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const plate = mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.25, 0.08, 6), flat("#6fa548"), { castShadow: false })
    plate.position.set(Math.cos(a) * radius * 0.5, radius * 0.36, Math.sin(a) * radius * 0.5)
    plate.lookAt(plate.position.clone().multiplyScalar(2).setY(radius * 1.2))
    plate.rotateX(Math.PI / 2)
    group.add(plate)
  }
  const head = mesh(new THREE.IcosahedronGeometry(radius * 0.28, 1), flat("#8cc45a"))
  head.position.set(0, 0.05, radius * 1.1)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(radius * 0.06, 0), flat("#1e2a18"), { castShadow: false })
    eye.position.set(side * radius * 0.12, 0.15, radius * 1.3)
    group.add(eye)
    for (const z of [-0.6, 0.6]) {
      const flipper = mesh(new THREE.BoxGeometry(radius * 0.5, 0.06, radius * 0.25), flat("#8cc45a"))
      flipper.position.set(side * radius * 0.95, -0.02, z * radius)
      flipper.rotation.y = side * z * 0.6
      group.add(flipper)
    }
  }
  return group
}

/** A dragonfly zipping around a point, for a bit of life over the water. */
export class Dragonfly {
  private readonly group = new THREE.Group()
  private readonly wings: Array<THREE.Mesh> = []
  private time = Math.random() * 100

  constructor(
    scene: THREE.Scene,
    private readonly home: THREE.Vector3,
    color: THREE.ColorRepresentation = "#3fc6e0"
  ) {
    const body = mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 4), flat(color), { castShadow: false })
    body.rotation.x = Math.PI / 2
    this.group.add(body)
    const wingMaterial = new THREE.MeshBasicMaterial({ color: "#e8fbff", transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    for (const [x, z] of [[-1, 0.12], [1, 0.12], [-1, -0.05], [1, -0.05]] as const) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.12), wingMaterial)
      wing.rotation.x = -Math.PI / 2
      wing.position.set(x * 0.22, 0.03, z)
      this.group.add(wing)
      this.wings.push(wing)
    }
    scene.add(this.group)
  }

  update(dt: number) {
    this.time += dt
    const t = this.time
    const target = new THREE.Vector3(Math.sin(t * 0.7) * 3 + Math.sin(t * 2.3) * 0.5, 0.8 + Math.sin(t * 1.7) * 0.4, Math.cos(t * 0.5) * 3).add(this.home)
    const before = this.group.position.clone()
    this.group.position.x = damp(this.group.position.x, target.x, 3, dt)
    this.group.position.y = damp(this.group.position.y, target.y, 3, dt)
    this.group.position.z = damp(this.group.position.z, target.z, 3, dt)
    const delta = this.group.position.clone().sub(before)
    if (delta.lengthSq() > 1e-6) this.group.rotation.y = Math.atan2(delta.x, delta.z)
    for (const [i, wing] of this.wings.entries()) wing.rotation.y = Math.sin(t * 60 + i) * 0.4
  }
}

/** A sleepy owl. `wake()` makes it hoot, flap and fly off into the night. */
export class Owl {
  readonly group = new THREE.Group()
  private readonly wings: Array<THREE.Mesh> = []
  private readonly lids: Array<THREE.Mesh> = []
  private flight = -1
  private time = 0
  private readonly start: THREE.Vector3

  constructor(scene: THREE.Scene, at: THREE.Vector3, private readonly flyTo: THREE.Vector3) {
    const feathers = flat("#8a6a4a")
    const chest = flat("#d9c3a0")
    const body = mesh(new THREE.IcosahedronGeometry(0.6, 1), feathers)
    body.scale.set(1, 1.15, 0.9)
    body.position.y = 0.65
    const belly = mesh(new THREE.IcosahedronGeometry(0.42, 1), chest)
    belly.scale.set(1, 1.1, 0.6)
    belly.position.set(0, 0.6, 0.28)
    this.group.add(body, belly)
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), flat("#fff3b0"))
      eye.rotation.x = Math.PI / 2
      eye.position.set(side * 0.2, 0.95, 0.5)
      const pupil = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10), flat("#1e1a18"))
      pupil.rotation.x = Math.PI / 2
      pupil.position.set(side * 0.2, 0.95, 0.53)
      const lid = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), feathers)
      lid.rotation.x = Math.PI / 2
      lid.position.set(side * 0.2, 0.95, 0.55)
      this.lids.push(lid)
      const tuft = mesh(new THREE.ConeGeometry(0.1, 0.3, 4), feathers)
      tuft.position.set(side * 0.3, 1.35, 0.1)
      tuft.rotation.z = -side * 0.4
      const wing = mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), feathers)
      wing.position.set(side * 0.6, 0.65, 0)
      this.wings.push(wing)
      this.group.add(eye, pupil, lid, tuft, wing)
    }
    const beak = mesh(new THREE.ConeGeometry(0.07, 0.18, 4), flat("#e0a030"))
    beak.rotation.x = Math.PI / 2 + 0.4
    beak.position.set(0, 0.82, 0.58)
    this.group.add(beak)
    this.group.position.copy(at)
    this.start = at.clone()
    this.group.scale.setScalar(1.3)
    scene.add(this.group)
  }

  get awake() {
    return this.flight >= 0
  }

  wake() {
    if (this.flight < 0) this.flight = 0
  }

  update(dt: number) {
    this.time += dt
    if (this.flight < 0) {
      // Sleepy: eyes closed, gentle breathing.
      this.group.scale.y = 1.3 * (1 + Math.sin(this.time * 1.5) * 0.03)
      return
    }
    this.flight += dt
    for (const lid of this.lids) lid.visible = false
    const flap = Math.sin(this.time * 18) * 0.9
    this.wings[0]!.rotation.z = flap
    this.wings[1]!.rotation.z = -flap
    if (this.flight > 0.8) {
      const t = Math.min(1, (this.flight - 0.8) / 3)
      this.group.position.lerpVectors(this.start, this.flyTo, t * t)
      this.group.position.y += Math.sin(t * Math.PI) * 3
      if (t >= 1) this.group.visible = false
    }
  }
}

/** Glowing fireflies drifting around a point. One draw call for all of them. */
export class Fireflies {
  private readonly points: THREE.Points
  private readonly homes: Float32Array
  private readonly phases: Float32Array
  private time = 0

  constructor(scene: THREE.Scene, center: THREE.Vector3, spread: THREE.Vector3, count: number, color: THREE.ColorRepresentation = "#fff3a0") {
    const positions = new Float32Array(count * 3)
    this.homes = new Float32Array(count * 3)
    this.phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.homes[i * 3] = center.x + (Math.random() - 0.5) * spread.x
      this.homes[i * 3 + 1] = center.y + Math.random() * spread.y
      this.homes[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread.z
      this.phases[i] = Math.random() * 100
    }
    positions.set(this.homes)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    )
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  update(dt: number) {
    this.time += dt
    const position = this.points.geometry.attributes.position as THREE.BufferAttribute
    const array = position.array as Float32Array
    for (let i = 0; i < this.phases.length; i++) {
      const p = this.phases[i]! + this.time
      array[i * 3] = this.homes[i * 3]! + Math.sin(p * 0.7) * 1.2
      array[i * 3 + 1] = this.homes[i * 3 + 1]! + Math.sin(p * 1.1) * 0.5
      array[i * 3 + 2] = this.homes[i * 3 + 2]! + Math.cos(p * 0.6) * 1.2
    }
    position.needsUpdate = true
    ;(this.points.material as THREE.PointsMaterial).opacity = 0.7 + Math.sin(this.time * 2.3) * 0.2
  }
}

/** Gently falling snow that follows the action. */
export class Snowfall {
  private readonly points: THREE.Points
  private readonly speeds: Float32Array
  private time = 0

  constructor(scene: THREE.Scene, count = 900, size = 40) {
    const positions = new Float32Array(count * 3)
    this.speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * size
      positions[i * 3 + 1] = Math.random() * 18
      positions[i * 3 + 2] = (Math.random() - 0.5) * size
      this.speeds[i] = 0.8 + Math.random() * 0.8
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#ffffff", size: 0.18, transparent: true, opacity: 0.85, depthWrite: false }))
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  update(dt: number, focus: THREE.Vector3) {
    this.time += dt
    this.points.position.set(focus.x, focus.y - 2, focus.z)
    const position = this.points.geometry.attributes.position as THREE.BufferAttribute
    const array = position.array as Float32Array
    for (let i = 0; i < this.speeds.length; i++) {
      let y = array[i * 3 + 1]! - this.speeds[i]! * dt
      if (y < 0) y += 18
      array[i * 3 + 1] = y
      array[i * 3] = array[i * 3]! + Math.sin(this.time + i) * 0.003
    }
    position.needsUpdate = true
  }
}
