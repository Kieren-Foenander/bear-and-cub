run(5)
const { mama, cub } = S.stage
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
  const waitAndJump = (index) => {
    const platform = S.stage.surfaces.platforms[index]
    for (let i = 0; i < 900; i++) {
      if (Math.abs(platform.object.position.x + platform.delta.x * 70 - bear.position.x) < 1.2) break
      run(1)
    }
    // Steer toward the landing instead of holding forward through the whole jump.
    const targetX = platform.object.position.x + platform.delta.x * 70
    const targetZ = platform.object.position.z
    return hopTo(bear, targetX, targetZ)
  }
  const onLog1 = waitAndJump(0)
  const onLog2 = waitAndJump(1)
  hopTo(bear, bear.position.x, -6)
  run(10, [])
  return [onLog1, onLog2, r(bear.position)]
}
log('cub ride', rideAcross(cub, 'cub'))
log('mama gate+ride')
play('mama'); walkTo(mama, 0, 14, 600, 0.4); walkTo(mama, 0, 6, 600, 0.4)
log('mama ride', rideAcross(mama, 'mama'), st().obj)
// Seesaw
play('cub')
const A = S.stage.interactions.list.find(i => i.id === 'seesaw-cub').anchor()
walkTo(cub, A.x, A.z, 600, 0.25); run(20); hopTo(cub, A.x, A.z); run(20)
log('cub on A?', st().prompts, st().obj)
play('mama')
const B = S.stage.interactions.list.find(i => i.id === 'seesaw-mama').anchor()
walkTo(mama, B.x + 2.5, B.z, 600, 0.3); run(10)
hopTo(mama, B.x, B.z)
run(80, [])
log('launched', r(cub.position), st().obj)
play('cub')
const fl = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).position()
walkTo(cub, fl.x, fl.z, 600, 0.3); run(10)
log('flower', jumpSwipe()); run(200)
log(st().obj)
play('mama')
walkTo(mama, 9, -9.5, 600, 0.4)
for (const z of [-12, -14, -16, -18, -20, -22, -26]) log('step', hopTo(mama, 9, z))
walkTo(mama, 0, -40, 600, 0.5)
play('cub'); walkTo(cub, 1, -41, 600, 0.5); run(30)
log('done', S.stage.completeTime)

if (S.stage.completeTime < 0) throw new Error('Woods journey did not complete')
