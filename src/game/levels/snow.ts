import * as THREE from "three"
import { markStatic } from "../batching.ts"
import { Snowfall } from "../critters.ts"
import { createTree, scatter } from "../nature.ts"
import { Drawbridge, sign } from "../props.ts"
import { Bell } from "../swipeThings.ts"
import { edgeHills } from "../terrain.ts"
import { damp, flat, jitter, mesh, smoothstep } from "../util.ts"
import type { LevelDef } from "./types.ts"

/**
 * Chapter 2, Level 7: Snowy Slopes.
 * Teaches: careful steering on slippery ice (small, gentle stick movements).
 *
 * An ice rink to slide around on, then Cub slides across thin ice floes on the frozen river (too
 * thin for Mama!) to ring a bell that lowers a snow bridge. Finally both bears push a giant
 * snowball into a crack in the ice to make a bridge to the cosy cabin.
 */

const BOUNDS = { minX: -32, maxX: 32, minZ: -64, maxZ: 42 }
const WATER = -1
const RINK = { x: 0, z: 20, r: 8 }
const RIVER = { z: -4, half: 5 }
const CRACK = { z: -24, half: 2.2 }
const SNOWBALL = { x: 6, startZ: -14.5, edgeZ: -21.2 }
const ICE_TRACTION = 0.18

const riverMask = (z: number) => smoothstep(RIVER.half + 0.4, RIVER.half - 0.4, Math.abs(z - RIVER.z))
const crackMask = (z: number) => smoothstep(CRACK.half + 0.4, CRACK.half - 0.4, Math.abs(z - CRACK.z))
const onRink = (x: number, z: number) => Math.hypot(x - RINK.x, z - RINK.z) < RINK.r

const height = (x: number, z: number) => {
  const bumps = 0.6 * Math.sin(x * 0.17) * Math.cos(z * 0.14) + 0.35 * Math.sin(x * 0.36 + z * 0.27)
  const corridor = smoothstep(10, 20, Math.abs(x))
  const water = Math.max(riverMask(z), crackMask(z))
  let h = (bumps + 0.5) * corridor * (1 - water)
  h -= 2.6 * water
  h += edgeHills(BOUNDS, x, z) * (1 - water)
  return h
}

