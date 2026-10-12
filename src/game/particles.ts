import * as THREE from "three"
import { GRAVITY } from "../services/Physics.ts"

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spin: THREE.Vector3
  life: number
  maxLife: number
  gravity: number
}

export interface BurstOptions {
  colors: ReadonlyArray<THREE.ColorRepresentation>
  count?: number
  speed?: number
  /** Extra upward kick. */
  up?: number
  size?: number
  life?: number
  gravity?: number
}

/** Cheap confetti / splashes / sparkles / dust. */
export class Particles {
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0)
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>()
  private readonly live: Array<Particle> = []
  private readonly pool: Array<THREE.Mesh> = []

  constructor(private readonly scene: THREE.Scene) {}

  burst(origin: THREE.Vector3, options: BurstOptions) {
    const { colors, count = 20, speed = 4, up = 3, size = 0.12, life = 1.2, gravity = 0.6 } = options
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(colors[i % colors.length]!)
      const key = color.getHexString()
      let material = this.materials.get(key)
      if (!material) {
        material = new THREE.MeshBasicMaterial({ color, transparent: true })
        this.materials.set(key, material)
      }
      const mesh = this.pool.pop() ?? new THREE.Mesh(this.geometry)
      mesh.material = material
      mesh.position.copy(origin)
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8))
      this.scene.add(mesh)
      const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).normalize()
      this.live.push({
        mesh,
        velocity: direction.multiplyScalar(speed * (0.5 + Math.random() * 0.5)).add(new THREE.Vector3(0, up, 0)),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        gravity
      })
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]!
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        this.pool.push(p.mesh)
        this.live.splice(i, 1)
        continue
      }
      p.velocity.y -= GRAVITY * p.gravity * dt
      p.velocity.multiplyScalar(1 - dt * 0.8)
      p.mesh.position.addScaledVector(p.velocity, dt)
      p.mesh.rotation.x += p.spin.x * dt
      p.mesh.rotation.y += p.spin.y * dt
      const fade = Math.min(1, p.life / (p.maxLife * 0.3))
      p.mesh.scale.multiplyScalar(fade < 1 ? 0.97 : 1)
    }
  }
}
