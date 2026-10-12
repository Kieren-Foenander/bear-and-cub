import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { Env } from "./nature.ts"
import { flat, jitter, mesh } from "./util.ts"

/** A chunky rock block with a grassy top. Solid. `top` is the height of the walkable top. */
export const cliff = (
  env: Env,
  box: { x0: number; x1: number; z0: number; z1: number; top: number; bottom?: number },
  colors: { rock?: THREE.ColorRepresentation; cap?: THREE.ColorRepresentation | null } = {}
) => {
  const { scene, rapier, world } = env
  const { x0, x1, z0, z1, top, bottom = -3 } = box
  const width = x1 - x0
  const depth = z1 - z0
  const height = top - bottom
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const geometry = jitter(
    new THREE.BoxGeometry(
      width,
      height,
      depth,
      Math.max(1, Math.round(width / 2.5)),
      Math.max(1, Math.round(height / 2)),
      Math.max(1, Math.round(depth / 2.5))
    ),
    0.22
  )
  const rock = mesh(geometry, flat(colors.rock ?? "#a89d8d"))
  rock.position.set(cx, (top + bottom) / 2, cz)
  scene.add(rock)
  if (colors.cap !== null) {
    const cap = mesh(
      jitter(
        new THREE.BoxGeometry(width + 0.3, 0.35, depth + 0.3, Math.max(1, Math.round(width / 2.5)), 1, Math.max(1, Math.round(depth / 2.5))),
        0.08
      ),
      flat(colors.cap ?? "#76bf4c")
    )
    cap.position.set(cx, top + 0.1, cz)
    scene.add(cap)
  }
  world.createCollider(rapier.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(cx, (top + bottom) / 2, cz))
  return rock
}

/** A round, flat-topped stone sticking out of the water. Solid and safe to stand on. */
export const steppingStone = (env: Env, x: number, z: number, radius: number, top: number) => {
  const { scene, rapier, world } = env
  const height = top + 3
  const stone = mesh(jitter(new THREE.CylinderGeometry(radius, radius * 1.15, height, 7, 2), 0.06), flat("#9d978b"))
  stone.position.set(x, top - height / 2, z)
  scene.add(stone)
  const moss = mesh(new THREE.CylinderGeometry(radius * 0.9, radius * 0.95, 0.12, 7), flat("#7fbf58"))
  moss.position.set(x, top + 0.03, z)
  scene.add(moss)
  world.createCollider(rapier.ColliderDesc.cylinder(height / 2, radius).setTranslation(x, top - height / 2, z))
}

/** A lily pad visual (the caller makes it a platform so it can bob and sink). */
export const lilyPadMesh = (radius: number, flower: boolean) => {
  const group = new THREE.Group()
  const pad = mesh(new THREE.CylinderGeometry(radius, radius, 0.16, 12, 1, false, 0.3, Math.PI * 2 - 0.3), flat("#5cb85c"))
  group.add(pad)
  const vein = mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.18, 12), flat("#6cc866"), { castShadow: false })
  group.add(vein)
  if (flower) {
    const petal = flat("#ff9ad5")
    for (let i = 0; i < 6; i++) {
      const p = mesh(new THREE.ConeGeometry(0.14, 0.4, 4), petal)
      const a = (i / 6) * Math.PI * 2
      p.position.set(radius * 0.5 + Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12)
      p.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
      group.add(p)
    }
  }
  return group
}

/** A log lying on its side along the X axis. */
export const logMesh = (length: number, radius = 0.45) => {
  const group = new THREE.Group()
  const log = mesh(new THREE.CylinderGeometry(radius, radius, length, 8), flat("#8a5a36"))
  log.rotation.z = Math.PI / 2
  group.add(log)
  for (const side of [-1, 1]) {
    const end = mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, 0.05, 8), flat("#d9b77e"), { castShadow: false })
    end.rotation.z = Math.PI / 2
    end.position.x = (side * length) / 2
    group.add(end)
  }
  return group
}

