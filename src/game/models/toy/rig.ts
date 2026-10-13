import * as THREE from "three"
import type { BearLook } from "../types.ts"
import { PartBatch, ball, bean, ring, teardrop } from "./geometry.ts"
import type { Placement } from "./geometry.ts"
import { gloss, sparkle, toyTint, vinyl } from "./materials.ts"

type Vec3 = readonly [number, number, number]

/** Chibi proportions. Mama is a gentle grown-up; Cub is nearly all head. */
interface Dims {
  readonly torso: Vec3
  readonly torsoSize: Vec3
  readonly head: Vec3
  readonly headSize: Vec3
  readonly earBase: Vec3
  readonly earSize: Vec3
  readonly eye: readonly [number, number]
  readonly eyeSize: Vec3
  readonly hipY: number
  readonly hipX: number
  readonly frontZ: number
  readonly hindZ: number
  readonly legRadius: number
  readonly tail: Vec3
  readonly tailSize: number
}

const MAMA: Dims = {
  torso: [0, 0.85, -0.24], torsoSize: [0.6, 0.62, 0.68],
  head: [0, 1.2, 0.6], headSize: [0.6, 0.54, 0.55],
  earBase: [0.33, 0.37, -0.06], earSize: [0.19, 0.18, 0.1],
  eye: [0.23, 0.03], eyeSize: [0.086, 0.116, 0.05],
  hipY: 0.4, hipX: 0.34, frontZ: 0.34, hindZ: -0.6, legRadius: 0.2,
  tail: [0, 0.98, -0.91], tailSize: 0.15
}

const CUB: Dims = {
  torso: [0, 0.73, -0.12], torsoSize: [0.5, 0.47, 0.56],
  head: [0, 1.18, 0.42], headSize: [0.68, 0.62, 0.61],
  earBase: [0.37, 0.43, -0.06], earSize: [0.19, 0.18, 0.1],
  eye: [0.26, 0.02], eyeSize: [0.106, 0.142, 0.055],
  hipY: 0.34, hipX: 0.29, frontZ: 0.26, hindZ: -0.42, legRadius: 0.18,
  tail: [0, 0.76, -0.66], tailSize: 0.13
}

const Z = new THREE.Vector3(0, 0, 1)
/** Turns a front-facing decal frame (x, y, out=z) into a downward-facing sole frame (x, z, out=-y). */
const SOLE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
const scratch = new THREE.Vector3()

/** A point on the front of an ellipsoid, plus the rotation that lays a decal flat on it. */
const onSurface = (size: Vec3, x: number, y: number, lift = 0): { at: Vec3, rot: THREE.Quaternion } => {
  const z = size[2] * Math.sqrt(Math.max(0, 1 - (x / size[0]) ** 2 - (y / size[1]) ** 2))
  const normal = new THREE.Vector3(x / size[0] ** 2, y / size[1] ** 2, z / size[2] ** 2).normalize()
  return { at: [x + normal.x * lift, y + normal.y * lift, z + normal.z * lift], rot: new THREE.Quaternion().setFromUnitVectors(Z, normal) }
}

/** Offset a decal within its own surface frame (x right, y up, z out). */
const within = (base: { at: Vec3, rot: THREE.Quaternion }, x: number, y: number, z: number): Vec3 => {
  scratch.set(x, y, z).applyQuaternion(base.rot)
  return [base.at[0] + scratch.x, base.at[1] + scratch.y, base.at[2] + scratch.z]
}

const place = (at: Vec3, size: Placement["size"], rot?: Placement["rot"]): Placement => rot ? { at, size, rot } : { at, size }

/**
 * The toy's pivots. `tumble` spins around the body centre for flights and twirls; `motion` pivots
 * at the hind paws on the ground, so squash keeps the feet planted and rearing up rocks back on them.
 */
export class ToyRig {
  readonly cub: boolean
  readonly dims: Dims
  readonly tumble = new THREE.Group()
  readonly motion = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly eyes = new THREE.Group()
  readonly happyEyes: THREE.Mesh
  readonly mouth = new THREE.Group()
  readonly ears: THREE.Group[] = []
  readonly legs: THREE.Group[] = []
  readonly tail = new THREE.Group()
  readonly scarfTail = new THREE.Group()
  /** Where the motion pivot (hind paws on the ground) sits relative to the tumble centre. */
  readonly pivot: Vec3
  readonly centre: number
  readonly earTilt = 0.34

