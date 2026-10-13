import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { SoundName } from "../services/Sound.ts"
import type { Bear } from "./bear.ts"
import type { Interactions } from "./interactions.ts"
import type { Particles } from "./particles.ts"
import type { Terrain } from "./terrain.ts"
import { GRAVITY } from "../services/Physics.ts"

/** Something a bear can pick up (B), carry over its head, and put down (B again). */
export interface Carryable {
  readonly id: string
  readonly object: THREE.Object3D
  state: "ground" | "held" | "falling" | "delivered"
  holder: Bear | null
  readonly velocity: THREE.Vector3
}

/** A place to put carried things (a basket, a nest…). */
export interface DropZone {
  readonly at: THREE.Vector3
  readonly radius: number
  readonly label: string
  readonly accepts: (item: Carryable) => boolean
  readonly onDeliver: (item: Carryable, bear: Bear) => void
}

/**
 * Picking things up and carrying them. Teaches a simple sequence: walk to it, press B to grab,
 * walk somewhere, press B to put it down.
 */
export class Carrying {
  private readonly items: Array<Carryable> = []
  private readonly zones: Array<DropZone> = []
  private readonly temp = new THREE.Vector3()
  private readonly ray: RAPIER.Ray

  constructor(
    private readonly interactions: Interactions,
    private readonly bears: ReadonlyArray<Bear>,
    private readonly terrain: Terrain,
    private readonly particles: Particles,
    private readonly sound: (name: SoundName) => void,
    private readonly rapier: typeof RAPIER,
    private readonly world: RAPIER.World
  ) {
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
    for (const bear of bears) {
      // Put down, wherever you are (unless you're at a drop zone, which has its own prompt).
      interactions.add({
        id: `drop-${bear.spec.id}`,
        who: bear.spec.id,
        kind: "press",
        buttons: ["b"],
        label: "Drop it",
        // Off to one side, so it never sits on top of Mama's "Put Cub down" prompt.
        anchor: () => bear.position.clone().add(new THREE.Vector3(1.4, 2.4 * bear.spec.scale + 0.8, 0)),
        inRange: (b) => this.heldBy(b) !== undefined && !this.zones.some((zone) => this.inZone(b, zone)),
        enabled: () => this.heldBy(bear) !== undefined,
        onComplete: (b) => this.drop(b)
      })
    }
  }

  heldBy(bear: Bear) {
    return this.items.find((item) => item.holder === bear && item.state === "held")
  }

  private inZone(bear: Bear, zone: DropZone) {
    return Math.hypot(bear.position.x - zone.at.x, bear.position.z - zone.at.z) < zone.radius && Math.abs(bear.feetY - zone.at.y) < 1.5
  }

  /** Add an item lying at `at`. Returns it so the level can check on it. */
  add(id: string, object: THREE.Object3D, at: THREE.Vector3) {
    const item: Carryable = { id, object, state: "ground", holder: null, velocity: new THREE.Vector3() }
    object.position.copy(at)
    this.items.push(item)
    for (const bear of this.bears) {
      this.interactions.add({
        id: `pick-${id}-${bear.spec.id}`,
        who: bear.spec.id,
        kind: "press",
        buttons: ["b"],
        label: "Pick up",
        anchor: () => item.object.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
        inRange: (b) =>
          Math.hypot(b.position.x - item.object.position.x, b.position.z - item.object.position.z) < 1.6 + b.spec.radius &&
          Math.abs(b.feetY - item.object.position.y) < 1.2,
        enabled: () => item.state === "ground" && this.heldBy(bear) === undefined && bear.mode === "walk",
        onComplete: (b) => {
          item.state = "held"
          item.holder = b
          this.sound("pickup")
        }
      })
    }
    return item
  }

  addZone(zone: DropZone) {
    this.zones.push(zone)
    for (const bear of this.bears) {
      this.interactions.add({
        id: `zone-${zone.label}-${zone.at.x}-${bear.spec.id}`,
        who: bear.spec.id,
        kind: "press",
        buttons: ["b"],
        label: zone.label,
        anchor: () => zone.at.clone().add(new THREE.Vector3(0, 2, 0)),
        inRange: (b) => this.inZone(b, zone),
        enabled: () => {
          const item = this.heldBy(bear)
          return item !== undefined && zone.accepts(item)
        },
        onComplete: (b) => {
          const item = this.heldBy(b)
          if (!item) return
          item.state = "delivered"
          item.holder = null
          item.object.position.copy(zone.at).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6))
          this.particles.burst(zone.at.clone().add(new THREE.Vector3(0, 1, 0)), { colors: ["#ffe066", "#ffffff"], count: 20, speed: 3, up: 2 })
          this.sound("found")
          zone.onDeliver(item, b)
        }
      })
    }
  }

  /** Drop whatever this bear is holding just in front of it. */
  drop(bear: Bear) {
    const item = this.heldBy(bear)
    if (!item) return
    item.state = "falling"
    item.holder = null
    item.velocity.copy(bear.forward).multiplyScalar(2).setY(3)
    this.sound("putdown")
  }

  /** Put a new item into the world as if it had just fallen from somewhere (e.g. knocked from a tree). */
  fall(item: Carryable, from: THREE.Vector3) {
    item.object.position.copy(from)
    item.velocity.set(0, 0, 0)
    item.state = "falling"
  }

  update(dt: number) {
    for (const item of this.items) {
      if (item.state === "held" && item.holder) {
        const bear = item.holder
        // Held up over the head, bobbing with each step.
        this.temp.copy(bear.position)
        this.temp.y = bear.feetY + 2.1 * bear.spec.scale + 0.35 + Math.sin(performance.now() / 150) * 0.03
        item.object.position.lerp(this.temp, Math.min(1, dt * 18))
        item.object.rotation.y += dt * 1.5
        // Dropped in the water? It bobs back to where it was picked up from would be confusing;
        // instead it just comes back down where the bear respawns (it stays held).
      } else if (item.state === "falling") {
        const previousY = item.object.position.y
        item.velocity.y -= GRAVITY * dt
        item.object.position.addScaledVector(item.velocity, dt)
        // Raised hay stacks and stumps are colliders, not terrain. Cast from before the fall
        // so a fast-moving acorn cannot pass through their tops; bears aren't item shelves.
        this.ray.origin.x = item.object.position.x
        this.ray.origin.y = Math.max(previousY, item.object.position.y)
        this.ray.origin.z = item.object.position.z
        const hit = this.world.castRay(
          this.ray,
          40,
          true,
          this.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          undefined,
          (collider) => !this.bears.some((bear) => bear.collider.handle === collider.handle)
        )
        const solidY = hit ? this.ray.origin.y - hit.timeOfImpact : -Infinity
        const floor = Math.max(solidY, this.terrain.heightAt(item.object.position.x, item.object.position.z), this.terrain.waterY + 0.3) + 0.3
        if (item.object.position.y <= floor) {
          item.object.position.y = floor
          if (Math.abs(item.velocity.y) < 2) {
            item.state = "ground"
            item.velocity.set(0, 0, 0)
          } else {
            item.velocity.y = Math.abs(item.velocity.y) * 0.35
            item.velocity.x *= 0.5
            item.velocity.z *= 0.5
          }
        }
      } else if (item.state === "ground") {
        item.object.rotation.y += dt * 0.8
      }
    }
  }
}
