import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { markStatic } from "./batching.ts"
import type { Terrain } from "./terrain.ts"
import { damp, flat, jitter, mesh, seeded } from "./util.ts"

/** Where things get built: the scene, the physics world and the ground. */
export interface Env {
  readonly scene: THREE.Scene
  readonly rapier: typeof RAPIER
  readonly world: RAPIER.World
  readonly terrain: Terrain
}

export interface Patch {
  readonly x: number
  readonly z: number
  readonly radius: number
}

export const createTree = (
  env: Env,
  x: number,
  z: number,
  options: { scale?: number; kind?: "pine" | "round"; rand?: () => number; snowy?: boolean } = {}
) => {
  const { scene, rapier, world } = env
  const { scale = 1, kind = "pine", rand = Math.random, snowy = false } = options
  const y = env.terrain.heightAt(x, z)
  const tree = new THREE.Group()
  tree.position.set(x, y - 0.2, z)
  tree.rotation.y = rand() * Math.PI * 2
  tree.scale.setScalar(scale)

  const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 6), flat("#8a5a36"))
  trunk.position.y = 1.2
  tree.add(trunk)

  if (kind === "pine") {
    const greens = snowy ? ["#3f7f55", "#eef4fa", "#f8fbff"] : ["#3f8f4a", "#4a9e52", "#55ab5b"]
    for (let i = 0; i < 3; i++) {
      const cone = mesh(jitter(new THREE.ConeGeometry(1.9 - i * 0.5, 2.2, 7), 0.08), flat(greens[i]!))
      cone.position.y = 2.6 + i * 1.15
      tree.add(cone)
    }
  } else {
    const greens = snowy ? ["#e8f0f8", "#f6f9fc", "#dfe9f3"] : ["#5fb35a", "#6cc062", "#4fa152"]
    for (let i = 0; i < 3; i++) {
      const blob = mesh(jitter(new THREE.IcosahedronGeometry(1.3 - i * 0.2, 1), 0.12), flat(greens[i]!))
      blob.position.set((i - 1) * 0.7, 3.2 + (i % 2) * 0.7, (i % 2) * 0.4)
      tree.add(blob)
    }
  }
  scene.add(markStatic(tree))
  world.createCollider(rapier.ColliderDesc.cylinder(2, 0.4 * scale).setTranslation(x, y + 1.6, z))
  return tree
}

export const createRock = (
  env: Env,
  x: number,
  z: number,
  size: number,
  rand: () => number
) => {
  const rock = mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.12), flat(rand() > 0.5 ? "#9a968c" : "#a8a397"))
  rock.scale.y = 0.65
  rock.rotation.y = rand() * Math.PI
  const { scene, rapier, world } = env
  const y = env.terrain.heightAt(x, z)
  rock.position.set(x, y + size * 0.2, z)
  scene.add(markStatic(rock))
  if (size > 0.6) world.createCollider(rapier.ColliderDesc.ball(size * 0.7).setTranslation(x, y + size * 0.1, z))
}

/** Thousands of grass blades in one draw call. They sway in the wind and part around the bears. */
export class Grass {
  private readonly uniforms = {
    uTime: { value: 0 },
    uBearA: { value: new THREE.Vector3(999, 0, 999) },
    uBearB: { value: new THREE.Vector3(999, 0, 999) }
  }

