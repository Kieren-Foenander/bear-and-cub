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