/** A big spotty mushroom; returns the cap collider so it can be made bouncy. */
export const mushroom = (
  env: Env,
  x: number,
  z: number,
  options: { capRadius?: number; height?: number; color?: THREE.ColorRepresentation; solid?: boolean } = {}
) => {
  const { scene, rapier, world, terrain } = env
  const { capRadius = 1.4, height = 1.2, color = "#e5484d", solid = true } = options
  const y = terrain.heightAt(x, z)
  const group = new THREE.Group()
  group.position.set(x, y, z)
  const stalk = mesh(new THREE.CylinderGeometry(capRadius * 0.3, capRadius * 0.4, height, 7), flat("#f3e6cf"))
  stalk.position.y = height / 2
  const cap = mesh(new THREE.SphereGeometry(capRadius, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat(color))
  cap.scale.y = 0.6
  cap.position.y = height - 0.05
  group.add(stalk, cap)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    const r = capRadius * (i % 2 ? 0.45 : 0.75)
    const spot = mesh(new THREE.IcosahedronGeometry(capRadius * 0.12, 0), flat("#ffffff"), { castShadow: false })
    spot.position.set(Math.cos(a) * r, height + Math.sqrt(Math.max(0, 1 - (r / capRadius) ** 2)) * capRadius * 0.6 - 0.05, Math.sin(a) * r)
    spot.scale.y = 0.5
    group.add(spot)
  }
  scene.add(group)
  const makeSolid = () => {
    world.createCollider(rapier.ColliderDesc.cylinder(height / 2, capRadius * 0.35).setTranslation(x, y + height / 2, z))
    return world.createCollider(rapier.ColliderDesc.cylinder(0.18, capRadius * 0.95).setTranslation(x, y + height + capRadius * 0.6 - 0.25, z))
  }
  const capCollider = solid ? makeSolid() : null
  return { group, cap, capCollider, makeSolid, top: y + height + capRadius * 0.6 - 0.07 }
}

/** A wooden sign with an emoji picture on it, to give little readers a hint. */
export const sign = (env: Env, x: number, z: number, emoji: string, facing = 0) => {
  const { scene, terrain } = env
  const y = terrain.heightAt(x, z)
  const group = new THREE.Group()
  group.position.set(x, y, z)
  group.rotation.y = facing
  const post = mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), flat("#8a5a36"))
  post.position.y = 0.7
  const board = mesh(new THREE.BoxGeometry(1.3, 0.9, 0.12), flat("#c9a46a"))
  board.position.y = 1.5
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 128
  const ctx2d = canvas.getContext("2d")!
  ctx2d.font = "96px serif"
  ctx2d.textAlign = "center"
  ctx2d.textBaseline = "middle"
  ctx2d.fillText(emoji, 64, 72)
  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8),
    new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace }), transparent: true })
  )
  picture.position.set(0, 1.5, 0.07)
  group.add(post, board, picture)
  scene.add(group)
  return group
}

/** Physics debris (smashed planks, rock chunks) that poofs away after a few seconds so it never blocks a path. */
export class Debris {
  private readonly items: Array<{ mesh: THREE.Object3D; body: RAPIER.RigidBody; life: number }> = []

  constructor(
    private readonly env: Env,
    private readonly poof: (at: THREE.Vector3) => void
  ) {}

  /** Turn a mesh into a flying dynamic body. Its collider is a box matching `size`. */
  fling(object: THREE.Object3D, size: THREE.Vector3, impulse: THREE.Vector3, life = 2.5 + Math.random()) {
    const { scene, rapier, world } = this.env
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    object.getWorldPosition(position)
    object.getWorldQuaternion(quaternion)
    scene.attach(object)
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z).setRotation(quaternion).setLinearDamping(0.3)
    )
    world.createCollider(rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setDensity(0.4), body)
    body.applyImpulse(impulse, true)
    body.applyTorqueImpulse({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }, true)
    this.items.push({ mesh: object, body, life })
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!
      const t = item.body.translation()
      const r = item.body.rotation()
      item.mesh.position.set(t.x, t.y, t.z)
      item.mesh.quaternion.set(r.x, r.y, r.z, r.w)
      item.life -= dt
      if (item.life < 0.3) item.mesh.scale.multiplyScalar(0.85)
      if (item.life <= 0) {
        this.poof(item.mesh.position.clone())
        this.env.scene.remove(item.mesh)
        this.env.world.removeRigidBody(item.body)
        this.items.splice(i, 1)
      }
    }
  }
}

