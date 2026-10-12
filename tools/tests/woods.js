run(5)
const { mama, cub } = S.stage
await shot('woods-start')
log(st().obj)
// Super bounce on the practice mushroom: walk next to it, jump on, press A on NOW.
const bounceOn = (bear, x, z, holdKeys = [], frames = 160) => {
  walkTo(bear, x + 2.4, z, 600, 0.3); run(10)
  // jump towards the mushroom
  run(1, ['KeyA', 'Space']); 
  let pressed = false, bounces = 0
  for (let i = 0; i < frames; i++) {
    const p = prompts()
    const codes = i < 18 ? ['KeyA'] : holdKeys.slice()
    if (!pressed && p.some(s => s.includes('NOW'))) { codes.push('Space'); pressed = true }
    if (pressed && bear.velocity.y > 10) { bounces++; pressed = false }
    run(1, codes)
  }
  run(1, [])
  return bounces
}
play('cub')
log('practice big bounces', bounceOn(cub, -6, 22), st().berries, st().obj)
await shot('woods-bounce')
// Over the fence: hop onto the mushroom, big bounce, then drift forward over the fence.
const fz = 12 + 2.6
walkTo(cub, 7.4, 19, 600, 0.3); walkTo(cub, 7.4, fz, 600, 0.3); run(10)
run(1, ['KeyA', 'Space'])
let pressed = false, big = false
for (let i = 0; i < 240; i++) {
  let codes = i < 18 ? ['KeyA'] : []
  if (!pressed && prompts().some(s => s.includes('NOW'))) { codes.push('Space'); pressed = true }
  if (cub.velocity.y > 12) big = true
  if (big && cub.position.z > 9.5) codes = ['KeyW']
  run(1, codes)
  if (big && cub.grounded && cub.position.z < 11) break
}
run(20, [])
log('after fence', r(cub.position), big, st().obj)
walkTo(cub, 0, 10, 300, 0.4); tap('KeyE'); run(80)
log('gate', st().obj)
// Ride logs: walk to bank, wait for JUMP prompt
const rideAcross = (bear, who) => {
  play(who)
  walkTo(bear, 0, 3.3, 600, 0.3); run(5)
  const waitAndJump = (frames) => {
    for (let i = 0; i < 900; i++) { if (who === 'mama' ? Math.abs(S.stage.surfaces.platforms[frames].object.position.x + S.stage.surfaces.platforms[frames].delta.x * 30 - bear.position.x) < 1.2 : prompts().some(p => p.includes('JUMP'))) break; run(1) }
    run(1, ['Space', 'KeyW']); for (let i = 0; i < 70; i++) { run(1, ['KeyW']); if (i > 5 && bear.grounded) break }
    run(3, [])
    return r(bear.position)
  }
  const onLog1 = waitAndJump(0)
  const onLog2 = waitAndJump(1)
  run(1, ['Space', 'KeyW']); for (let i = 0; i < 70; i++) { run(1, i < 25 ? ['KeyW'] : []); if (i > 5 && bear.grounded) break }
  run(10, [])
  return [onLog1, onLog2, r(bear.position)]
}
log('cub ride', rideAcross(cub, 'cub'))
log('mama gate+ride')
play('mama'); walkTo(mama, 0, 14, 600, 0.4); walkTo(mama, 0, 6, 600, 0.4)
log('mama ride', rideAcross(mama, 'mama'), st().obj)
await shot('woods-logs')
// Seesaw
play('cub')
const A = S.stage.interactions.list.find(i => i.id === 'seesaw-cub').anchor()
walkTo(cub, A.x, A.z, 600, 0.25); run(20)
log('cub on A?', st().prompts, st().obj)
play('mama')
const B = S.stage.interactions.list.find(i => i.id === 'seesaw-mama').anchor()
walkTo(mama, B.x + 2.5, B.z, 600, 0.3); run(10)
run(1, ['Space', 'KeyA']); for (let i = 0; i < 50; i++) { run(1, i < 14 ? ['KeyA'] : []); if (i > 5 && mama.grounded) break }
run(80, [])
log('launched', r(cub.position), st().obj)
await shot('woods-seesaw')
play('cub')
const fl = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).position()
walkTo(cub, fl.x, fl.z, 600, 0.3); run(10)
log('flower', jumpSwipe()); run(200)
log(st().obj)
await shot('woods-steps')
play('mama')
walkTo(mama, 9, -9.5, 600, 0.4)
for (let i = 0; i < 7; i++) { run(1, ['Space', 'KeyW']); for (let k = 0; k < 40; k++) { run(1, k < 22 ? ['KeyW'] : []); if (k > 5 && mama.grounded) break } run(5, []) ; log('step', r(mama.position)) }
walkTo(mama, 0, -40, 600, 0.5)
play('cub'); walkTo(cub, 1, -41, 600, 0.5); run(30)
log('done', S.stage.completeTime)
