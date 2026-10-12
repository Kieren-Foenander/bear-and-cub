import * as THREE from "three"
import type { Particles } from "./particles.ts"
import { flat, mesh } from "./util.ts"

interface Berry {
  readonly group: THREE.Group
  readonly home: THREE.Vector3
  readonly phase: number
  taken: boolean
  pop: number
}

/**
 * Berries to collect. Like coins in a platformer they double as breadcrumbs: a line of berries
 * shows a little player where to go (and an arc of berries shows how to jump).
 */
export class Berries {
  private readonly berries: Array<Berry> = []
  private time = 0
  private streak = 0
  private streakTimer = 0
  private readonly geometry = new THREE.IcosahedronGeometry(0.16, 0)
  private readonly leafGeometry = new THREE.ConeGeometry(0.12, 0.12, 5)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly particles: Particles
  ) {}

  get total() {
    return this.berries.length
  }

  get collected() {
    return this.berries.filter((b) => b.taken).length
  }

  /** One berry with its bottom `height` above `position`. */
  add(position: THREE.Vector3, height = 0.7) {
    const group = new THREE.Group()
    const red = flat("#e83a5a")
    for (const [x, y, z] of [[-0.1, 0, 0], [0.1, 0, 0.02], [0, 0.15, -0.02], [0, 0.02, 0.15]] as const) {
      const b = mesh(this.geometry, red, { receiveShadow: false })
      b.position.set(x, y, z)
      group.add(b)
    }
    const leaf = mesh(this.leafGeometry, flat("#4fa152"), { receiveShadow: false })
    leaf.position.y = 0.3
    leaf.rotation.x = Math.PI
    group.add(leaf)
    const home = position.clone().add(new THREE.Vector3(0, height, 0))
    group.position.copy(home)
    this.scene.add(group)
    this.berries.push({ group, home, phase: Math.random() * 10, taken: false, pop: 0 })
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

  update(dt: number, bears: ReadonlyArray<THREE.Vector3>, onCollect: (streak: number) => void) {
    this.time += dt
    this.streakTimer -= dt
    if (this.streakTimer <= 0) this.streak = 0
    for (const berry of this.berries) {
      if (berry.taken) {
        if (berry.pop > 0) {
          berry.pop -= dt * 3
          berry.group.position.y += dt * 4
          berry.group.scale.setScalar(Math.max(0.01, berry.pop))
          if (berry.pop <= 0) berry.group.visible = false
        }
        continue
      }
      berry.group.rotation.y = this.time * 1.5 + berry.phase
      berry.group.position.y = berry.home.y + Math.sin(this.time * 2.5 + berry.phase) * 0.12
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
  }
}
