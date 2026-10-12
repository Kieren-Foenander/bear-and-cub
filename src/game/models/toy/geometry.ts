import * as THREE from "three"
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"

/**
 * Smooth vinyl-toy building blocks. Every part is a unit primitive that gets squashed, placed and
 * vertex-coloured into a `PartBatch`, so one pivot becomes one mesh (one draw call) no matter how
 * many colours it has.
 */

/** Strip UVs and weld the seam so smooth normals have no visible crease. */
const weld = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  geometry.deleteAttribute("uv")
  const welded = mergeVertices(geometry)
  geometry.dispose()
  welded.computeVertexNormals()
  return welded
}

const cache = new Map<string, THREE.BufferGeometry>()
const cached = (key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let geometry = cache.get(key)
  if (!geometry) { geometry = build(); cache.set(key, geometry) }
  return geometry
}

/** A unit-radius sphere; scale it into eggs, beans and buttons. */
export type Detail = "hi" | "mid" | "lo" | "xs"

export const ball = (detail: Detail = "mid"): THREE.BufferGeometry =>
  cached(`ball-${detail}`, () => {
    const [w, h] = detail === "hi" ? [24, 16] : detail === "mid" ? [14, 10] : detail === "lo" ? [10, 7] : [7, 5]
    return weld(new THREE.SphereGeometry(1, w, h))
  })

/**
 * A unit sphere gently reshaped into a bean / pear: `taper` widens the bottom and narrows the top,
 * `flat` presses the underside so a body sits like a toy on a shelf.
 */
export const bean = (taper: number, flat: number, detail: Detail = "hi"): THREE.BufferGeometry =>
  cached(`bean-${taper}-${flat}-${detail}`, () => {
    const geometry = ball(detail).clone()
    const position = geometry.getAttribute("position")
    const v = new THREE.Vector3()
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i)
      const widen = 1 - taper * v.y
      v.x *= widen
      v.z *= widen
      if (v.y < 0) v.y *= 1 - flat * (1 - v.y * v.y * 0.4)
      position.setXYZ(i, v.x, v.y, v.z)
    }
    geometry.computeVertexNormals()
    return geometry
  })

/** A torus, or an arc of one (for smiles and closed happy eyes). */
export const ring = (radius: number, tube: number, arc = Math.PI * 2, tubular = 24, radial = 8): THREE.BufferGeometry =>
  cached(`ring-${radius}-${tube}-${arc}-${tubular}-${radial}`, () => {
    const geometry = new THREE.TorusGeometry(radius, tube, radial, tubular, arc)
    geometry.deleteAttribute("uv")
    if (arc >= Math.PI * 2 - 1e-6) return weld(geometry)
    return geometry
  })

/** A rounded little cone (party-hat-shaped) for the scarf tip and flower petals. */
export const teardrop = (detail: Detail = "lo"): THREE.BufferGeometry =>
  cached(`teardrop-${detail}`, () => {
    const geometry = ball(detail).clone()
    const position = geometry.getAttribute("position")
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      const pinch = 0.55 + 0.45 * (1 - y) / 2 * 1.4
      position.setX(i, position.getX(i) * pinch)
      position.setZ(i, position.getZ(i) * pinch)
    }
    geometry.computeVertexNormals()
    return geometry
  })

const matrix = new THREE.Matrix4()
const quaternion = new THREE.Quaternion()
const euler = new THREE.Euler()
const scaleVector = new THREE.Vector3()
const positionVector = new THREE.Vector3()
const colour = new THREE.Color()

export interface Placement {
  /** Position. */
  readonly at: readonly [number, number, number]
  /** Radii / scale. */
  readonly size: readonly [number, number, number] | number
  /** Euler rotation (XYZ), or an explicit quaternion. */
  readonly rot?: readonly [number, number, number] | THREE.Quaternion
}

/** Collects vertex-coloured parts for one rigid pivot, then bakes them into a single mesh. */
export class PartBatch {
  private readonly parts: THREE.BufferGeometry[] = []

  add(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, place: Placement): this {
    const part = geometry.clone()
    const size = place.size
    if (typeof size === "number") scaleVector.setScalar(size)
    else scaleVector.set(size[0], size[1], size[2])
    if (place.rot instanceof THREE.Quaternion) quaternion.copy(place.rot)
    else if (place.rot) quaternion.setFromEuler(euler.set(place.rot[0], place.rot[1], place.rot[2]))
    else quaternion.identity()
    matrix.compose(positionVector.set(place.at[0], place.at[1], place.at[2]), quaternion, scaleVector)
    part.applyMatrix4(matrix)
    colour.set(color)
    const count = part.getAttribute("position").count
    const colours = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colours[i * 3] = colour.r
      colours[i * 3 + 1] = colour.g
      colours[i * 3 + 2] = colour.b
    }
    part.setAttribute("color", new THREE.BufferAttribute(colours, 3))
    this.parts.push(part)
    return this
  }

  get empty(): boolean { return this.parts.length === 0 }

  mesh(material: THREE.Material, name: string, castShadow = true): THREE.Mesh {
    const indexed = this.parts.every(part => part.index !== null)
    const inputs = indexed ? this.parts : this.parts.map(part => part.index ? part.toNonIndexed() : part)
    const geometry = mergeGeometries(inputs, false)
    for (const part of this.parts) part.dispose()
    this.parts.length = 0
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    return mesh
  }
}
