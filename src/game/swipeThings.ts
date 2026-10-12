import * as THREE from "three"
import type { SoundName } from "../services/Sound.ts"
import { GRAVITY } from "../services/Physics.ts"
import type { Bear } from "./bear.ts"
import { createTree, type Env } from "./nature.ts"
import type { Particles } from "./particles.ts"
import { CUB } from "./specs.ts"
import { hangHeight, type Swipes } from "./swipe.ts"
import { damp, flat, mesh } from "./util.ts"

export interface SwipeThingContext extends Env {
  readonly swipes: Swipes
  readonly particles: Particles
  readonly sound: (name: SoundName) => void
}

/**
 * A big bell hanging from a wooden frame. The cub has to jump and swipe it at the top of her jump.
 */
export class Bell {
  private readonly pivot = new THREE.Group()
  private readonly material = new THREE.MeshStandardMaterial({
    color: "#f2c230",
    flatShading: true,
    roughness: 0.35,
    metalness: 0.3,
    emissive: "#ffcf3f",
    emissiveIntensity: 0
  })
  private swing = 0
  private swingSpeed = 0
  private rung = false
  private postsAlong: "x" | "z" = "x"

  /** `postsAlong` is the axis the two posts sit on; walk in along the other axis. */
  constructor(ctx: SwipeThingContext, at: THREE.Vector3, onFirstRing: () => void, postsAlong: "x" | "z" = "x") {
    const { scene, rapier, world, swipes } = ctx
    const ground = ctx.terrain.heightAt(at.x, at.z)
    const target = new THREE.Vector3(at.x, ground + hangHeight(CUB, 1.65), at.z)
    const barY = ground + 3.6

    const wood = flat("#8a5a36")
    for (const side of [-1, 1]) {
      const post = mesh(new THREE.BoxGeometry(0.35, 3.8, 0.35), wood)
      const px = postsAlong === "x" ? at.x + side * 1.5 : at.x
      const pz = postsAlong === "z" ? at.z + side * 1.5 : at.z
      post.position.set(px, ground + 1.9, pz)
      scene.add(post)
      world.createCollider(rapier.ColliderDesc.cuboid(0.18, 1.9, 0.18).setTranslation(px, ground + 1.9, pz))
    }
    const bar = mesh(new THREE.BoxGeometry(3.6, 0.3, 0.3), wood)
    bar.position.set(at.x, barY, at.z)
    if (postsAlong === "z") bar.rotation.y = Math.PI / 2
    this.postsAlong = postsAlong
    scene.add(bar)

    this.pivot.position.set(at.x, barY, at.z)
    scene.add(this.pivot)
    const ropeLength = barY - target.y - 0.35
    const rope = mesh(new THREE.CylinderGeometry(0.04, 0.04, ropeLength, 4), flat("#d8c49a"), { castShadow: false })
    rope.position.y = -ropeLength / 2
    this.pivot.add(rope)
    const profile = [
      new THREE.Vector2(0.05, 0.4),
      new THREE.Vector2(0.25, 0.35),
      new THREE.Vector2(0.32, 0.1),
      new THREE.Vector2(0.38, -0.2),
      new THREE.Vector2(0.52, -0.38),
      new THREE.Vector2(0.48, -0.42)
    ]
    const bell = mesh(new THREE.LatheGeometry(profile, 8), this.material)
    bell.position.y = -(barY - target.y)
    this.pivot.add(bell)
    const clapper = mesh(new THREE.IcosahedronGeometry(0.12, 0), flat("#8a6a1e"))
    clapper.position.y = bell.position.y - 0.42
    this.pivot.add(clapper)

    swipes.add(
      {
        id: "bell",
        who: ["cub"],
        position: () => target,
        horizontalReach: 1.1,
        verticalReach: 0.32,
        enabled: () => true,
        onHit: (bear: Bear) => {
          this.swingSpeed += bear.forward.x >= 0 ? 4 : -4
          ctx.sound("bell")
          ctx.particles.burst(target, { colors: ["#ffe066", "#ffffff"], count: 16, speed: 4, up: 1, gravity: 0.1 })
          if (!this.rung) {
            this.rung = true
            onFirstRing()
          }
        },
        glow: (amount) => {
          this.material.emissiveIntensity = damp(this.material.emissiveIntensity, amount * 0.8, 12, 1 / 60)
        }
      },
      { who: "cub", enabled: () => !this.rung }
    )
  }

  update(dt: number) {
    // A damped spring keeps it swinging for a bit after each hit.
    this.swingSpeed += (-this.swing * 18 - this.swingSpeed * 1.2) * dt
    this.swing += this.swingSpeed * dt
    if (this.postsAlong === "x") this.pivot.rotation.z = this.swing * 0.35
    else this.pivot.rotation.x = this.swing * 0.35
  }
}

