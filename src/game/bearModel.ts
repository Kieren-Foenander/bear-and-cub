import * as THREE from "three"
import { damp, flat, mesh } from "./util.ts"

export interface BearLook {
  /** Lets the model use different proportions for the grown-up and the little one. */
  readonly kind: "mama" | "cub"
  readonly fur: THREE.ColorRepresentation
  readonly belly: THREE.ColorRepresentation
  /** Optional scarf colour, so the cub is easy to spot. */
  readonly scarf?: THREE.ColorRepresentation
}

/** Load any model assets. Awaited once at startup before any BearModel is constructed. */
export const preloadBearModels = (): Promise<void> => Promise.resolve()

export interface BearAnimState {
  /** Horizontal speed in m/s. */
  readonly speed: number
  readonly maxSpeed: number
  readonly grounded: boolean
  /** Riding on Mama's back. */
  readonly carried: boolean
  /** Thrown through the air by Mama (can't steer). */
  readonly flying: boolean
  /** Vertical velocity in m/s, + is up. */
  readonly verticalVelocity: number
}

/** Height from the model's origin (its feet) to the top of its ears, at scale 1. */
export const MODEL_HEIGHT = 1.9
const HIP_HEIGHT = 0.85

/**
 * A bear built from a handful of chunky shapes. The origin sits between the feet and the bear faces +Z.
 */
export class BearModel {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly legs: Array<THREE.Group> = []
  private walkPhase = 0
  private squash = 0
  private nod = 0
  private swipeTime = 0

  constructor(look: BearLook, scale: number) {
    const fur = flat(look.fur)
    const belly = flat(look.belly)
    const dark = flat("#2b1d14")

    this.root.add(this.body)
    this.body.position.y = HIP_HEIGHT

    const torso = mesh(new THREE.IcosahedronGeometry(1, 1), fur)
    torso.scale.set(0.75, 0.62, 1)
    this.body.add(torso)

    const tummy = mesh(new THREE.IcosahedronGeometry(0.6, 1), belly)
    tummy.scale.set(0.95, 0.6, 1.2)
    tummy.position.set(0, -0.2, 0.1)
    this.body.add(tummy)

    const tail = mesh(new THREE.IcosahedronGeometry(0.17, 0), fur)
    tail.position.set(0, 0.2, -1)
    this.body.add(tail)

    this.head.position.set(0, 0.45, 0.95)
    this.body.add(this.head)
    const skull = mesh(new THREE.IcosahedronGeometry(0.52, 1), fur)
    this.head.add(skull)
    const snout = mesh(new THREE.IcosahedronGeometry(0.24, 1), belly)
    snout.scale.set(1, 0.8, 1)
    snout.position.set(0, -0.1, 0.43)
    this.head.add(snout)
    const nose = mesh(new THREE.IcosahedronGeometry(0.09, 0), dark)
    nose.position.set(0, -0.02, 0.64)
    this.head.add(nose)
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.IcosahedronGeometry(0.075, 1), dark)
      eye.position.set(side * 0.2, 0.12, 0.42)
      this.head.add(eye)
      const shine = mesh(new THREE.IcosahedronGeometry(0.025, 0), flat("#ffffff"), { castShadow: false })
      shine.position.set(side * 0.2 + 0.02, 0.15, 0.49)
      this.head.add(shine)
      const ear = mesh(new THREE.IcosahedronGeometry(0.17, 0), fur)
      ear.position.set(side * 0.33, 0.42, -0.05)
      this.head.add(ear)
      const innerEar = mesh(new THREE.IcosahedronGeometry(0.09, 0), belly)
      innerEar.position.set(side * 0.33, 0.42, 0.06)
      this.head.add(innerEar)
    }

    if (look.scarf !== undefined) {
      const scarf = mesh(new THREE.TorusGeometry(0.42, 0.13, 5, 10), flat(look.scarf))
      scarf.position.set(0, 0.25, 0.72)
      scarf.rotation.x = Math.PI / 2 - 0.5
      this.body.add(scarf)
      const tassel = mesh(new THREE.BoxGeometry(0.22, 0.4, 0.1), flat(look.scarf))
      tassel.position.set(0.25, 0.05, 0.95)
      tassel.rotation.z = 0.3
      this.body.add(tassel)
    }

    for (const [x, z] of [[-0.42, 0.55], [0.42, 0.55], [-0.42, -0.55], [0.42, -0.55]] as const) {
      const hip = new THREE.Group()
      hip.position.set(x, -0.2, z)
      const leg = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.7, 6), fur)
      leg.position.y = -0.3
      hip.add(leg)
      const paw = mesh(new THREE.IcosahedronGeometry(0.19, 0), belly)
      paw.scale.set(1, 0.6, 1.2)
      paw.position.set(0, -0.62, 0.05)
      hip.add(paw)
      this.body.add(hip)
      this.legs.push(hip)
    }

    this.root.scale.setScalar(scale)
  }

  /** Squish the bear when it lands. */
  land(strength: number) {
    this.squash = Math.max(this.squash, strength)
  }

  /** Big front-paw swipe. */
  swipe() {
    this.swipeTime = 1
  }

  /** Happy dance when a level is finished. */
  celebrate() {
    this.nod = 1
  }

  /** Shake off water after falling in. */
  shake() {
    this.squash = 0.6
  }

  /** A happy little head bob, used for roars. */
  cheer() {
    this.nod = 1
  }

  animate(dt: number, state: BearAnimState) {
    const { speed, maxSpeed, grounded, carried } = state
    const stride = Math.min(1, speed / maxSpeed)
    this.walkPhase += dt * (4 + 8 * stride)

    this.legs.forEach((leg, i) => {
      let target: number
      if (carried) target = Math.sin(this.walkPhase * 0.6 + i) * 0.3 + 0.6
      else if (!grounded) target = i < 2 ? -0.7 : 0.7
      else target = Math.sin(this.walkPhase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * stride
      leg.rotation.x = damp(leg.rotation.x, target, 18, dt)
    })

    // Swipe: the front-right paw shoots up and forward, then settles back.
    if (this.swipeTime > 0) {
      this.swipeTime = Math.max(0, this.swipeTime - dt * 3.5)
      const t = Math.sin((1 - this.swipeTime) * Math.PI)
      this.legs[1]!.rotation.x = -2.6 * t
      this.legs[1]!.rotation.z = 0.5 * t
    } else {
      this.legs[1]!.rotation.z = 0
    }

    const bob = grounded && !carried ? Math.abs(Math.sin(this.walkPhase)) * 0.08 * stride : 0
    this.squash = damp(this.squash, 0, 8, dt)
    this.body.position.y = HIP_HEIGHT + bob - this.squash * 0.25
    this.body.scale.set(1 + this.squash * 0.25, 1 - this.squash * 0.3, 1 + this.squash * 0.25)

    this.nod = damp(this.nod, 0, 5, dt)
    this.head.rotation.x = -this.nod * 0.6 + (carried ? -0.2 : 0)
  }
}
