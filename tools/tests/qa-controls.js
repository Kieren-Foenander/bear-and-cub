// Emulate two standard controllers through the actual Gamepad API input path.
run(30)
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const makePad = (index, id) => ({
  index, id, connected: true, mapping: 'standard', axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
})
const mamaPad = makePad(0, 'Xbox controller')
const cubPad = makePad(1, '054c DualSense')
let pads = [mamaPad, cubPad]
const original = navigator.getGamepads.bind(navigator)
Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads })
try {
  const { mama, cub } = S.stage
  const mamaX = mama.position.x, cubX = cub.position.x
  mamaPad.axes[0] = -1; cubPad.axes[0] = 1; run(30)
  assert(mama.position.x < mamaX - 1 && cub.position.x > cubX + 1, 'controllers should independently move both bears')
  mamaPad.axes[0] = cubPad.axes[0] = 0; run(30)
  mamaPad.buttons[0].pressed = cubPad.buttons[0].pressed = true; run(2)
  assert(mama.velocity.y > 0 && cub.velocity.y > 0, 'both controllers should jump independently')
  mamaPad.buttons[0].pressed = cubPad.buttons[0].pressed = false; run(120)
  cubPad.buttons[9].pressed = true; run(1)
  assert(S.screen === 'paused', 'Cub should be able to pause')
  cubPad.buttons[9].pressed = false; run(2)
  mamaPad.buttons[9].pressed = true; run(1)
  assert(S.screen === 'playing', 'Mama should be able to resume')
  mamaPad.buttons[9].pressed = false; run(2)
  pads = [mamaPad]
  const previous = S.router.active
  mamaPad.buttons[8].pressed = true; run(1)
  assert(S.router.active !== previous, 'one controller should switch bears with Back')
  mamaPad.buttons[8].pressed = false; run(1)
  pads = []; run(30)
  assert(S.screen === 'playing', 'disconnecting controllers should preserve gameplay')
  log('qa controls passed')
} finally {
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: original })
}
