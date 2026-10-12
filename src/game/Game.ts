import { Effect, Layer } from "effect"
import * as THREE from "three"
import { Hud } from "../services/Hud.ts"
import { Input } from "../services/Input.ts"
import { Physics } from "../services/Physics.ts"
import { Renderer } from "../services/Renderer.ts"
import { Sound } from "../services/Sound.ts"
import { Bear, type BearSpec } from "./bear.ts"
import { CoopCamera } from "./camera.ts"
import { ControlRouter } from "./controls.ts"
import { Coop } from "./coop.ts"
import { GameHud } from "./hud.ts"
import { Interactions } from "./interactions.ts"
import { Level, SPOTS } from "./level.ts"
import { Butterflies, Flowers, Grass, GRASS_PATCHES } from "./nature.ts"
import { Particles } from "./particles.ts"
import { Prompts } from "./prompts.ts"
import { createTerrain, Water } from "./terrain.ts"
import { flat, mesh } from "./util.ts"

const MAMA: BearSpec = {
  id: "mama",
  name: "Mama Bear",
  look: { fur: "#8b5a3c", belly: "#d9a877" },
  scale: 1,
  radius: 0.7,
  halfHeight: 0.25,
  speed: 6.5,
  jumpSpeed: 7.5,
  ringColor: "#5aa9ff",
  mass: 4
}

const CUB: BearSpec = {
  id: "cub",
  name: "Cub",
  look: { fur: "#c98b55", belly: "#f1d2a6", scarf: "#ff6fa8" },
  scale: 0.55,
  radius: 0.4,
  halfHeight: 0.13,
  speed: 6,
  jumpSpeed: 8.5,
  ringColor: "#ff6fa8",
  mass: 1
}

const spawnPoint = (spot: THREE.Vector3, spec: BearSpec) =>
  spot.clone().add(new THREE.Vector3(0, spec.halfHeight + spec.radius + 0.3, 0))

/** Everything that happens each frame. Plain mutable TypeScript, so the hot path stays allocation-light. */
class Game {
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly world: Physics["Service"]["world"]
  private readonly sun: THREE.DirectionalLight
  private readonly coopCamera: CoopCamera
  readonly router = new ControlRouter()
  private readonly interactions = new Interactions()
  private readonly particles: Particles
  private readonly water: Water
  private readonly grass: Grass
  private readonly flowers: Flowers
  private readonly butterflies: Butterflies
  private readonly clouds: Array<THREE.Group> = []
  private readonly arrow: THREE.Mesh
  readonly mama: Bear
  readonly cub: Bear
  readonly coop: Coop
  readonly level: Level
  private readonly hud: GameHud
  private readonly prompts: Prompts
  private started = false
  private time = 0

  constructor(
    private readonly renderer: Renderer["Service"],
    physics: Physics["Service"],
    private readonly input: Input["Service"],
    private readonly sound: Sound["Service"],
    hudRoot: HTMLElement
  ) {
    const { scene, camera } = renderer
    const { RAPIER, world } = physics
    this.scene = scene
    this.camera = camera
    this.world = world

    scene.background = new THREE.Color("#9fd8ff")
    scene.fog = new THREE.Fog("#bfe6ff", 45, 120)
    scene.add(new THREE.HemisphereLight("#d8f0ff", "#6aa84f", 1.4))
    this.sun = new THREE.DirectionalLight("#fff1d0", 2.4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 120 })
    this.sun.shadow.bias = -0.0008
    scene.add(this.sun, this.sun.target)

    this.hud = new GameHud(hudRoot)
    this.prompts = new Prompts(hudRoot)
    this.particles = new Particles(scene)
    this.coopCamera = new CoopCamera(camera)

    createTerrain(scene, RAPIER, world)
    this.water = new Water(scene)
    this.grass = new Grass(scene, GRASS_PATCHES)
    this.flowers = new Flowers(scene)
    this.butterflies = new Butterflies(scene, GRASS_PATCHES)
    this.buildClouds()

    const play = (name: Parameters<Sound["Service"]["play"]>[0]) => sound.play(name)
    const bearContext = {
      rapier: RAPIER,
      world,
      scene,
      sound: play,
      onSplash: (bear: Bear) => {
        play("splash")
        this.particles.burst(bear.position, { colors: ["#ffffff", "#bfe8ff", "#7fd0ff"], count: 30, speed: 5, up: 6 })
        this.hud.toast("Splash!")
      }
    }
    this.mama = new Bear(MAMA, bearContext, spawnPoint(SPOTS.mamaSpawn, MAMA))
    this.cub = new Bear(CUB, bearContext, spawnPoint(SPOTS.cubSpawn, CUB))
    this.mama.yaw = this.cub.yaw = Math.PI

    this.level = new Level({
      rapier: RAPIER,
      world,
      scene,
      particles: this.particles,
      interactions: this.interactions,
      sound: play,
      toast: (text) => this.hud.toast(text),
      shake: (amount) => this.coopCamera.shake(amount)
    })
    this.coop = new Coop(this.mama, this.cub, this.interactions, play)

    this.arrow = mesh(new THREE.ConeGeometry(0.5, 1, 4), flat("#ffcf3f"), { castShadow: false })
    this.arrow.rotation.x = Math.PI
    scene.add(this.arrow)