/**
 * A wooden bridge that starts standing up on its hinge and swings down when `lower()` is called.
 * It extends from the hinge in the direction of `yaw` (0 = +Z).
 */
export class Drawbridge {
  readonly hinge = new THREE.Group()
  private angle = -Math.PI / 2
  private lowering = false
  down = false

  constructor(
    private readonly env: Env,
    hingeAt: THREE.Vector3,
    readonly length: number,
    private readonly yaw: number,
    private readonly onLanded: () => void = () => {},
    readonly width = 3.2,
    /** Resting angle once lowered: 0 = flat, positive = slopes down away from the hinge (a ramp). */
    private readonly finalAngle = 0
  ) {
    const plankMaterials = [flat("#a0683c"), flat("#8d5a32")]
    const planks = Math.round(length / 0.6)
    for (let i = 0; i < planks; i++) {
      const plank = mesh(new THREE.BoxGeometry(width, 0.25, 0.55), plankMaterials[i % 2]!)
      plank.position.set((i % 3) * 0.05, 0, 0.3 + i * (length / planks))
      this.hinge.add(plank)
    }
    for (const side of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.18, 0.18, length), flat("#7d4f2c"))
      rail.position.set(side * (width / 2 - 0.05), 0.8, length / 2)
      this.hinge.add(rail)
      for (let i = 0; i <= 4; i++) {
        const post = mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), flat("#7d4f2c"))
        post.position.set(side * (width / 2 - 0.05), 0.4, (i / 4) * length)
        this.hinge.add(post)
      }
    }
    this.hinge.position.copy(hingeAt)
    this.hinge.rotation.order = "YXZ"
    this.hinge.rotation.y = yaw
    this.hinge.rotation.x = this.angle
    env.scene.add(this.hinge)
  }

  lower() {
    this.lowering = true
  }

  update(dt: number) {
    if (!this.lowering || this.down) return
    this.angle = Math.min(this.finalAngle, this.angle + dt * 0.9)
    this.hinge.rotation.x = this.angle
    if (this.angle === this.finalAngle) {
      this.down = true
      this.addColliders()
      this.onLanded()
    }
  }

  private addColliders() {
    const { rapier, world } = this.env
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.finalAngle, this.yaw, 0, "YXZ"))
    const local = (x: number, y: number, z: number) =>
      new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(this.hinge.position)
    const box = (hx: number, hy: number, hz: number, at: THREE.Vector3) =>
      world.createCollider(rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(at.x, at.y, at.z).setRotation(rotation))
    box(this.width / 2, 0.15, this.length / 2, local(0, 0, this.length / 2))
    // Invisible side walls so nobody tumbles off the bridge.
    box(0.15, 1.2, this.length / 2, local(-this.width / 2, 1, this.length / 2))
    box(0.15, 1.2, this.length / 2, local(this.width / 2, 1, this.length / 2))
  }

  /** The far end of the lowered bridge, on the deck. */
  get tip() {
    return new THREE.Vector3(0, 0.2, this.length)
      .applyEuler(new THREE.Euler(this.finalAngle, this.yaw, 0, "YXZ"))
      .add(this.hinge.position)
  }
}

/**
 * A tall dead tree that topples over when pushed, landing as a log bridge.
 * It falls in the direction of `yaw` (0 = towards +Z).
 */
export class FallingTree {
  readonly pivot = new THREE.Group()
  private angle = 0
  private speed = 0
  private wobble = 0
  private readonly collider: RAPIER.Collider
  falling = false
  down = false

