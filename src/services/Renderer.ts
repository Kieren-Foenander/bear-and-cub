import { Context, Effect, Layer } from "effect"
import * as THREE from "three"

export class Renderer extends Context.Service<Renderer, {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
}>()("bears/services/Renderer") {
  static readonly layer = Layer.effect(
    Renderer,
    Effect.gen(function*() {
      const root = document.getElementById("app")!

      const renderer = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const renderer = new THREE.WebGLRenderer({ antialias: true })
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          renderer.setSize(window.innerWidth, window.innerHeight)
          renderer.shadowMap.enabled = true
          renderer.shadowMap.type = THREE.PCFShadowMap
          renderer.outputColorSpace = THREE.SRGBColorSpace
          root.appendChild(renderer.domElement)
          return renderer
        }),
        (renderer) =>
          Effect.sync(() => {
            renderer.domElement.remove()
            renderer.dispose()
          })
      )

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400)

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      yield* Effect.acquireRelease(
        Effect.sync(() => window.addEventListener("resize", onResize)),
        () => Effect.sync(() => window.removeEventListener("resize", onResize))
      )

      return Renderer.of({ renderer, scene, camera })
    })
  )
}
