import * as THREE from "three"
import type { BearLook } from "../types.ts"
import { bake, rectY, rectZ, ringY, ringZ, Sculpt } from "./sculpt.ts"
import type { Paint } from "./sculpt.ts"

/** [z, centre y, half width, half height, chamfer] along the torso. */
type TorsoRing = readonly [number, number, number, number, number]
/** [y, half width, half depth, chamfer, centre z] up the head. */
type HeadRing = readonly [number, number, number, number, number]

interface Proportions {
  torso: readonly TorsoRing[]
  /** Neck pivot (body space) and head centre relative to it. */
  neck: readonly [number, number, number]
  headCentre: readonly [number, number, number]
  head: readonly HeadRing[]
  /** Flat front of the face, head-local z. */
  face: number
  snout: { hw: number, hh: number, jaw: number, bottom: number, length: number }
  eye: { x: number, y: number, rx: number, ry: number }
  ear: { x: number, y: number, z: number, size: number }
  frontHip: readonly [number, number, number]
  hindHip: readonly [number, number, number]
  knee: number
  leg: number
  paw: number
  tail: readonly [number, number, number]
}

const MAMA: Proportions = {
  torso: [
    [-0.84, 1.0, 0.26, 0.24, 0.12],
    [-0.74, 0.98, 0.45, 0.42, 0.21],
    [-0.52, 0.97, 0.55, 0.51, 0.27],
    [0.1, 1.0, 0.58, 0.56, 0.29],
    [0.4, 1.03, 0.52, 0.49, 0.26],
    [0.56, 1.08, 0.36, 0.33, 0.17]
  ],
  neck: [0, 1.15, 0.46],
  headCentre: [0, 0.22, 0.32],
  head: [
    [-0.39, 0.3, 0.26, 0.12, 0],
    [-0.21, 0.5, 0.39, 0.19, 0],
    [0.1, 0.52, 0.39, 0.2, 0],
    [0.26, 0.45, 0.34, 0.18, -0.01],
    [0.38, 0.29, 0.23, 0.12, -0.03]
  ],
  face: 0.39,
  snout: { hw: 0.21, hh: 0.085, jaw: 0.05, bottom: -0.21, length: 0.18 },
  eye: { x: 0.21, y: 0.045, rx: 0.07, ry: 0.087 },
  ear: { x: 0.34, y: 0.29, z: -0.06, size: 1 },
  frontHip: [0.36, 0.72, 0.32],
  hindHip: [0.37, 0.7, -0.5],
  knee: 0.27,
  leg: 0.215,
  paw: 1,
  tail: [0, 1.18, -0.8]
}

const CUB: Proportions = {
  torso: [
    [-0.66, 0.94, 0.3, 0.27, 0.13],
    [-0.55, 0.91, 0.48, 0.41, 0.23],
    [-0.3, 0.9, 0.54, 0.45, 0.27],
    [0.12, 0.9, 0.55, 0.46, 0.28],
    [0.36, 0.92, 0.48, 0.4, 0.24],
    [0.5, 0.96, 0.32, 0.27, 0.14]
  ],
  neck: [0, 1.05, 0.42],
  headCentre: [0, 0.28, 0.28],
  head: [
    [-0.44, 0.33, 0.29, 0.13, 0],
    [-0.24, 0.57, 0.43, 0.22, 0],
    [0.1, 0.59, 0.43, 0.23, 0],
    [0.29, 0.5, 0.37, 0.2, -0.01],
    [0.42, 0.32, 0.25, 0.13, -0.03]
  ],
  face: 0.43,
  snout: { hw: 0.165, hh: 0.075, jaw: 0.042, bottom: -0.27, length: 0.13 },
  eye: { x: 0.25, y: 0.0, rx: 0.098, ry: 0.122 },
  ear: { x: 0.38, y: 0.32, z: -0.07, size: 1.05 },
  frontHip: [0.32, 0.66, 0.26],
  hindHip: [0.33, 0.64, -0.36],
  knee: 0.22,
  leg: 0.2,
  paw: 0.85,
  tail: [0, 1.06, -0.66]
}

