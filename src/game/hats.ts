import * as THREE from "three"
import { flat, mesh } from "./util.ts"

/** Hats for Cub, one for finishing each level. Built at "cub head" scale (before the 0.55 scale). */
export interface Hat {
  readonly id: string
  readonly name: string
  readonly emoji: string
  /** Finishing this level unlocks it. */
  readonly unlockedBy: string
  readonly build: () => THREE.Object3D
}

const flowerCrown = () => {
  const group = new THREE.Group()
  const ring = mesh(new THREE.TorusGeometry(0.36, 0.05, 5, 16), flat("#5aa64a"))
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  const colors = ["#ff7eb6", "#ffd84d", "#ffffff", "#b38cff", "#ff9a4d"]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const bloom = mesh(new THREE.IcosahedronGeometry(0.09, 0), flat(colors[i % colors.length]!))
    bloom.position.set(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36)
    group.add(bloom)
  }
  return group
}

const sailorHat = () => {
  const group = new THREE.Group()
  const crown = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 10), flat("#ffffff"))
  crown.position.y = 0.11
  const band = mesh(new THREE.CylinderGeometry(0.345, 0.35, 0.08, 10), flat("#3b82f6"))
  band.position.y = 0.04
  const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), flat("#ffffff"))
  group.add(crown, band, brim)
  return group
}

const frogHat = () => {
  const group = new THREE.Group()
  const dome = mesh(new THREE.SphereGeometry(0.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat("#5cbf4a"))
  dome.scale.y = 0.7
  group.add(dome)
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.IcosahedronGeometry(0.12, 1), flat("#5cbf4a"))
    eye.position.set(side * 0.2, 0.3, 0.18)
    const pupil = mesh(new THREE.IcosahedronGeometry(0.06, 1), flat("#1e2a18"))
    pupil.position.set(side * 0.21, 0.32, 0.28)
    group.add(eye, pupil)
  }
  return group
}

const mushroomCap = () => {
  const group = new THREE.Group()
  const cap = mesh(new THREE.SphereGeometry(0.46, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat("#e5484d"))
  cap.scale.y = 0.6
  group.add(cap)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const spot = mesh(new THREE.IcosahedronGeometry(0.06, 0), flat("#ffffff"))
    spot.position.set(Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28)
    group.add(spot)
  }
  return group
}

const goldenCrown = () => {
  const group = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: "#ffcf3f", metalness: 0.5, roughness: 0.35, flatShading: true, emissive: "#a8790a", emissiveIntensity: 0.25 })
  const band = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 10, 1, true), gold)
  band.position.y = 0.08
  group.add(band)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const point = mesh(new THREE.ConeGeometry(0.08, 0.2, 4), gold)
    point.position.set(Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3)
    const gem = mesh(new THREE.IcosahedronGeometry(0.045, 0), flat(i % 2 ? "#ff6fa8" : "#6fc3ff"))
    gem.position.set(Math.cos(a) * 0.33, 0.1, Math.sin(a) * 0.33)
    group.add(point, gem)
  }
  return group
}

const partyHat = () => {
  const group = new THREE.Group()
  const cone = mesh(new THREE.ConeGeometry(0.24, 0.6, 10), flat("#c38bff"))
  cone.position.y = 0.3
  const pom = mesh(new THREE.IcosahedronGeometry(0.08, 1), flat("#ffe066"))
  pom.position.y = 0.62
  group.add(cone, pom)
  for (let i = 0; i < 3; i++) {
    const stripe = mesh(new THREE.TorusGeometry(0.2 - i * 0.06, 0.02, 4, 12), flat("#ffe066"))
    stripe.rotation.x = Math.PI / 2
    stripe.position.y = 0.12 + i * 0.16
    group.add(stripe)
  }
  group.rotation.z = 0.25
  return group
}

const nightcap = () => {
  const group = new THREE.Group()
  const cone = mesh(new THREE.ConeGeometry(0.3, 0.75, 10), flat("#5b6fd8"))
  cone.position.set(0, 0.3, -0.1)
  cone.rotation.x = -0.6
  const band = mesh(new THREE.TorusGeometry(0.3, 0.07, 5, 12), flat("#ffffff"))
  band.rotation.x = Math.PI / 2
  const star = mesh(new THREE.IcosahedronGeometry(0.06, 0), flat("#ffe066"))
  star.position.set(0.12, 0.3, 0.15)
  const pom = mesh(new THREE.IcosahedronGeometry(0.09, 1), flat("#ffffff"))
  pom.position.set(0, 0.48, -0.45)
  group.add(cone, band, star, pom)
  return group
}

const beanie = () => {
  const group = new THREE.Group()
  const dome = mesh(new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat("#e5484d"))
  const cuff = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.12, 14), flat("#ffffff"))
  cuff.position.y = 0.04
  const stripe = mesh(new THREE.TorusGeometry(0.3, 0.035, 4, 14), flat("#ffffff"))
  stripe.rotation.x = Math.PI / 2
  stripe.position.y = 0.2
  const bobble = mesh(new THREE.IcosahedronGeometry(0.12, 1), flat("#ffffff"))
  bobble.position.y = 0.4
  group.add(dome, cuff, stripe, bobble)
  return group
}

const acornCap = () => {
  const group = new THREE.Group()
  const cap = mesh(new THREE.SphereGeometry(0.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat("#8a5a36"))
  cap.scale.y = 0.6
  const stem = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5), flat("#6b4a2a"))
  stem.position.y = 0.32
  const leaf = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.15), flat("#e07a2e"))
  leaf.position.set(0.15, 0.4, 0)
  leaf.rotation.z = 0.5
  group.add(cap, stem, leaf)
  return group
}

const sunhat = () => {
  const group = new THREE.Group()
  const brim = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), flat("#f2d27a"))
  const crown = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.26, 12), flat("#f2d27a"))
  crown.position.y = 0.14
  const ribbon = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 12), flat("#ff6fa8"))
  ribbon.position.y = 0.06
  group.add(brim, crown, ribbon)
  return group
}

export const HATS: ReadonlyArray<Hat> = [
  { id: "flowers", name: "Flower crown", emoji: "🌸", unlockedBy: "meadow", build: flowerCrown },
  { id: "sailor", name: "Sailor hat", emoji: "⛵", unlockedBy: "creek", build: sailorHat },
  { id: "frog", name: "Frog hat", emoji: "🐸", unlockedBy: "pond", build: frogHat },
  { id: "mushroom", name: "Mushroom cap", emoji: "🍄", unlockedBy: "woods", build: mushroomCap },
  { id: "crown", name: "Golden crown", emoji: "👑", unlockedBy: "mountain", build: goldenCrown },
  { id: "nightcap", name: "Sleepy nightcap", emoji: "🌙", unlockedBy: "night", build: nightcap },
  { id: "beanie", name: "Bobble beanie", emoji: "❄️", unlockedBy: "snow", build: beanie },
  { id: "acorn", name: "Acorn cap", emoji: "🌰", unlockedBy: "autumn", build: acornCap },
  { id: "sunhat", name: "Sun hat", emoji: "👒", unlockedBy: "beach", build: sunhat },
  { id: "party", name: "Party hat", emoji: "🥳", unlockedBy: "playground", build: partyHat }
]

export const hatById = (id: string | undefined) => HATS.find((hat) => hat.id === id)
