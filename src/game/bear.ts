import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { PadState } from "../services/Input.ts"
import { GRAVITY } from "../services/Physics.ts"
import type { SoundName } from "../services/Sound.ts"
import { BearModel, type BearLook } from "./bearModel.ts"
import { distanceToRiver, RIVER_HALF_WIDTH, WATER_Y } from "./terrain.ts"
import { damp, dampAngle } from "./util.ts"

export type BearId = "mama" | "cub"

export interface BearSpec {
  readonly id: BearId
  readonly name: string
  readonly look: BearLook
  readonly scale: number
  readonly radius: number
  readonly halfHeight: number
  readonly speed: number
  readonly jumpSpeed: number
  readonly ringColor: THREE.ColorRepresentation
  readonly mass: number
  /** Extra hang time at the top of a jump: makes "swipe at the top" much easier to time. */
  readonly apexFloat?: boolean
}

export interface BearContext {
  readonly rapier: typeof RAPIER
  readonly world: RAPIER.World
  readonly scene: THREE.Scene
  readonly sound: (name: SoundName) => void
  readonly onSplash: (bear: Bear) => void
}

const COYOTE_TIME = 0.15
const JUMP_BUFFER = 0.15

export class Bear {
  readonly body: RAPIER.RigidBody
  readonly collider: RAPIER.Collider
  private readonly kcc: RAPIER.KinematicCharacterController
  readonly model: BearModel
  private readonly ring: THREE.Mesh

  /** Centre of the physics capsule. */
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  yaw = 0
  grounded = false
  mode: "walk" | "carried" | "flying" = "walk"
  /** Highlighted when this is the bear the shared controller is driving. */
  highlighted = false
  /** A collider to pass through, e.g. mama while the cub is being thrown off her back. */
  ignore: RAPIER.Collider | null = null

  private coyote = 0
  private jumpBuffer = 0
  private airTime = 0
  private safeTimer = 0
  private readonly lastSafe = new THREE.Vector3()
  private readonly groundBelow = new THREE.Vector3()
  private time = 0

  constructor(
    readonly spec: BearSpec,
    private readonly ctx: BearContext,
    spawn: THREE.Vector3
  ) {
    const { rapier, world, scene } = ctx
    this.position.copy(spawn)
    this.lastSafe.copy(spawn)
    this.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(spec.halfHeight, spec.radius), this.body)

    this.kcc = world.createCharacterController(0.04)
    this.kcc.setMaxSlopeClimbAngle((46 * Math.PI) / 180)
    this.kcc.setMinSlopeSlideAngle((40 * Math.PI) / 180)
    this.kcc.enableAutostep(0.35 * spec.scale + 0.1, 0.2, false)
    this.kcc.enableSnapToGround(0.4)
    this.kcc.setApplyImpulsesToDynamicBodies(true)
    this.kcc.setCharacterMass(spec.mass)

