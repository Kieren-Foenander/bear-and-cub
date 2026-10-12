import * as THREE from "three"

/** A flat colour, or one picked per facet from its part-local centre and outward normal. */
export type Paint = THREE.Color | ((centre: THREE.Vector3, normal: THREE.Vector3) => THREE.Color)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)

/**
 * Accumulates crisp planar facets into one vertex-coloured geometry, so every part on a pivot
 * becomes a single mesh. Each facet gets exactly one colour (never split across its triangles),
 * with an optional whisper of tone variation, which keeps the folded-paper look tidy.
 */
export class Sculpt {
  private readonly positions: number[] = []
  private readonly colors: number[] = []
  private readonly matrix = new THREE.Matrix4()
  private readonly euler = new THREE.Euler()
  private readonly quaternion = new THREE.Quaternion()
  private readonly scale = new THREE.Vector3(1, 1, 1)
  private readonly offset = new THREE.Vector3()

  /** Lightness jitter per facet (0 for none). */
  constructor(private readonly jitter = 0.012) {}

  /** Places following parts: translate, then rotate (XYZ), uniformly or per-axis scaled. */
  place(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): this {
    this.offset.set(x, y, z)
    this.quaternion.setFromEuler(this.euler.set(rx, ry, rz))
    this.matrix.compose(this.offset, this.quaternion, this.scale.set(sx, sy, sz))
    return this
  }

  /** One flat convex polygon, wound to face away from `inside` (part-local). */
  face(points: readonly THREE.Vector3[], paint: Paint, inside: THREE.Vector3): void {
    const centre = new THREE.Vector3()
    for (const p of points) centre.add(p)
    centre.divideScalar(points.length)
    // Newell's method copes with any planar convex polygon.
    const normal = new THREE.Vector3()
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!
      const b = points[(i + 1) % points.length]!
      normal.x += (a.y - b.y) * (a.z + b.z)
      normal.y += (a.z - b.z) * (a.x + b.x)
      normal.z += (a.x - b.x) * (a.y + b.y)
    }
    if (normal.lengthSq() < 1e-12) return
    normal.normalize()
    const flip = normal.dot(centre.clone().sub(inside)) < 0
    if (flip) normal.negate()
    const color = (typeof paint === "function" ? paint(centre, normal) : paint).clone()
    if (this.jitter > 0) {
      const s = Math.sin(centre.x * 91.7 + centre.y * 47.3 + centre.z * 13.1) * 4375.85
      color.offsetHSL(0, 0, (s - Math.floor(s) - 0.5) * this.jitter)
    }
    const world = points.map(p => p.clone().applyMatrix4(this.matrix))
    for (let i = 1; i < world.length - 1; i++) {
      const tri = flip ? [world[0]!, world[i + 1]!, world[i]!] : [world[0]!, world[i]!, world[i + 1]!]
      for (const p of tri) {
        this.positions.push(p.x, p.y, p.z)
        this.colors.push(color.r, color.g, color.b)
      }
    }
  }

  /**
   * Skins matching rings (same point count, edges kept parallel) into planar quads and caps both
   * ends. Rings built by `ringX/Y/Z` or `outline` always give flat facets.
   */
  loft(rings: readonly (readonly THREE.Vector3[])[], paint: Paint, caps = true): this {
    const inside = new THREE.Vector3()
    let count = 0
    for (const ring of rings) for (const p of ring) { inside.add(p); count++ }
    inside.divideScalar(count)
    for (let r = 0; r < rings.length - 1; r++) {
      const a = rings[r]!
      const b = rings[r + 1]!
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length
        const quad = [a[i]!, a[j]!, b[j]!, b[i]!]
        // Drop collapsed corners so pointed tips stay valid triangles.
        const unique = quad.filter((p, k) => p.distanceToSquared(quad[(k + 1) % 4]!) > 1e-10)
        if (unique.length >= 3) this.face(unique, paint, inside)
      }
    }
    if (caps) {
      this.face(rings[0]!, paint, inside)
      this.face(rings[rings.length - 1]!, paint, inside)
    }
    return this
  }

  /** A flat outline (in XY) extruded along Z from z0 to z1, with bevelled front and back. */
  slab(outline: readonly (readonly [number, number])[], z0: number, z1: number, bevel: number, paint: Paint): this {
    const inset = (scale: number, z: number) => {
      let cx = 0
      let cy = 0
      for (const [x, y] of outline) { cx += x; cy += y }
      cx /= outline.length
      cy /= outline.length
      return outline.map(([x, y]) => v(cx + (x - cx) * scale, cy + (y - cy) * scale, z))
    }
    const depth = z1 - z0
    return this.loft([inset(1 - bevel, z0), inset(1, z0 + depth * 0.3), inset(1, z1 - depth * 0.4), inset(1 - bevel, z1)], paint)
  }

  /** A low faceted button (eye, nose, blush) facing +Z, its back at z. */
  dot(x: number, y: number, z: number, rx: number, ry: number, depth: number, paint: Paint, sides = 8, crown = 0.62): this {
    const ring = (scale: number, dz: number) => {
      const points: THREE.Vector3[] = []
      for (let i = 0; i < sides; i++) {
        const angle = (i + 0.5) / sides * Math.PI * 2
        points.push(v(x + Math.cos(angle) * rx * scale, y + Math.sin(angle) * ry * scale, z + dz))
      }
      return points
    }
    return this.loft([ring(1, 0), ring(1, depth * 0.45), ring(crown, depth)], paint)
  }

  get empty(): boolean { return this.positions.length === 0 }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
}

