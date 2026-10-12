import * as THREE from "three"

/** Rounded, hand-shaped ring profiles rather than scaled primitive spheres.
 * Alternating diagonals keep the broad facets quiet under soft lighting. */
export const pebble = (width: number, height: number, depth: number, fullness = 1): THREE.BufferGeometry => {
  const sides = 12
  const rings = 8
  const vertices: number[] = []
  const indices: number[] = []
  for (let ring = 0; ring <= rings; ring++) {
    const latitude = Math.PI * ring / rings
    const y = Math.cos(latitude)
    const radius = Math.pow(Math.sin(latitude), fullness)
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2
      // Slightly fuller lower cheeks, flatter crown and gentle asymmetry.
      const cheek = 1 + 0.045 * Math.sin(latitude * 2)
      vertices.push(Math.cos(angle) * radius * width * cheek, y * height,
        Math.sin(angle) * radius * depth * (1 - 0.035 * y))
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side
      const b = ring * sides + (side + 1) % sides
      const c = a + sides
      const d = b + sides
      if ((ring + side) % 2) indices.push(a, b, c, b, d, c)
      else indices.push(a, d, c, a, b, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

export const material = (color: THREE.ColorRepresentation): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.91, metalness: 0, flatShading: true })

export const part = (
  parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material,
  x = 0, y = 0, z = 0, name = ""
): THREE.Mesh => {
  const mesh = new THREE.Mesh(geometry, surface)
  mesh.position.set(x, y, z)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** A tiny fixed curve is geometry, never a per-frame allocation. */
export const line = (parent: THREE.Object3D, points: readonly THREE.Vector3[], radius: number,
  surface: THREE.Material): THREE.Mesh => part(parent,
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...points]), 10, radius, 4, false), surface)

/** Bake static pieces per pivot/material. Facial pivots and mouth remain editable. */
export const batchStaticParts = (parent: THREE.Object3D, keep: ReadonlySet<THREE.Object3D>): void => {
  const batches = new Map<THREE.Material, THREE.Mesh[]>()
  for (const child of [...parent.children]) {
    if (child instanceof THREE.Mesh && !keep.has(child) && !Array.isArray(child.material)) {
      const batch = batches.get(child.material) ?? []
      batch.push(child)
      batches.set(child.material, batch)
    } else batchStaticParts(child, keep)
  }
  for (const [surface, meshes] of batches) {
    if (meshes.length < 2) continue
    const positions: number[] = []
    const normals: number[] = []
    const transform = new THREE.Matrix3()
    const v = new THREE.Vector3()
    for (const mesh of meshes) {
      mesh.updateMatrix()
      transform.getNormalMatrix(mesh.matrix)
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      const position = geometry.getAttribute("position")
      const normal = geometry.getAttribute("normal")
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix)
        positions.push(v.x, v.y, v.z)
        v.fromBufferAttribute(normal, i).applyMatrix3(transform).normalize()
        normals.push(v.x, v.y, v.z)
      }
      geometry.dispose()
      mesh.geometry.dispose()
      parent.remove(mesh)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
    geometry.computeBoundingBox()
    part(parent, geometry, surface, 0, 0, 0, "batched sculpt")
  }
}
