import * as THREE from "three"
import type { BearLook } from "../bearModel.ts"
import { batchStaticParts, line, material, part, pebble } from "./shapes.ts"

/** All animation pivots are separate from the game-owned root transform. */
export class BearRig {
  readonly motion = new THREE.Group()
  readonly head = new THREE.Group()
  readonly jaw = new THREE.Group()
  readonly mouth: THREE.Mesh
  readonly eyes: THREE.Group[] = []
  readonly ears: THREE.Group[] = []
  readonly legs: THREE.Group[] = []
  readonly knees: THREE.Group[] = []
  readonly tail = new THREE.Group()
  readonly scarfTail = new THREE.Group()
  readonly cub: boolean

  constructor(root: THREE.Object3D, look: BearLook) {
    this.cub = look.kind === "cub"
    const cub = this.cub
    const fur = material(look.fur)
    const cream = material(look.belly)
    const shade = material(new THREE.Color(look.fur).multiplyScalar(0.87))
    const blush = material(new THREE.Color(look.belly).lerp(new THREE.Color("#e99094"), 0.4))
    const cocoa = material("#352b30")
    const eyeSurface = material("#251d29")
    eyeSurface.roughness = 0.28
    const white = material("#fff6e5")
    const tongue = material("#f398a7")
    root.add(this.motion)
    this.motion.name = "rear-foot-pivot"
    this.motion.position.set(0, 0.12, -0.65)
    const body = new THREE.Group()
    body.position.set(0, -0.12, 0.65)
    this.motion.add(body)

    // Broad back at y=1.55, ready for Cub's existing carrying anchor.
    part(body, pebble(cub ? 0.62 : 0.69, cub ? 0.56 : 0.61, cub ? 0.76 : 0.88, 0.9),
      fur, 0, cub ? 0.88 : 0.94, -0.2, "pear-shaped torso")
    part(body, pebble(0.48, cub ? 0.37 : 0.43, 0.63), cream, 0, 0.7, -0.09, "soft tummy")
    // A chest bib reads from the front, rather than hiding the belly underneath.
    part(body, pebble(cub ? 0.39 : 0.4, 0.36, 0.1), cream, 0, 0.89, cub ? 0.48 : 0.56, "chest bib")
    this.tail.position.set(0, 1.01, cub ? -0.98 : -1.04)
    body.add(this.tail)
    part(this.tail, pebble(0.16, 0.17, 0.17), fur, 0, 0, 0, "pom-pom tail")
    part(this.tail, pebble(0.085, 0.085, 0.055), cream, 0, 0.02, -0.135)

    this.head.name = "head"
    this.head.position.set(0, cub ? 1.26 : 1.29, cub ? 0.52 : 0.53)
    body.add(this.head)
    part(this.head, pebble(cub ? 0.59 : 0.52, cub ? 0.54 : 0.47, cub ? 0.49 : 0.45, 0.87),
      fur, 0, 0, 0, "rounded cheek skull")
    // Side tufts give Mama a soft silhouette without expensive fur.
    for (const side of [-1, 1]) {
      part(this.head, pebble(cub ? 0.17 : 0.19, 0.19, 0.25), fur, side * (cub ? 0.46 : 0.41), -0.13, 0.12)
      const ear = new THREE.Group()
      ear.position.set(side * (cub ? 0.4 : 0.36), cub ? 0.46 : 0.42, -0.035)
      ear.rotation.z = side * -0.15
      this.head.add(ear)
      this.ears.push(ear)
      part(ear, pebble(cub ? 0.185 : 0.18, cub ? 0.177 : 0.19, 0.12, 0.8), fur)
      part(ear, pebble(0.112, 0.11, 0.034), blush, 0, 0, 0.105)
      part(ear, pebble(0.074, 0.075, 0.02), cream, 0, -0.02, 0.131)

      const eye = new THREE.Group()
      eye.position.set(side * (cub ? 0.25 : 0.235), cub ? 0.12 : 0.105, cub ? 0.434 : 0.397)
      eye.rotation.y = side * 0.15
      this.head.add(eye)
      this.eyes.push(eye)
      part(eye, pebble(cub ? 0.098 : 0.078, cub ? 0.122 : 0.095, 0.05), cocoa)
      part(eye, pebble(cub ? 0.077 : 0.061, cub ? 0.104 : 0.08, 0.029), eyeSurface, 0, 0.001, 0.032)
      const glint = part(eye, pebble(0.025, 0.03, 0.013), white, -0.022, 0.033, 0.058)
      glint.castShadow = false
      part(eye, pebble(0.011, 0.012, 0.007), white, 0.022, -0.022, 0.061).castShadow = false
      // Small brows and apricot cheeks frame the eyes at TV distance.
      const brow = part(this.head, pebble(0.105, 0.029, 0.029), cream,
        side * 0.24, cub ? 0.295 : 0.245, cub ? 0.37 : 0.337)
      brow.rotation.z = side * -0.1
      part(this.head, pebble(cub ? 0.13 : 0.11, 0.062, 0.028), blush,
        side * (cub ? 0.365 : 0.33), -0.06, cub ? 0.397 : 0.358)
    }

    this.mouth = part(this.head, pebble(0.19, 0.115, 0.043), cocoa, 0, -0.255, 0.465, "mouth opening")
    this.mouth.scale.y = 0.12
    // Two muzzle lobes are much friendlier than one long pointed snout.
    for (const side of [-1, 1]) {
      part(this.head, pebble(0.17, 0.145, 0.195), cream, side * 0.115, -0.13, 0.43, "muzzle")
    }
    const nose = part(this.head, pebble(cub ? 0.12 : 0.13, 0.087, 0.077, 0.8), cocoa, 0, -0.055, 0.621, "button nose")
    nose.rotation.z = Math.PI
    part(this.head, pebble(0.043, 0.014, 0.008), white, -0.026, -0.024, 0.689).castShadow = false
    line(this.head, [new THREE.Vector3(0, -0.11, 0.626), new THREE.Vector3(0, -0.19, 0.63)], 0.014, cocoa)
    this.jaw.position.set(0, -0.24, 0.35)
    this.head.add(this.jaw)
    part(this.jaw, pebble(0.2, 0.067, 0.18), cream, 0, -0.02, 0.105, "lower jaw")
    part(this.jaw, pebble(0.083, 0.026, 0.07), tongue, 0, 0.034, 0.17, "little tongue")
    line(this.jaw, [new THREE.Vector3(-0.16, 0.017, 0.215), new THREE.Vector3(-0.085, -0.013, 0.268),
      new THREE.Vector3(0, 0.004, 0.281), new THREE.Vector3(0.085, -0.013, 0.268),
      new THREE.Vector3(0.16, 0.017, 0.215)], 0.012, cocoa)

    // Gentle Mama detail; attached to the ear so it follows her twitch.
    if (!cub) {
      const flower = new THREE.Group()
      flower.position.set(-0.045, 0.06, 0.137)
      flower.rotation.z = -0.2
      this.ears[0]!.add(flower)
      const petals = material("#ffe3d8")
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2
        const petal = part(flower, pebble(0.041, 0.072, 0.027), petals,
          Math.sin(angle) * 0.071, Math.cos(angle) * 0.071, 0)
        petal.rotation.z = -angle
      }
      part(flower, pebble(0.044, 0.043, 0.033), material("#f7c974"), 0, 0, 0.027)
    }

