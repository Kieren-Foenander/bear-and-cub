import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { PadState } from "../services/Input.ts"
import { GRAVITY } from "../services/Physics.ts"
import type { SoundName } from "../services/Sound.ts"
import { BearModel, type BearLook } from "./bearModel.ts"
import type { Surface, Surfaces } from "./surfaces.ts"
import type { Terrain } from "./terrain.ts"
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
  readonly terrain: Terrain
  readonly surfaces: Surfaces
  readonly sound: (name: SoundName) => void
  readonly onSplash: (bear: Bear) => void
  /** Buzz this bear's controller. */
  readonly rumble: (bear: Bear, strength: number, ms: number) => void
  /** Colliders the ground ray should ignore (the bears themselves). */
  readonly isBear: (collider: RAPIER.Collider) => boolean
}

const COYOTE_TIME = 0.15
const JUMP_BUFFER = 0.15
/** How early you can press jump before landing on a mushroom and still get the big bounce. */
const SUPER_BOUNCE_WINDOW = 0.35

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
  /** What we're standing on (or about to land on), if it's special. */
  surfaceBelow: Surface | undefined
  /** Distance from our feet to whatever is below us. */
  groundGap = 0
  /** Seconds since jump was last pressed. */
  sinceJumpPress = 99
  /** How many super bounces we've just missed (makes the next one easier). */
  bounceAssist = 0
  /** True for the one frame where we land after being in the air a while. */
  justLanded = false

  private coyote = 0
  private jumpBuffer = 0
  private airTime = 0
  private safeTimer = 0
  private readonly lastSafe = new THREE.Vector3()
  private time = 0
  private readonly ray: RAPIER.Ray

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
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

    this.kcc = world.createCharacterController(0.04)
    this.kcc.setMaxSlopeClimbAngle((46 * Math.PI) / 180)
    this.kcc.setMinSlopeSlideAngle((40 * Math.PI) / 180)
    this.kcc.enableAutostep(0.35 * spec.scale + 0.1, 0.2, false)
    this.kcc.enableSnapToGround(0.4)
    this.kcc.setApplyImpulsesToDynamicBodies(true)
    this.kcc.setCharacterMass(spec.mass)

    this.model = new BearModel(spec.look, spec.scale)
    this.model.root.userData.shared = true
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

  /** Put the bear somewhere new and make that its respawn point. */
  placeAt(feet: THREE.Vector3) {
    const center = feet.clone().add(new THREE.Vector3(0, this.spec.halfHeight + this.spec.radius + 0.05, 0))
    this.mode = "walk"
    this.collider.setEnabled(true)
    this.velocity.set(0, 0, 0)
    this.teleport(center)
    this.lastSafe.copy(center)
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

    this.sinceJumpPress = pad?.pressed.a ? 0 : this.sinceJumpPress + dt
    const onBouncer = this.grounded && this.surfaceBelow?.kind === "bouncer"

    // Forgiving jumps: you can press slightly early (buffer) or slightly late (coyote time).
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt
    this.jumpBuffer = pad?.pressed.a && !flying ? JUMP_BUFFER : this.jumpBuffer - dt
    if (onBouncer && this.surfaceBelow?.kind === "bouncer") {
      // Mushrooms always bounce you; pressing jump just before landing makes it a big one.
      // Mama is too heavy for the big bounce.
      const heavy = this.spec.mass >= 3
      // Every small bounce (a missed big one) quietly widens the window a little.
      const window = SUPER_BOUNCE_WINDOW + Math.min(3, this.bounceAssist) * 0.08
      const big = this.sinceJumpPress < window && this.mode === "walk" && !heavy
      this.bounceAssist = big ? Math.max(0, this.bounceAssist - 1) : this.bounceAssist + 1
      this.velocity.y = big ? this.surfaceBelow.superPower : this.surfaceBelow.power * (heavy ? 0.8 : 1)
      this.surfaceBelow.onBounce(big)
      this.ctx.rumble(this, big ? 0.7 : 0.25, big ? 200 : 80)
      this.model.land(0.8)
      this.sinceJumpPress = 99
      this.jumpBuffer = 0
      this.coyote = 0
      if (this.mode === "flying") this.mode = "walk"
    } else if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.velocity.y = this.spec.jumpSpeed
      this.jumpBuffer = 0
      this.coyote = 0
      this.ctx.sound(this.spec.id === "mama" ? "bigJump" : "jump")
    }

    // Only for her own jumps; throws are aimed with normal gravity.
    const atApex = this.spec.apexFloat && !flying && !this.grounded && Math.abs(this.velocity.y) < 2.5
    this.velocity.y -= GRAVITY * (atApex ? 0.4 : 1) * dt

    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt }
    // Ride along with moving platforms.
    if (this.grounded && this.surfaceBelow?.kind === "platform") {
      desired.x += this.surfaceBelow.delta.x
      desired.y += Math.min(0, this.surfaceBelow.delta.y)
      desired.z += this.surfaceBelow.delta.z
      if (this.surfaceBelow.delta.y > 0) {
        // Rising platforms lift us directly so we don't sink into them.
        this.position.y += this.surfaceBelow.delta.y
      }
    }
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
    this.justLanded = this.grounded && !wasGrounded && this.airTime > 0.25
    // Bonked our head on something.
    if (desired.y > 0 && moved.y < desired.y * 0.5) this.velocity.y = Math.min(this.velocity.y, 0)

    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.25) {
        this.model.land(Math.min(1, this.airTime))
        this.ctx.sound("land")
        if (this.airTime > 0.6) this.ctx.rumble(this, 0.3, 90)
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

    this.probeGround()
    this.trackSafeGround(dt)
    this.syncVisuals(dt)
  }

  /** Look straight down: what are we standing on, and how far away is it? */
  private probeGround() {
    this.ray.origin.x = this.position.x
    this.ray.origin.y = this.position.y
    this.ray.origin.z = this.position.z
    const hit = this.ctx.world.castRayAndGetNormal(
      this.ray,
      40,
      true,
      this.ctx.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      this.body,
      (collider) => !this.ctx.isBear(collider)
    )
    const halfHeight = this.spec.halfHeight + this.spec.radius
    this.groundGap = hit ? hit.timeOfImpact - halfHeight : 40
    this.surfaceBelow = hit ? this.ctx.surfaces.surfaceFor(hit.collider) : undefined
    if (this.surfaceBelow?.kind === "platform" && this.grounded) this.surfaceBelow.riders += this.spec.mass
    this.ring.position.set(this.position.x, Math.max(this.position.y - (hit?.timeOfImpact ?? halfHeight), this.ctx.terrain.waterY) + 0.06, this.position.z)
  }

  /** Remember the last good place we stood, so falling in the water is just a quick reset. */
  private trackSafeGround(dt: number) {
    this.safeTimer -= dt
    if (this.safeTimer <= 0 && this.grounded && this.mode === "walk" && this.surfaceBelow === undefined) {
      this.safeTimer = 0.3
      if (this.feetY > this.ctx.terrain.waterY + 0.4 && this.solidAround()) this.lastSafe.copy(this.position)
    }
    if (this.feetY < this.ctx.terrain.waterY - 0.3 || this.position.y < -30) {
      this.ctx.onSplash(this)
      this.model.shake()
      this.velocity.set(0, 0, 0)
      this.mode = "walk"
      this.collider.setEnabled(true)
      this.teleport(this.lastSafe.clone().add(new THREE.Vector3(0, 0.3, 0)))
    }
  }

  /** Is there solid, dry ground all around us (not standing on the edge of a drop)? */
  private solidAround() {
    const reach = this.spec.radius + 0.2
    for (const [dx, dz] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]] as const) {
      this.ray.origin.x = this.position.x + dx
      this.ray.origin.y = this.position.y
      this.ray.origin.z = this.position.z + dz
      const hit = this.ctx.world.castRay(
        this.ray,
        this.spec.halfHeight + this.spec.radius + 1,
        true,
        this.ctx.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        this.body,
        (collider) => !this.ctx.isBear(collider)
      )
      if (!hit) return false
      const groundY = this.position.y - hit.timeOfImpact
      if (groundY < this.ctx.terrain.waterY + 0.3) return false
    }
    return true
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
    this.ring.visible = !carried
    this.ring.scale.setScalar(this.highlighted ? 1 + Math.sin(this.time * 6) * 0.12 : 1)
  }
}