interface Apple {
  readonly home: THREE.Vector3
  readonly mesh: THREE.Group
  state: "hanging" | "falling" | "gone"
  velocity: THREE.Vector3
  timer: number
}

/**
 * Practice! Apples hang at "top of a jump" height. Knock them down and they grow back,
 * so the cub can try as many times as she likes. Mama can knock them too, to show how.
 */
export class AppleTree {
  /** Apples the cub has knocked down. */
  cubHits = 0
  private readonly apples: Array<Apple> = []

  constructor(
    private readonly ctx: SwipeThingContext,
    readonly at: THREE.Vector3
  ) {
    const { scene, swipes } = ctx
    createTree(ctx, at.x, at.z, { scale: 1.4, kind: "round", rand: () => 0.3 })
    const ground = ctx.terrain.heightAt(at.x, at.z)
    const appleGeometry = new THREE.IcosahedronGeometry(0.26, 1)
    const red = new THREE.MeshStandardMaterial({ color: "#e5484d", flatShading: true, emissive: "#ff9a4d", emissiveIntensity: 0 })

    for (let i = 0; i < 3; i++) {
      const angle = Math.PI * 0.2 + (i * Math.PI * 2) / 3
      const home = new THREE.Vector3(at.x + Math.cos(angle) * 1.6, ground + hangHeight(CUB, 1.6), at.z + Math.sin(angle) * 1.6)
      const group = new THREE.Group()
      const material = red.clone()
      group.add(mesh(appleGeometry, material))
      const leaf = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.08), flat("#4fa152"), { castShadow: false })
      leaf.position.set(0.08, 0.27, 0)
      leaf.rotation.z = 0.4
      const stem = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 3), flat("#6b4a2a"), { castShadow: false })
      stem.position.y = 0.7
      group.add(leaf, stem)
      group.position.copy(home)
      scene.add(group)
      const apple: Apple = { home, mesh: group, state: "hanging", velocity: new THREE.Vector3(), timer: 0 }
      this.apples.push(apple)

      swipes.add(
        {
          id: `apple-${i}`,
          who: ["cub", "mama"],
          position: () => apple.home,
          horizontalReach: 1,
          verticalReach: 0.45,
          enabled: () => apple.state === "hanging",
          onHit: (bear) => this.knock(apple, bear),
          glow: (amount) => {
            material.emissiveIntensity = damp(material.emissiveIntensity, amount * 0.7, 12, 1 / 60)
          }
        },
        { who: "cub" }
      )
    }
  }

  private knock(apple: Apple, bear: Bear) {
    apple.state = "falling"
    apple.timer = 0
    apple.velocity.copy(bear.forward).multiplyScalar(2.5).setY(2)
    apple.mesh.children[2]!.visible = false
    if (bear.spec.id === "cub") this.cubHits++
    this.ctx.sound("pop")
    this.ctx.particles.burst(apple.home, { colors: ["#4fa152", "#6cc062", "#fff36b"], count: 14, speed: 3, up: 1 })
  }

  update(dt: number) {
    for (const apple of this.apples) {
      apple.timer += dt
      if (apple.state === "falling") {
        // Simple bouncy ballistics; no need for the physics engine for an apple.
        apple.velocity.y -= GRAVITY * dt
        apple.mesh.position.addScaledVector(apple.velocity, dt)
        apple.mesh.rotation.x += apple.velocity.z * dt * 3
        const floor = this.ctx.terrain.heightAt(apple.mesh.position.x, apple.mesh.position.z) + 0.26
        if (apple.mesh.position.y < floor) {
          apple.mesh.position.y = floor
          apple.velocity.y = Math.abs(apple.velocity.y) * 0.45
          apple.velocity.x *= 0.7
          apple.velocity.z *= 0.7
        }
        if (apple.timer > 2.5) {
          apple.state = "gone"
          apple.timer = 0
          this.ctx.particles.burst(apple.mesh.position, { colors: ["#ffffff", "#ffd84d"], count: 8, speed: 2, up: 1 })
          apple.mesh.visible = false
        }
      } else if (apple.state === "gone" && apple.timer > 2.5) {
        // Grow back on the branch.
        apple.state = "hanging"
        apple.mesh.position.copy(apple.home)
        apple.mesh.rotation.set(0, 0, 0)
        apple.mesh.children[2]!.visible = true
        apple.mesh.visible = true
        apple.mesh.scale.setScalar(0.01)
      }
      if (apple.state === "hanging") {
        apple.mesh.scale.setScalar(damp(apple.mesh.scale.x, 1, 6, dt))
        apple.mesh.rotation.z = Math.sin(apple.timer * 1.5 + apple.home.x) * 0.08
      }
    }
  }
}
