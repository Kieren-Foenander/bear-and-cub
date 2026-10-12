import * as THREE from "three"
import { BearModel, preloadBearModels } from "./game/bearModel.ts"
import type { BearAnimState } from "./game/bearModel.ts"
import { MAMA, CUB } from "./game/specs.ts"

await preloadBearModels()
const stage = document.querySelector<HTMLElement>("#stage")!
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
stage.append(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color("#f2f0e5")
scene.add(new THREE.HemisphereLight("#fff0de", "#94af93", 2.6))
const sun = new THREE.DirectionalLight("#ffefd9", 3.5)
sun.position.set(-3, 7, 5)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -8
sun.shadow.camera.right = 8
sun.shadow.camera.top = 8
sun.shadow.camera.bottom = -8
sun.shadow.normalBias = 0.025
sun.shadow.bias = -0.00015
sun.shadow.radius = 4
scene.add(sun)
const rim = new THREE.DirectionalLight("#dce9ff", 1.5)
rim.position.set(3, 4, -4)
scene.add(rim)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#dfe7ce", roughness: 1 }))
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)
const mat = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.18, 0.07, 64),
  new THREE.MeshStandardMaterial({ color: "#eee9d9", roughness: 1 }))
mat.position.y = -0.041
mat.receiveShadow = true
scene.add(mat)

const mama = new BearModel(MAMA.look, MAMA.scale)
const cub = new BearModel(CUB.look, CUB.scale)
scene.add(mama.root, cub.root)
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 150)
let view = "portrait"
const setView = (name: string): void => {
  view = name
  if (name === "front") camera.position.set(0, 2.7, 9.3)
  else if (name === "side") camera.position.set(8.5, 3.1, 0.6)
  else if (name === "back") camera.position.set(0, 3.3, -9.3)
  else if (name === "couch") camera.position.set(5, 9.5, 14)
  else camera.position.set(3.6, 2.85, 6.8)
  camera.lookAt(0, 0.92, 0)
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name))
}
setView("portrait")
const resize = (): void => {
  renderer.setSize(stage.clientWidth, stage.clientHeight)
  camera.aspect = stage.clientWidth / stage.clientHeight
  camera.updateProjectionMatrix()
}
window.addEventListener("resize", resize)
resize()

const status = document.querySelector<HTMLElement>("#status")!
const slider = document.querySelector<HTMLInputElement>("#speed")!
const output = document.querySelector<HTMLOutputElement>("#speed-value")!
const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!
let mode = "idle"
let speed = 0
let time = 0
let modeTime = 0
let jumpTime = -1
let paused = false
const state: BearAnimState = { speed: 0, maxSpeed: 1, grounded: true, carried: false, flying: false, verticalVelocity: 0 }
const setSpeed = (value: number): void => {
  speed = Math.max(0, Math.min(1, value))
  slider.value = String(speed)
  output.value = `${Math.round(speed * 100)}%`
}
const both = (action: "swipe" | "cheer" | "celebrate" | "shake"): void => { mama[action](); cub[action]() }
const setMode = (name: string): void => {
  if (name === "swipe") { both("swipe"); status.textContent = "Swipe · up and forward"; return }
  mode = name
  modeTime = 0
  jumpTime = -1
  setSpeed(name === "walk" ? 0.35 : name === "run" ? 1 : 0)
  // Reset idle settling on an explicit mode selection.
  state.speed = 0.5
  mama.animate(1 / 60, state)
  cub.animate(1 / 60, state)
  if (name === "jump") jumpTime = 0
  if (name === "cheer" || name === "celebrate" || name === "shake") both(name)
  const labels: Record<string, string> = {
    idle: "Idle · breathing & blinking", walk: "Walk · diagonal paw pairs", run: "Run · bouncy bound",
    jump: "Jump · stretch, tuck, land", cheer: "Cheer · a happy little roar", carried: "Ride · Cub on Mama's back",
    flying: "Wheee! · delighted tumble", celebrate: "Dance · 2 seconds of joy", shake: "Shake · dry those ears",
    sit: "Sit · Mama rests, Cub yawns"
  }
  status.textContent = labels[name] ?? name
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.classList.toggle("active", button.dataset.mode === name))
  if (name === "sit") for (let i = 0; i < 600; i++) step(1 / 60)
}

function step(dt: number): void {
  time += dt
  modeTime += dt
  mama.root.position.set(-1.05, 0, 0)
  cub.root.position.set(1.32, 0, 0.34)
  mama.root.rotation.y = -0.12
  cub.root.rotation.y = -0.2
  state.speed = speed
  state.grounded = true
  state.carried = false
  state.flying = false
  state.verticalVelocity = 0
  if (jumpTime >= 0) {
    jumpTime += dt
    const duration = 1.15
    const height = Math.max(0, 2.6 * jumpTime * (duration - jumpTime))
    state.grounded = jumpTime >= duration
    state.verticalVelocity = 2.6 * (duration - 2 * jumpTime)
    mama.root.position.y = height
    cub.root.position.y = height * 1.15
    if (state.grounded) { bothLand(); jumpTime = -1 }
  }
  if (mode === "flying") {
    state.grounded = false
    state.flying = true
    state.verticalVelocity = Math.cos(modeTime * 2) * 3
    mama.root.position.y = 0.6 + Math.sin(modeTime * 2) * 0.18
    cub.root.position.y = 0.9 + Math.sin(modeTime * 2 + 0.4) * 0.2
  }
  mama.animate(dt, state)
  if (mode === "carried") {
    cub.root.position.set(-1.05, 1.55, -0.15)
    cub.root.rotation.y = mama.root.rotation.y
    state.carried = true
  }
  cub.animate(dt, state)
}
function bothLand(): void { mama.land(0.9); cub.land(0.9) }
function render(): void { renderer.render(scene, camera) }
const setPaused = (value: boolean): void => {
  paused = value
  pauseButton.innerHTML = `${paused ? "Resume" : "Pause"} <small>P</small>`
  pauseButton.classList.toggle("active", paused)
}
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode!)))
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view!)))
slider.addEventListener("input", () => {
  const next = Number(slider.value)
  setMode(next === 0 ? "idle" : next >= 0.65 ? "run" : "walk")
  setSpeed(next)
})
pauseButton.addEventListener("click", () => setPaused(!paused))
const keys: Record<string, string> = { "1": "idle", "2": "walk", "3": "run", "4": "jump", "5": "carried", "6": "flying", "7": "sit", q: "swipe", e: "cheer", c: "celebrate", h: "shake" }
window.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement) return
  if (event.key.toLowerCase() === "p") setPaused(!paused)
  else if (event.code === "Space") { event.preventDefault(); setMode("jump") }
  else { const next = keys[event.key.toLowerCase()]; if (next) setMode(next) }
})
// Deterministic screenshot/review hooks, kept out of the shipped game entry point.
Object.assign(window, { bearPreview: {
  setMode, setView, setSpeed, setPaused,
  advance: (seconds: number): void => { for (let i = 0; i < Math.round(seconds * 60); i++) step(1 / 60); render() },
  info: (): object => ({ mode, view, time, modeTime, calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }),
  bounds: (): object => ({ mama: new THREE.Box3().setFromObject(mama.root), cub: new THREE.Box3().setFromObject(cub.root) })
} })
let previous = performance.now()
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - previous) / 1000)
  previous = now
  if (!paused) step(dt)
  render()
})