const tint = (color: THREE.ColorRepresentation, toward: THREE.ColorRepresentation, amount: number): THREE.Color =>
  new THREE.Color(color).lerp(new THREE.Color(toward), amount)

/** All animation pivots live inside the game-owned root. */
export class OrigamiRig {
  readonly cub: boolean
  /** Rolls around the body centre when thrown. */
  readonly tumble = new THREE.Group()
  /** Pitches/squashes around the hind feet, so rearing up keeps them planted. */
  readonly motion = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly jaw = new THREE.Group()
  readonly eyes: THREE.Object3D[] = []
  readonly ears: THREE.Object3D[] = []
  readonly legs: THREE.Group[] = []
  readonly knees: THREE.Group[] = []
  readonly hips: THREE.Vector3[] = []
  readonly tail = new THREE.Group()
  readonly scarf: THREE.Group[] = []
  /** Where a hat sits, head-local. */
  readonly hatAnchor: THREE.Vector3
  readonly hindZ: number

  constructor(root: THREE.Object3D, look: BearLook) {
    this.cub = look.kind === "cub"
    const d = this.cub ? CUB : MAMA
    // A gentle warm lift keeps the look colours but stops darker browns going muddy in shade.
    const fur = new THREE.Color(look.fur).offsetHSL(0, 0, 0.04)
    const belly = new THREE.Color(look.belly).offsetHSL(0, 0, 0.03)
    const furLight = tint(fur, "#fff1dc", 0.07)
    const furDeep = tint(fur, "#3b2418", 0.14)
    const pad = tint(belly, "#f2a0a8", 0.3)
    const pinkEar = tint(belly, "#f29aa6", 0.45)
    const blush = tint(belly, "#f0687e", 0.62)
    const ink = new THREE.Color("#2a1e26")
    const shine = new THREE.Color("#ffffff")
    const mouth = new THREE.Color("#7a2e3c")
    const tongue = new THREE.Color("#f48aa0")

    this.hindZ = d.hindHip[2]
    const centre = new THREE.Vector3(0, 1.0, -0.05)
    this.tumble.position.copy(centre)
    root.add(this.tumble)
    this.tumble.add(this.motion)
    this.motion.position.set(0, -centre.y, this.hindZ - centre.z)
    this.motion.add(this.body)
    this.body.position.set(0, 0, -this.hindZ)

    // Torso: a chamfered box, cream underneath and on the chest.
    const torsoTop = Math.max(...d.torso.map(([, y, , hh]) => y + hh))
    const torso = new Sculpt()
    const torsoPaint: Paint = (c, n) => n.z > 0.9 ? belly : n.y > 0.55 && c.y > torsoTop - 0.01 ? furLight : fur
    torso.loft(d.torso.map(([z, y, hw, hh, c]) => ringZ(z, hw, hh, c, 0, y)), torsoPaint)
    bake(this.body, torso, "matte", "torso")

    // Tail: a little folded gem with a cream tip.
    this.tail.position.set(...d.tail)
    this.body.add(this.tail)
    const tailSculpt = new Sculpt()
    tailSculpt.loft([ringZ(0.04, 0.1, 0.1, 0.05), ringZ(-0.12, 0.16, 0.15, 0.08), ringZ(-0.26, 0.1, 0.095, 0.05)],
      (c) => c.z < -0.14 ? belly : fur, "end")
    bake(this.tail, tailSculpt)

    this.buildHead(d, look, { fur, belly, furLight, furDeep, pinkEar, blush, ink, shine, mouth, tongue })
    this.hatAnchor = new THREE.Vector3(d.headCentre[0], d.headCentre[1] + d.head[d.head.length - 1]![0] + 0.02, d.headCentre[2] - 0.03)

    for (let i = 0; i < 4; i++) this.buildLeg(d, i, fur, furDeep, pad)
  }

