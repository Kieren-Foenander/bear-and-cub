import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { Sound, SoundName } from "../services/Sound.ts"
import { Bear, type BearSpec } from "./bear.ts"
import { CoopCamera } from "./camera.ts"
import { Berries } from "./collectibles.ts"
import type { Routed } from "./controls.ts"
import { Coop } from "./coop.ts"
import { Interactions } from "./interactions.ts"
import type { LevelDef, LevelLogic, Objective, StageApi } from "./levels/types.ts"
import { Butterflies, Flowers, Grass } from "./nature.ts"
import { Particles } from "./particles.ts"
import { CUB, MAMA } from "./specs.ts"
import { Surfaces } from "./surfaces.ts"
import { Swipes } from "./swipe.ts"
import { Terrain } from "./terrain.ts"
import { flat, mesh } from "./util.ts"

export interface StageServices {
  readonly rapier: typeof RAPIER
  readonly camera: THREE.PerspectiveCamera
  readonly sound: Sound["Service"]
  readonly toast: (text: string) => void
  readonly popCounter: () => void
}

interface Goal {
  readonly at: THREE.Vector3
  readonly open: () => boolean
  readonly beam: THREE.Mesh
}

/**
 * One level, running. Owns its own scene and physics world so loading the next level is just
 * "throw this one away and build another".
 */
export class Stage {
  readonly scene = new THREE.Scene()
  readonly world: RAPIER.World
  readonly terrain: Terrain
  readonly mama: Bear
  readonly cub: Bear
  readonly coop: Coop
  readonly interactions = new Interactions()
  readonly swipes = new Swipes(this.interactions)
  readonly particles: Particles
  readonly surfaces: Surfaces
  readonly berries: Berries
  readonly logic: LevelLogic
  readonly cameraRig: CoopCamera
  private readonly sun: THREE.DirectionalLight
  private readonly clouds: Array<THREE.Group> = []
  private readonly arrow: THREE.Mesh
  private grass: Grass | null = null
  private flowers: Flowers | null = null
  private butterflies: Butterflies | null = null
  private goal: Goal | null = null
  private time = 0
  /** Seconds since both bears reached the honey pot; -1 until then. */
  completeTime = -1

  constructor(
    readonly def: LevelDef,
    private readonly services: StageServices
  ) {
    const { rapier, sound } = services
    const { scene } = this
    this.world = new rapier.World({ x: 0, y: -22, z: 0 })

    scene.background = new THREE.Color(def.sky?.color ?? "#9fd8ff")
    scene.fog = new THREE.Fog(def.sky?.fog ?? "#bfe6ff", 45, 130)
    scene.add(new THREE.HemisphereLight("#d8f0ff", "#6aa84f", 1.4))
    this.sun = new THREE.DirectionalLight("#fff1d0", 2.4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 140 })
    this.sun.shadow.bias = -0.0008
    scene.add(this.sun, this.sun.target)

    this.particles = new Particles(scene)
    this.terrain = new Terrain(def.terrain, scene, rapier, this.world)
    this.surfaces = new Surfaces(rapier, this.world, scene)
    this.berries = new Berries(scene, this.particles)
    this.cameraRig = new CoopCamera(services.camera)
    this.buildClouds()

    const play = (name: SoundName) => sound.play(name)
    const bearColliders = new Set<number>()
    const bearContext = {
      rapier,
      world: this.world,
      scene,
      terrain: this.terrain,
      surfaces: this.surfaces,
      sound: play,
      isBear: (collider: RAPIER.Collider) => bearColliders.has(collider.handle),
      onSplash: (bear: Bear) => {
        play("splash")
        this.particles.burst(bear.position, { colors: ["#ffffff", "#bfe8ff", "#7fd0ff"], count: 30, speed: 5, up: 6 })
        services.toast("Splash!")
      }
    }
    const spawn = (spec: BearSpec, [x, z]: readonly [number, number]) =>
      new THREE.Vector3(x, this.terrain.heightAt(x, z) + spec.halfHeight + spec.radius + 0.3, z)
    this.mama = new Bear(MAMA, bearContext, spawn(MAMA, def.spawn.mama))
    this.cub = new Bear(CUB, bearContext, spawn(CUB, def.spawn.cub))
    bearColliders.add(this.mama.collider.handle)
    bearColliders.add(this.cub.collider.handle)
    this.mama.yaw = this.cub.yaw = Math.PI