export const snow: LevelDef = {
  id: "snow",
  title: "Snowy Slopes",
  teaches: "Steer gently on slippery ice",
  emoji: "❄️",
  unlockAfter: "night",
  sky: {
    color: "#cfe6f7",
    fog: "#e4f0f8",
    fogNear: 40,
    fogFar: 115,
    hemisphere: { sky: "#eaf4ff", ground: "#c9d8e6", intensity: 1.5 },
    sun: { color: "#fff6e8", intensity: 2.1 }
  },
  spawn: { mama: [-1.5, 34], cub: [1.5, 33] },
  terrain: {
    bounds: BOUNDS,
    height,
    cell: 1,
    waterY: WATER,
    waterColor: "#3d7fb8",
    grass: ["#eef4fa", "#e6eef7", "#f4f8fc", "#e1eaf4"],
    hill: "#d3dfeb",
    rock: "#8f9bab",
    color: (x, z, y) => (onRink(x, z) && y > -0.3 ? "#bfe6f7" : null)
  },
  build: (api) => {
    const { scene, mama, cub, berries, particles, sound, toast, shake, interactions, surfaces, rapier, world } = api
    const at = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z)
    const updates: Array<(dt: number) => void> = []

    // Ice is slippery: the rink and the frozen river.
    api.setTraction((x, z) => (onRink(x, z) || Math.abs(z - RIVER.z) < RIVER.half + 0.6 ? ICE_TRACTION : 1))

    // --- The ice rink: slide around and grab the berries. ---
    const rinkBerries: Array<number> = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      rinkBerries.push(berries.add(at(RINK.x + Math.cos(a) * 5, RINK.z + Math.sin(a) * 5)))
    }
    rinkBerries.push(berries.add(at(RINK.x, RINK.z)))
    const rinkCollected = () => rinkBerries.filter((i) => berries.taken(i)).length
    sign(api, RINK.x + RINK.r + 1.5, RINK.z + 4, "⛸️")

    // --- The frozen river: thin ice floes. Fine for Cub, far too thin for Mama. ---
    const floes: Array<ReturnType<typeof surfaces.addPlatform>> = []
    const floeSpots = [
      { x: 2, z: 0.3 },
      { x: 3.5, z: -1.9 },
      { x: 2.1, z: -4.1 },
      { x: 3.6, z: -6.3 },
      { x: 2.4, z: -8.5 }
    ]
    for (const [i, spot] of floeSpots.entries()) {
      const size = 3.1
      const object = new THREE.Group()
      const slab = mesh(jitter(new THREE.BoxGeometry(size, 0.3, size, 2, 1, 2), 0.06), flat("#d9f1fb"))
      const shine = mesh(new THREE.BoxGeometry(size * 0.5, 0.02, 0.15), flat("#ffffff"), { castShadow: false })
      shine.position.set(-0.3, 0.16, 0.3)
      shine.rotation.y = 0.6
      object.add(slab, shine)
      object.rotation.y = i % 2 ? 0.1 : -0.08
      let sink = 0
      let heavyLatch = 0
      const phase = i * 1.3
      const floe = surfaces.addPlatform(object, rapier.ColliderDesc.cuboid(size / 2, 0.15, size / 2), (t, weight, dt) => {
        // Mama counts as "on" this floe if any part of her overlaps it (not just her middle), and
        // once it starts to crack it keeps going for a moment, so neighbouring floes can't hold her up.
        const top = -0.1 - sink
        const overlapping =
          Math.abs(mama.position.x - spot.x) < size / 2 + mama.spec.radius &&
          Math.abs(mama.position.z - spot.z) < size / 2 + mama.spec.radius &&
          mama.feetY < top + 0.5 &&
          mama.feetY > top - 1.2
        heavyLatch = overlapping || weight >= 3 ? 0.9 : Math.max(0, heavyLatch - dt)
        sink = damp(sink, heavyLatch > 0 ? 1.9 : weight > 0 ? 0.08 : 0, heavyLatch > 0 ? 2 : 5, dt)
        return new THREE.Vector3(spot.x, -0.25 - sink + Math.sin(t * 1.2 + phase) * 0.03, spot.z)
      })
      floes.push(floe)
      berries.add(new THREE.Vector3(spot.x, -0.1, spot.z), 0.6)
    }
    let thinIceCooldown = 0
    const acrossRiver = (bear: typeof cub) => bear.position.z < RIVER.z - RIVER.half - 0.3
    const bridge = new Drawbridge(api, at(-8, RIVER.z - RIVER.half - 0.6).setY(0), RIVER.half * 2 + 1.2, 0, () => {
      sound("smash")
      shake(0.3)
      particles.burst(bridge.tip, { colors: ["#ffffff", "#e6f2fb"], count: 30, speed: 4 })
    })
    // A snowy bridge: white planks.
    bridge.hinge.traverse((object) => {
      if (object instanceof THREE.Mesh) object.material = flat("#f4f8fc")
    })
    updates.push((dt) => bridge.update(dt))
    const bellAt = at(3.5, RIVER.z - RIVER.half - 4)
    const bell = new Bell(
      api,
      bellAt,
      () => {
        bridge.lower()
        toast("Ding! A snow bridge for Mama!")
      },
      "z"
    )
    updates.push((dt) => bell.update(dt))

    // --- The giant snowball: push it into the crack to make a bridge. Two bears push faster! ---
    const ball = new THREE.Group()
    const snowMaterial = flat("#f8fbff")
    const sphere = mesh(jitter(new THREE.IcosahedronGeometry(1, 2), 0.04), snowMaterial)
    ball.add(sphere)
    for (let i = 0; i < 6; i++) {
      const lump = mesh(new THREE.IcosahedronGeometry(0.3, 0), snowMaterial)
      const a = (i / 6) * Math.PI * 2
      lump.position.set(Math.cos(a) * 0.85, Math.sin(a * 2) * 0.4, Math.sin(a) * 0.85)
      ball.add(lump)
    }
    scene.add(ball)
    let radius = 1.15
    let along = 0
    let dropped = 0
    let filled = false
    const ballPosition = new THREE.Vector3(SNOWBALL.x, radius, SNOWBALL.startZ)
    const ballBody = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(ballPosition.x, ballPosition.y, ballPosition.z))
    // A flat-backed collider (it still looks round) so a push goes straight instead of sliding off the side.
    const ballShape = () => rapier.ColliderDesc.cuboid(radius * 1.05, radius, radius * 0.9)
    let ballCollider = world.createCollider(ballShape(), ballBody)
    let pushers = 0
    const pushing = (bear: typeof cub) => {
      const dx = bear.position.x - ballPosition.x
      const dz = bear.position.z - ballPosition.z
      const touching = Math.abs(dx) < radius * 1.05 + bear.spec.radius && dz < radius * 0.9 + bear.spec.radius + 0.35
      return bear.mode === "walk" && bear.grounded && touching && dz > 0.3 && bear.velocity.z < -0.8
    }
    interactions.add({
      id: "push-snowball-cub",
      who: "cub",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => ballPosition.clone().add(new THREE.Vector3(0, radius + 1.6, 0)),
      inRange: (bear) => bear.position.distanceTo(ballPosition) < radius + 3,
      enabled: () => !filled && dropped === 0,
      view: (bear) =>
        pushing(bear)
          ? { buttons: ["move"], label: pushers > 1 ? "Push together! 💪" : "Push! Keep going!" }
          : { buttons: ["move"], label: "Push it this way ⬆" }
    })
    interactions.add({
      id: "push-snowball-mama",
      who: "mama",
      kind: "guide",
      buttons: [],
      label: "",
      anchor: () => ballPosition.clone().add(new THREE.Vector3(0, radius + 2.6, 0)),
      inRange: (bear) => bear.position.distanceTo(ballPosition) < radius + 3.5,
      enabled: () => !filled && dropped === 0,
      view: (bear) => (pushing(bear) ? { buttons: ["move"], label: "Push together!" } : { buttons: ["move"], label: "Help push!" })
    })
    updates.push((dt) => {
      if (filled) return
      if (dropped === 0) {
        pushers = (pushing(cub) ? 1 : 0) + (pushing(mama) ? 1 : 0)
        if (pushers > 0) {
          const speed = 1.1 * pushers
          const step = speed * dt
          along += step
          ballPosition.z = SNOWBALL.startZ - along
          sphere.rotation.x -= step / radius
          // It picks up snow as it rolls.
          const grown = Math.min(1.6, 1.15 + along * 0.07)
          if (grown - radius > 0.05) {
            radius = grown
            world.removeCollider(ballCollider, false)
            ballCollider = world.createCollider(ballShape(), ballBody)
          }
          if (Math.random() < 0.3) particles.burst(ballPosition.clone().setY(0.2), { colors: ["#ffffff"], count: 2, speed: 1.5, up: 1 })
        }
        if (ballPosition.z <= SNOWBALL.edgeZ) {
          dropped = 0.001
          world.removeCollider(ballCollider, true)
          sound("throw")
        }
      } else {
        // Tip over the edge and wedge into the crack.
        dropped = Math.min(1, dropped + dt * 1.6)
        ballPosition.z = THREE.MathUtils.lerp(SNOWBALL.edgeZ, CRACK.z, dropped)
        ballPosition.y = radius - (radius + 0.45) * dropped * dropped
        sphere.rotation.x -= dt * 3
        if (dropped >= 1) {
          filled = true
          ball.scale.set(1.15 * radius, 0.85 * radius, 1.25 * radius)
          world.createCollider(rapier.ColliderDesc.cuboid(radius + 0.4, 0.2, CRACK.half + 0.8).setTranslation(SNOWBALL.x, -0.2, CRACK.z))
          sound("smash")
          shake(0.5)
          toast("A snowball bridge!")
          particles.burst(new THREE.Vector3(SNOWBALL.x, 0.3, CRACK.z), { colors: ["#ffffff", "#e6f2fb"], count: 40, speed: 6, up: 4 })
        }
      }
      ball.position.copy(ballPosition)
      if (!filled) ball.scale.setScalar(radius)
      ballBody.setNextKinematicTranslation(ballPosition)
    })

    // --- The cosy cabin at the end. ---
    const honey = at(0, -44)
    api.goal(honey, () => filled)
    const cabin = new THREE.Group()
    const logs = flat("#8a5a36")
    const walls = mesh(new THREE.BoxGeometry(6, 3, 4.5), logs)
    walls.position.y = 1.5
    const roof = mesh(new THREE.ConeGeometry(4.8, 2.4, 4), flat("#f8fbff"))
    roof.position.y = 4.2
    roof.rotation.y = Math.PI / 4
    roof.scale.set(1, 1, 0.8)
    const door = mesh(new THREE.BoxGeometry(1.1, 1.9, 0.1), flat("#5a3a22"))
    door.position.set(0, 0.95, 2.26)
    const window1 = mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: "#ffd77a", emissive: "#ffb347", emissiveIntensity: 0.8 }))
    window1.position.set(-1.8, 1.8, 2.26)
    const window2 = window1.clone()
    window2.position.x = 1.8
    const chimney = mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), flat("#9a968c"))
    chimney.position.set(1.6, 4.6, -0.6)
    cabin.add(walls, roof, door, window1, window2, chimney)
    cabin.position.copy(at(0, -50))
    scene.add(markStatic(cabin))
    world.createCollider(rapier.ColliderDesc.cuboid(3, 2.5, 2.25).setTranslation(0, cabin.position.y + 1.5, -50))
    let smokeTime = 0
    updates.push((dt) => {
      smokeTime -= dt
      if (smokeTime <= 0) {
        smokeTime = 0.35
        particles.burst(new THREE.Vector3(1.6, cabin.position.y + 5.6, -50.6), { colors: ["#e8e8e8", "#ffffff"], count: 1, speed: 0.3, up: 1.6, gravity: -0.02, life: 2.5, size: 0.3 })
      }
    })

    // Snowmen to say hello.
    const snowman = (x: number, z: number, facing: number) => {
      const group = new THREE.Group()
      for (const [y, r] of [[0.7, 0.75], [1.65, 0.55], [2.4, 0.4]] as const) {
        const part = mesh(new THREE.IcosahedronGeometry(r, 1), snowMaterial)
        part.position.y = y
        group.add(part)
      }
      const nose = mesh(new THREE.ConeGeometry(0.08, 0.4, 5), flat("#ff8c2a"))
      nose.rotation.x = Math.PI / 2
      nose.position.set(0, 2.4, 0.5)
      group.add(nose)
      for (const side of [-1, 1]) {
        const eye = mesh(new THREE.IcosahedronGeometry(0.05, 0), flat("#222222"))
        eye.position.set(side * 0.14, 2.5, 0.36)
        group.add(eye)
      }
      const scarf = mesh(new THREE.TorusGeometry(0.42, 0.1, 5, 10), flat("#e5484d"))
      scarf.rotation.x = Math.PI / 2
      scarf.position.y = 2.05
      group.add(scarf)
      group.position.copy(at(x, z))
      group.rotation.y = facing
      scene.add(markStatic(group))
      world.createCollider(rapier.ColliderDesc.cylinder(1.2, 0.7).setTranslation(x, group.position.y + 1.2, z))
    }
    snowman(-11, 22, 0.4)
    snowman(9, -36, -0.3)
    snowman(-6, -46, 0.2)

    berries.line(at(0, 10), at(0, 4), 3, height)
    berries.line(at(6, -13), at(6, -10.5), 2, height)
    berries.line(at(SNOWBALL.x, CRACK.z - 4), at(0, -40), 4, height)
    berries.ring(at(-20, 6), 2, 5, height)
    berries.ring(at(20, -34), 2, 5, height)

    const snowfall = new Snowfall(scene, 900, 44)
    const focus = new THREE.Vector3()
    updates.push((dt) => {
      focus.copy(mama.position).add(cub.position).multiplyScalar(0.5)
      snowfall.update(dt, focus)
      thinIceCooldown -= dt
      if (thinIceCooldown <= 0 && mama.surfaceBelow && floes.includes(mama.surfaceBelow as (typeof floes)[number])) {
        thinIceCooldown = 4
        toast("Crack! Too thin for Mama!")
        sound("splashSmall")
      }
    })

    createTree(api, -12, -52, { scale: 1.6, kind: "pine", snowy: true })
    createTree(api, 12, -53, { scale: 1.4, kind: "pine", snowy: true })
    scatter(api, {
      seed: 808,
      trees: 55,
      rocks: 12,
      snowy: true,
      kinds: ["pine", "pine", "pine", "round"],
      blocked: (x, z, margin) =>
        Math.abs(x) < 12 + margin ||
        Math.hypot(x - RINK.x, z - RINK.z) < RINK.r + 3 + margin ||
        riverMask(z) > 0 ||
        crackMask(z) > 0 ||
        Math.abs(z - RIVER.z) < RIVER.half + 2 ||
        Math.abs(z - CRACK.z) < CRACK.half + 2
    })

    return {
      update: (dt) => {
        for (const update of updates) update(dt)
      },
      objective: () => {
        if (!bridge.down) {
          if (rinkCollected() < 4 && cub.position.z > RIVER.z + RIVER.half + 1)
            return { text: `Slide on the ice! Grab the berries (${Math.min(4, rinkCollected())}/4)`, target: null }
          if (!acrossRiver(cub)) return { text: "Cub: steer gently across the ice floes!", target: new THREE.Vector3(floeSpots[0]!.x, 2.5, floeSpots[0]!.z) }
          return { text: "Cub: jump and ring the bell!", target: bellAt.clone().add(new THREE.Vector3(0, 4.5, 0)) }
        }
        if (!acrossRiver(mama)) return { text: "Mama: cross the snow bridge!", target: new THREE.Vector3(-8, 2.5, RIVER.z) }
        if (!filled) return { text: pushers > 1 ? "Push, push, push! 💪" : "Push the big snowball into the crack!", target: ballPosition.clone().add(new THREE.Vector3(0, radius + 3.5, 0)) }
        return { text: "Both bears to the cosy cabin!", target: honey.clone().add(new THREE.Vector3(0, 3.5, 0)) }
      }
    }
  }
}
