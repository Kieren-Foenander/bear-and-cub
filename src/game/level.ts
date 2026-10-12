import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { SoundName } from "../services/Sound.ts"
import type { Bear } from "./bear.ts"
import type { Interactions } from "./interactions.ts"
import { createRock, createTree, GRASS_PATCHES } from "./nature.ts"
import type { Particles } from "./particles.ts"
import type { Swipes } from "./swipe.ts"
import { AppleTree, Bell } from "./swipeThings.ts"
import { distanceToRiver, heightAt, pathX, RIVER_HALF_WIDTH, riverZ } from "./terrain.ts"
import { clamp, damp, flat, jitter, mesh, seeded } from "./util.ts"

export interface LevelContext {
  readonly rapier: typeof RAPIER
  readonly world: RAPIER.World
  readonly scene: THREE.Scene
  readonly particles: Particles
  readonly interactions: Interactions
  readonly swipes: Swipes
  readonly sound: (name: SoundName) => void
  readonly toast: (text: string) => void
  readonly shake: (amount: number) => void
}

/** Things the bears care about: where to stand, where to aim. */
export const SPOTS = {
  mamaSpawn: new THREE.Vector3(-1.5, 0, 26),
  cubSpawn: new THREE.Vector3(1.5, 0, 25),
  lift: new THREE.Vector3(6, 0, -1.6),
  liftTarget: new THREE.Vector3(6.8, 3.2, -6.2),
  throw: new THREE.Vector3(0, 0, -11.5),
  throwTarget: new THREE.Vector3(0.5, 0, -30.5),
  appleTree: new THREE.Vector3(-6, 0, 15),
  bell: new THREE.Vector3(5, 0, -32),
  honey: new THREE.Vector3(0, 0, -52)
}
for (const spot of [SPOTS.mamaSpawn, SPOTS.cubSpawn, SPOTS.lift, SPOTS.throw, SPOTS.throwTarget, SPOTS.appleTree, SPOTS.bell, SPOTS.honey]) {
  spot.y = heightAt(spot.x, spot.z)
}

const WALL = { z: -6, hz: 2, top: 8, ledgeTop: 3.2, gapHalf: 2, ledgeX: [2, 10] as const }
const BRIDGE_X = -9

interface DynamicProp {
  mesh: THREE.Object3D
  body: RAPIER.RigidBody
  /** Seconds until it poofs away, so debris never blocks the path. */
  life: number
}

/** A glowing circle on the ground that says "stand here". */
class SpotMarker {
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

export class Level {
  barricadeBroken = false
  bridgeDown = false
  finished = false

  private readonly props: Array<DynamicProp> = []
  private readonly boulder: THREE.Mesh
  private boulderCollider: RAPIER.Collider
  private boulderPush = 0
  private boulderFall = -1
  private readonly boulderStart: THREE.Vector3
  private readonly barricade: THREE.Group
  private barricadeCollider: RAPIER.Collider | null
  private readonly bell: Bell
  readonly appleTree: AppleTree
  private readonly bridge: THREE.Group
  private bridgeAngle = -Math.PI / 2
  private readonly liftMarker: SpotMarker
  private readonly throwMarker: SpotMarker
  private readonly honeyGlow: THREE.Mesh
  private time = 0

