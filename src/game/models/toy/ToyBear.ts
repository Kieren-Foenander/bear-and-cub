import * as THREE from "three"
import type { BearAnimState, BearLook, BearStyle, BearStyleModel } from "../types.ts"
import { ToyRig } from "./rig.ts"

// Pose channels, blended in reusable buffers so animate() never allocates.
const enum P {
  Y, Z, Pitch, Yaw, Roll, ScaleX, ScaleY, ScaleZ,
  HeadY, HeadPitch, HeadYaw, HeadRoll, EyeX, Mouth, Blink, Happy,
  EarLeft, EarRight, EarBack, Tail, Scarf,
  Swing, Splay = Swing + 4, Lift = Splay + 4, Stretch = Lift + 4,
  Count = Stretch + 4
}

const TAU = Math.PI * 2
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
const smooth = (n: number): number => { const t = clamp01(n); return t * t * (3 - 2 * t) }
/** Attack, hold, release: zero at both ends, so retriggers never pop. */
const envelope = (t: number, duration: number, attack: number, release: number): number =>
  t < 0 ? 0 : smooth(t / attack) * smooth((duration - t) / release)

/** Where Cub glances while idling (radians of head yaw), cycled on a lazy timer. */
const GLANCES = [0, 0.42, 0.05, -0.36, 0.2, -0.12, 0.5, -0.45]

const SWIPE = 0.36
const CHEER = 1.35
const CELEBRATE = 2.1
const SHAKE = 0.85
/** One dance bar: two hops and one side-to-side sway. */
const BAR = 1.05

/** Chunky vinyl-toy bear: bobble head, bean body, stubby legs, lots of squash and stretch. */
export class ToyBear implements BearStyleModel {
  readonly root: THREE.Object3D = new THREE.Group()
  private readonly rig: ToyRig
  private readonly target = new Float64Array(P.Count)
  private readonly pose = new Float64Array(P.Count)
  private readonly rates = new Float64Array(P.Count)
  private readonly flightAxis = new THREE.Vector3(0, 0, 1)
  private readonly flightRotation = new THREE.Quaternion()
  private readonly restRotation = new THREE.Quaternion()
  private readonly flightCurrent = new THREE.Quaternion()
  private readonly extraRotation = new THREE.Quaternion()
  private readonly euler = new THREE.Euler()
  private flightAngle = 0
  private wasFlying = false
  private time = 0
  private phase = 0
  private idleTime = 0
  private stride = 0
  private sit = 0
  private carried = 0
  private flying = 0
  private air = 0
  private stretch = 0
  private squash = 0
  private squashVelocity = 0
  private swipeTime = -1
  private cheerTime = -1
  private celebrateTime = -1
  private danceIn = 0
  private shakeTime = -1
  private blinkTime = -1
  private blinkWait: number
  private glance = 0
  private glanceWait = 2
  private spin = 0
  private spinCarry = 0
  private lastYaw = 0
  private turn = 0
  private hat: THREE.Object3D | null = null

  constructor(look: BearLook, scale: number) {
    this.root.name = look.kind === "mama" ? "Mama Bear" : "Cub"
    this.root.scale.setScalar(scale)
    this.rig = new ToyRig(this.root, look)
    this.time = this.rig.cub ? 1.7 : 0
    this.blinkWait = this.rig.cub ? 2.3 : 3.6
    this.glanceWait = this.rig.cub ? 1.2 : 2.6
    this.pose[P.ScaleX] = this.pose[P.ScaleY] = this.pose[P.ScaleZ] = 1
    for (let i = 0; i < P.Count; i++) {
      this.rates[i] = i >= P.Swing ? 30 : i === P.Pitch ? 22 : i === P.Blink || i === P.Happy ? 40 : i === P.HeadYaw || i === P.EyeX ? 9 : i >= P.HeadY ? 20 : 15
    }
  }

  land(strength: number): void {
    // Kick the squash spring; it overshoots into a little stretch on the way back.
    this.squashVelocity = Math.max(this.squashVelocity, clamp01(strength) * 9)
  }

