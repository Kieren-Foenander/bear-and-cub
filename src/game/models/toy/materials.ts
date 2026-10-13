import * as THREE from "three"

/**
 * Soft vinyl: smooth-shaded, a little glossy, with a faint warm rim so the silhouette glows
 * against the flat-shaded grass. All colour comes from vertex colours, so one material covers
 * fur, muzzle, blush, paw pads and the scarf.
 */
export const vinyl = (): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `{
        float rim = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
        outgoingLight += diffuseColor.rgb * vec3(1.0, 0.94, 0.86) * pow(rim, 2.4) * 0.5;
      }
      #include <opaque_fragment>`
    )
  }
  material.customProgramCacheKey = () => "toy-vinyl-rim"
  return material
}

/** Wet-look eyes and nose: very dark, very glossy, so the sun adds its own little glint. */
export const gloss = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0 })

/** Eye sparkles stay pure white whatever the lighting and tone mapping do. */
export const sparkle = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false })

/** Cleaner, brighter toy versions of the game's fur colours (the look colours stay untouched). */
export const toyTint = (color: THREE.ColorRepresentation, saturate: number, lighten: number): THREE.Color => {
  const result = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  result.getHSL(hsl, THREE.SRGBColorSpace)
  return result.setHSL(hsl.h, Math.min(1, hsl.s * saturate), Math.min(0.92, hsl.l + lighten), THREE.SRGBColorSpace)
}
