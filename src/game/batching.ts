import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

/** Mark scenery that never moves, so `batchStatic` can merge it into a few big meshes. */
export const markStatic = <T extends THREE.Object3D>(object: T): T => {
  object.userData.static = true
  return object
}

/**
 * Merge every static mesh in the scene into one mesh per material. A level has hundreds of
 * trees, rocks and cliff blocks; drawing them one by one costs a draw call each (twice, with
 * shadows). After this they cost a handful.
 */
export const batchStatic = (scene: THREE.Scene) => {
  scene.updateMatrixWorld(true)
  const roots: Array<THREE.Object3D> = []
  scene.traverse((object) => {
    if (object.userData.static && !roots.some((root) => isDescendant(object, root))) roots.push(object)
  })

  const byMaterial = new Map<THREE.Material, { geometries: Array<THREE.BufferGeometry>; castShadow: boolean }>()
  for (const root of roots) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return
      const geometry = (object.geometry as THREE.BufferGeometry).index ? object.geometry.toNonIndexed() : object.geometry.clone()
      for (const name of Object.keys(geometry.attributes)) {
        if (name !== "position" && name !== "normal") geometry.deleteAttribute(name)
      }
      if (!geometry.attributes.normal) geometry.computeVertexNormals()
      geometry.applyMatrix4(object.matrixWorld)
      const entry = byMaterial.get(object.material) ?? { geometries: [], castShadow: false }
      entry.geometries.push(geometry)
      entry.castShadow ||= object.castShadow
      byMaterial.set(object.material, entry)
    })
  }
  for (const root of roots) {
    root.removeFromParent()
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
  }

  for (const [material, { geometries, castShadow }] of byMaterial) {
    const merged = mergeGeometries(geometries)
    for (const geometry of geometries) geometry.dispose()
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    scene.add(mesh)
  }
}

const isDescendant = (object: THREE.Object3D, root: THREE.Object3D) => {
  for (let parent = object.parent; parent; parent = parent.parent) if (parent === root) return true
  return false
}
