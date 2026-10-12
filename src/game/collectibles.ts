import * as THREE from "three"
import type { Particles } from "./particles.ts"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { painted } from "./nature.ts"

interface Berry {
  readonly home: THREE.Vector3
  readonly position: THREE.Vector3
  readonly phase: number
  taken: boolean
  pop: number
}

/**
 * Berries to collect. Like coins in a platformer they double as breadcrumbs: a line of berries
 * shows a little player where to go (and an arc of berries shows how to jump).
 * They're all one instanced mesh, built once the level has placed them all.
 */
export class Berries {
  private readonly berries: Array<Berry> = []
  private mesh: THREE.InstancedMesh | null = null
  private time = 0
  private streak = 0
  private streakTimer = 0
  private readonly matrix = new THREE.Matrix4()
  private readonly quaternion = new THREE.Quaternion()
  private readonly scale = new THREE.Vector3()
  private readonly axis = new THREE.Vector3(0, 1, 0)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly particles: Particles
  ) {}

  get total() {
    return this.berries.length
  }

  get collected() {
    let count = 0
    for (const berry of this.berries) if (berry.taken) count++
    return count
  }

  /** One berry with its bottom `height` above `position`. */
  add(position: THREE.Vector3, height = 0.7) {
    const home = position.clone().add(new THREE.Vector3(0, height, 0))
    this.berries.push({ home, position: home.clone(), phase: Math.random() * 10, taken: false, pop: 0 })
  }

  /** `count` berries evenly spaced from a to b (heights taken from a/b's y). */
  line(a: THREE.Vector3, b: THREE.Vector3, count: number, heightAt?: (x: number, z: number) => number) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const p = a.clone().lerp(b, t)
      if (heightAt) p.y = heightAt(p.x, p.z)
      this.add(p)
    }
  }

  /** An arc from a to b, peaking `peak` above the straight line — shows the shape of a jump. */
  arc(a: THREE.Vector3, b: THREE.Vector3, count: number, peak: number) {
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1)
      const p = a.clone().lerp(b, t)
      p.y += Math.sin(t * Math.PI) * peak
      this.add(p, 0.6)
    }
  }

  /** A ring of berries, for hiding in out-of-the-way places. */
  ring(center: THREE.Vector3, radius: number, count: number, heightAt: (x: number, z: number) => number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = center.x + Math.cos(angle) * radius
      const z = center.z + Math.sin(angle) * radius
      this.add(new THREE.Vector3(x, heightAt(x, z), z))
    }
  }

  private build() {
    const parts: Array<THREE.BufferGeometry> = []
    for (const [x, y, z] of [[-0.1, 0, 0], [0.1, 0, 0.02], [0, 0.15, -0.02], [0, 0.02, 0.15]] as const) {
      parts.push(painted(new THREE.IcosahedronGeometry(0.16, 0).translate(x, y, z), "#e83a5a"))
    }
    parts.push(painted(new THREE.ConeGeometry(0.12, 0.12, 5).rotateX(Math.PI).translate(0, 0.3, 0), "#4fa152"))
    const geometry = mergeGeometries(parts)!
    this.mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }), Math.max(1, this.berries.length))
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }

  update(dt: number, bears: ReadonlyArray<THREE.Vector3>, onCollect: (streak: number) => void) {
    if (!this.mesh) this.build()
    const mesh = this.mesh!
    this.time += dt
    this.streakTimer -= dt
    if (this.streakTimer <= 0) this.streak = 0
    this.berries.forEach((berry, i) => {
      let size = 1
      if (berry.taken) {
        if (berry.pop > 0) {
          berry.pop = Math.max(0, berry.pop - dt * 3)
          berry.position.y += dt * 4
        }
        size = berry.pop
      } else {
        berry.position.y = berry.home.y + Math.sin(this.time * 2.5 + berry.phase) * 0.12
        for (const bear of bears) {
          const dx = bear.x - berry.home.x
          const dz = bear.z - berry.home.z
          const dy = bear.y - berry.home.y
          if (dx * dx + dz * dz < 1.1 && Math.abs(dy) < 1.4) {
            berry.taken = true
            berry.pop = 1
            this.streak++
            this.streakTimer = 1.2
            this.particles.burst(berry.home, { colors: ["#ff6b8b", "#ffffff"], count: 8, speed: 2.5, up: 1.5, gravity: 0.2 })
            onCollect(this.streak)
            break
          }
        }
      }
      this.quaternion.setFromAxisAngle(this.axis, this.time * 1.5 + berry.phase)
      this.scale.setScalar(Math.max(0.0001, size))
      this.matrix.compose(berry.position, this.quaternion, this.scale)
      mesh.setMatrixAt(i, this.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
}