    if (look.scarf !== undefined) {
      const pink = material(look.scarf)
      const collar = part(this.head, new THREE.TorusGeometry(cub ? 0.39 : 0.36, 0.078, 5, 12), pink, 0, -0.35, -0.03)
      collar.rotation.x = Math.PI / 2 - 0.18
      part(this.head, pebble(0.1, 0.09, 0.085), pink, 0.33, -0.34, 0.17, "scarf knot")
      this.scarfTail.position.set(0.34, -0.36, 0.15)
      this.head.add(this.scarfTail)
      const ribbon = part(this.scarfTail, pebble(0.09, 0.22, 0.039, 0.25), pink, 0.02, -0.18, 0.04)
      ribbon.rotation.z = 0.17
      const stitch = material(new THREE.Color(look.scarf).lerp(new THREE.Color("#fff6e5"), 0.4))
      for (const offset of [-0.045, 0, 0.045]) {
        part(this.scarfTail, new THREE.BoxGeometry(0.02, 0.045, 0.025), stitch, offset + 0.052, -0.38, 0.066)
      }
    }

    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const front = i < 2
      const hip = new THREE.Group()
      hip.name = `${front ? "front" : "hind"}-${side < 0 ? "left" : "right"}`
      const hipY = cub ? 0.52 : 0.62
      hip.position.set(side * (cub ? 0.43 : 0.47), hipY, front ? 0.49 : -0.66)
      body.add(hip)
      this.legs.push(hip)
      part(hip, pebble(front ? 0.225 : 0.26, cub ? 0.26 : 0.31, 0.245, 0.8), fur, 0, -0.12, 0)
      const knee = new THREE.Group()
      knee.position.set(0, cub ? -0.27 : -0.35, 0)
      hip.add(knee)
      this.knees.push(knee)
      part(knee, pebble(0.19, 0.19, 0.19, 0.65), fur, 0, -0.08, 0.015)
      part(knee, pebble(cub ? 0.22 : 0.235, 0.14, 0.285, 0.7), fur,
        0, -(hipY - (cub ? 0.27 : 0.35) - 0.14), 0.068, "round paw")
      // Sole pads show when kicking/swiping; no claws on these friendly bears.
      const pawY = -(hipY - (cub ? 0.27 : 0.35))
      part(knee, pebble(0.12, 0.018, 0.14), shade, 0, pawY + 0.02, 0.078)
      for (const toe of [-1, 0, 1]) {
        part(knee, pebble(0.026, 0.041, 0.009), cream, toe * 0.075, pawY + 0.16, 0.309)
      }
    }
    batchStaticParts(this.motion, new Set([this.mouth]))
  }
}