  cheer(): void { this.cheerTime = 0; this.idleTime = 0 }
  swipe(): void { this.swipeTime = 0; this.idleTime = 0 }
  celebrate(): void {
    // A retrigger mid-twirl finishes the turn forwards instead of snapping back.
    this.spinCarry = this.spin % TAU
    // Mid-dance, rewind to the same point in the beat so the hops never stutter.
    this.celebrateTime = this.celebrateTime >= 0 ? this.celebrateTime % BAR : 0
    this.idleTime = 0
  }
  shake(): void { this.shakeTime = 0; this.idleTime = 0 }

  /** Hats are built for ~0.45-radius heads; the toy's big round head needs them a size up. */
  wear(hat: THREE.Object3D | null): void {
    if (this.hat) this.rig.head.remove(this.hat)
    this.hat = hat
    if (!hat) return
    const size = this.rig.dims.headSize
    hat.position.set(0, size[1] * 0.86, -size[2] * 0.08)
    hat.rotation.x = -0.12
    hat.scale.setScalar(size[0] / 0.46)
    hat.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true
    })
    this.rig.head.add(hat)
  }

  animate(dt: number, state: BearAnimState): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    dt = Math.min(dt, 0.05)
    this.time += dt
    const t = this.time
    const cub = this.rig.cub
    const response = 1 - Math.exp(-dt * 10)
    const speed = clamp01(state.speed / Math.max(0.001, state.maxSpeed))
    this.stride = mix(this.stride, speed, response)
    const stride = this.stride
    const moving = stride > 0.025
    const action = this.cheerTime >= 0 || this.swipeTime >= 0 || this.celebrateTime >= 0 || this.shakeTime >= 0
    this.idleTime = state.grounded && !state.carried && !state.flying && !moving && !action ? this.idleTime + dt : 0
    this.sit = mix(this.sit, smooth((this.idleTime - 8) / 1.2), 1 - Math.exp(-dt * 5))
    this.carried = mix(this.carried, state.carried ? 1 : 0, response)
    this.flying = mix(this.flying, state.flying ? 1 : 0, response)
    this.air = mix(this.air, !state.grounded && !state.carried ? 1 : 0, response)
    this.stretch = mix(this.stretch, Math.max(-1, Math.min(1, state.verticalVelocity / 7)) * this.air, response)

    // Squash spring (positive = squashed, negative = stretched).
    this.squashVelocity += (-260 * this.squash - 13 * this.squashVelocity) * dt
    this.squash += this.squashVelocity * dt
    const squash = this.squash

    // Bouncy toy gait: quicker little steps than a real bear.
    this.phase = (this.phase + dt * (4 + stride * 11)) % (TAU * 64)

    let yawDelta = (this.root.rotation.y - this.lastYaw) % TAU
    if (yawDelta > Math.PI) yawDelta -= TAU
    if (yawDelta < -Math.PI) yawDelta += TAU
    this.lastYaw = this.root.rotation.y
    this.turn = mix(this.turn, Math.max(-0.18, Math.min(0.18, yawDelta / dt * 0.02)) * stride, response)

    if (this.swipeTime >= 0 && (this.swipeTime += dt) > SWIPE) this.swipeTime = -1
    if (this.cheerTime >= 0 && (this.cheerTime += dt) > CHEER) this.cheerTime = -1
    if (this.celebrateTime >= 0 && (this.celebrateTime += dt) > CELEBRATE) this.celebrateTime = -1
    if (this.shakeTime >= 0 && (this.shakeTime += dt) > SHAKE) this.shakeTime = -1
    this.blinkWait -= dt
    if (this.blinkWait <= 0 && this.blinkTime < 0) {
      this.blinkTime = 0
      // Now and then a double blink, which reads as extra cute.
      this.blinkWait = Math.sin(t * 2.9) > 0.55 ? 0.32 : 2.6 + (Math.sin(t * 1.37) + 1) * 1.2
    }
    if (this.blinkTime >= 0 && (this.blinkTime += dt) > 0.16) this.blinkTime = -1
    this.glanceWait -= dt
    if (this.glanceWait <= 0) {
      this.glance = (this.glance + 1) % GLANCES.length
      this.glanceWait = 1.6 + (Math.sin(t * 0.77) + 1) * 1.3
    }

    const p = this.target
    p.fill(0)
    const breathe = Math.sin(t * 2.2)
    const locomotion = (1 - this.carried) * (1 - this.flying) * (1 - this.air) * (1 - this.sit)
    const gait = stride * locomotion
    const run = smooth((stride - 0.45) / 0.45)
    const still = 1 - smooth(stride * 3)

    // Every step is a little hop; running turns it into a proper bound.
    const hop = Math.abs(Math.sin(this.phase))
    p[P.Y] = hop * mix(0.05, 0.16, run) * gait
    p[P.ScaleY] = 1 + breathe * 0.016 * still + (hop - 0.5) * mix(0.06, 0.14, run) * gait
    p[P.ScaleX] = 1 - (hop - 0.5) * mix(0.03, 0.06, run) * gait
    p[P.ScaleZ] = 1 + breathe * 0.006 * still
    p[P.Roll] = Math.sin(this.phase) * gait * mix(0.06, 0.02, run) - this.turn
    p[P.Pitch] = Math.sin(this.phase * 2) * gait * mix(0.02, 0.07, run) - run * gait * 0.04
    p[P.HeadY] = breathe * 0.008 * still - hop * 0.03 * gait
    p[P.HeadPitch] = breathe * 0.02 * still + Math.cos(this.phase * 2) * gait * mix(0.05, 0.09, run)
    p[P.HeadRoll] = Math.sin(t * 0.7) * 0.05 * still + Math.sin(this.phase) * 0.06 * gait
    p[P.HeadYaw] = GLANCES[this.glance]! * still * (cub ? 1 : 0.7) + this.turn * 1.4
    p[P.EyeX] = GLANCES[this.glance]! * still * 0.05
    p[P.EarLeft] = Math.pow(Math.max(0, Math.sin(t * 0.93)), 30) * Math.sin(t * 34) * 0.32 + Math.sin(this.phase * 2) * 0.08 * gait
    p[P.EarRight] = Math.pow(Math.max(0, Math.sin(t * 0.71 + 2)), 30) * Math.sin(t * 31) * 0.3 - Math.sin(this.phase * 2) * 0.08 * gait
    p[P.EarBack] = run * gait * 0.25
    p[P.Tail] = Math.sin(t * (cub ? 7 : 5)) * (0.12 + gait * 0.25)
    p[P.Scarf] = 0.15 + Math.sin(this.phase * 2 + 0.7) * (0.06 + gait * 0.3) + run * gait * 0.5
    p[P.Blink] = this.blinkTime >= 0 ? Math.sin(Math.PI * this.blinkTime / 0.16) : 0

    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      // Walk: diagonal pairs. Run: front and hind pairs bound together.
      const walkSwing = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI))
      const runSwing = Math.sin(this.phase + (front ? 0 : Math.PI * 0.8) + (side > 0 ? 0.25 : 0))
      const swing = mix(walkSwing, runSwing, run)
      p[P.Swing + i] = swing * mix(0.55, 0.85, run) * gait
      p[P.Lift + i] = Math.max(0, -Math.cos(this.phase + (i === 0 || i === 3 ? 0 : Math.PI))) * 0.05 * gait * (1 - run)
      // In the air: reach on the way up, tuck into a ball on the way down.
      const rising = clamp01(this.stretch)
      const falling = clamp01(-this.stretch)
      const airLeg = front ? -0.7 * rising - 0.25 + 0.6 * falling : 0.75 * rising + 0.2 - 0.55 * falling
      p[P.Swing + i] = mix(p[P.Swing + i]!, airLeg, this.air)
      p[P.Splay + i] = side * this.air * 0.12
      p[P.Stretch + i] = this.air * rising * 0.12
    }
    // Rising stretches tall and thin; falling tucks a little round.
    p[P.ScaleY] += this.stretch * 0.12
    p[P.ScaleX] -= this.stretch * 0.05
    p[P.ScaleZ] -= this.stretch * 0.03
    p[P.EarBack] += clamp01(this.stretch) * 0.35 * this.air
    p[P.Scarf] += clamp01(this.stretch) * 0.8 * this.air

    // Teddy-bear sit: rock back onto the bottom, hind legs straight out, soles showing.
    const sit = Math.max(this.sit, this.carried)
    p[P.Pitch] = mix(p[P.Pitch]!, cub ? -0.55 : -0.5, sit)
    p[P.Y] -= sit * (cub ? 0.3 : 0.33)
    p[P.Z] -= sit * 0.04
    p[P.HeadPitch] += sit * 0.38
    p[P.HeadY] += sit * 0.02
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      p[P.Swing + i] = mix(p[P.Swing + i]!, front ? 0.25 : -1.4, sit)
      p[P.Splay + i] = mix(p[P.Splay + i]!, side * (front ? 0.12 : 0.28), sit)
      p[P.Lift + i] = mix(p[P.Lift + i]!, front ? (cub ? 0 : -0.06) : 0.2, sit)
    }
    // Riding on Mama's back: legs dangle over her sides and kick, paws pat, head looks around.
    const ride = this.carried
    p[P.Y] -= ride * 0.23
    p[P.Pitch] += ride * 0.22
    p[P.HeadYaw] += ride * Math.sin(t * 1.3) * 0.35
    p[P.HeadRoll] += ride * Math.sin(t * 1.9) * 0.1
    p[P.Mouth] += ride * (0.25 + Math.max(0, Math.sin(t * 1.1)) * 0.3)
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      p[P.Splay + i] += ride * side * (front ? 0.35 : 0.55)
      p[P.Swing + i] += ride * (front
        ? -0.9 + Math.sin(t * 7 + i * 2.1) * 0.35
        : 0.55 + Math.sin(t * 8 + i * Math.PI) * 0.4)
    }
    // Cub's sleepy yawn once she's settled.
    const yawn = cub ? envelope(this.idleTime - 10.5, 2.3, 0.5, 0.7) : 0
    p[P.Mouth] = Math.max(p[P.Mouth]!, yawn)
    p[P.HeadPitch] -= yawn * 0.25
    p[P.Blink] = Math.max(p[P.Blink]!, yawn * 0.85)
    p[P.EarBack] += yawn * 0.3

    // Thrown: delighted spread-eagle, barrel-rolling around the body centre.
    if (state.flying && !this.wasFlying) this.flightAngle = 0
    if (state.flying) this.flightAngle = (this.flightAngle + dt * 4.2) % TAU
    this.wasFlying = state.flying
    const flight = this.flying
    p[P.Pitch] = mix(p[P.Pitch]!, -0.2 + Math.sin(t * 5) * 0.15, flight)
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, -0.2, flight)
    p[P.Mouth] = mix(p[P.Mouth]!, 0.9, flight)
    p[P.Happy] = Math.max(p[P.Happy]!, flight)
    p[P.EarBack] += flight * 0.4
    p[P.Scarf] = mix(p[P.Scarf]!, 1.1 + Math.sin(t * 13) * 0.25, flight)
    p[P.Tail] += flight * Math.sin(t * 15) * 0.3
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      p[P.Swing + i] = mix(p[P.Swing + i]!, (front ? -0.6 : 0.6) + Math.sin(t * 9 + i * 1.7) * 0.18, flight)
      p[P.Splay + i] = mix(p[P.Splay + i]!, side * 1.25, flight)
      p[P.Stretch + i] = mix(p[P.Stretch + i]!, 0.15, flight)
    }

    // Cheer: rock back on the hind paws, paws up, big happy roar.
    const cheer = envelope(this.cheerTime, CHEER, 0.2, 0.35)
    const roar = envelope(this.cheerTime - 0.15, CHEER - 0.15, 0.12, 0.3)
    // Celebrate: four happy hops, a twirl on the third, ta-da on the last.
    const ct = this.celebrateTime
    this.danceIn = ct >= 0 ? Math.min(1, this.danceIn + dt / 0.15) : 0
    const dance = smooth(this.danceIn) * envelope(ct, CELEBRATE, 1e-3, 0.3)
    const hopBeat = ct >= 0 ? Math.abs(Math.sin(TAU * ct / BAR)) : 0
    const tada = smooth((ct - 1.6) / 0.15)
    const rear = Math.max(cheer, dance * 0.6)
    p[P.Pitch] = mix(p[P.Pitch]!, -0.85, rear)
    p[P.Y] = mix(p[P.Y]!, 0.03, rear) + dance * hopBeat * 0.3
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, 0.45 - roar * 0.25, rear)
    p[P.HeadRoll] += dance * Math.sin(ct * TAU / BAR) * 0.22 + cheer * Math.sin(this.cheerTime * 18) * 0.05
    p[P.Roll] += dance * Math.sin(ct * TAU / BAR) * 0.12
    p[P.Mouth] = Math.max(p[P.Mouth]!, roar, dance * 0.75)
    p[P.Happy] = Math.max(p[P.Happy]!, dance, smooth((this.cheerTime - 0.5) / 0.1) * cheer)
    p[P.EarBack] += rear * 0.2
    p[P.Tail] += dance * Math.sin(ct * TAU * 4 / BAR) * 0.4
    p[P.Scarf] += dance * hopBeat * 0.6
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      if (front) {
        const wave = dance * Math.sin(ct * TAU * 2 / BAR + i * Math.PI) * 0.45 * (1 - tada) + cheer * Math.sin(this.cheerTime * 16 + i * Math.PI) * 0.2
        p[P.Swing + i] = mix(p[P.Swing + i]!, mix(-1.5, -2.3, tada * dance) + wave, rear)
        p[P.Splay + i] = mix(p[P.Splay + i]!, side * mix(0.45, 0.9, tada * dance), rear)
        p[P.Stretch + i] = mix(p[P.Stretch + i]!, 0.15, rear)
      } else {
        p[P.Swing + i] = mix(p[P.Swing + i]!, 0.2 - hopBeat * dance * 0.3, rear)
        p[P.Splay + i] = mix(p[P.Splay + i]!, side * 0.12, rear)
      }
    }
    this.spin = ct >= 0 ? mix(this.spinCarry, TAU, smooth((ct - BAR) / 0.5)) : 0
    if (ct < 0) this.spinCarry = 0

    // Swipe: tiny wind-up, then the front-right paw arcs high and forward, stretching like vinyl.
    const st = this.swipeTime
    const swipe = envelope(st, SWIPE, 0.05, 0.12)
    const strike = smooth((st - 0.04) / 0.09)
    const windup = st >= 0 ? smooth(st / 0.04) * (1 - strike) : 0
    // The big head would hide a normal reach, so she rocks back and the paw stretches up past it.
    p[P.Swing + 1] = mix(p[P.Swing + 1]!, mix(0.6, cub ? -2.25 : -2.4, strike), swipe)
    p[P.Splay + 1] = mix(p[P.Splay + 1]!, mix(0.15, cub ? 0.56 : 0.5, strike), swipe)
    p[P.Stretch + 1] = mix(p[P.Stretch + 1]!, strike * (cub ? 2.0 : 1.45), swipe)
    p[P.Lift + 1] += swipe * strike * (cub ? 0.55 : 0.44)
    p[P.Swing + 0] = mix(p[P.Swing + 0]!, -0.6, swipe * 0.7)
    p[P.Pitch] -= swipe * (strike * (cub ? 0.7 : 0.5) - windup * 0.08)
    p[P.Y] += swipe * strike * 0.05
    p[P.Roll] -= swipe * 0.1
    p[P.ScaleY] -= windup * 0.08
    p[P.HeadRoll] -= swipe * strike * (cub ? 0.34 : 0.22)
    p[P.HeadYaw] += swipe * 0.12
    p[P.HeadPitch] += swipe * strike * 0.2
    p[P.EarBack] += swipe * strike * 0.3
    p[P.Mouth] = Math.max(p[P.Mouth]!, swipe * strike * 0.6)

    // Shake: squint while the wobble itself is layered on after smoothing (see below).
    const shake = envelope(this.shakeTime, SHAKE, 0.12, 0.25)
    p[P.Happy] = Math.max(p[P.Happy]!, shake)
    p[P.EarBack] += shake * 0.2

    // Landing squash (and the springy overshoot) on top of everything.
    p[P.ScaleY] -= squash * 0.55
    p[P.ScaleX] += squash * 0.32
    p[P.ScaleZ] += squash * 0.2
    p[P.HeadY] -= squash * 0.12
    p[P.EarLeft] += squash * 0.5
    p[P.EarRight] += squash * 0.5

    for (let i = 0; i < P.Count; i++) {
      this.pose[i] = mix(this.pose[i]!, p[i]!, 1 - Math.exp(-dt * this.rates[i]!))
    }
    // Squash is already a spring, so it bypasses the smoothing to keep its snap.
    this.pose[P.ScaleY] += (p[P.ScaleY]! - this.pose[P.ScaleY]!) * 0.65
    this.pose[P.ScaleX] += (p[P.ScaleX]! - this.pose[P.ScaleX]!) * 0.65
    this.pose[P.ScaleZ] += (p[P.ScaleZ]! - this.pose[P.ScaleZ]!) * 0.65

    // Flight roll, celebration twirl and the wet-dog twist share the body-centre pivot.
    this.flightRotation.setFromAxisAngle(this.flightAxis, this.flightAngle).slerp(this.restRotation, 1 - this.flying)
    this.flightCurrent.slerp(this.flightRotation, response)
    const wobble = Math.sin(Math.max(0, this.shakeTime) * 48) * shake
    this.extraRotation.setFromEuler(this.euler.set(0, this.spin, wobble * 0.32))
    this.rig.tumble.quaternion.multiplyQuaternions(this.flightCurrent, this.extraRotation)
    this.applyPose(wobble, shake)
  }

  private applyPose(wobble: number, shake: number): void {
    const p = this.pose
    const rig = this.rig
    const d = rig.dims
    rig.motion.position.set(rig.pivot[0], rig.pivot[1] + p[P.Y]!, rig.pivot[2] + p[P.Z]!)
    rig.motion.rotation.set(p[P.Pitch]!, p[P.Yaw]!, p[P.Roll]!)
    rig.motion.scale.set(Math.max(0.3, p[P.ScaleX]!), Math.max(0.3, p[P.ScaleY]!), Math.max(0.3, p[P.ScaleZ]!))
    rig.head.position.set(d.head[0], d.head[1] + p[P.HeadY]!, d.head[2])
    rig.head.rotation.set(p[P.HeadPitch]!, p[P.HeadYaw]! - wobble * 0.5, p[P.HeadRoll]! + wobble * 0.3)
    const happy = clamp01(p[P.Happy]!)
    const open = Math.max(0.06, 1 - clamp01(p[P.Blink]!) * 1.05)
    const eyes = open * (1 - smooth(happy * 1.6))
    rig.eyes.scale.set(1, Math.max(0.001, eyes), 1)
    rig.eyes.visible = eyes > 0.03
    rig.eyes.position.x = p[P.EyeX]!
    const closed = smooth((happy - 0.35) * 1.6)
    rig.happyEyes.scale.set(1, Math.max(0.001, closed), 1)
    rig.happyEyes.visible = closed > 0.03
    const mouth = clamp01(p[P.Mouth]!)
    rig.mouth.scale.set(0.55 + mouth * 0.45, Math.max(0.001, mouth), 0.6 + mouth * 0.4)
    rig.mouth.visible = mouth > 0.03
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const flap = Math.sin(Math.max(0, this.shakeTime) * 48 + side) * shake * 0.6
      rig.ears[i]!.rotation.set(-p[P.EarBack]!, 0, -side * rig.earTilt - side * p[P.EarLeft + i]! + flap)
    }
    rig.tail.rotation.set(0.2, p[P.Tail]! + wobble * 0.8, 0)
    rig.scarfTail.rotation.set(p[P.Scarf]!, 0, 0.1 + wobble * 0.6)
    for (let i = 0; i < 4; i++) {
      const leg = rig.legs[i]!
      leg.rotation.set(p[P.Swing + i]!, 0, p[P.Splay + i]!)
      leg.position.y = d.hipY + p[P.Lift + i]!
      const stretch = 1 + p[P.Stretch + i]!
      const thin = Math.pow(stretch, -0.3)
      leg.scale.set(thin, stretch, thin)
    }
  }
}

/** Chunky vinyl toy: big glossy eyes, bobble head, bean body. */
export const toyStyle: BearStyle = {
  id: "toy",
  label: "Toy",
  create: (look, scale) => new ToyBear(look, scale)
}