  constructor(
    private readonly env: Env,
    base: THREE.Vector3,
    readonly length: number,
    private readonly yaw: number,
    private readonly onLanded: () => void = () => {},
    private readonly radius = 0.75
  ) {
    const bark = flat("#7a5634")
    const trunk = mesh(jitter(new THREE.CylinderGeometry(radius * 0.8, radius, length, 8, 4), 0.05), bark)
    trunk.position.y = length / 2
    this.pivot.add(trunk)
    for (let i = 0; i < 4; i++) {
      const branch = mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.8, 5), bark)
      const a = (i / 4) * Math.PI * 2 + 0.4
      branch.position.set(Math.cos(a) * 0.6, length * (0.6 + i * 0.1), Math.sin(a) * 0.6)
      branch.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8)
      this.pivot.add(branch)
    }
    this.pivot.position.copy(base).add(new THREE.Vector3(0, radius * 0.8, 0))
    this.pivot.rotation.order = "YXZ"
    this.pivot.rotation.y = yaw
    env.scene.add(this.pivot)
    this.collider = env.world.createCollider(
      env.rapier.ColliderDesc.cylinder(length / 2, radius).setTranslation(base.x, base.y + length / 2, base.z)
    )
  }


  /** A little shove (shows progress before it goes). */
  nudge() {
    this.wobble = 1
  }

  fall() {
    this.falling = true
    this.env.world.removeCollider(this.collider, true)
  }

  update(dt: number) {
    this.wobble = Math.max(0, this.wobble - dt * 3)
    if (!this.falling) {
      this.pivot.rotation.x = Math.sin(this.wobble * 12) * this.wobble * 0.06
      return
    }
    if (this.down) return
    // Topple: starts slow, speeds up like a real falling tree.
    this.speed += dt * 3.2
    this.angle = Math.min(Math.PI / 2, this.angle + this.speed * dt)
    this.pivot.rotation.x = this.angle
    if (this.angle >= Math.PI / 2) {
      this.down = true
      this.addColliders()
      this.onLanded()
    }
  }

  private addColliders() {
    const { rapier, world } = this.env
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(this.pivot.position)
    const box = (hx: number, hy: number, hz: number, at: THREE.Vector3) =>
      world.createCollider(rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(at.x, at.y, at.z).setRotation(rotation))
    box(this.radius, this.radius * 0.7, this.length / 2, local(0, 0, this.length / 2))
    // Gentle slopes at each end so bears can walk up onto the log.
    const top = this.radius * 0.7 + this.radius * 0.8
    const run = 2.4
    const slope = Math.atan2(top, run)
    const rampLength = Math.hypot(top, run)
    for (const [z, dir] of [[this.length, 1], [0, -1]] as const) {
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(dir * slope, this.yaw, 0, "YXZ"))
      const center = local(0, top / 2 - this.radius * 0.8 - 0.1, z + (dir * run) / 2)
      world.createCollider(
        rapier.ColliderDesc.cuboid(this.radius, 0.1, rampLength / 2).setTranslation(center.x, center.y, center.z).setRotation(tilt)
      )
    }
    // Invisible rails so a careful bear doesn't slip off the log.
    box(0.1, 1.2, this.length / 2 - 1, local(-this.radius - 0.15, 1, this.length / 2))
    box(0.1, 1.2, this.length / 2 - 1, local(this.radius + 0.15, 1, this.length / 2))
  }
}

/** A wooden fence with a gate in the middle that swings open. */
export class Gate {
  private readonly left = new THREE.Group()
  private readonly right = new THREE.Group()
  private readonly collider: RAPIER.Collider
  private openAmount = 0
  open = false

  constructor(
    private readonly env: Env,
    center: THREE.Vector3,
    readonly halfWidth: number,
    readonly height: number,
    fenceTo: { minX: number; maxX: number }
  ) {
    const { scene, rapier, world } = env
    const wood = flat("#a0683c")
    const dark = flat("#7d4f2c")
    // The fence either side of the gate.
    const fence = (x0: number, x1: number) => {
      const width = x1 - x0
      for (let x = x0 + 0.4; x < x1; x += 0.8) {
        const post = mesh(new THREE.BoxGeometry(0.6, height + Math.sin(x * 3) * 0.2, 0.3), Math.round(x * 2) % 2 ? wood : dark)
        post.position.set(x, center.y + height / 2, center.z)
        scene.add(post)
      }
      world.createCollider(rapier.ColliderDesc.cuboid(width / 2, height / 2 + 1, 0.4).setTranslation((x0 + x1) / 2, center.y + height / 2 - 1, center.z))
    }
    fence(fenceTo.minX, center.x - halfWidth)
    fence(center.x + halfWidth, fenceTo.maxX)
    // The two doors, hinged at the outside.
    for (const [door, side] of [[this.left, -1], [this.right, 1]] as const) {
      for (let i = 0; i < 3; i++) {
        const plank = mesh(new THREE.BoxGeometry(halfWidth / 3 - 0.06, height * 0.9, 0.22), i % 2 ? wood : dark)
        plank.position.set(-side * (halfWidth / 6 + (i * halfWidth) / 3), height * 0.45, 0)
        door.add(plank)
      }
      const brace = mesh(new THREE.BoxGeometry(halfWidth, 0.25, 0.26), dark)
      brace.position.set(-side * halfWidth * 0.5, height * 0.5, 0.05)
      brace.rotation.z = side * 0.5
      door.add(brace)
      door.position.set(center.x + side * halfWidth, center.y, center.z)
      scene.add(door)
    }
    this.collider = world.createCollider(rapier.ColliderDesc.cuboid(halfWidth, height / 2 + 1, 0.4).setTranslation(center.x, center.y + height / 2 - 1, center.z))
  }