    this.coop = new Coop(this.mama, this.cub, this.interactions, scene, this.particles, play, services.toast)

    this.arrow = mesh(new THREE.ConeGeometry(0.5, 1, 4), flat("#ffcf3f"), { castShadow: false })
    this.arrow.rotation.x = Math.PI
    scene.add(this.arrow)

    const api: StageApi = {
      scene,
      rapier,
      world: this.world,
      terrain: this.terrain,
      particles: this.particles,
      interactions: this.interactions,
      swipes: this.swipes,
      surfaces: this.surfaces,
      berries: this.berries,
      coop: this.coop,
      mama: this.mama,
      cub: this.cub,
      sound: play,
      toast: services.toast,
      shake: (amount) => this.cameraRig.shake(amount),
      goal: (at, open = () => true) => {
        this.goal = this.buildGoal(at, open)
      },
      nature: ({ grass, flowers, butterflies }) => {
        if (grass) this.grass = new Grass(scene, this.terrain, grass)
        if (flowers) this.flowers = new Flowers(scene, this.terrain, flowers)
        if (butterflies) this.butterflies = new Butterflies(scene, this.terrain, butterflies)
      }
    }
    this.logic = def.build(api)
    this.cameraRig.update(0, [this.mama.position, this.cub.position], true)
  }

  get butterfliesFound() {
    return this.butterflies?.foundCount ?? 0
  }

  get butterfliesTotal() {
    return this.butterflies?.total ?? 0
  }

  private buildGoal(at: THREE.Vector3, open: () => boolean): Goal {
    const { scene } = this
    const y = this.terrain.heightAt(at.x, at.z)
    const pot = mesh(new THREE.CylinderGeometry(0.6, 0.5, 1, 8), flat("#c9773a"))
    pot.position.set(at.x, y + 0.5, at.z)
    const rim = mesh(new THREE.TorusGeometry(0.58, 0.1, 5, 10), flat("#a85f2b"))
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.5
    const honey = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 8), flat("#ffc21a"))
    honey.position.y = 0.48
    const drip = mesh(new THREE.IcosahedronGeometry(0.15, 0), flat("#ffc21a"))
    drip.position.set(0.5, 0.3, 0.2)
    pot.add(rim, honey, drip)
    scene.add(pot)
    // A soft beam of light so you can see the goal from anywhere.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.6, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })
    )
    beam.position.set(at.x, y + 15, at.z)
    scene.add(beam)
    return { at: new THREE.Vector3(at.x, y, at.z), open, beam }
  }

  private buildClouds() {
    const { minX, maxX, minZ, maxZ } = this.terrain.bounds
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group()
      const puffs = 3 + (i % 3)
      for (let j = 0; j < puffs; j++) {
        const puff = mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.5, 0), flat("#ffffff"), { receiveShadow: false, castShadow: false })
        puff.position.set(j * 2.4 - puffs, Math.random(), Math.random() * 1.5)
        cloud.add(puff)
      }
      cloud.position.set(minX + Math.random() * (maxX - minX), 26 + Math.random() * 8, minZ + Math.random() * (maxZ - minZ))
      this.scene.add(cloud)
      this.clouds.push(cloud)
    }
  }

  /** The current objective, or the "go to the honey" one once the level's puzzles are done. */
  objective(): Objective {
    if (this.completeTime >= 0) return { text: "Hooray!", target: null }
    return this.logic.objective()
  }

  /** One frame of gameplay. `routed` is null while paused/in menus (the world still animates). */
  update(dt: number, routed: Routed | null) {
    this.time += dt
    const { mama, cub } = this
    const mamaPad = routed?.mama ?? null
    const cubPad = routed?.cub ?? null
    const sound = this.services.sound

    // Once the level is won, nothing more to do: just celebrate.
    if (this.completeTime >= 0) routed = null
    if (routed) {
      mama.highlighted = !routed.twoPlayer && routed.active === "mama"
      cub.highlighted = !routed.twoPlayer && routed.active === "cub"

      this.interactions.beginFrame()
      this.interactions.update(dt, mama, mamaPad)
      this.interactions.update(dt, cub, cubPad)

      // B with nothing to do is a roar. Everyone loves a roar.
      for (const [bear, pad] of [[mama, mamaPad], [cub, cubPad]] as const) {
        if (pad?.pressed.b && bear.mode === "walk" && !(bear === mama && this.coop.carrying)) {
          bear.model.cheer()
          sound.play(bear === mama ? "roar" : "cubRoar")
        }
      }
      // X is a paw swipe. Hanging things can only be reached near the top of a jump.
      for (const [bear, pad] of [[mama, mamaPad], [cub, cubPad]] as const) {
        if (pad?.pressed.x && bear.mode === "walk") {
          bear.model.swipe()
          sound.play("swipe")
          this.swipes.swipe(bear)
        }
      }
    } else {
      this.interactions.beginFrame()
    }

    this.surfaces.update(dt)
    mama.update(dt, mamaPad)
    this.coop.update(dt, mamaPad)
    cub.update(dt, cubPad)
    this.logic.update(dt)
    this.swipes.update(dt, [mama, cub])

    this.world.timestep = dt
    this.world.step()

    const bears = [mama.position, cub.position]
    this.terrain.update(this.time)
    this.grass?.update(this.time, mama.position, cub.position)
    this.flowers?.update(dt, bears, (note) => sound.note(note))
    this.butterflies?.update(dt, bears, (position) => {
      sound.play("found")
      this.particles.burst(position, { colors: ["#fff36b", "#ffffff", "#ff9ad5"], count: 24, speed: 3, up: 2, gravity: 0.1 })
      this.services.popCounter()
    })
    this.berries.update(dt, bears, (streak) => {
      sound.note(streak + 2)
      this.services.popCounter()
    })
    this.particles.update(dt)
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.6
      if (cloud.position.x > this.terrain.bounds.maxX + 20) cloud.position.x = this.terrain.bounds.minX - 20
    }
    this.updateGoal(dt)

    this.cameraRig.update(dt, bears)
    const focus = mama.position.clone().add(cub.position).multiplyScalar(0.5)
    this.sun.position.copy(focus).add(new THREE.Vector3(18, 30, 12))
    this.sun.target.position.copy(focus)

    const objective = this.objective()
    this.arrow.visible = routed !== null && objective.target !== null
    if (objective.target) {
      this.arrow.position.copy(objective.target).add(new THREE.Vector3(0, Math.sin(this.time * 3) * 0.3, 0))
      this.arrow.rotation.y += dt * 2
    }
  }

  private updateGoal(dt: number) {
    const goal = this.goal
    if (!goal) return
    const open = goal.open()
    goal.beam.visible = open
    ;(goal.beam.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(this.time * 3) * 0.05
    if (this.completeTime >= 0) {
      this.completeTime += dt
      return
    }
    const close = (bear: Bear) =>
      Math.hypot(bear.position.x - goal.at.x, bear.position.z - goal.at.z) < 3.5 && Math.abs(bear.feetY - goal.at.y) < 2
    if (open && close(this.mama) && close(this.cub)) {
      this.completeTime = 0
      this.services.sound.play("success")
      this.mama.model.celebrate()
      this.cub.model.celebrate()
      for (let i = 0; i < 4; i++) {
        this.particles.burst(goal.at.clone().add(new THREE.Vector3((i - 1.5) * 2, 3, 0)), {
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

  /** Where the honey pot is, for levels that want to point at it. */
  get goalPosition() {
    return this.goal?.at ?? null
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.render(this.scene, this.services.camera)
  }

  dispose() {
    // Bear models may share geometry between levels (cached glTF), so they're marked `shared` and skipped.
    const disposeTree = (object: THREE.Object3D) => {
      if (object.userData.shared) return
      if (object instanceof THREE.Mesh) object.geometry.dispose()
      for (const child of object.children) disposeTree(child)
    }
    disposeTree(this.scene)
    this.world.free()
  }
}
