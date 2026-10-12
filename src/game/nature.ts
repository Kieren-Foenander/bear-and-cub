import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import { heightAt } from "./terrain.ts"
import { damp, flat, jitter, mesh, seeded } from "./util.ts"

export interface Patch {
  readonly x: number
  readonly z: number
  readonly radius: number
}

/** Tall grass patches. Little explorers find butterflies in these. */
export const GRASS_PATCHES: ReadonlyArray<Patch> = [
  { x: -16, z: 22, radius: 6 },
  { x: 17, z: 14, radius: 5.5 },
  { x: -20, z: 5, radius: 5 },
  { x: 22, z: 26, radius: 4.5 },
  { x: -24, z: -13, radius: 5 },
  { x: 21, z: -12, radius: 5 },
  { x: -17, z: -38, radius: 6 },
  { x: 19, z: -45, radius: 6 },
  { x: -4, z: -60, radius: 5 }
]

export const createTree = (
  scene: THREE.Scene,
  rapier: typeof RAPIER,
  world: RAPIER.World,
  x: number,
  z: number,
  options: { scale?: number; kind?: "pine" | "round"; rand?: () => number } = {}
) => {
  const { scale = 1, kind = "pine", rand = Math.random } = options
  const y = heightAt(x, z)
  const tree = new THREE.Group()
  tree.position.set(x, y - 0.2, z)
  tree.rotation.y = rand() * Math.PI * 2
  tree.scale.setScalar(scale)

  const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 6), flat("#8a5a36"))
  trunk.position.y = 1.2
  tree.add(trunk)

  if (kind === "pine") {
    const greens = ["#3f8f4a", "#4a9e52", "#55ab5b"]
    for (let i = 0; i < 3; i++) {
      const cone = mesh(jitter(new THREE.ConeGeometry(1.9 - i * 0.5, 2.2, 7), 0.08), flat(greens[i]!))
      cone.position.y = 2.6 + i * 1.15
      tree.add(cone)
    }
  } else {
    const greens = ["#5fb35a", "#6cc062", "#4fa152"]
    for (let i = 0; i < 3; i++) {
      const blob = mesh(jitter(new THREE.IcosahedronGeometry(1.3 - i * 0.2, 1), 0.12), flat(greens[i]!))
      blob.position.set((i - 1) * 0.7, 3.2 + (i % 2) * 0.7, (i % 2) * 0.4)
      tree.add(blob)
    }
  }
  scene.add(tree)
  world.createCollider(rapier.ColliderDesc.cylinder(2, 0.4 * scale).setTranslation(x, y + 1.6, z))
  return tree
}

export const createRock = (
  scene: THREE.Scene,
  rapier: typeof RAPIER,
  world: RAPIER.World,
  x: number,
  z: number,
  size: number,
  rand: () => number
) => {
  const rock = mesh(jitter(new THREE.DodecahedronGeometry(size, 0), size * 0.12), flat(rand() > 0.5 ? "#9a968c" : "#a8a397"))
  rock.scale.y = 0.65
  rock.rotation.y = rand() * Math.PI
  const y = heightAt(x, z)
  rock.position.set(x, y + size * 0.2, z)
  scene.add(rock)
  if (size > 0.6) world.createCollider(rapier.ColliderDesc.ball(size * 0.7).setTranslation(x, y + size * 0.1, z))
}

/** Thousands of grass blades in one draw call. They sway in the wind and part around the bears. */
export class Grass {
  private readonly uniforms = {
    uTime: { value: 0 },
    uBearA: { value: new THREE.Vector3(999, 0, 999) },
    uBearB: { value: new THREE.Vector3(999, 0, 999) }
  }

  constructor(scene: THREE.Scene, patches: ReadonlyArray<Patch>) {
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
            new THREE.Vector3(x, heightAt(x, z) - 0.05, z),
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
  group: THREE.Group
  bounce: number
  cooldown: number
  note: number
}

/** Walk through flowers and they bounce and play a note. */
export class Flowers {
  private readonly flowers: Array<Flower> = []

  constructor(scene: THREE.Scene) {
    const rand = seeded(7)
    const petals = ["#ff7eb6", "#ffd84d", "#ffffff", "#b38cff", "#ff9a4d"]
    const stem = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4)
    const head = new THREE.IcosahedronGeometry(0.16, 0)
    const middle = new THREE.IcosahedronGeometry(0.08, 0)
    const clusters = [
      [-6, 18], [7, 24], [-10, 8], [9, 4], [-4, 29], [12, 18], [-12, -16], [10, -14],
      [-7, -34], [8, -38], [-10, -52], [11, -56], [26, 2], [-28, 30]
    ] as const
    let note = 0
    for (const [cx, cz] of clusters) {
      const count = 5 + Math.floor(rand() * 4)
      for (let i = 0; i < count; i++) {
        const x = cx + (rand() - 0.5) * 3.5
        const z = cz + (rand() - 0.5) * 3.5
        const group = new THREE.Group()
        group.position.set(x, heightAt(x, z), z)
        const s = mesh(stem, flat("#4c9a3e"), { castShadow: false })
        s.position.y = 0.25
        const h = mesh(head, flat(petals[Math.floor(rand() * petals.length)]!))
        h.position.y = 0.55
        h.scale.y = 0.5
        const m = mesh(middle, flat("#ffcf3f"), { castShadow: false })
        m.position.y = 0.62
        group.add(s, h, m)
        scene.add(group)
        this.flowers.push({ group, bounce: 0, cooldown: 0, note: note++ })
      }
    }
  }

  update(dt: number, bears: ReadonlyArray<THREE.Vector3>, playNote: (index: number) => void) {
    for (const flower of this.flowers) {
      flower.cooldown -= dt
      for (const bear of bears) {
        const dx = bear.x - flower.group.position.x
        const dz = bear.z - flower.group.position.z
        if (dx * dx + dz * dz < 0.9 && flower.cooldown <= 0 && Math.abs(bear.y - flower.group.position.y) < 2) {
          flower.bounce = 1
          flower.cooldown = 1.2
          playNote(flower.note)
        }
      }
      flower.bounce = damp(flower.bounce, 0, 4, dt)
      const wobble = Math.sin(flower.bounce * 14) * flower.bounce
      flower.group.rotation.z = wobble * 0.5
      flower.group.scale.setScalar(1 + flower.bounce * 0.5)
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

  constructor(scene: THREE.Scene, patches: ReadonlyArray<Patch>) {
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
          home: new THREE.Vector3(x, heightAt(x, z) + 1.1, z),
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
