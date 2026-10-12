import * as THREE from "three"
import type { PadState } from "../services/Input.ts"
import { GRAVITY } from "../services/Physics.ts"
import type { SoundName } from "../services/Sound.ts"
import type { Bear } from "./bear.ts"
import type { Interactions } from "./interactions.ts"
import { SPOTS } from "./level.ts"

const nearXZ = (point: THREE.Vector3, radius: number) => (bear: Bear) =>
  Math.hypot(bear.position.x - point.x, bear.position.z - point.z) < radius && Math.abs(bear.feetY - point.y) < 1.5

/**
 * Mama can scoop the cub onto her back, then lift her somewhere high, throw her, or set her down.
 */
export class Coop {
  carrying = false

  constructor(
    private readonly mama: Bear,
    private readonly cub: Bear,
    interactions: Interactions,
    private readonly sound: (name: SoundName) => void
  ) {
    const atLift = nearXZ(SPOTS.lift, 2)
    const atThrow = nearXZ(SPOTS.throw, 2.2)
    const aboveMama = () => this.mama.position.clone().add(new THREE.Vector3(0, 2.4, 0))

    interactions.add({
      id: "pick-up",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Pick up",
      anchor: () => this.cub.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
      inRange: (bear) =>
        bear.position.distanceTo(this.cub.position) < 2.6 && Math.abs(bear.feetY - this.cub.feetY) < 1.2,
      enabled: () => !this.carrying && this.cub.mode === "walk",
      onComplete: () => {
        this.carrying = true
        this.sound("pickup")
      }
    })
    interactions.add({
      id: "lift",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Lift up!",
      anchor: aboveMama,
      inRange: atLift,
      enabled: () => this.carrying,
      onComplete: () => this.release(SPOTS.liftTarget, 0.85, "throw")
    })
    interactions.add({
      id: "throw-river",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Throw!",
      anchor: aboveMama,
      inRange: atThrow,
      enabled: () => this.carrying,
      onComplete: () => this.release(SPOTS.throwTarget, 1.25, "throw")
    })
    interactions.add({
      id: "put-down",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Put down",
      anchor: aboveMama,
      inRange: (bear) => !atLift(bear) && !atThrow(bear),
      enabled: () => this.carrying,
      onComplete: () => {
        const target = this.mama.position.clone().addScaledVector(this.mama.forward, 2)
        target.y = this.mama.feetY
        this.release(target, 0.45, "putdown")
      }
    })
  }

  /** Toss the cub so she lands on `feetTarget` after `time` seconds. */
  private release(feetTarget: THREE.Vector3, time: number, sound: SoundName) {
    this.carrying = false
    const start = this.mama.backAnchor.add(new THREE.Vector3(0, 0.7, 0))
    const cubCenter = start.clone().setY(start.y + this.cub.spec.halfHeight + this.cub.spec.radius)
    this.cub.teleport(cubCenter)
    const target = feetTarget.clone().setY(feetTarget.y + this.cub.spec.halfHeight + this.cub.spec.radius + 0.1)
    const velocity = target.sub(cubCenter).divideScalar(time)
    velocity.y += 0.5 * GRAVITY * time
    this.cub.launch(velocity)
    this.sound(sound)
  }

  /** Free throw in whatever direction mama is facing. */
  private fling() {
    this.carrying = false
    const start = this.mama.backAnchor.add(new THREE.Vector3(0, 0.7 + this.cub.spec.halfHeight + this.cub.spec.radius, 0))
    this.cub.teleport(start)
    this.cub.launch(this.mama.forward.multiplyScalar(10).add(new THREE.Vector3(0, 9, 0)))
    this.sound("throw")
  }

  /** Runs after interactions (which may have consumed B) and after mama moves. */
  update(dt: number, mamaPad: PadState | null) {
    if (this.carrying && mamaPad?.pressed.y) this.fling()
    if (this.carrying) this.cub.carry(this.mama.backAnchor, this.mama.yaw, dt)
    // While flying, the cub passes straight through mama so she doesn't get stuck on her.
    this.cub.ignore = this.cub.mode === "flying" ? this.mama.collider : null
  }
}
