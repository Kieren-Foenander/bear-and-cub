// Real gameplay and the normal shared camera, including style switches while carried.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const { HATS } = await import('/src/game/hats.ts')
run(30)
const { mama, cub } = S.stage
for (const style of ['origami', 'toy', 'classic']) {
  if (cub.model.style !== style) {
    tap('Escape'); tap('KeyS'); tap('KeyS'); tap('Space'); tap('Escape'); run(30)
  }
  assert(cub.model.style === style, 'pause-menu style order')
  cub.model.wear(HATS.find(h => h.id === 'beanie').build())
  // Set up near a real musical bell; movement/swipe itself uses game input.
  const bell = S.stage.swipes.targets.find(t => t.id === 'music-bell-2')
  mama.placeAt(V(15, S.stage.terrain.heightAt(15, 16), 16)); cub.placeAt(V(21, S.stage.terrain.heightAt(21, 16), 16)); run(30)
  play('cub'); walkTo(cub, bell.position().x, bell.position().z, 180, 0.3); run(10)
  log(style, 'bell approach', r(cub.position), prompts())
  await shot(`qa2-${style}-walk`)
  run(1, ['Space']);
  let reachable = false
  for (let i = 0; i < 80; i++) { if (S.stage.swipes.inReach(cub, bell)) { reachable = true; break }; run(1) }
  assert(reachable, `${style}: a jump should reach the bell`)
  run(4, ['KeyQ']); await shot(`qa2-${style}-swipe`); run(90)
  play('mama'); walkTo(mama, cub.position.x + 1.5, cub.position.z, 180, 0.4); tap('KeyE'); run(60)
  assert(S.stage.coop.carrying, `${style}: pickup should work`)
  await shot(`qa2-${style}-back`)
  // Cycle through all styles while carried, keeping the beanie attached.
  for (let i = 0; i < 3; i++) {
    tap('Escape'); tap('KeyS'); tap('KeyS'); tap('Space'); tap('Escape'); run(30)
    assert(cub.mode === 'carried', 'style switching should preserve carry state')
  }
  mama.yaw = 0; tap('KeyR'); run(15)
  assert(cub.mode === 'flying', `${style}: throw should be airborne`)
  await shot(`qa2-${style}-throw`); run(100)
  mama.model.celebrate(); cub.model.celebrate(); run(35)
  await shot(`qa2-${style}-celebrate`); run(150)
  for (const bear of [mama, cub]) {
    bear.model.root.updateMatrixWorld(true)
    bear.model.root.traverse(o => assert(o.matrixWorld.elements.every(Number.isFinite), `${style}: nonfinite model transform`))
  }
  mama.placeAt(V(-1.5, 0, 4)); cub.placeAt(V(1.5, 0, 4)); run(60)
  for (const hat of HATS) {
    cub.model.wear(hat.build()); run(30)
    await shot(`qa2-${style}-hat-${hat.id}`)
  }
}
log('qa style gameplay passed')
