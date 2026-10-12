import type { BearSpec } from "./bear.ts"

export const MAMA: BearSpec = {
  id: "mama",
  name: "Mama Bear",
  look: { fur: "#8b5a3c", belly: "#d9a877" },
  scale: 1,
  radius: 0.7,
  halfHeight: 0.25,
  speed: 6.5,
  jumpSpeed: 7.5,
  ringColor: "#5aa9ff",
  mass: 4
}

export const CUB: BearSpec = {
  id: "cub",
  name: "Cub",
  look: { fur: "#c98b55", belly: "#f1d2a6", scarf: "#ff6fa8" },
  scale: 0.55,
  radius: 0.4,
  halfHeight: 0.13,
  speed: 6,
  jumpSpeed: 8.5,
  ringColor: "#ff6fa8",
  mass: 1,
  apexFloat: true
}