  private buildHead(d: Proportions, look: BearLook, c: Record<string, THREE.Color>): void {
    const fur = c.fur!
    const belly = c.belly!
    this.head.name = "head"
    this.head.position.set(...d.neck)
    this.body.add(this.head)
    const [hx, hy, hz] = d.headCentre
    const top = d.head[d.head.length - 1]![0]

    const skull = new Sculpt()
    const gloss = new Sculpt(0)
    skull.place(hx, hy, hz)
    gloss.place(hx, hy, hz)
    skull.loft(d.head.map(([y, hw, hd, ch, cz]) => ringY(y, hw, hd, ch, 0, cz)),
      (p, n) => n.y > 0.55 && p.y > top - 0.01 ? c.furLight! : fur)

    // Wedge snout: its top slopes down to a flat cream front. The lower slice is the jaw, so the
    // closed mouth is just a crisp seam that drops open for roars and cheers.
    const s = d.snout
    const front = d.face + s.length
    const back = d.face - 0.09
    const taper = [[back, 1, 1, 0.075], [front, 0.8, 0.74, 0.055]] as const
    skull.loft(taper.map(([z, w, h, ch]) => ringZ(z, s.hw * w, s.hh * h, ch, 0, s.bottom + s.hh * h, 0.008)), belly, "end")
    // Nose: a glossy rounded triangle on the tip, with one tiny glint.
    const k = this.cub ? 0.85 : 1
    const nose = ([[-0.085, 0.035], [0.085, 0.035], [0.065, -0.025], [0.02, -0.05], [-0.02, -0.05], [-0.065, -0.025]] as const)
      .map(([x, y]) => [x * k, y * k] as [number, number])
    const noseY = s.bottom + s.hh * 1.48 - 0.04 * k
    gloss.place(hx, hy + noseY, hz)
    gloss.slab(nose, front - 0.01, front + 0.035, 0.3, c.ink!, false)
    gloss.decal(nose.map(([x, y]) => [x * 0.28 - 0.03 * k, y * 0.28 + 0.012 * k] as [number, number]), front + 0.037, c.shine!)

    // A dark mouth inside, seen through the seam and when the jaw drops, plus a line up to the nose.
    skull.loft([rectZ(d.face - 0.04, s.hw * 0.5, 0.06, 0, s.bottom - 0.03),
      rectZ(front - 0.03, s.hw * 0.45, 0.05, 0, s.bottom - 0.03)], c.mouth!)
    // A line from the nose down to a small smile.
    const noseBottom = noseY - 0.045 * k
    const lip = s.bottom + 0.012
    skull.decal([[-0.011, lip], [0.011, lip], [0.011, noseBottom], [-0.011, noseBottom]], front + 0.003, c.ink!)
    for (const side of [-1, 1]) {
      skull.decal([[0, lip - 0.01], [side * 0.012, lip - 0.012], [side * 0.07 * k, lip + 0.012], [side * 0.062 * k, lip + 0.022]],
        front + 0.003, c.ink!)
    }

    // Blushing cheeks sit on the face, just outside the snout.
    for (const side of [-1, 1]) {
      skull.disc(side * (s.hw + 0.075), s.bottom + s.hh * 0.9, d.face + 0.004, 0.062, 0.042, c.blush!)
    }
    bake(this.head, skull, "matte", "skull")

    // Jaw: the snout's lower slice, hinged at the back.
    this.jaw.position.set(hx, hy + s.bottom, hz + back)
    this.head.add(this.jaw)
    const jaw = new Sculpt()
    jaw.loft(taper.map(([z, w, h]) => ringZ(z - back, s.hw * w * 0.985, s.jaw * h, 0.008, 0, -s.jaw * h, 0.04)), belly, "end")
    jaw.loft([rectZ(0.06, s.hw * 0.48, 0.012, 0, -0.006), rectZ(front - back - 0.05, s.hw * 0.4, 0.012, 0, -0.006)], c.tongue!, "end")
    bake(this.jaw, jaw, "matte", "jaw")

    // Eyes: glossy dots with a single tiny highlight; separate pivots so they can blink.
    for (const side of [-1, 1]) {
      const eye = new THREE.Group()
      eye.position.set(hx + side * d.eye.x, hy + d.eye.y, hz + d.face - 0.012)
      this.head.add(eye)
      this.eyes.push(eye)
      const dot = new Sculpt(0)
      dot.dot(0, 0, 0, d.eye.rx, d.eye.ry, 0.04, c.ink!, 10, 0.72)
      dot.disc(-d.eye.rx * 0.3, d.eye.ry * 0.32, 0.042, d.eye.rx * 0.24, d.eye.rx * 0.24, c.shine!)
      bake(eye, dot, "gloss", "eye")
    }
    bake(this.head, gloss, "gloss", "nose")

    // Ears: rounded triangles with a pink inner fold, tipped outwards.
    for (const side of [-1, 1]) {
      const ear = new THREE.Group()
      ear.position.set(hx + side * d.ear.x, hy + d.ear.y, hz + d.ear.z)
      ear.rotation.set(-0.12, side * -0.22, side * -0.32)
      this.head.add(ear)
      this.ears.push(ear)
      const k = d.ear.size
      const shell = new Sculpt()
      shell.slab([[-0.17 * k, -0.06], [0.17 * k, -0.06], [0.15 * k, 0.12 * k], [0.06 * k, 0.24 * k], [-0.06 * k, 0.24 * k], [-0.15 * k, 0.12 * k]],
        -0.06, 0.06, 0.2, fur)
      shell.decal([[-0.1 * k, 0.0], [0.1 * k, 0.0], [0.085 * k, 0.1 * k], [0.035 * k, 0.16 * k], [-0.035 * k, 0.16 * k], [-0.085 * k, 0.1 * k]],
        0.063, c.pinkEar!)
      if (!this.cub && side < 0) this.addFlower(shell, k)
      bake(ear, shell, "matte", "ear")
    }

    if (look.scarf !== undefined) this.buildScarf(d, new THREE.Color(look.scarf))
  }

