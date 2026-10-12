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
export const mushroom = (env: Env, x: number, z: number, options: { capRadius?: number; height?: number; color?: THREE.ColorRepresentation } = {}) => {
  const { scene, rapier, world, terrain } = env
  const { capRadius = 1.4, height = 1.2, color = "#e5484d" } = options
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
  world.createCollider(rapier.ColliderDesc.cylinder(height / 2, capRadius * 0.35).setTranslation(x, y + height / 2, z))
  const capCollider = world.createCollider(
    rapier.ColliderDesc.cylinder(0.18, capRadius * 0.95).setTranslation(x, y + height + capRadius * 0.6 - 0.25, z)
  )
  return { group, cap, capCollider, top: y + height + capRadius * 0.6 - 0.07 }
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
    readonly width = 3.2
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
    this.angle = Math.min(0, this.angle + dt * 0.9)
    this.hinge.rotation.x = this.angle
    if (this.angle === 0) {
      this.down = true
      this.addColliders()
      this.onLanded()
    }
  }

  private addColliders() {
    const { rapier, world } = this.env
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
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
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
      .add(this.hinge.position)
  }
}
