import * as THREE from "three"
import type { BearAnimState, BearLook, BearStyle, BearStyleModel } from "../types.ts"
import { BearRig } from "./rig.ts"

// Pose buffers avoid creating vectors, arrays or temporary objects each frame.
const enum P {
  Y, Z, Pitch, Yaw, Roll, ScaleX, ScaleY, ScaleZ,
  HeadPitch, HeadYaw, HeadRoll, Mouth, Blink, EarLeft, EarRight, Tail, Scarf,
  FrontLeft, FrontRight, HindLeft, HindRight,
  SplayFrontLeft, SplayFrontRight, SplayHindLeft, SplayHindRight,
  KneeFrontLeft, KneeFrontRight, KneeHindLeft, KneeHindRight,
  LiftFrontLeft, LiftFrontRight, LiftHindLeft, LiftHindRight,
  Count
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
const smooth = (n: number): number => { const t = clamp01(n); return t * t * (3 - 2 * t) }
/** Attack, short hold, release; reaches zero at both ends, including retriggers. */
const envelope = (t: number, duration: number, attack: number, release: number): number =>
  t < 0 ? 0 : smooth(t / attack) * smooth((duration - t) / release)

/** A layered quadruped rig. Only `root` belongs to the game; all motion is local. */
export class ClassicBear implements BearStyleModel {
  readonly root: THREE.Object3D = new THREE.Group()
  private readonly rig: BearRig
  private readonly target = new Float64Array(P.Count)
  private readonly pose = new Float64Array(P.Count)
  private readonly flightAxis = new THREE.Vector3(0, 0, 1)
  private readonly flightRotation = new THREE.Quaternion()
  private readonly restRotation = new THREE.Quaternion()
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
  private squashTarget = 0
  private swipeTime = -1
  private cheerTime = -1
  private celebrateTime = -1
  private shakeTime = -1
  private blinkTime = -1
  private blinkWait: number
  private lastYaw = 0
  private turn = 0

  constructor(look: BearLook, scale: number) {
    this.root.name = look.kind === "mama" ? "Mama Bear" : "Cub"
    this.root.scale.setScalar(scale)
    this.rig = new BearRig(this.root, look)
    // Slightly offset rhythms: the family never blinks in perfect synchrony.
    this.time = this.rig.cub ? 1.7 : 0
    this.blinkWait = this.rig.cub ? 2.7 : 4.1
    this.pose[P.ScaleX] = this.pose[P.ScaleY] = this.pose[P.ScaleZ] = 1
  }

  land(strength: number): void {
    this.squashTarget = Math.max(this.squashTarget, clamp01(strength))
  }

  cheer(): void { this.cheerTime = 0; this.idleTime = 0 }
  swipe(): void { this.swipeTime = 0; this.idleTime = 0 }
  celebrate(): void { this.celebrateTime = 0; this.idleTime = 0 }
  shake(): void { this.shakeTime = 0; this.idleTime = 0 }

  private hat: THREE.Object3D | null = null

  /** Pop a hat on (or take it off with null). The hat is built at head scale and sits on top of the head. */
  wear(hat: THREE.Object3D | null): void {
    if (this.hat) this.rig.head.remove(this.hat)
    this.hat = hat
    if (!hat) return
    hat.position.set(0, this.rig.cub ? 0.44 : 0.4, -0.04)
    hat.rotation.x = -0.15
    hat.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true
    })
    this.rig.head.add(hat)
  }

  animate(dt: number, state: BearAnimState): void {
    // Ignore invalid time and bound suspended-tab catch-up, so poses stay finite.
    if (!Number.isFinite(dt) || dt <= 0) return
    dt = Math.min(dt, 0.05)
    this.time += dt
    const t = this.time
    const response = 1 - Math.exp(-dt * 12)
    const speed = clamp01(state.speed / Math.max(0.001, state.maxSpeed))
    this.stride = mix(this.stride, speed, response)
    const stride = this.stride
    const moving = stride > 0.025
    const action = this.cheerTime >= 0 || this.swipeTime >= 0 || this.celebrateTime >= 0 || this.shakeTime >= 0
    this.idleTime = state.grounded && !state.carried && !state.flying && !moving && !action ? this.idleTime + dt : 0
    this.sit = mix(this.sit, smooth((this.idleTime - 8) / 1.2), 1 - Math.exp(-dt * 5))
    this.carried = mix(this.carried, state.carried ? 1 : 0, response)
    this.flying = mix(this.flying, state.flying ? 1 : 0, response)
    if (state.flying && !this.wasFlying) this.flightAngle = 0
    if (state.flying) this.flightAngle = (this.flightAngle + dt * 3.6) % (Math.PI * 2)
    this.wasFlying = state.flying
    this.flightRotation.setFromAxisAngle(this.flightAxis, this.flightAngle)
      .slerp(this.restRotation, 1 - this.flying)
    this.rig.tumble.quaternion.slerp(this.flightRotation, response)
    this.air = mix(this.air, !state.grounded && !state.carried ? 1 : 0, response)
    this.stretch = mix(this.stretch, clamp01(state.verticalVelocity / 7) * this.air, response)
    this.squash = mix(this.squash, this.squashTarget, 1 - Math.exp(-dt * 32))
    this.squashTarget *= Math.exp(-dt * 9)
    this.phase += dt * (3.2 + stride * 12)

    // Read the game-owned yaw, then lean only the inner rig into the turn.
    let yawDelta = (this.root.rotation.y - this.lastYaw) % (Math.PI * 2)
    if (yawDelta > Math.PI) yawDelta -= Math.PI * 2
    if (yawDelta < -Math.PI) yawDelta += Math.PI * 2
    this.lastYaw = this.root.rotation.y
    this.turn = mix(this.turn, Math.max(-0.14, Math.min(0.14, yawDelta / dt * 0.018)) * stride, response)

    if (this.swipeTime >= 0 && (this.swipeTime += dt) > 0.36) this.swipeTime = -1
    if (this.cheerTime >= 0 && (this.cheerTime += dt) > 1.35) this.cheerTime = -1
    if (this.celebrateTime >= 0 && (this.celebrateTime += dt) > 2.1) this.celebrateTime = -1
    if (this.shakeTime >= 0 && (this.shakeTime += dt) > 0.85) this.shakeTime = -1
    this.blinkWait -= dt
    if (this.blinkWait <= 0 && this.blinkTime < 0) {
      this.blinkTime = 0
      this.blinkWait = 3.1 + (Math.sin(t * 1.37) + 1) * 1.1
    }
    if (this.blinkTime >= 0 && (this.blinkTime += dt) > 0.18) this.blinkTime = -1

    const p = this.target
    p.fill(0)
    const breathe = Math.sin(t * 2.4)
    const locomotion = (1 - this.carried) * (1 - this.flying) * (1 - this.air) * (1 - this.sit)
    const gait = stride * locomotion
    const run = smooth((stride - 0.5) / 0.45)
    const bob = (1 - Math.cos(this.phase * 2)) * 0.024 * gait
    p[P.Y] = bob - this.squash * 0.065
    p[P.Roll] = Math.sin(this.phase) * gait * 0.022 - this.turn
    p[P.Pitch] = Math.sin(this.phase * 2) * gait * 0.025
    p[P.ScaleX] = 1 + this.squash * 0.13 - this.stretch * 0.035
    p[P.ScaleY] = 1 + breathe * 0.012 * (1 - gait) - this.squash * 0.19 + this.stretch * 0.1
    p[P.ScaleZ] = 1 + this.squash * 0.08 + breathe * 0.004
    p[P.HeadPitch] = breathe * 0.018 + Math.sin(this.phase * 2 + 0.7) * gait * 0.055
    p[P.HeadYaw] = Math.sin(t * 0.48) * 0.1 * (1 - gait) + this.turn * 0.8
    p[P.HeadRoll] = Math.sin(t * 0.83) * 0.022 * (1 - gait)
    const earTwitch = Math.pow(Math.max(0, Math.sin(t * 0.91)), 22) * Math.sin(t * 29) * 0.13
    p[P.EarLeft] = earTwitch
    p[P.EarRight] = Math.pow(Math.max(0, Math.sin(t * 0.71 + 2)), 24) * Math.sin(t * 27) * 0.11
    p[P.Tail] = Math.sin(t * 4.5) * (0.07 + gait * 0.13)
    p[P.Scarf] = Math.sin(this.phase + 0.7) * (0.03 + gait * 0.21) - this.stretch * 0.22
    p[P.Blink] = this.blinkTime >= 0 ? Math.sin(Math.PI * this.blinkTime / 0.18) : 0

    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      // Walk: diagonal pairs. Run: front/hind pairs bound with a slight offset.
      const walkOffset = i === 0 || i === 3 ? 0 : Math.PI
      const runOffset = (front ? 0 : Math.PI * 0.75) + (side > 0 ? 0.3 : 0)
      const walkSwing = Math.sin(this.phase + walkOffset)
      const runSwing = Math.sin(this.phase + runOffset)
      const swing = mix(walkSwing, runSwing, run)
      p[P.FrontLeft + i] = swing * (0.48 + run * 0.2) * gait
      p[P.LiftFrontLeft + i] = Math.max(0, swing) * 0.09 * gait
      p[P.KneeFrontLeft + i] = Math.max(0, swing) * 0.3 * gait
      // Reach on takeoff, then tuck hind paws and reach front paws as we fall.
      const airLeg = front ? mix(-0.65, -0.95, this.stretch) : mix(0.8, 0.2, this.stretch)
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, airLeg, this.air)
      p[P.KneeFrontLeft + i] += this.air * (front ? 0.2 : -0.45)
    }

    // Sitting: hind paws scoot forward while front paws rest in a relaxed pose.
    const sitting = Math.max(this.sit, this.carried)
    p[P.Y] -= sitting * (this.rig.cub ? 0.074 : 0.11)
    p[P.Y] -= this.carried * 0.28
    p[P.Z] -= sitting * 0.16
    p[P.Pitch] = mix(p[P.Pitch]!, -0.45, sitting)
    p[P.HeadPitch] += sitting * 0.4
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, front ? -0.13 : -0.55, sitting)
      p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, front ? 0.16 : 0.15, sitting)
      p[P.SplayFrontLeft + i] = sitting * (i % 2 === 0 ? -1 : 1) * (front ? 0.16 : 0.24) + this.carried * (i % 2 === 0 ? -1 : 1) * 0.5
    }
    p[P.HeadYaw] += this.carried * Math.sin(t * 1.3) * 0.25
    p[P.HeadRoll] += this.carried * Math.sin(t * 1.7) * 0.075
    p[P.FrontLeft] += this.carried * Math.sin(t * 6) * 0.2
    p[P.FrontRight] += this.carried * Math.sin(t * 6 + 1.8) * 0.2
    p[P.HindLeft] += this.carried * Math.sin(t * 5) * 0.16
    p[P.HindRight] += this.carried * Math.sin(t * 5 + Math.PI) * 0.16
    // Cub's sleepy little yawn occurs after settling, without another timer.
    const yawn = this.rig.cub ? envelope(this.idleTime - 10, 2.3, 0.5, 0.7) : 0
    p[P.Mouth] = yawn * 0.72
    p[P.HeadPitch] -= yawn * 0.16
    p[P.Blink] = Math.max(p[P.Blink]!, yawn * 0.65)

    const flight = this.flying
    p[P.Y] += flight * 0.15
    p[P.Pitch] = mix(p[P.Pitch]!, -0.3 + Math.sin(t * 4) * 0.25, flight)
    p[P.Roll] += flight * Math.sin(t * 4.5) * 0.12
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, -0.14, flight)
    p[P.HeadRoll] += flight * Math.sin(t * 5) * 0.1
    p[P.Mouth] = Math.max(p[P.Mouth]!, flight * 0.65)
    for (let i = 0; i < 4; i++) {
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, -0.25 + Math.sin(t * 7 + i) * 0.15, flight)
      p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, (i % 2 === 0 ? -1 : 1) * 1.05, flight)
      p[P.KneeFrontLeft + i] *= 1 - flight
    }

    const cheer = envelope(this.cheerTime, 1.35, 0.22, 0.38)
    const dance = envelope(this.celebrateTime, 2.1, 0.16, 0.3)
    const rear = Math.max(cheer, dance * 0.85)
    p[P.Pitch] = mix(p[P.Pitch]!, -0.85, rear)
    p[P.Y] += rear * 0.055 + dance * Math.abs(Math.sin(this.celebrateTime * 10)) * 0.2
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, 0.28, rear)
    p[P.HeadYaw] += dance * Math.sin(this.celebrateTime * 9) * 0.25
    p[P.Roll] += dance * Math.sin(this.celebrateTime * 9) * 0.14
    p[P.Mouth] = Math.max(p[P.Mouth]!, rear * 0.95)
    for (let i = 0; i < 2; i++) {
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, -0.65 - dance * Math.sin(this.celebrateTime * 11 + i * Math.PI) * 0.6, rear)
      p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, (i === 0 ? -1 : 1) * 0.45, rear)
      p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, -0.4, rear)
    }

    // A fast anticipation then a high, forward paw arc, readable in midair.
    const swipe = envelope(this.swipeTime, 0.36, 0.055, 0.12)
    const swipeArc = smooth((this.swipeTime - 0.035) / 0.1)
    p[P.FrontRight] = mix(p[P.FrontRight]!, mix(0.35, -2.85, swipeArc), swipe)
    p[P.KneeFrontRight] = mix(p[P.KneeFrontRight]!, -0.08, swipe)
    p[P.SplayFrontRight] = mix(p[P.SplayFrontRight]!, 0.17, swipe)
    p[P.LiftFrontRight] += swipe * (this.rig.cub ? 0.35 : 0.18)
    p[P.HeadPitch] -= swipe * 0.18
    p[P.Roll] -= swipe * 0.08

    const shake = envelope(this.shakeTime, 0.85, 0.08, 0.2)
    const shiver = Math.sin(this.shakeTime * 55) * shake
    p[P.Yaw] += shiver * 0.14
    p[P.Roll] += shiver * 0.09
    p[P.HeadYaw] -= shiver * 0.26
    p[P.EarLeft] += Math.sin(this.shakeTime * 55 - 0.5) * shake * 0.32
    p[P.EarRight] += Math.sin(this.shakeTime * 55 + 0.5) * shake * 0.32
    p[P.Scarf] += shiver * 0.3
    p[P.Blink] = Math.max(p[P.Blink]!, shake * 0.65)

    for (let i = 0; i < P.Count; i++) {
      // Eyelids need the full short blink; the swipe needs a crisp attack.
      const rate = i === P.Blink ? 60 : i >= P.FrontLeft ? 32 : i >= P.HeadPitch ? 24 : 18
      this.pose[i] = mix(this.pose[i]!, p[i]!, 1 - Math.exp(-dt * rate))
    }
    this.applyPose()
  }

  private applyPose(): void {
    const p = this.pose
    const rig = this.rig
    rig.motion.position.y = -0.83 + p[P.Y]!
    rig.motion.position.z = -0.5 + p[P.Z]!
    rig.motion.rotation.set(p[P.Pitch]!, p[P.Yaw]!, p[P.Roll]!)
    rig.motion.scale.set(p[P.ScaleX]!, p[P.ScaleY]!, p[P.ScaleZ]!)
    rig.head.rotation.set(p[P.HeadPitch]!, p[P.HeadYaw]!, p[P.HeadRoll]!)
    rig.jaw.rotation.x = p[P.Mouth]! * 0.72
    rig.mouth.scale.y = 0.12 + p[P.Mouth]! * 1.75
    rig.mouth.position.y = -0.255 - p[P.Mouth]! * 0.055
    for (let i = 0; i < 2; i++) {
      rig.eyes[i]!.scale.y = Math.max(0.055, 1 - p[P.Blink]! * 1.06)
      rig.ears[i]!.rotation.z = (i === 0 ? 0.15 : -0.15) + p[P.EarLeft + i]!
    }
    rig.tail.rotation.y = p[P.Tail]!
    rig.scarfTail.rotation.x = p[P.Scarf]!
    for (let i = 0; i < 4; i++) {
      rig.legs[i]!.rotation.set(p[P.FrontLeft + i]!, 0, p[P.SplayFrontLeft + i]!)
      rig.legs[i]!.position.y = rig.hipHeights[i]! + p[P.LiftFrontLeft + i]!
      rig.knees[i]!.rotation.x = p[P.KneeFrontLeft + i]!
    }
  }
}

/** The first style (by Codex): sculpted, softly faceted procedural rig. */
export const classicStyle: BearStyle = {
  id: "classic",
  label: "Classic",
  create: (look, scale) => new ClassicBear(look, scale)
}