  /** Mama's little flower, tucked at the base of her left ear. */
  private addFlower(sculpt: Sculpt, k: number): void {
    const petal = new THREE.Color("#ffe2ea")
    const petalTip = new THREE.Color("#ff86ab")
    const heart = new THREE.Color("#f9c04f")
    const [x, y, z] = [-0.17 * k, 0.07, 0.075]
    for (let i = 0; i < 5; i++) {
      sculpt.place(x, y, z, 0, 0, i / 5 * Math.PI * 2 + 0.3, 1.15)
      sculpt.slab([[-0.035, 0.02], [0.035, 0.02], [0.06, 0.09], [0, 0.135], [-0.06, 0.09]], 0, 0.035, 0.25,
        (p) => p.y > 0.1 ? petalTip : petal, false)
    }
    sculpt.place(x, y, z, 0, 0, 0, 1.15)
    sculpt.dot(0, 0, 0.02, 0.045, 0.045, 0.035, heart, 6, 0.6)
    sculpt.place()
  }

  /** Cub's knitted pink scarf: a striped collar and a two-piece trailing tail. */
  private buildScarf(d: Proportions, scarf: THREE.Color): void {
    const light = tint(scarf, "#ffffff", 0.35)
    const collar = new Sculpt()
    const [, hy, hz] = d.headCentre
    const bottom = d.head[0]!
    // A ring of chunky knitted segments around the neck, alternately striped.
    const segments = 10
    const cy = hy + bottom[0] - 0.02
    const cz = hz - 0.08
    const rx = bottom[1] + 0.07
    const rz = bottom[2] + 0.07
    const t = 0.075
    const h = 0.11
    collar.place(0, cy, cz, 0.18)
    for (let i = 0; i < segments; i++) {
      const a0 = (i + 0.5) / segments * Math.PI * 2
      const a1 = (i + 1.5) / segments * Math.PI * 2
      const ring = (a: number) => {
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        return [
          new THREE.Vector3(cos * (rx + t), h, sin * (rz + t)), new THREE.Vector3(cos * (rx + t), -h, sin * (rz + t)),
          new THREE.Vector3(cos * rx * 0.9, -h, sin * rz * 0.9), new THREE.Vector3(cos * rx * 0.9, h, sin * rz * 0.9)
        ]
      }
      collar.loft([ring(a0), ring(a1)], i % 2 ? light : scarf, "none")
    }
    collar.place(0.3, cy - 0.04, cz + rz + 0.02, 0.18)
    collar.loft([ringZ(-0.04, 0.1, 0.09, 0.04), ringZ(0.1, 0.075, 0.07, 0.03)], scarf, "end")
    collar.place()
    bake(this.head, collar, "matte", "scarf")

    // The tail hangs from the knot and flutters behind as Cub runs.
    let parent: THREE.Object3D = this.head
    for (let piece = 0; piece < 2; piece++) {
      const joint = new THREE.Group()
      if (piece === 0) joint.position.set(0.34, cy - 0.08, cz + rz + 0.02)
      else joint.position.set(0, -0.24, 0)
      parent.add(joint)
      this.scarf.push(joint)
      const strip = new Sculpt()
      const stripe = (p: THREE.Vector3) => (p.y < -0.12) !== (piece === 1) ? light : scarf
      if (piece === 0) {
        strip.loft([rectY(0.02, 0.075, 0.03), rectY(-0.12, 0.08, 0.03), rectY(-0.26, 0.085, 0.03)], stripe, "end")
      } else {
        strip.loft([rectY(0.02, 0.085, 0.03), rectY(-0.12, 0.09, 0.03), rectY(-0.2, 0.09, 0.03)], stripe, "none")
        // Little fringe of folded points.
        for (const x of [-0.06, 0, 0.06]) {
          strip.loft([rectY(-0.2, 0.03, 0.03, x), rectY(-0.27, 0.002, 0.01, x)], light, "end")
        }
      }
      bake(joint, strip, "matte", "scarf tail")
      parent = joint
    }
    this.scarf[0]!.rotation.set(0.25, 0, 0.2)
  }