  openUp() {
    if (this.open) return
    this.open = true
    this.env.world.removeCollider(this.collider, true)
  }

  update(dt: number) {
    if (!this.open) return
    this.openAmount = Math.min(1, this.openAmount + dt * 1.2)
    const angle = (1 - (1 - this.openAmount) ** 3) * (Math.PI / 2) * 0.95
    this.left.rotation.y = angle
    this.right.rotation.y = -angle
  }
}

/**
 * A seesaw: a plank on a log. When the big bear lands on one end, whoever is standing on the
 * other end goes flying.
 */
export class Seesaw {
  readonly group = new THREE.Group()
  private readonly plank = new THREE.Group()
  private tilt = 0
  private tiltTarget = 0
  readonly endA: THREE.Vector3
  readonly endB: THREE.Vector3
  private readonly along: THREE.Vector3

  constructor(env: Env, center: THREE.Vector3, readonly halfLength: number, yaw: number) {
    const { scene, rapier, world } = env
    const base = logMesh(1.6, 0.4)
    base.rotation.y = Math.PI / 2
    this.group.add(base)
    const board = mesh(new THREE.BoxGeometry(halfLength * 2, 0.18, 1.6), flat("#c9a46a"))
    this.plank.add(board)
    for (const side of [-1, 1]) {
      const pad = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 10), flat(side < 0 ? "#ff9ad5" : "#5aa9ff"), { castShadow: false })
      pad.position.set(side * (halfLength - 0.7), 0.12, 0)
      this.plank.add(pad)
    }
    this.plank.position.y = 0.45
    this.group.add(this.plank)
    this.group.position.copy(center)
    this.group.rotation.y = yaw
    scene.add(this.group)
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    world.createCollider(
      rapier.ColliderDesc.cuboid(halfLength, 0.15, 0.8).setTranslation(center.x, center.y + 0.45, center.z).setRotation(rotation)
    )
    const along = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation)
    this.along = along
    this.endA = center.clone().addScaledVector(along, -(halfLength - 0.7)).setY(center.y + 0.55)
    this.endB = center.clone().addScaledVector(along, halfLength - 0.7).setY(center.y + 0.55)
  }

  /** Which half of the plank a point is standing on: -1 = A (pink), 1 = B (blue), 0 = off it. */
  sideOf(feet: THREE.Vector3) {
    const offset = feet.clone().sub(this.group.position)
    const along = offset.x * this.along.x + offset.z * this.along.z
    const across = -offset.x * this.along.z + offset.z * this.along.x
    if (Math.abs(across) > 1 || Math.abs(along) > this.halfLength + 0.3 || Math.abs(offset.y - 0.6) > 0.7) return 0
    return along < -0.4 ? -1 : along > 0.4 ? 1 : 0
  }

  /** Tip the plank: -1 = A end down, 1 = B end down. */
  rest(side: -1 | 0 | 1) {
    this.tiltTarget = side * 0.18
  }

  /** Thwack! B end slams down, A end flicks up. */
  slam() {
    this.tilt = -0.35
    this.tiltTarget = 0.2
  }

  update(dt: number) {
    this.tilt += (this.tiltTarget - this.tilt) * Math.min(1, dt * 8)
    this.plank.rotation.z = -this.tilt
  }
}