    this.model = new BearModel(spec.look, spec.scale)
    scene.add(this.model.root)

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(spec.radius * 1.3, spec.radius * 1.3 + 0.18, 24),
      new THREE.MeshBasicMaterial({ color: spec.ringColor, transparent: true, opacity: 0.85, depthWrite: false })
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.renderOrder = 1
    scene.add(this.ring)
  }

  get feetY() {
    return this.position.y - this.spec.halfHeight - this.spec.radius
  }

  /** Where something riding on this bear's back should sit. */
  get backAnchor() {
    return new THREE.Vector3(0, 0, -0.15)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw)
      .add(this.position)
      .setY(this.feetY + 1.55 * this.spec.scale)
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  teleport(position: THREE.Vector3) {
    this.position.copy(position)
    this.body.setTranslation(position, true)
    this.body.setNextKinematicTranslation(position)
  }

  /** Fling the bear through the air. It can't steer until it lands. */
  launch(velocity: THREE.Vector3) {
    this.mode = "flying"
    this.collider.setEnabled(true)
    this.velocity.copy(velocity)
    this.grounded = false
    this.coyote = 0
  }

  /** Called every frame while another bear is carrying this one. */
  carry(anchor: THREE.Vector3, yaw: number, dt: number) {
    if (this.mode !== "carried") {
      this.mode = "carried"
      this.collider.setEnabled(false)
    }
    this.velocity.set(0, 0, 0)
    // The anchor is where our feet go; the physics body is our centre.
    this.position.set(anchor.x, anchor.y + this.spec.halfHeight + this.spec.radius, anchor.z)
    this.body.setNextKinematicTranslation(this.position)
    this.yaw = dampAngle(this.yaw, yaw, 12, dt)
  }

  /** Move the bear for one frame. `pad` is null when nobody is driving this bear. */
  update(dt: number, pad: PadState | null) {
    this.time += dt
    if (this.mode === "carried") {
      this.syncVisuals(dt)
      return
    }

    const flying = this.mode === "flying"
    const moveX = flying || !pad ? 0 : pad.moveX
    const moveZ = flying || !pad ? 0 : pad.moveY

    if (!flying) {
      const accel = this.grounded ? 14 : 6
      this.velocity.x = damp(this.velocity.x, moveX * this.spec.speed, accel, dt)
      this.velocity.z = damp(this.velocity.z, moveZ * this.spec.speed, accel, dt)
      if (Math.hypot(moveX, moveZ) > 0.15) this.yaw = dampAngle(this.yaw, Math.atan2(moveX, moveZ), 12, dt)
    } else if (this.horizontalSpeed > 1) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 6, dt)
    }

    // Forgiving jumps: you can press slightly early (buffer) or slightly late (coyote time).
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt
    this.jumpBuffer = pad?.pressed.a && !flying ? JUMP_BUFFER : this.jumpBuffer - dt
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.velocity.y = this.spec.jumpSpeed
      this.jumpBuffer = 0
      this.coyote = 0
      this.ctx.sound(this.spec.id === "mama" ? "bigJump" : "jump")
    }

    // Only for her own jumps; throws are aimed with normal gravity.
    const atApex = this.spec.apexFloat && !flying && !this.grounded && Math.abs(this.velocity.y) < 2.5
    this.velocity.y -= GRAVITY * (atApex ? 0.4 : 1) * dt
    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt }
    this.kcc.computeColliderMovement(
      this.collider,
      desired,
      this.ctx.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (collider) => collider !== this.ignore
    )
    const moved = this.kcc.computedMovement()
    this.position.x += moved.x
    this.position.y += moved.y
    this.position.z += moved.z
    this.body.setNextKinematicTranslation(this.position)

    const wasGrounded = this.grounded
    this.grounded = this.kcc.computedGrounded()
    // Bonked our head on something.
    if (desired.y > 0 && moved.y < desired.y * 0.5) this.velocity.y = Math.min(this.velocity.y, 0)

    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.25) {
        this.model.land(Math.min(1, this.airTime))
        this.ctx.sound("land")
      }
      this.airTime = 0
      this.velocity.y = Math.max(this.velocity.y, -1)
      if (flying) {
        this.mode = "walk"
        this.velocity.x *= 0.3
        this.velocity.z *= 0.3
      }
    } else {
      this.airTime += dt
    }

    this.trackSafeGround(dt)
    this.syncVisuals(dt)
  }

  private trackSafeGround(dt: number) {
    this.safeTimer -= dt
    const inRiver = distanceToRiver(this.position.x, this.position.z) < RIVER_HALF_WIDTH + 1
    if (this.grounded && this.mode === "walk" && !inRiver && this.feetY > WATER_Y + 0.8 && this.safeTimer <= 0) {
      this.lastSafe.copy(this.position)
      this.safeTimer = 0.3
    }
    if (this.feetY < WATER_Y - 0.3 || this.position.y < -20) {
      this.ctx.onSplash(this)
      this.model.shake()
      this.velocity.set(0, 0, 0)
      this.mode = "walk"
      this.teleport(this.lastSafe.clone().add(new THREE.Vector3(0, 0.3, 0)))
    }
  }

  private syncVisuals(dt: number) {
    const carried = this.mode === "carried"
    this.model.root.position.set(this.position.x, this.feetY, this.position.z)
    this.model.root.rotation.y = this.yaw
    this.model.animate(dt, {
      speed: this.horizontalSpeed,
      maxSpeed: this.spec.speed,
      grounded: this.grounded || carried,
      carried,
      flying: this.mode === "flying",
      verticalVelocity: carried ? 0 : this.velocity.y
    })

    // The coloured ring sits on the ground under the bear so you can always tell where you'll land.
    this.ring.visible = !carried
    if (this.ring.visible) {
      const ray = new this.ctx.rapier.Ray(this.position, { x: 0, y: -1, z: 0 })
      const hit = this.ctx.world.castRay(
        ray,
        30,
        true,
        this.ctx.rapier.QueryFilterFlags.EXCLUDE_KINEMATIC | this.ctx.rapier.QueryFilterFlags.EXCLUDE_SENSORS
      )
      const groundY = hit ? this.position.y - hit.timeOfImpact : this.feetY
      this.groundBelow.set(this.position.x, Math.max(groundY, WATER_Y) + 0.06, this.position.z)
      this.ring.position.copy(this.groundBelow)
      const pulse = this.highlighted ? 1 + Math.sin(this.time * 6) * 0.12 : 1
      this.ring.scale.setScalar(pulse)
    }
  }
}
