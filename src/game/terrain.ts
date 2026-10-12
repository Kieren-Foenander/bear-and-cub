import type RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import { hash3, smoothstep } from "./util.ts"

export interface Bounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/** Everything a level needs to say about its ground. */
export interface TerrainDef {
  readonly bounds: Bounds
  readonly height: (x: number, z: number) => number
  /** Optional per-triangle colour, e.g. a dirt path. Return null for the default palette. */
  readonly color?: (x: number, z: number, y: number) => THREE.ColorRepresentation | null
  /** Anything below this is water. */
  readonly waterY?: number
  readonly waterColor?: THREE.ColorRepresentation
  readonly grass?: ReadonlyArray<THREE.ColorRepresentation>
  readonly hill?: THREE.ColorRepresentation
  /** Triangle size in metres. Smaller = crisper edges (e.g. creek banks you jump across). */
  readonly cell?: number
}

/** Hills around the edge of a level so nobody wanders off the map. */
export const edgeHills = (bounds: Bounds, x: number, z: number, height = 9, width = 10) =>
  height *
  Math.max(
    smoothstep(bounds.maxX - width, bounds.maxX, x),
    smoothstep(bounds.minX + width, bounds.minX, x),
    smoothstep(bounds.maxZ - width, bounds.maxZ, z),
    smoothstep(bounds.minZ + width, bounds.minZ, z)
  )

const DEFAULT_GRASS = ["#7cc451", "#6db847", "#86cc5a", "#74bd4e"]

export class Terrain {
  readonly waterY: number
  readonly bounds: Bounds
  private readonly water: THREE.Mesh
  private readonly waterUniforms = { uTime: { value: 0 } }

  constructor(
    private readonly def: TerrainDef,
    scene: THREE.Scene,
    rapier: typeof RAPIER,
    world: RAPIER.World
  ) {
    this.waterY = def.waterY ?? -1
    this.bounds = def.bounds
    const { minX, maxX, minZ, maxZ } = def.bounds
    const width = maxX - minX
    const depth = maxZ - minZ
    const cell = def.cell ?? 1.4
    const geometry = new THREE.PlaneGeometry(width, depth, Math.round(width / cell), Math.round(depth / cell))
    geometry.rotateX(-Math.PI / 2)
    geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

    const position = geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i)
      let z = position.getZ(i)
      const edge = x <= minX || x >= maxX || z <= minZ || z >= maxZ
      if (!edge) {
        x += hash3(x, 0, z) * cell * 0.3
        z += hash3(z, 1, x) * cell * 0.3
      }
      position.setXYZ(i, x, def.height(x, z), z)
    }

    // The physics collider uses exactly the same triangles as the visual mesh.
    const vertices = new Float32Array(position.array)
    const indices = new Uint32Array(geometry.index!.array)
    world.createCollider(rapier.ColliderDesc.trimesh(vertices, indices).setFriction(0.8))

    // Flat shading + one colour per triangle = the low-poly look.
    const faceted = geometry.toNonIndexed()
    geometry.dispose()
    const fp = faceted.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(fp.count * 3)
    const color = new THREE.Color()
    const grass = (def.grass ?? DEFAULT_GRASS).map((c) => new THREE.Color(c))
    const hill = new THREE.Color(def.hill ?? "#5b9e3c")
    const sand = new THREE.Color("#e3d2a0")
    const bed = new THREE.Color("#8d8a7a")
    for (let i = 0; i < fp.count; i += 3) {
      const cx = (fp.getX(i) + fp.getX(i + 1) + fp.getX(i + 2)) / 3
      const cy = (fp.getY(i) + fp.getY(i + 1) + fp.getY(i + 2)) / 3
      const cz = (fp.getZ(i) + fp.getZ(i + 1) + fp.getZ(i + 2)) / 3
      const custom = def.color?.(cx, cz, cy)
      if (custom != null) color.set(custom)
      else if (cy < this.waterY - 0.3) color.copy(bed)
      else if (cy < this.waterY + 0.9) color.copy(sand)
      else if (cy > 3.5) color.copy(hill).offsetHSL(0, 0, hash3(cx, cy, cz) * 0.03)
      else color.copy(grass[Math.floor((hash3(cx, 7, cz) * 0.5 + 0.5) * grass.length) % grass.length]!)
      for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3)
    }
    faceted.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    faceted.computeVertexNormals()
    const ground = new THREE.Mesh(faceted, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }))
    ground.receiveShadow = true
    scene.add(ground)

    // Invisible walls in case anyone manages to scramble up the edge hills.
    const wall = (x: number, z: number, hx: number, hz: number) =>
      world.createCollider(rapier.ColliderDesc.cuboid(hx, 30, hz).setTranslation(x, 10, z))
    wall(minX + 4, (minZ + maxZ) / 2, 1, depth)
    wall(maxX - 4, (minZ + maxZ) / 2, 1, depth)
    wall((minX + maxX) / 2, minZ + 4, width, 1)
    wall((minX + maxX) / 2, maxZ - 4, width, 1)

    // One water plane for the whole level: anywhere the ground dips below it becomes a river or pond.
    const waterGeometry = new THREE.PlaneGeometry(width, depth, Math.round(width / 2), Math.round(depth / 2))
    waterGeometry.rotateX(-Math.PI / 2)
    waterGeometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: def.waterColor ?? "#4fb7ea",
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3
    })
    waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.waterUniforms.uTime
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          transformed.y += sin(uTime * 1.6 + position.x * 0.6 + position.z * 0.4) * 0.08 + cos(uTime * 1.1 - position.x * 0.3) * 0.05;`
        )
    }
    this.water = new THREE.Mesh(waterGeometry, waterMaterial)
    this.water.position.y = this.waterY
    this.water.receiveShadow = true
    scene.add(this.water)
  }

  heightAt(x: number, z: number) {
    return this.def.height(x, z)
  }

  update(time: number) {
    this.waterUniforms.uTime.value = time
  }
}