  constructor(scene: THREE.Scene, terrain: Terrain, patches: ReadonlyArray<Patch>) {
    const rand = seeded(42)
    const blade = new THREE.ConeGeometry(0.09, 1, 3)
    blade.translate(0, 0.5, 0)
    const material = new THREE.MeshStandardMaterial({ color: "#8fd35f", flatShading: true, roughness: 1 })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;\nuniform vec3 uBearA;\nuniform vec3 uBearB;"
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float h = position.y;
          transformed.x += sin(uTime * 2.0 + root.x * 0.4 + root.z * 0.3) * 0.18 * h;
          transformed.z += cos(uTime * 1.7 + root.z * 0.5) * 0.08 * h;
          vec2 da = root.xz - uBearA.xz;
          vec2 db = root.xz - uBearB.xz;
          float fa = smoothstep(1.6, 0.0, length(da));
          float fb = smoothstep(1.1, 0.0, length(db));
          transformed.xz += normalize(da + 0.0001) * fa * h * 0.9 + normalize(db + 0.0001) * fb * h * 0.9;
          transformed.y -= (fa + fb) * h * 0.3;`
        )
    }

    const blades: Array<THREE.Matrix4> = []
    const color = new THREE.Color()
    const colors: Array<number> = []
    for (const patch of patches) {
      const count = Math.round(patch.radius * patch.radius * 9)
      for (let i = 0; i < count; i++) {
        const angle = rand() * Math.PI * 2
        const r = Math.sqrt(rand()) * patch.radius
        const x = patch.x + Math.cos(angle) * r
        const z = patch.z + Math.sin(angle) * r
        const edge = 1 - r / patch.radius
        const height = 0.6 + rand() * 0.7 + edge * 0.5
        blades.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, terrain.heightAt(x, z) - 0.05, z),
            new THREE.Quaternion(),
            new THREE.Vector3(1, height, 1)
          )
        )
        color.setHSL(0.26 + rand() * 0.06, 0.55, 0.42 + rand() * 0.15)
        colors.push(color.r, color.g, color.b)
      }
    }
    const instanced = new THREE.InstancedMesh(blade, material, blades.length)
    blades.forEach((matrix, i) => instanced.setMatrixAt(i, matrix))
    instanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3)
    instanced.receiveShadow = true
    scene.add(instanced)
  }

  update(time: number, bearA: THREE.Vector3, bearB: THREE.Vector3) {
    this.uniforms.uTime.value = time
    this.uniforms.uBearA.value.copy(bearA)
    this.uniforms.uBearB.value.copy(bearB)
  }
}

interface Flower {
  readonly position: THREE.Vector3
  bounce: number
  cooldown: number
  readonly note: number
}

/** Paint a whole geometry one colour (as a vertex colour) so differently coloured parts can share one mesh. */
export const painted = (geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position!.count * 3)
  for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i)
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "color") g.deleteAttribute(name)
  return g
}

/**
 * Walk through flowers and they bounce and play a note.
 * All the stems are one instanced mesh and all the petals another, so a meadow full of
 * flowers is just two draw calls.
 */
export class Flowers {
  private readonly flowers: Array<Flower> = []
  private readonly stems: THREE.InstancedMesh
  private readonly heads: THREE.InstancedMesh
  private readonly matrix = new THREE.Matrix4()
  private readonly quaternion = new THREE.Quaternion()
  private readonly euler = new THREE.Euler()
  private readonly scale = new THREE.Vector3()

  constructor(scene: THREE.Scene, terrain: Terrain, clusters: ReadonlyArray<readonly [number, number]>) {
    const rand = seeded(7)
    const petals = ["#ff7eb6", "#ffd84d", "#ffffff", "#b38cff", "#ff9a4d"]
    let note = 0
    const colors: Array<THREE.Color> = []
    for (const [cx, cz] of clusters) {
      const count = 5 + Math.floor(rand() * 4)
      for (let i = 0; i < count; i++) {
        const x = cx + (rand() - 0.5) * 3.5
        const z = cz + (rand() - 0.5) * 3.5
        this.flowers.push({ position: new THREE.Vector3(x, terrain.heightAt(x, z), z), bounce: 0, cooldown: 0, note: note++ })
        colors.push(new THREE.Color(petals[Math.floor(rand() * petals.length)]!))
      }
    }
    const stem = painted(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4).translate(0, 0.25, 0), "#4c9a3e")
    const middle = painted(new THREE.IcosahedronGeometry(0.08, 0).translate(0, 0.62, 0), "#ffcf3f")
    const stemGeometry = mergeGeometries([stem, middle])!
    const headGeometry = new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.5, 1).translate(0, 0.55, 0)
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })
    this.stems = new THREE.InstancedMesh(stemGeometry, material, this.flowers.length)
    this.heads = new THREE.InstancedMesh(headGeometry, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), this.flowers.length)
    this.heads.castShadow = true
    this.stems.receiveShadow = this.heads.receiveShadow = true
    colors.forEach((color, i) => this.heads.setColorAt(i, color))
    this.flowers.forEach((_, i) => this.place(i))
    scene.add(this.stems, this.heads)
  }

  private place(i: number) {
    const flower = this.flowers[i]!
    const wobble = Math.sin(flower.bounce * 14) * flower.bounce
    this.quaternion.setFromEuler(this.euler.set(0, 0, wobble * 0.5))
    this.scale.setScalar(1 + flower.bounce * 0.5)
    this.matrix.compose(flower.position, this.quaternion, this.scale)
    this.stems.setMatrixAt(i, this.matrix)
    this.heads.setMatrixAt(i, this.matrix)
  }

  update(dt: number, bears: ReadonlyArray<THREE.Vector3>, playNote: (index: number) => void) {
    let changed = false
    this.flowers.forEach((flower, i) => {
      flower.cooldown -= dt
      for (const bear of bears) {
        const dx = bear.x - flower.position.x
        const dz = bear.z - flower.position.z
        if (dx * dx + dz * dz < 0.9 && flower.cooldown <= 0 && Math.abs(bear.y - flower.position.y) < 2) {
          flower.bounce = 1
          flower.cooldown = 1.2
          playNote(flower.note)
        }
      }
      if (flower.bounce > 0.001) {
        flower.bounce = damp(flower.bounce, 0, 4, dt)
        if (flower.bounce < 0.002) flower.bounce = 0
        this.place(i)
        changed = true
      }
    })
    if (changed) {
      this.stems.instanceMatrix.needsUpdate = true
      this.heads.instanceMatrix.needsUpdate = true
    }
  }
}

interface Butterfly {
  group: THREE.Group
  wings: [THREE.Mesh, THREE.Mesh]
  home: THREE.Vector3
  phase: number
  found: boolean
  flee: number
  fleeDir: THREE.Vector3
}

/** Butterflies hide in the tall grass. Getting close "finds" them. */
export class Butterflies {
  readonly total: number
  private readonly butterflies: Array<Butterfly> = []
  private time = 0

  constructor(scene: THREE.Scene, terrain: Terrain, patches: ReadonlyArray<Patch>) {
    const rand = seeded(99)
    const wingColors = ["#ff6fa8", "#ffb347", "#6fc3ff", "#c38bff", "#fff36b", "#ff8d6b"]
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.lineTo(0.35, 0.3)
    wingShape.lineTo(0.42, -0.05)
    wingShape.lineTo(0.22, -0.3)
    wingShape.lineTo(0, 0)
    const wingGeometry = new THREE.ShapeGeometry(wingShape)
    wingGeometry.rotateX(-Math.PI / 2)
    const bodyGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4)
    bodyGeometry.rotateX(Math.PI / 2)

    for (const patch of patches) {
      const count = patch.radius > 5.5 ? 2 : 1
      for (let i = 0; i < count; i++) {
        const angle = rand() * Math.PI * 2
        const r = rand() * patch.radius * 0.6
        const x = patch.x + Math.cos(angle) * r
        const z = patch.z + Math.sin(angle) * r
        const color = wingColors[Math.floor(rand() * wingColors.length)]!
        const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true, emissive: color, emissiveIntensity: 0.25 })
        const group = new THREE.Group()
        const left = new THREE.Mesh(wingGeometry, material)
        const right = new THREE.Mesh(wingGeometry, material)
        right.scale.x = -1
        const body = new THREE.Mesh(bodyGeometry, flat("#3a2a20"))
        group.add(left, right, body)
        group.scale.setScalar(1.4)
        scene.add(group)
        this.butterflies.push({
          group,
          wings: [left, right],
          home: new THREE.Vector3(x, terrain.heightAt(x, z) + 1.1, z),
          phase: rand() * 100,
          found: false,
          flee: 0,
          fleeDir: new THREE.Vector3()
        })
      }
    }
    this.total = this.butterflies.length
  }

  get foundCount() {
    return this.butterflies.filter((b) => b.found).length
  }

  update(dt: number, bears: ReadonlyArray<THREE.Vector3>, onFound: (position: THREE.Vector3) => void) {
    this.time += dt
    for (const b of this.butterflies) {
      const t = this.time + b.phase
      const flap = Math.sin(t * 18) * 0.9
      b.wings[0].rotation.z = flap
      b.wings[1].rotation.z = -flap

      if (b.flee <= 0) {
        for (const bear of bears) {
          if (bear.distanceTo(b.group.position) < 2.6) {
            b.flee = 2.2
            b.fleeDir.subVectors(b.group.position, bear).setY(0).normalize()
            if (!b.found) {
              b.found = true
              onFound(b.group.position.clone())
            }
          }
        }
      }

      const target = b.home.clone().add(new THREE.Vector3(Math.sin(t * 0.7) * 1.6, Math.sin(t * 1.3) * 0.4, Math.cos(t * 0.5) * 1.6))
      if (b.flee > 0) {
        b.flee -= dt
        target.copy(b.group.position).addScaledVector(b.fleeDir, 3).add(new THREE.Vector3(0, 2.5, 0))
      }
      const before = b.group.position.clone()
      b.group.position.x = damp(b.group.position.x, target.x, b.flee > 0 ? 2.5 : 1.2, dt)
      b.group.position.y = damp(b.group.position.y, target.y + Math.sin(t * 9) * 0.08, b.flee > 0 ? 2.5 : 1.2, dt)
      b.group.position.z = damp(b.group.position.z, target.z, b.flee > 0 ? 2.5 : 1.2, dt)
      const delta = b.group.position.clone().sub(before)
      if (delta.lengthSq() > 1e-6) b.group.rotation.y = Math.atan2(delta.x, delta.z)
    }
  }
}

/** Sprinkle trees and rocks over a level, avoiding anywhere `blocked` says no. */
export const scatter = (
  env: Env,
  options: { seed: number; trees: number; rocks: number; blocked: (x: number, z: number, margin: number) => boolean; kinds?: ReadonlyArray<"pine" | "round">; snowy?: boolean }
) => {
  const rand = seeded(options.seed)
  const { minX, maxX, minZ, maxZ } = env.terrain.bounds
  const kinds = options.kinds ?? ["pine", "pine", "round"]
  const pick = () => [minX + 6 + rand() * (maxX - minX - 12), minZ + 6 + rand() * (maxZ - minZ - 12)] as const
  let trees = 0
  for (let attempt = 0; attempt < options.trees * 12 && trees < options.trees; attempt++) {
    const [x, z] = pick()
    if (options.blocked(x, z, 1) || env.terrain.heightAt(x, z) < env.terrain.waterY + 0.5) continue
    createTree(env, x, z, { scale: 0.8 + rand() * 0.6, kind: kinds[Math.floor(rand() * kinds.length)]!, rand, snowy: options.snowy ?? false })
    trees++
  }
  let rocks = 0
  for (let attempt = 0; attempt < options.rocks * 12 && rocks < options.rocks; attempt++) {
    const [x, z] = pick()
    if (options.blocked(x, z, -1)) continue
    createRock(env, x, z, 0.3 + rand() * 1, rand)
    rocks++
  }
}
