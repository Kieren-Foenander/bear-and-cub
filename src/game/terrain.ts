import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import { hash3, smoothstep } from "./util.ts"

export const WORLD = { minX: -46, maxX: 46, minZ: -74, maxZ: 42 }
export const WATER_Y = -1
export const RIVER_HALF_WIDTH = 6

/** The river wiggles a little as it crosses the map. */
export const riverZ = (x: number) => -21 + 1.5 * Math.sin(x * 0.09)

export const distanceToRiver = (x: number, z: number) => Math.abs(z - riverZ(x))

/** The dirt path snakes from the start meadow to the honey tree. */
export const pathX = (z: number) => 1.2 * Math.sin(z * 0.15)

const isOnPath = (x: number, z: number) =>
  z < 30 && z > -52 && distanceToRiver(x, z) > RIVER_HALF_WIDTH && Math.abs(x - pathX(z)) < 1.6

export const heightAt = (x: number, z: number) => {
  const bumps =
    0.6 * Math.sin(x * 0.17) * Math.cos(z * 0.13) + 0.35 * Math.sin(x * 0.37 + z * 0.29) + 0.25 * Math.cos(z * 0.41 - x * 0.11)
  // Keep the middle corridor flat so puzzle spots are predictable; let the sides roll.
  const corridor = smoothstep(10, 22, Math.abs(x))
  const river = distanceToRiver(x, z)
  let h = (bumps + 0.4) * corridor * smoothstep(RIVER_HALF_WIDTH, 9, river)
  h -= 3 * smoothstep(RIVER_HALF_WIDTH, 3.5, river)
  // Hills around the edge keep everyone inside the play area.
  // (but not across the river, or the hills would make a sneaky land bridge).
  h += 9 * smoothstep(WORLD.maxX - 10, WORLD.maxX, Math.abs(x)) * smoothstep(RIVER_HALF_WIDTH, RIVER_HALF_WIDTH + 4, river)
  h += 9 * smoothstep(WORLD.maxZ - 10, WORLD.maxZ, z)
  h += 9 * smoothstep(WORLD.minZ + 10, WORLD.minZ, z)
  return h
}

const COLORS = {
  grass: [new THREE.Color("#7cc451"), new THREE.Color("#6db847"), new THREE.Color("#86cc5a"), new THREE.Color("#74bd4e")],
  hill: new THREE.Color("#5b9e3c"),
  path: new THREE.Color("#d9b77e"),
  sand: new THREE.Color("#e3d2a0"),
  riverbed: new THREE.Color("#8d8a7a")
}

export const createTerrain = (scene: THREE.Scene, rapier: typeof RAPIER, world: RAPIER.World) => {
  const width = WORLD.maxX - WORLD.minX
  const depth = WORLD.maxZ - WORLD.minZ
  const cell = 1.4
  const geometry = new THREE.PlaneGeometry(width, depth, Math.round(width / cell), Math.round(depth / cell))
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2)

  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i)
    let z = position.getZ(i)
    const edge = x <= WORLD.minX || x >= WORLD.maxX || z <= WORLD.minZ || z >= WORLD.maxZ
    if (!edge) {
      x += hash3(x, 0, z) * cell * 0.3
      z += hash3(z, 1, x) * cell * 0.3
    }
    position.setXYZ(i, x, heightAt(x, z), z)
  }

  // The physics collider uses exactly the same triangles as the visual mesh.
  const vertices = new Float32Array(position.array)
  const indices = new Uint32Array(geometry.index!.array)
  world.createCollider(rapier.ColliderDesc.trimesh(vertices, indices).setFriction(0.8))

  // Flat shading + one colour per triangle = the low-poly look.
  const faceted = geometry.toNonIndexed()
  const facetedPosition = faceted.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(facetedPosition.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < facetedPosition.count; i += 3) {
    const cx = (facetedPosition.getX(i) + facetedPosition.getX(i + 1) + facetedPosition.getX(i + 2)) / 3
    const cy = (facetedPosition.getY(i) + facetedPosition.getY(i + 1) + facetedPosition.getY(i + 2)) / 3
    const cz = (facetedPosition.getZ(i) + facetedPosition.getZ(i + 1) + facetedPosition.getZ(i + 2)) / 3
    if (cy < WATER_Y - 0.3) color.copy(COLORS.riverbed)
    else if (cy < 0.05 && distanceToRiver(cx, cz) < RIVER_HALF_WIDTH + 0.5) color.copy(COLORS.sand)
    else if (isOnPath(cx, cz)) color.copy(COLORS.path)
    else if (cy > 2.5) color.copy(COLORS.hill).offsetHSL(0, 0, hash3(cx, cy, cz) * 0.03)
    else color.copy(COLORS.grass[Math.floor((hash3(cx, 7, cz) * 0.5 + 0.5) * 4) % 4]!)
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3)
  }
  faceted.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  faceted.computeVertexNormals()

  const ground = new THREE.Mesh(
    faceted,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
  )
  ground.receiveShadow = true
  scene.add(ground)

  // Invisible walls in case anyone manages to scramble up the edge hills.
  const wall = (x: number, z: number, hx: number, hz: number) =>
    world.createCollider(rapier.ColliderDesc.cuboid(hx, 20, hz).setTranslation(x, 10, z))
  wall(WORLD.minX + 4, 0, 1, depth)
  wall(WORLD.maxX - 4, 0, 1, depth)
  wall(0, WORLD.minZ + 4, width, 1)
  wall(0, WORLD.maxZ - 4, width, 1)
}

/** A low-poly river surface that gently bobs. */
export class Water {
  readonly mesh: THREE.Mesh
  private readonly base: Float32Array

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, RIVER_HALF_WIDTH * 2 + 6, 46, 8)
    geometry.rotateX(-Math.PI / 2)
    const position = geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      position.setZ(i, position.getZ(i) + riverZ(x))
    }
    this.base = new Float32Array(position.array)
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: "#4fb7ea",
        flatShading: true,
        transparent: true,
        opacity: 0.85,
        roughness: 0.3
      })
    )
    this.mesh.position.y = WATER_Y
    this.mesh.receiveShadow = true
    scene.add(this.mesh)
  }

  update(time: number) {
    const position = this.mesh.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) {
      const x = this.base[i * 3]!
      const z = this.base[i * 3 + 2]!
      position.setY(i, Math.sin(time * 1.6 + x * 0.6 + z * 0.4) * 0.08 + Math.cos(time * 1.1 - x * 0.3) * 0.05)
    }
    position.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}