/** A chamfered rectangle (octagon) in the XZ plane at height y. Absolute chamfers keep facets planar. */
export const ringY = (y: number, hw: number, hd: number, c: number, cx = 0, cz = 0): THREE.Vector3[] => {
  c = Math.min(c, hw * 0.95, hd * 0.95)
  return [
    v(cx + hw - c, y, cz + hd), v(cx + hw, y, cz + hd - c), v(cx + hw, y, cz - hd + c), v(cx + hw - c, y, cz - hd),
    v(cx - hw + c, y, cz - hd), v(cx - hw, y, cz - hd + c), v(cx - hw, y, cz + hd - c), v(cx - hw + c, y, cz + hd)
  ]
}

/** A chamfered rectangle (octagon) in the XY plane at depth z. */
export const ringZ = (z: number, hw: number, hh: number, c: number, cx = 0, cy = 0): THREE.Vector3[] => {
  c = Math.min(c, hw * 0.95, hh * 0.95)
  return [
    v(cx + hw - c, cy + hh, z), v(cx + hw, cy + hh - c, z), v(cx + hw, cy - hh + c, z), v(cx + hw - c, cy - hh, z),
    v(cx - hw + c, cy - hh, z), v(cx - hw, cy - hh + c, z), v(cx - hw, cy + hh - c, z), v(cx - hw + c, cy + hh, z)
  ]
}

/** A chamfered rectangle (octagon) in the YZ plane at x, for parts lofted sideways. */
export const ringX = (x: number, hh: number, hd: number, c: number, cy = 0, cz = 0): THREE.Vector3[] => {
  c = Math.min(c, hh * 0.95, hd * 0.95)
  return [
    v(x, cy + hh, cz + hd - c), v(x, cy + hh - c, cz + hd), v(x, cy - hh + c, cz + hd), v(x, cy - hh, cz + hd - c),
    v(x, cy - hh, cz - hd + c), v(x, cy - hh + c, cz - hd), v(x, cy + hh - c, cz - hd), v(x, cy + hh, cz - hd + c)
  ]
}

const shared = new Map<string, THREE.MeshStandardMaterial>()

/** Shared vertex-coloured flat materials; colour lives in the geometry, so both bears share these. */
export const origamiMaterial = (kind: "matte" | "gloss"): THREE.MeshStandardMaterial => {
  let material = shared.get(kind)
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, metalness: 0, roughness: kind === "gloss" ? 0.22 : 0.88
    })
    shared.set(kind, material)
  }
  return material
}

/** Bake a sculpt into a shadow-casting mesh on `parent`. */
export const bake = (parent: THREE.Object3D, sculpt: Sculpt, kind: "matte" | "gloss" = "matte", name = ""): THREE.Mesh | null => {
  if (sculpt.empty) return null
  const mesh = new THREE.Mesh(sculpt.build(), origamiMaterial(kind))
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