    this.coopCamera.update(0, [this.mama.position, this.cub.position], true)
  }

  private buildClouds() {
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group()
      const puffs = 3 + (i % 3)
      for (let j = 0; j < puffs; j++) {
        const puff = mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.5, 0), flat("#ffffff"), { receiveShadow: false })
        puff.position.set(j * 2.4 - puffs, Math.random(), Math.random() * 1.5)
        cloud.add(puff)
      }
      cloud.position.set(-60 + Math.random() * 120, 24 + Math.random() * 8, -70 + Math.random() * 110)
      this.scene.add(cloud)
      this.clouds.push(cloud)
    }
  }

  private start() {
    this.started = true
    this.hud.hideStart()
    this.sound.unlock()
    this.sound.play("success")
  }

  frame(dt: number) {
    this.time += dt
    this.input.poll()
    const routed = this.router.route(this.input.devices())

    if (!this.started) {
      const pad = this.input.devices().find((d) => d.kind === "gamepad")
      this.hud.setStartStyle(pad?.style ?? "xbox")
      if (routed.anyPressed) this.start()
    } else {
      this.play(dt, routed)
    }

    this.coopCamera.update(dt, [this.mama.position, this.cub.position])

    const objective = this.level.objective(this.cub)
    this.hud.update(dt, {
      twoPlayer: routed.twoPlayer,
      active: this.router.active,
      mamaStyle: routed.mamaStyle,
      cubStyle: routed.cubStyle,
      objective: this.started ? objective.text : "",
      butterflies: this.butterflies.foundCount,
      butterfliesTotal: this.butterflies.total,
      soundLocked: this.started && this.sound.isLocked()
    })

    this.arrow.visible = this.started && objective.target !== null
    if (objective.target) {
      this.arrow.position.copy(objective.target).add(new THREE.Vector3(0, Math.sin(this.time * 3) * 0.3, 0))
      this.arrow.rotation.y += dt * 2
    }

    this.prompts.update(this.interactions.active, this.camera, ({ bear }) =>
      bear.spec.id === "mama" ? routed.mamaStyle : routed.cubStyle
    )

    this.renderer.renderer.render(this.scene, this.camera)
  }

  private play(dt: number, routed: ReturnType<ControlRouter["route"]>) {
    const { mama, cub } = this
    if (routed.swapped) {
      this.sound.play("swap")
      this.hud.toast(this.router.active === "mama" ? "Playing as Mama" : "Playing as Cub")
    }
    mama.highlighted = !routed.twoPlayer && this.router.active === "mama"
    cub.highlighted = !routed.twoPlayer && this.router.active === "cub"

    this.interactions.beginFrame()
    this.interactions.update(dt, mama, routed.mama)
    this.interactions.update(dt, cub, routed.cub)

    // B with nothing to do is a roar. Everyone loves a roar.
    for (const [bear, pad] of [[mama, routed.mama], [cub, routed.cub]] as const) {
      if (pad?.pressed.b && bear.mode === "walk" && !(bear === mama && this.coop.carrying)) {
        bear.model.cheer()
        this.sound.play(bear === mama ? "roar" : "cubRoar")
      }
    }

    mama.update(dt, routed.mama)
    this.coop.update(dt, routed.mama)
    cub.update(dt, routed.cub)
    this.level.update(dt, mama, cub)

    this.world.timestep = dt
    this.world.step()

    const bears = [mama.position, cub.position]
    this.water.update(this.time)
    this.grass.update(this.time, mama.position, cub.position)
    this.flowers.update(dt, bears, (note) => this.sound.note(note))
    this.butterflies.update(dt, bears, (position) => {
      this.sound.play("found")
      this.particles.burst(position, { colors: ["#fff36b", "#ffffff", "#ff9ad5"], count: 24, speed: 3, up: 2, gravity: 0.1 })
      this.hud.popCounter()
    })
    this.particles.update(dt)
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.6
      if (cloud.position.x > 70) cloud.position.x = -70
    }

    const focus = mama.position.clone().add(cub.position).multiplyScalar(0.5)
    this.sun.position.copy(focus).add(new THREE.Vector3(18, 30, 12))
    this.sun.target.position.copy(focus)
  }
}

/** Wires the Effect services into the game and runs the frame loop until the layer is torn down. */
export const GameLive = Layer.effectDiscard(
  Effect.gen(function*() {
    const renderer = yield* Renderer
    const physics = yield* Physics
    const input = yield* Input
    const sound = yield* Sound
    const hud = yield* Hud

    const game = new Game(renderer, physics, input, sound, hud.root)
    // Handy for poking at the game from the browser console while developing.
    if (import.meta.env.DEV) Object.assign(window, { game })

    const loop = Effect.callback<never>(() => {
      let last = performance.now()
      let handle = requestAnimationFrame(function tick(now) {
        // Clamp so a background tab doesn't explode the physics when it comes back.
        const dt = Math.min((now - last) / 1000, 1 / 30)
        last = now
        game.frame(dt)
        handle = requestAnimationFrame(tick)
      })
      return Effect.sync(() => cancelAnimationFrame(handle))
    })

    yield* Effect.forkScoped(loop)
  })
)
