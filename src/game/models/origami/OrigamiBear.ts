import * as THREE from "three"
import type { BearAnimState, BearLook, BearStyle, BearStyleModel } from "../types.ts"
import { OrigamiRig } from "./rig.ts"

// Pose channels: a target buffer is rebuilt each frame and the live pose eases toward it.
const enum P {
  Y, Z, Pitch, Yaw, Roll, ScaleX, ScaleY, ScaleZ,
  HeadPitch, HeadYaw, HeadRoll, Mouth, Blink, EarLeft, EarRight, EarBack, Tail, Scarf, ScarfSway,
  FrontLeft, FrontRight, HindLeft, HindRight,
  SplayFrontLeft, SplayFrontRight, SplayHindLeft, SplayHindRight,
  KneeFrontLeft, KneeFrontRight, KneeHindLeft, KneeHindRight,
  LiftFrontLeft, LiftFrontRight, LiftHindLeft, LiftHindRight,
  Count
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
const smooth = (n: number): number => { const t = clamp01(n); return t * t * (3 - 2 * t) }
/** Attack, hold, release; zero at both ends so retriggers never pop. */
const envelope = (t: number, duration: number, attack: number, release: number): number =>
  t < 0 ? 0 : smooth(t / attack) * smooth((duration - t) / release)

const EAR_TILT = 0.32

/** Crisp folded-paper bears: big planar facets, vertex-coloured, one mesh per pivot. */
export class OrigamiBear implements BearStyleModel {
  readonly root: THREE.Object3D = new THREE.Group()
  private readonly rig: OrigamiRig
  private readonly target = new Float64Array(P.Count)
  private readonly pose = new Float64Array(P.Count)
  private readonly motionBase = new THREE.Vector3()
  private readonly flightAxis = new THREE.Vector3(0, 0, 1)
  private readonly flightRotation = new THREE.Quaternion()
  private readonly restRotation = new THREE.Quaternion()
  private hat: THREE.Object3D | null = null
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
    this.rig = new OrigamiRig(this.root, look)
    this.motionBase.copy(this.rig.motion.position)
    // Offset rhythms so the family never blinks in unison.
    this.time = this.rig.cub ? 1.7 : 0
    this.blinkWait = this.rig.cub ? 2.7 : 4.1
    this.pose[P.ScaleX] = this.pose[P.ScaleY] = this.pose[P.ScaleZ] = 1
    this.applyPose()
  }

  land(strength: number): void { this.squashTarget = Math.max(this.squashTarget, clamp01(strength)) }
  cheer(): void { this.cheerTime = 0; this.idleTime = 0 }
  swipe(): void { this.swipeTime = 0; this.idleTime = 0 }
  celebrate(): void { this.celebrateTime = 0; this.idleTime = 0 }
  shake(): void { this.shakeTime = 0; this.idleTime = 0 }

  wear(hat: THREE.Object3D | null): void {
    if (this.hat) this.rig.head.remove(this.hat)
    this.hat = hat
    if (!hat) return
    hat.scale.setScalar(1)
    hat.position.copy(this.rig.hatAnchor)
    hat.rotation.x = -0.12
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
    this.flightRotation.setFromAxisAngle(this.flightAxis, this.flightAngle).slerp(this.restRotation, 1 - this.flying)
    this.rig.tumble.quaternion.slerp(this.flightRotation, response)
    this.air = mix(this.air, !state.grounded && !state.carried ? 1 : 0, response)
    this.stretch = mix(this.stretch, clamp01(state.verticalVelocity / 7) * this.air, response)
    this.squash = mix(this.squash, this.squashTarget, 1 - Math.exp(-dt * 32))
    this.squashTarget *= Math.exp(-dt * 9)
    this.phase += dt * (3.4 + stride * 11.5)

    // Read the game-owned yaw and lean only the inner rig into turns.
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
    if (this.blinkTime >= 0 && (this.blinkTime += dt) > 0.16) this.blinkTime = -1

    const p = this.target
    p.fill(0)
    p[P.ScaleX] = p[P.ScaleY] = p[P.ScaleZ] = 1

    // Idle life: breathing, a slow look around, the odd ear flick.
    const breathe = Math.sin(t * 2.3)
    const locomotion = (1 - this.carried) * (1 - this.flying) * (1 - this.air) * (1 - this.sit)
    const gait = stride * locomotion
    const still = 1 - gait
    const run = smooth((stride - 0.5) / 0.45)
    const bob = (1 - Math.cos(this.phase * 2)) * (0.022 + run * 0.03) * gait
    p[P.Y] = bob - this.squash * 0.07
    p[P.Roll] = Math.sin(this.phase) * gait * 0.03 * (1 - run) - this.turn
    p[P.Pitch] = Math.sin(this.phase * 2) * gait * (0.02 + run * 0.035)
    p[P.ScaleX] = 1 + this.squash * 0.14 - this.stretch * 0.04
    p[P.ScaleY] = 1 + breathe * 0.014 * still - this.squash * 0.2 + this.stretch * 0.1
    p[P.ScaleZ] = 1 + this.squash * 0.08 + breathe * 0.005
    const glance = Math.sin(t * 0.47) + Math.sin(t * 0.19 + 1) * 0.6
    p[P.HeadPitch] = breathe * 0.02 * still + Math.sin(this.phase * 2 + 0.8) * gait * (0.05 + run * 0.04)
    p[P.HeadYaw] = Math.max(-1, Math.min(1, glance)) * 0.22 * still + this.turn * 0.9
    p[P.HeadRoll] = Math.sin(t * 0.83) * 0.04 * still
    p[P.EarLeft] = Math.pow(Math.max(0, Math.sin(t * 0.91)), 22) * Math.sin(t * 29) * 0.2
    p[P.EarRight] = Math.pow(Math.max(0, Math.sin(t * 0.71 + 2)), 24) * Math.sin(t * 27) * 0.18
    p[P.EarBack] = run * gait * 0.35 + this.squash * 0.4 + this.air * 0.25
    p[P.Tail] = Math.sin(t * 4.5) * (0.12 + gait * 0.2)
    p[P.Scarf] = 0.15 + gait * (0.35 + run * 0.45) + this.air * 0.4 - this.stretch * 0.25 + Math.sin(this.phase + 0.7) * (0.05 + gait * 0.15)
    p[P.ScarfSway] = Math.sin(t * 1.6) * 0.06 + Math.sin(this.phase * 2) * gait * 0.18
    p[P.Blink] = this.blinkTime >= 0 ? Math.sin(Math.PI * this.blinkTime / 0.16) : 0

    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      // Walk: diagonal pairs. Run: a bounding gait, front and hind pairs nearly together.
      const walkOffset = i === 0 || i === 3 ? 0 : Math.PI
      const runOffset = (front ? 0 : Math.PI * 0.8) + (side > 0 ? 0.35 : 0)
      const swing = mix(Math.sin(this.phase + walkOffset), Math.sin(this.phase + runOffset), run)
      const reach = Math.cos(this.phase + mix(walkOffset, runOffset, run))
      p[P.FrontLeft + i] = swing * (0.5 + run * 0.25) * gait
      // Paws lift while swinging forward, so they never drag.
      const lifting = Math.max(0, -reach) * gait
      p[P.LiftFrontLeft + i] = lifting * (0.06 + run * 0.05)
      p[P.KneeFrontLeft + i] = lifting * (front ? -0.55 : 0.6) * (0.8 + run * 0.4)
      // Takeoff reaches, then the hind paws tuck and the front paws reach for the ground.
      const airLeg = front ? mix(-0.5, -0.95, this.stretch) : mix(0.75, 0.25, this.stretch)
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, airLeg, this.air)
      p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, front ? -0.35 + this.stretch * 0.3 : 0.55, this.air)
    }

    // Sitting: the rump drops, hind paws scoot forward, front paws stay straight and tidy.
    p[P.Y] -= this.sit * (cub ? 0.18 : 0.27)
    p[P.Pitch] = mix(p[P.Pitch]!, -0.42, this.sit)
    p[P.HeadPitch] += this.sit * 0.36
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, front ? 0.42 : (cub ? -0.8 : -1.0), this.sit)
      p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, front ? 0 : (cub ? 0.3 : 0.55), this.sit)
      p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, (i % 2 === 0 ? -1 : 1) * (front ? 0.06 : 0.22), this.sit)
    }

    // Riding on Mama: sat on her back, legs dangling either side and kicking happily.
    const carried = this.carried
    p[P.Y] -= carried * (cub ? 0.62 : 0.7)
    p[P.Pitch] = mix(p[P.Pitch]!, -0.3, carried)
    p[P.HeadPitch] += carried * (0.22 + Math.sin(t * 2.6) * 0.06)
    p[P.HeadYaw] += carried * Math.sin(t * 1.3) * 0.3
    p[P.HeadRoll] += carried * Math.sin(t * 1.7) * 0.09
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      const side = i % 2 === 0 ? -1 : 1
      const kick = Math.sin(t * (front ? 6 : 5) + (side > 0 ? Math.PI : 0) + (front ? 0.6 : 0))
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, front ? -0.55 + kick * 0.25 : -0.55 + kick * 0.3, carried)
      p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, front ? -0.2 : 0.35 + kick * 0.3, carried)
      p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, side * (front ? 0.45 : 1.0), carried)
    }
    p[P.Scarf] += carried * 0.2

    // Cub's sleepy yawn after settling, with no extra timer.
    const yawn = cub ? envelope(this.idleTime - 10, 2.3, 0.5, 0.7) : 0
    p[P.Mouth] = yawn * 0.85
    p[P.HeadPitch] -= yawn * 0.2
    p[P.Blink] = Math.max(p[P.Blink]!, yawn * 0.75)

    // Thrown: delighted spread-eagle tumble.
    const flight = this.flying
    p[P.Y] += flight * 0.12
    p[P.Pitch] = mix(p[P.Pitch]!, -0.25 + Math.sin(t * 4) * 0.22, flight)
    p[P.Roll] += flight * Math.sin(t * 4.5) * 0.12
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, -0.2, flight)
    p[P.HeadRoll] += flight * Math.sin(t * 5) * 0.12
    p[P.Mouth] = Math.max(p[P.Mouth]!, flight * 0.9)
    p[P.EarBack] += flight * 0.4
    p[P.Scarf] += flight * 0.6
    for (let i = 0; i < 4; i++) {
      const front = i < 2
      p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, (front ? -0.55 : 0.45) + Math.sin(t * 9 + i * 1.7) * 0.18, flight)
      p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, (i % 2 === 0 ? -1 : 1) * 1.0, flight)
      p[P.KneeFrontLeft + i] *= 1 - flight
    }

    // Cheer: rear up onto the hind paws with a happy open-mouthed roar.
    // Celebrate: the same stance, bouncing and waving both paws for a couple of seconds.
    const cheer = envelope(this.cheerTime, 1.35, 0.22, 0.38)
    const dance = envelope(this.celebrateTime, 2.1, 0.18, 0.32)
    const ct = this.celebrateTime
    const rear = Math.max(cheer, dance * 0.85)
    const hop = dance * Math.pow(Math.abs(Math.sin(ct * 8)), 0.8)
    p[P.Pitch] = mix(p[P.Pitch]!, -0.95, rear)
    p[P.Y] += rear * 0.05 + hop * 0.16
    p[P.Z] -= rear * 0.06
    p[P.HeadPitch] = mix(p[P.HeadPitch]!, 0.45, rear)
    p[P.HeadYaw] += dance * Math.sin(ct * 8) * 0.3
    p[P.HeadRoll] += dance * Math.sin(ct * 8) * 0.16 + cheer * Math.sin(this.cheerTime * 14) * 0.05
    p[P.Roll] += dance * Math.sin(ct * 8) * 0.12
    p[P.Yaw] += dance * Math.sin(ct * 4) * 0.25
    p[P.Mouth] = Math.max(p[P.Mouth]!, rear)
    p[P.Blink] = Math.max(p[P.Blink]!, dance * 0.55)
    p[P.EarBack] -= rear * 0.15
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1
      if (i < 2) {
        const wave = dance * Math.sin(ct * 11 + i * Math.PI) * 0.55
        p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, -1.0 - wave - cheer * 0.15, rear)
        p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, side * (0.45 + cheer * 0.2), rear)
        p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, -0.5, rear)
      } else {
        // Hind legs straighten under the raised body so the paws stay planted.
        p[P.FrontLeft + i] = mix(p[P.FrontLeft + i]!, 0.75, rear)
        p[P.KneeFrontLeft + i] = mix(p[P.KneeFrontLeft + i]!, 0, rear)
        p[P.SplayFrontLeft + i] = mix(p[P.SplayFrontLeft + i]!, side * 0.08, rear)
      }
    }

    // Swipe: a quick wind-up, then one front paw lifts from the shoulder and arcs high up and
    // forward, pad first, well above the ears so it reads at the top of a jump.
    const swipe = envelope(this.swipeTime, 0.36, 0.05, 0.12)
    const arc = smooth((this.swipeTime - 0.03) / 0.1)
    p[P.FrontRight] = mix(p[P.FrontRight]!, mix(0.45, -2.7, arc), swipe)
    p[P.KneeFrontRight] = mix(p[P.KneeFrontRight]!, mix(0.3, -0.25, arc), swipe)
    p[P.SplayFrontRight] = mix(p[P.SplayFrontRight]!, 0.55, swipe)
    p[P.LiftFrontRight] += swipe * arc * (cub ? 0.65 : 0.5)
    p[P.HeadPitch] -= swipe * 0.15
    p[P.HeadYaw] -= swipe * 0.1
    p[P.HeadRoll] -= swipe * 0.12
    p[P.Roll] -= swipe * 0.12
    p[P.Pitch] -= swipe * 0.28
    p[P.Mouth] = Math.max(p[P.Mouth]!, swipe * 0.5)

    // Shake: a wet-dog shimmy from the nose back.
    const shake = envelope(this.shakeTime, 0.85, 0.08, 0.2)
    const shiver = Math.sin(this.shakeTime * 52) * shake
    p[P.Yaw] += shiver * 0.12
    p[P.Roll] += shiver * 0.12
    p[P.HeadYaw] -= shiver * 0.3
    p[P.HeadRoll] += shiver * 0.18
    p[P.EarLeft] += Math.sin(this.shakeTime * 52 - 0.6) * shake * 0.45
    p[P.EarRight] -= Math.sin(this.shakeTime * 52 + 0.6) * shake * 0.45
    p[P.Tail] += Math.sin(this.shakeTime * 52 + 1.2) * shake * 0.6
    p[P.ScarfSway] += Math.sin(this.shakeTime * 52 - 1) * shake * 0.6
    p[P.Blink] = Math.max(p[P.Blink]!, shake * 0.8)

    for (let i = 0; i < P.Count; i++) {
      // Blinks and the swipe need a crisp attack; the body eases more gently.
      const rate = i === P.Blink ? 60 : i >= P.FrontLeft ? 30 : i >= P.HeadPitch ? 22 : 16
      this.pose[i] = mix(this.pose[i]!, p[i]!, 1 - Math.exp(-dt * rate))
    }
    this.applyPose()
  }

  private applyPose(): void {
    const p = this.pose
    const rig = this.rig
    rig.motion.position.set(this.motionBase.x, this.motionBase.y + p[P.Y]!, this.motionBase.z + p[P.Z]!)
    rig.motion.rotation.set(p[P.Pitch]!, p[P.Yaw]!, p[P.Roll]!)
    rig.motion.scale.set(p[P.ScaleX]!, p[P.ScaleY]!, p[P.ScaleZ]!)
    rig.head.rotation.set(p[P.HeadPitch]!, p[P.HeadYaw]!, p[P.HeadRoll]!)
    rig.jaw.rotation.x = p[P.Mouth]! * 0.55
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      rig.eyes[i]!.scale.y = Math.max(0.08, 1 - p[P.Blink]! * 1.05)
      const ear = rig.ears[i]!
      ear.rotation.z = side * -EAR_TILT + p[P.EarLeft + i]! * side
      ear.rotation.x = -0.12 - p[P.EarBack]!
    }
    rig.tail.rotation.set(-0.2 + p[P.ScaleY]! - 1, p[P.Tail]!, 0)
    if (rig.scarf.length) {
      rig.scarf[0]!.rotation.set(0.2 + p[P.Scarf]! * 0.6, p[P.ScarfSway]!, 0.25 + p[P.ScarfSway]!)
      rig.scarf[1]!.rotation.set(p[P.Scarf]! * 0.5, 0, p[P.ScarfSway]! * 0.8)
    }
    for (let i = 0; i < 4; i++) {
      const hip = rig.hips[i]!
      rig.legs[i]!.rotation.set(p[P.FrontLeft + i]!, 0, p[P.SplayFrontLeft + i]!)
      rig.legs[i]!.position.set(hip.x, hip.y + p[P.LiftFrontLeft + i]!, hip.z)
      rig.knees[i]!.rotation.x = p[P.KneeFrontLeft + i]!
    }
  }
}

/** Crisp, clean, faceted low poly, like folded paper. */
export const origamiStyle: BearStyle = {
  id: "origami",
  label: "Origami",
  create: (look, scale) => new OrigamiBear(look, scale)
}