  constructor(root: THREE.Object3D, look: BearLook) {
    const cub = look.kind === "cub"
    this.cub = cub
    const d = cub ? CUB : MAMA
    this.dims = d
    const fur = toyTint(look.fur, cub ? 1.15 : 1.08, cub ? 0.09 : 0.11)
    const cream = toyTint(look.belly, 1.05, 0.09)
    const innerEar = cream.clone().lerp(new THREE.Color("#ff9db2"), 0.4)
    const blush = new THREE.Color("#ff8ea4")
    const pad = cream.clone().lerp(new THREE.Color("#ffb3bf"), 0.3)
    const dark = "#2a1c24"
    const surface = vinyl()
    const shine = gloss()
    const twinkle = sparkle()

    this.centre = d.torso[1]
    this.pivot = [0, -this.centre, d.hindZ]
    this.tumble.name = "toy-tumble"
    this.tumble.position.set(0, this.centre, 0)
    root.add(this.tumble)
    this.motion.name = "toy-motion"
    this.motion.position.set(...this.pivot)
    this.tumble.add(this.motion)
    this.body.position.set(0, 0, -d.hindZ)
    this.motion.add(this.body)

    // Bean body with a cream tummy that shows from the front and below.
    const torso = new PartBatch()
      .add(bean(0.12, 0.25), fur, place(d.torso, d.torsoSize))
      .add(ball("mid"), cream, place([0, d.torso[1] - d.torsoSize[1] * 0.18, d.torso[2] + d.torsoSize[2] * 0.42],
        [d.torsoSize[0] * 0.66, d.torsoSize[1] * 0.68, d.torsoSize[2] * 0.6]))

    if (look.scarf !== undefined) {
      // A puffy scarf where the head meets the body (seen from the game camera behind), with a
      // knot on the left and a little tail that streams back over her shoulder.
      const scarf = new THREE.Color(look.scarf)
      const dots = "#fff4f8"
      const neck: Vec3 = [0, d.head[1] - d.headSize[1] * 0.42, d.head[2] - d.headSize[2] * 0.62]
      torso.add(ring(0.43, 0.1, Math.PI * 2, 24, 8), scarf, place(neck, 1, [-0.75, 0, 0]))
      const knot: Vec3 = [-0.42, neck[1] - 0.03, neck[2] - 0.03]
      torso.add(ball("lo"), scarf, place(knot, [0.1, 0.12, 0.12]))
      this.scarfTail.position.set(knot[0] - 0.02, knot[1] - 0.02, knot[2] - 0.04)
      this.body.add(this.scarfTail)
      const tailPieces = new PartBatch()
        .add(teardrop(), scarf, place([-0.02, -0.15, -0.03], [0.085, 0.17, 0.04], [0.15, 0.4, -0.25]))
        .add(teardrop(), scarf, place([0.0, -0.14, -0.14], [0.08, 0.15, 0.038], [-0.2, 0.9, -0.1]))
        .add(ball("xs"), dots, place([-0.07, -0.2, -0.0], 0.024))
        .add(ball("xs"), dots, place([-0.05, -0.1, -0.02], 0.02))
        .add(ball("xs"), dots, place([-0.06, -0.2, -0.17], 0.02))
      this.scarfTail.add(tailPieces.mesh(surface, "scarf tail"))
    }

    this.tail.position.set(...d.tail)
    this.body.add(this.tail)
    this.tail.add(new PartBatch()
      .add(ball("mid"), fur.clone().lerp(cream, 0.25), place([0, 0, 0], d.tailSize))
      .mesh(surface, "pom-pom tail"))

    // Head pivots at its own centre: a bobble-head, like a desk toy.
    this.head.name = "head"
    this.head.position.set(...d.head)
    this.body.add(this.head)
    const hs = d.headSize
    const skull = new PartBatch().add(ball("hi"), fur, place([0, 0, 0], hs))
    const glossy = new PartBatch()
    const muzzleSize: Vec3 = cub ? [0.25, 0.18, 0.17] : [0.27, 0.19, 0.18]
    const muzzle: Vec3 = [0, -hs[1] * 0.3, hs[2] * 0.79]
    skull.add(ball("mid"), cream, place(muzzle, muzzleSize))
    const muzzleFront = (y: number): number => muzzle[2] + muzzleSize[2] * Math.sqrt(Math.max(0, 1 - ((y - muzzle[1]) / muzzleSize[1]) ** 2))
    // Rounded-triangle button nose with its own glint.
    const noseY = muzzle[1] + muzzleSize[1] * 0.42
    const noseZ = muzzleFront(noseY) - 0.01
    glossy.add(bean(-0.35, 0, "lo"), dark, place([0, noseY, noseZ], cub ? [0.075, 0.052, 0.05] : [0.085, 0.058, 0.055]))
    // "ω" smile.
    const smileY = muzzle[1] - muzzleSize[1] * 0.18
    const smileZ = muzzleFront(smileY) + 0.004
    glossy.add(ball("xs"), dark, place([0, (noseY + smileY) / 2 - 0.005, (noseZ + smileZ) / 2 + 0.01], [0.012, (noseY - smileY) * 0.42, 0.012]))
    for (const side of [-1, 1]) {
      glossy.add(ring(0.042, 0.011, Math.PI, 12, 5), dark, place([side * 0.042, smileY, smileZ - 0.004], 1, [-0.25, side * 0.3, Math.PI]))
    }

    // Big glossy eyes with two sparkles each, on a pivot that squashes to blink.
    const eyeY = d.eye[1]
    this.eyes.position.set(0, eyeY, 0)
    this.head.add(this.eyes)
    const eyeBall = new PartBatch()
    const glints = new PartBatch()
    const happy = new PartBatch()
    for (const side of [-1, 1]) {
      const eye = onSurface(hs, side * d.eye[0], eyeY, -d.eyeSize[2] * 0.45)
      const shifted = (p: Vec3): Vec3 => [p[0], p[1] - eyeY, p[2]]
      eyeBall.add(ball("mid"), dark, place(shifted(eye.at), d.eyeSize, eye.rot))
      const es = d.eyeSize
      glints.add(ball("xs"), "#ffffff", place(shifted(within(eye, -es[0] * 0.32, es[1] * 0.38, es[2] * 0.82)), [es[0] * 0.36, es[1] * 0.3, 0.012], eye.rot))
      glints.add(ball("xs"), "#ffffff", place(shifted(within(eye, es[0] * 0.36, -es[1] * 0.4, es[2] * 0.8)), [es[0] * 0.17, es[1] * 0.13, 0.01], eye.rot))
      // Closed "^ ^" eyes for laughing, dancing and shaking off water.
      const arc = onSurface(hs, side * d.eye[0], eyeY - es[1] * 0.3, 0.004)
      happy.add(ring(es[0] * 0.95, 0.017, Math.PI, 14, 5), dark, place(arc.at, 1, arc.rot))
      // Rosy cheeks under and outside each eye.
      const cheek = onSurface(hs, side * hs[0] * 0.6, eyeY - hs[1] * 0.27, -0.022)
      skull.add(ball("lo"), blush, place(cheek.at, cub ? [0.12, 0.075, 0.035] : [0.105, 0.065, 0.035], cheek.rot))
    }
    this.eyes.add(eyeBall.mesh(shine, "eyes"))
    this.eyes.add(glints.mesh(twinkle, "eye sparkles", false))
    this.happyEyes = happy.mesh(shine, "happy eyes")
    this.happyEyes.visible = false
    this.head.add(this.happyEyes)

    // Open mouth: hidden at rest, grows from under the smile for roars and giggles.
    const mouthY = smileY - 0.035
    this.mouth.position.set(0, mouthY, muzzleFront(mouthY) - 0.02)
    this.mouth.rotation.x = -0.35
    this.head.add(this.mouth)
    this.mouth.add(new PartBatch()
      .add(ball("lo"), "#7a2f3d", place([0, -0.03, 0], [0.085, 0.07, 0.035]))
      .add(ball("xs"), "#ff8fa3", place([0, -0.065, 0.016], [0.055, 0.032, 0.025]))
      .mesh(surface, "open mouth", false))
    this.mouth.visible = false

    this.head.add(skull.mesh(surface, "head"))
    this.head.add(glossy.mesh(shine, "nose and smile"))
    const noseGlint = new PartBatch().add(ball("xs"), "#ffffff", place([-0.025, noseY + 0.022, noseZ + 0.045], [0.022, 0.013, 0.008]))
    this.head.add(noseGlint.mesh(twinkle, "nose glint", false))

    // Round ears on wiggle pivots at their base.
    for (const side of [-1, 1]) {
      const ear = new THREE.Group()
      ear.position.set(side * d.earBase[0], d.earBase[1], d.earBase[2])
      ear.rotation.z = -side * this.earTilt
      this.head.add(ear)
      this.ears.push(ear)
      const es = d.earSize
      const parts = new PartBatch()
        .add(ball("mid"), fur, place([0, es[1] * 0.75, 0], es))
        .add(ball("lo"), innerEar, place([0, es[1] * 0.72, es[2] * 0.62], [es[0] * 0.62, es[1] * 0.6, es[2] * 0.45]))
      if (!cub && side < 0) {
        // Mama's flower, tucked at the base of her left ear.
        const centre: Vec3 = [0.07, es[1] * 0.22, es[2] * 1.1]
        for (let i = 0; i < 5; i++) {
          const angle = i / 5 * Math.PI * 2
          parts.add(teardrop("xs"), "#ff9ec2", place(
            [centre[0] + Math.sin(angle) * 0.072, centre[1] + Math.cos(angle) * 0.072, centre[2]],
            [0.05, 0.07, 0.024], [0, 0, -angle + Math.PI]))
        }
        parts.add(ball("xs"), "#ffd65c", place([centre[0], centre[1], centre[2] + 0.02], [0.042, 0.042, 0.026]))
      }
      ear.add(parts.mesh(surface, side < 0 ? "left ear" : "right ear"))
    }

    // Four stubby legs. Each is one pivot at the hip with a round paw and toe beans on the sole.
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      const hip = new THREE.Group()
      hip.name = `${front ? "front" : "hind"}-${side < 0 ? "left" : "right"}`
      hip.position.set(side * (front ? d.hipX : d.hipX + 0.03), d.hipY, front ? d.frontZ : d.hindZ)
      this.body.add(hip)
      this.legs.push(hip)
      const grow = front ? 1 : 1.1
      const r = d.legRadius * grow
      // One chunky stub per leg, flat-bottomed like a toy that stands on a shelf; a round pad
      // and three toe beans on the sole show whenever a paw lifts.
      const top = 0.24
      const half = (d.hipY + top) / 1.82
      const stubY = top - half
      const parts = new PartBatch()
        .add(bean(0.1, 0.3, "mid"), fur, place([0, stubY, 0.02], [r, half, r * 1.1]))
      // Pads sit flush on the domed underside of the stub, so they only show when a sole lifts.
      const under: Vec3 = [r * 1.04, half * 0.82, r * 1.14]
      const soleAt = (x: number, z: number, sink: number, size: Vec3): void => {
        const spot = onSurface([under[0], under[2], under[1]], x, z, -sink)
        // onSurface works on a front-facing ellipsoid; rotate +Z (out) to -Y (down) for the sole.
        const q = SOLE.clone().multiply(spot.rot)
        parts.add(ball("xs"), pad, place([spot.at[0], stubY - spot.at[2], 0.02 + spot.at[1]], size, q))
      }
      soleAt(0, -0.05 * r, 0.004, [r * 0.55, r * 0.5, 0.02])
      for (const toe of [-1, 0, 1]) soleAt(toe * r * 0.45, r * (0.62 - Math.abs(toe) * 0.1), 0.004, [r * 0.17, r * 0.14, 0.018])
      hip.add(parts.mesh(surface, `${hip.name} leg`))
    }

    this.body.add(torso.mesh(surface, "body"))
  }
}