  private buildLeg(d: Proportions, i: number, fur: THREE.Color, furDeep: THREE.Color, pad: THREE.Color): void {
    const front = i < 2
    const side = i % 2 === 0 ? -1 : 1
    const [hx, hipY, hz] = front ? d.frontHip : d.hindHip
    const hip = new THREE.Group()
    hip.name = `${front ? "front" : "hind"}-${side < 0 ? "left" : "right"}`
    hip.position.set(side * hx, hipY, hz)
    this.body.add(hip)
    this.legs.push(hip)
    this.hips.push(hip.position.clone())
    const w = d.leg
    const kneeDrop = hipY - d.knee
    const upper = new Sculpt()
    if (front) {
      upper.loft([ringY(0.12, w * 1.02, w * 1.05, w * 0.4), ringY(-kneeDrop + 0.02, w * 0.92, w * 0.95, w * 0.36)], fur)
    } else {
      // Hind legs have a broad haunch that reads from the side.
      upper.loft([
        ringY(0.16, w * 1.05, w * 1.5, w * 0.45, 0, -0.02),
        ringY(-0.12, w * 1.15, w * 1.5, w * 0.5, 0, 0.0),
        ringY(-kneeDrop + 0.02, w * 0.92, w * 0.95, w * 0.36)
      ], fur)
    }
    bake(hip, upper, "matte", "leg")

    const knee = new THREE.Group()
    knee.position.set(0, -kneeDrop, 0)
    hip.add(knee)
    this.knees.push(knee)
    const lower = new Sculpt()
    const g = -d.knee + 0.014
    const p = d.paw
    lower.loft([
      ringY(0.08, w * 0.94, w * 0.96, w * 0.36),
      ringY(g + 0.11 * p, w * 1.1, w * 1.2, w * 0.45, 0, 0.045),
      ringY(g, w * 1.04, w * 1.14, w * 0.42, 0, 0.055)
    ], (_, n) => n.y < -0.9 ? furDeep : fur)
    // A paw print on each sole: one big pad and three toe beans, shown off by swipes and cheers.
    lower.place(0, g - 0.004, 0.055, Math.PI / 2)
    lower.disc(0, -w * 0.18, 0, w * 0.5, w * 0.38, pad, 6)
    for (const toe of [-1, 0, 1]) lower.disc(toe * w * 0.5, w * 0.55 - Math.abs(toe) * w * 0.12, 0, w * 0.18, w * 0.18, pad, 5)
    lower.place()
    bake(knee, lower, "matte", "paw")
  }
}
