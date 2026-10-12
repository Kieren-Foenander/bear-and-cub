import * as THREE from "three"
import type { PadState } from "../services/Input.ts"
import { GRAVITY } from "../services/Physics.ts"
import type { SoundName } from "../services/Sound.ts"
import type { Bear } from "./bear.ts"
import type { Interactions } from "./interactions.ts"
import type { Particles } from "./particles.ts"

/** A place where Mama can lift or throw Cub to a fixed target. */
export interface CoopSpot {
  readonly id: string
  readonly kind: "lift" | "throw"
  /** Where Mama stands (on the ground). */
  readonly at: THREE.Vector3
  /** Where Cub's feet land. */
  readonly target: THREE.Vector3
  /** Seconds in the air; longer = higher arc. */
  readonly time: number
  /** Show the glowing paw circle? Defaults to always. */
  readonly active?: () => boolean
  readonly radius?: number
}

/** A glowing circle on the ground that says "stand here". */
export class SpotMarker {
  readonly group = new THREE.Group()
  private time = Math.random() * 10

  constructor(scene: THREE.Scene, position: THREE.Vector3, color: THREE.ColorRepresentation, radius = 1.4) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.2, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
    )
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.2, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false })
    )
    for (const m of [ring, disc]) {
      m.rotation.x = -Math.PI / 2
      this.group.add(m)
    }
    // Little paw print in the middle.
    const pad = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false })
    const palm = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), pad)
    palm.rotation.x = -Math.PI / 2
    palm.position.z = 0.12
    this.group.add(palm)
    for (let i = 0; i < 4; i++) {
      const toe = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), pad)
      toe.rotation.x = -Math.PI / 2
      const angle = -0.9 + i * 0.6
      toe.position.set(Math.sin(angle) * 0.5, 0.001, 0.12 - Math.cos(angle) * 0.5)
      this.group.add(toe)
    }
    this.group.position.copy(position).add(new THREE.Vector3(0, 0.08, 0))
    this.group.renderOrder = 1
    scene.add(this.group)
  }

  update(dt: number, visible: boolean) {
    this.time += dt
    this.group.visible = visible
    this.group.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06)
  }
}

const nearXZ = (point: THREE.Vector3, radius: number) => (bear: Bear) =>
  Math.hypot(bear.position.x - point.x, bear.position.z - point.z) < radius && Math.abs(bear.feetY - point.y) < 1.5

/**
 * Mama can scoop the cub onto her back, then lift her somewhere high, throw her, or set her down.
 * With nothing on her back, Y calls the cub over (for when a little explorer wanders off).
 */
export class Coop {
  carrying = false
  private readonly spots: Array<{ spot: CoopSpot; marker: SpotMarker }> = []
  private readonly atAnySpot: Array<(bear: Bear) => boolean> = []

  constructor(
    private readonly mama: Bear,
    private readonly cub: Bear,
    private readonly interactions: Interactions,
    private readonly scene: THREE.Scene,
    private readonly particles: Particles,
    private readonly sound: (name: SoundName) => void,
    private readonly toast: (text: string) => void
  ) {
    const aboveMama = () => this.mama.position.clone().add(new THREE.Vector3(0, 2.4, 0))

    interactions.add({
      id: "pick-up",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Pick up",
      anchor: () => this.cub.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
      inRange: (bear) => bear.position.distanceTo(this.cub.position) < 2.6 && Math.abs(bear.feetY - this.cub.feetY) < 1.2,
      enabled: () => !this.carrying && this.cub.mode === "walk",
      onComplete: () => {
        this.carrying = true
        this.sound("pickup")
      }
    })
    interactions.add({
      id: "put-down",
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: "Put down",
      anchor: aboveMama,
      inRange: (bear) => !this.atAnySpot.some((at) => at(bear)),
      enabled: () => this.carrying,
      onComplete: () => {
        const target = this.mama.position.clone().addScaledVector(this.mama.forward, 2)
        target.y = this.mama.feetY
        this.release(target, 0.45, "putdown")
      }
    })
  }

  addSpot(spot: CoopSpot) {
    const at = nearXZ(spot.at, spot.radius ?? 2.1)
    this.atAnySpot.push(at)
    this.spots.push({ spot, marker: new SpotMarker(this.scene, spot.at, "#5aa9ff") })
    this.interactions.add({
      id: `spot-${spot.id}`,
      who: "mama",
      kind: "press",
      buttons: ["b"],
      label: spot.kind === "lift" ? "Lift up!" : "Throw!",
      anchor: () => this.mama.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
      inRange: at,
      enabled: () => this.carrying,
      onComplete: () => this.release(spot.target, spot.time, "throw")
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

  /** "Come here!" Cub pops straight onto Mama's back (never into a wall). */
  private call() {
    if (this.cub.mode !== "walk" || this.cub.position.distanceTo(this.mama.position) < 4) return
    this.particles.burst(this.cub.position, { colors: ["#ffffff", "#ff9ad5"], count: 16, speed: 3, up: 2 })
    this.carrying = true
    this.particles.burst(this.mama.backAnchor, { colors: ["#ffffff", "#ff9ad5"], count: 16, speed: 3, up: 2 })
    this.sound("pickup")
    this.toast("Come here, Cub!")
  }

  /** Runs after interactions (which may have consumed B) and after mama moves. */
  update(dt: number, mamaPad: PadState | null) {
    if (mamaPad?.pressed.y) {
      if (this.carrying) this.fling()
      else this.call()
    }
    if (this.carrying) this.cub.carry(this.mama.backAnchor, this.mama.yaw, dt)
    // While flying, the cub passes straight through mama so she doesn't get stuck on her.
    this.cub.ignore = this.cub.mode === "flying" ? this.mama.collider : null
    for (const { spot, marker } of this.spots) marker.update(dt, spot.active?.() ?? true)
  }
}
