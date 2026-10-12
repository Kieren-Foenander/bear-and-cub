import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"

/**
 * A platform that moves. Bears standing on it move with it.
 * `motion` returns where the platform should be at time `t`; `riders` is the total mass standing on
 * it (Cub weighs 1, Mama weighs 4), so lily pads can sink under Mama.
 */
export interface Platform {
  readonly kind: "platform"
  readonly body: RAPIER.RigidBody
  readonly object: THREE.Object3D
  readonly motion: (t: number, riders: number, dt: number) => THREE.Vector3
  /** How far it moved this frame, applied to anyone riding it. */
  readonly delta: THREE.Vector3
  riders: number
  /** Safe to respawn on? Moving and sinking things aren't. */
  readonly safe: false
}

/** A bouncy surface (mushroom caps). Press jump just before landing for a super bounce. */
export interface Bouncer {
  readonly kind: "bouncer"
  readonly power: number
  readonly superPower: number
  readonly onBounce: (big: boolean) => void
  readonly safe: false
}

export type Surface = Platform | Bouncer

export class Surfaces {
  private readonly byCollider = new Map<number, Surface>()
  readonly platforms: Array<Platform> = []
  private time = 0

  constructor(
    private readonly rapier: typeof RAPIER,
    private readonly world: RAPIER.World,
    private readonly scene: THREE.Scene
  ) {}

  /** A kinematic platform. `object` is the visual; `shape` is its collider (relative to the object's origin). */
  addPlatform(object: THREE.Object3D, shape: RAPIER.ColliderDesc, motion: Platform["motion"]) {
    const start = motion(0, 0, 0)
    object.position.copy(start)
    this.scene.add(object)
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z))
    const collider = this.world.createCollider(shape, body)
    const platform: Platform = { kind: "platform", body, object, motion, delta: new THREE.Vector3(), riders: 0, safe: false }
    this.byCollider.set(collider.handle, platform)
    this.platforms.push(platform)
    return platform
  }

  addBouncer(collider: RAPIER.Collider, bouncer: Omit<Bouncer, "kind" | "safe">) {
    this.byCollider.set(collider.handle, { kind: "bouncer", safe: false, ...bouncer })
  }

  surfaceFor(collider: RAPIER.Collider | null) {
    return collider ? this.byCollider.get(collider.handle) : undefined
  }

  /** Call before the bears move. */
  update(dt: number) {
    this.time += dt
    for (const platform of this.platforms) {
      const next = platform.motion(this.time, platform.riders, dt)
      platform.delta.subVectors(next, platform.object.position)
      platform.object.position.copy(next)
      platform.body.setNextKinematicTranslation(next)
      platform.riders = 0
    }
  }
}
