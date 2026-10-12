import * as THREE from "three"

export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent exponential smoothing towards `target`. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))

export const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

/** Small deterministic PRNG so the world looks the same every time we load it. */
export const seeded = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Hash a position to [-1, 1]; identical positions always get identical results. */
export const hash3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

/** Shared flat-shaded material: the whole low-poly look comes from this. */
export const flat = (color: THREE.ColorRepresentation) => {
  const key = new THREE.Color(color).getHexString()
  let material = materials.get(key)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0 })
    materials.set(key, material)
  }
  return material
}

export const mesh = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  options: { castShadow?: boolean; receiveShadow?: boolean } = {}
) => {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = options.castShadow ?? true
  m.receiveShadow = options.receiveShadow ?? true
  return m
}

/** Nudge vertices by a position-based hash so boxes and spheres look chunky but stay crack-free. */
export const jitter = (geometry: THREE.BufferGeometry, amount: number) => {
  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const kx = Math.round(x * 100) / 100
    const ky = Math.round(y * 100) / 100
    const kz = Math.round(z * 100) / 100
    position.setXYZ(
      i,
      x + hash3(kx, ky, kz) * amount,
      y + hash3(ky, kz, kx) * amount,
      z + hash3(kz, kx, ky) * amount
    )
  }
  geometry.computeVertexNormals()
  return geometry
}