  constructor(private readonly ctx: LevelContext) {
    const { scene, rapier, world } = ctx

    this.buildCliffs()

    // --- Puzzle 1: lift the cub onto the ledge so she can push the boulder onto the barricade. ---
    this.boulderStart = new THREE.Vector3(3.3, WALL.ledgeTop + 0.9, WALL.z)
    this.boulder = mesh(jitter(new THREE.DodecahedronGeometry(0.95, 1), 0.08), flat("#8f8a80"))
    this.boulder.position.copy(this.boulderStart)
    scene.add(this.boulder)
    this.boulderCollider = world.createCollider(
      rapier.ColliderDesc.ball(0.9).setTranslation(this.boulderStart.x, this.boulderStart.y, this.boulderStart.z)
    )

    this.barricade = new THREE.Group()
    this.barricade.position.set(0, 0, WALL.z)
    const wood = flat("#a0683c")
    const darkWood = flat("#7d4f2c")
    for (let i = 0; i < 5; i++) {
      const plank = mesh(new THREE.BoxGeometry(0.72, 3.2, 0.25), i % 2 ? wood : darkWood)
      plank.position.set(-1.6 + i * 0.8, 1.6, 0)
      plank.rotation.z = (i - 2) * 0.03
      this.barricade.add(plank)
    }
    for (const [y, angle] of [[1, 0.35], [2.2, -0.35]] as const) {
      const brace = mesh(new THREE.BoxGeometry(4.4, 0.35, 0.25), wood)
      brace.position.set(0, y, 0.25)
      brace.rotation.z = angle
      this.barricade.add(brace)
    }
    scene.add(this.barricade)
    // Taller than it looks, so nobody can hop over it from the ledge.
    this.barricadeCollider = world.createCollider(rapier.ColliderDesc.cuboid(WALL.gapHalf, 4, 0.5).setTranslation(0, 3, WALL.z))

    ctx.interactions.add({
      id: "push-boulder",
      who: "cub",
      kind: "mash",
      buttons: ["b"],
      count: 3,
      label: "Push!",
      anchor: () => this.boulder.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
      inRange: (bear) => bear.feetY > WALL.ledgeTop - 0.6 && bear.position.distanceTo(this.boulder.position) < 2.6,
      enabled: () => this.boulderFall < 0 && !this.barricadeBroken,
      onStep: () => {
        this.boulderPush += 1
        ctx.sound("push")
        ctx.particles.burst(this.boulder.position.clone().setY(WALL.ledgeTop + 0.1), {
          colors: ["#cbb79a", "#a99a85"],
          count: 8,
          speed: 2,
          up: 1
        })
      },
      onComplete: () => {
        this.boulderFall = 0
        ctx.sound("push")
      }
    })

    // --- Practice: an apple tree near the start teaches "jump, then swipe at the top". ---
    this.appleTree = new AppleTree(ctx, SPOTS.appleTree)

    // --- Puzzle 2: throw the cub over the river so she can jump and ring the bell, lowering the bridge. ---
    this.bridge = this.buildBridge()
    this.bell = new Bell(ctx, SPOTS.bell, () => {
      this.bridgeDown = true
      ctx.toast("Ding! The bridge is coming down!")
    })

    // --- The goal: a honey tree. ---
    createTree(scene, rapier, world, SPOTS.honey.x - 2.5, SPOTS.honey.z - 2, { scale: 1.9, kind: "round" })
    const hive = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.55 - Math.abs(i - 1.5) * 0.12, 0.22, 6, 10), flat(i % 2 ? "#f2b632" : "#e09b1d"))
      ring.rotation.x = Math.PI / 2
      ring.position.y = -i * 0.32
      hive.add(ring)
    }
    hive.position.set(SPOTS.honey.x - 1, SPOTS.honey.y + 4.6, SPOTS.honey.z - 1)
    scene.add(hive)
    const pot = mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), flat("#c9773a"))
    pot.position.set(SPOTS.honey.x + 0.8, SPOTS.honey.y + 0.45, SPOTS.honey.z)
    const honey = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8), flat("#ffc21a"))
    honey.position.set(0, 0.46, 0)
    pot.add(honey)
    scene.add(pot)
    this.honeyGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#ffd84d", transparent: true, opacity: 0.25, depthWrite: false })
    )
    this.honeyGlow.position.copy(pot.position).add(new THREE.Vector3(0, 0.5, 0))
    scene.add(this.honeyGlow)

    this.liftMarker = new SpotMarker(scene, SPOTS.lift, "#5aa9ff")
    this.throwMarker = new SpotMarker(scene, SPOTS.throw, "#5aa9ff")

    this.scatter()
  }

  private buildCliffs() {
    const { scene, rapier, world } = this.ctx
    const block = (x0: number, x1: number, top: number, z0 = WALL.z - WALL.hz, z1 = WALL.z + WALL.hz) => {
      const bottom = -2
      const width = x1 - x0
      const height = top - bottom
      const depth = z1 - z0
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      const geometry = jitter(
        new THREE.BoxGeometry(width, height, depth, Math.max(1, Math.round(width / 2.5)), Math.max(1, Math.round(height / 2)), 2),
        0.22
      )
      const rock = mesh(geometry, flat("#a89d8d"))
      rock.position.set(cx, (top + bottom) / 2, cz)
      scene.add(rock)
      const cap = mesh(
        jitter(new THREE.BoxGeometry(width + 0.3, 0.35, depth + 0.3, Math.max(1, Math.round(width / 2.5)), 1, 2), 0.08),
        flat("#76bf4c")
      )
      cap.position.set(cx, top + 0.1, cz)
      scene.add(cap)
      world.createCollider(rapier.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(cx, (top + bottom) / 2, cz))
    }
    block(-46, -WALL.gapHalf, WALL.top)
    block(WALL.ledgeX[0], WALL.ledgeX[1], WALL.ledgeTop)
    // A tall back wall on the ledge so the cub can't wander off the far side.
    block(WALL.gapHalf - 0.01, WALL.ledgeX[1], WALL.top, WALL.z - WALL.hz - 0.6, WALL.z - WALL.hz + 0.6)
    block(WALL.ledgeX[1], 46, WALL.top)
  }

  private buildBridge() {
    const { scene } = this.ctx
    const hingeZ = riverZ(BRIDGE_X) - RIVER_HALF_WIDTH - 1.2
    const length = RIVER_HALF_WIDTH * 2 + 2.4
    const hinge = new THREE.Group()
    hinge.position.set(BRIDGE_X, heightAt(BRIDGE_X, hingeZ), hingeZ)
    const plankMaterials = [flat("#a0683c"), flat("#8d5a32")]
    const planks = Math.round(length / 0.6)
    for (let i = 0; i < planks; i++) {
      const plank = mesh(new THREE.BoxGeometry(3.2, 0.25, 0.55), plankMaterials[i % 2]!)
      plank.position.set((i % 3) * 0.05, 0, 0.3 + i * (length / planks))
      hinge.add(plank)
    }
    for (const side of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.18, 0.18, length), flat("#7d4f2c"))
      rail.position.set(side * 1.55, 0.8, length / 2)
      hinge.add(rail)
      for (let i = 0; i <= 4; i++) {
        const post = mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), flat("#7d4f2c"))
        post.position.set(side * 1.55, 0.4, (i / 4) * length)
        hinge.add(post)
      }
    }
    hinge.rotation.x = this.bridgeAngle
    scene.add(hinge)
    hinge.userData.length = length
    return hinge
  }

  private lowerBridgeColliders() {
    const { rapier, world } = this.ctx
    const length = this.bridge.userData.length as number
    const { x, y, z } = this.bridge.position
    const centerZ = z + length / 2
    world.createCollider(rapier.ColliderDesc.cuboid(1.6, 0.15, length / 2).setTranslation(x, y, centerZ))
    // Invisible side walls so nobody tumbles off the bridge.
    world.createCollider(rapier.ColliderDesc.cuboid(0.15, 1.2, length / 2).setTranslation(x - 1.6, y + 1, centerZ))
    world.createCollider(rapier.ColliderDesc.cuboid(0.15, 1.2, length / 2).setTranslation(x + 1.6, y + 1, centerZ))
  }

  private scatter() {
    const { scene, rapier, world } = this.ctx
    const rand = seeded(1234)
    const blocked = (x: number, z: number, margin: number) =>
      Math.abs(x - pathX(z)) < 8 + margin ||
      distanceToRiver(x, z) < RIVER_HALF_WIDTH + 2.5 + margin ||
      Math.abs(z - WALL.z) < WALL.hz + 2 + margin ||
      GRASS_PATCHES.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + margin) ||
      Math.abs(x - BRIDGE_X) < 4 && Math.abs(z - riverZ(BRIDGE_X)) < 12 ||
      heightAt(x, z) > 3
    let trees = 0
    for (let attempt = 0; attempt < 600 && trees < 55; attempt++) {
      const x = -40 + rand() * 80
      const z = -68 + rand() * 106
      if (blocked(x, z, 1)) continue
      createTree(scene, rapier, world, x, z, { scale: 0.8 + rand() * 0.6, kind: rand() > 0.4 ? "pine" : "round", rand })
      trees++
    }
    let rocks = 0
    for (let attempt = 0; attempt < 400 && rocks < 35; attempt++) {
      const x = -40 + rand() * 80
      const z = -68 + rand() * 106
      if (blocked(x, z, -2)) continue
      createRock(scene, rapier, world, x, z, 0.3 + rand() * 1, rand)
      rocks++
    }
    // A few stepping-stone rocks along the river bank to make it look lived in.
    for (let i = 0; i < 8; i++) {
      const x = -30 + i * 8 + rand() * 3
      if (Math.abs(x) < 12) continue
      createRock(scene, rapier, world, x, riverZ(x) + (rand() > 0.5 ? 1 : -1) * (RIVER_HALF_WIDTH + 0.8), 0.5 + rand() * 0.5, rand)
    }
  }

  private smash() {
    const { rapier, world, scene, particles } = this.ctx
    this.barricadeBroken = true
    if (this.barricadeCollider) world.removeCollider(this.barricadeCollider, true)
    this.barricadeCollider = null
    world.removeCollider(this.boulderCollider, true)

    const temp = new THREE.Vector3()
    const tempQ = new THREE.Quaternion()
    for (const child of [...this.barricade.children]) {
      child.getWorldPosition(temp)
      child.getWorldQuaternion(tempQ)
      scene.attach(child)
      const box = (child as THREE.Mesh).geometry as THREE.BoxGeometry
      const { width, height, depth } = box.parameters
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic().setTranslation(temp.x, temp.y, temp.z).setRotation(tempQ).setLinearDamping(0.3)
      )
      world.createCollider(rapier.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setDensity(0.4), body)
      body.applyImpulse({ x: (Math.random() - 0.5) * 3, y: 3 + Math.random() * 2, z: -4 - Math.random() * 3 }, true)
      body.applyTorqueImpulse({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }, true)
      this.props.push({ mesh: child, body, life: 2.5 + Math.random() })
    }

    scene.remove(this.boulder)
    for (let i = 0; i < 7; i++) {
      const size = 0.3 + Math.random() * 0.25
      const chunk = mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.15), flat("#8f8a80"))
      const p = this.boulder.position
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic().setTranslation(p.x + (Math.random() - 0.5), p.y + Math.random() * 0.5, p.z + (Math.random() - 0.5))
      )
      world.createCollider(rapier.ColliderDesc.ball(size).setDensity(0.6), body)
      body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1.5, z: -1.5 - Math.random() * 2 }, true)
      scene.add(chunk)
      this.props.push({ mesh: chunk, body, life: 2 + Math.random() })
    }

    particles.burst(new THREE.Vector3(0, 1.5, WALL.z), {
      colors: ["#c8b08a", "#a0683c", "#8f8a80", "#e8dcc4"],
      count: 45,
      speed: 7,
      up: 4,
      size: 0.18,
      life: 1.6
    })
    this.ctx.sound("smash")
    this.ctx.shake(0.8)
    this.ctx.toast("CRASH!")
  }

  /** Is the bear on the far side of the river? */
  static acrossRiver(bear: Bear) {
    return bear.position.z < riverZ(bear.position.x) - RIVER_HALF_WIDTH + 0.5
  }

  update(dt: number, mama: Bear, cub: Bear) {
    this.time += dt

    // Boulder wobbles as the cub pushes, then rolls off the ledge onto the barricade.
    if (this.boulderFall < 0) {
      const nudge = this.boulderStart.x - this.boulderPush * 0.12
      this.boulder.position.x = damp(this.boulder.position.x, nudge, 10, dt)
      this.boulder.rotation.z = damp(this.boulder.rotation.z, this.boulderPush * 0.25, 10, dt)
    } else if (!this.barricadeBroken) {
      this.boulderFall += dt
      const rollTime = 0.45
      const dropTime = 0.4
      if (this.boulderFall < rollTime) {
        const t = this.boulderFall / rollTime
        this.boulder.position.x = THREE.MathUtils.lerp(this.boulderStart.x - 0.36, WALL.ledgeX[0] - 0.2, t * t)
      } else {
        const t = clamp((this.boulderFall - rollTime) / dropTime, 0, 1)
        this.boulder.position.x = THREE.MathUtils.lerp(WALL.ledgeX[0] - 0.2, 0.3, t)
        this.boulder.position.y = THREE.MathUtils.lerp(this.boulderStart.y, 2.6, t * t)
        if (t >= 1) this.smash()
      }
      this.boulder.rotation.z += dt * 8
    }

    for (let i = this.props.length - 1; i >= 0; i--) {
      const prop = this.props[i]!
      const t = prop.body.translation()
      const r = prop.body.rotation()
      prop.mesh.position.set(t.x, t.y, t.z)
      prop.mesh.quaternion.set(r.x, r.y, r.z, r.w)
      prop.life -= dt
      if (prop.life < 0.3) prop.mesh.scale.multiplyScalar(0.85)
      if (prop.life <= 0) {
        this.ctx.particles.burst(prop.mesh.position, { colors: ["#e8dcc4", "#ffffff"], count: 6, speed: 2, up: 1 })
        this.ctx.scene.remove(prop.mesh)
        this.ctx.world.removeRigidBody(prop.body)
        this.props.splice(i, 1)
      }
    }

    this.appleTree.update(dt)
    this.bell.update(dt)
    if (this.bridgeDown && this.bridgeAngle < 0) {
      this.bridgeAngle = Math.min(0, this.bridgeAngle + dt * 0.9)
      // Ease in with a little bounce at the end.
      this.bridge.rotation.x = this.bridgeAngle
      if (this.bridgeAngle === 0) {
        this.lowerBridgeColliders()
        this.ctx.sound("smash")
        this.ctx.shake(0.3)
        this.ctx.particles.burst(this.bridge.position.clone().add(new THREE.Vector3(0, 0.3, (this.bridge.userData.length as number) - 0.5)), {
          colors: ["#e8dcc4", "#c8b08a"],
          count: 25,
          speed: 4
        })
      }
    }

    // Markers only show when they're useful.
    this.liftMarker.update(dt, !this.barricadeBroken && cub.feetY < WALL.ledgeTop - 0.5)
    this.throwMarker.update(dt, this.barricadeBroken && !this.bridgeDown && !Level.acrossRiver(cub))

    this.honeyGlow.scale.setScalar(1 + Math.sin(this.time * 3) * 0.15)
    if (!this.finished && this.bridgeDown) {
      const close = (bear: Bear) => bear.position.distanceTo(SPOTS.honey) < 7
      if (close(mama) && close(cub)) {
        this.finished = true
        this.ctx.sound("success")
        this.ctx.toast("Hooray! You found the honey!")
        for (let i = 0; i < 4; i++) {
          this.ctx.particles.burst(SPOTS.honey.clone().add(new THREE.Vector3((i - 1.5) * 2, 3, 0)), {
            colors: ["#ff6fa8", "#ffd84d", "#6fc3ff", "#8fe388", "#c38bff"],
            count: 40,
            speed: 8,
            up: 6,
            size: 0.16,
            life: 2.5,
            gravity: 0.25
          })
        }
      }
    }
  }

  /** What should the players do next? Drives the objective banner and the floating arrow. */
  objective(cub: Bear): { text: string; target: THREE.Vector3 | null } {
    if (!this.barricadeBroken) {
      if (this.appleTree.cubHits === 0 && cub.feetY < WALL.ledgeTop - 0.6) {
        return { text: "Cub: jump and swipe an apple!", target: SPOTS.appleTree.clone().add(new THREE.Vector3(0, 6, 0)) }
      }
      if (cub.feetY > WALL.ledgeTop - 0.6) return { text: "Cub: push the big rock!", target: this.boulder.position.clone().add(new THREE.Vector3(0, 2.6, 0)) }
      return { text: "Mama: lift Cub up onto the rock!", target: SPOTS.lift.clone().add(new THREE.Vector3(0, 3.5, 0)) }
    }
    if (!this.bridgeDown) {
      if (Level.acrossRiver(cub)) return { text: "Cub: jump and ring the bell!", target: SPOTS.bell.clone().add(new THREE.Vector3(0, 5, 0)) }
      return { text: "Mama: throw Cub over the river!", target: SPOTS.throw.clone().add(new THREE.Vector3(0, 3.5, 0)) }
    }
    if (!this.finished) return { text: "Find the honey tree!", target: SPOTS.honey.clone().add(new THREE.Vector3(0.8, 4, 0)) }
    return { text: "Explore! Can you find all the butterflies?", target: null }
  }
}

