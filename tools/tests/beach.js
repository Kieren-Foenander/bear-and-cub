run(5)
const { mama, cub } = S.stage
await shot('beach-start')
// Cross the crabs: wait at the edge until the coach says GO, then run.
const cross = (bear, who) => {
  play(who)
  walkTo(bear, 0, 21.5, 900, 0.3); run(10)
  let bumps = 0
  for (let tries = 0; tries < 6; tries++) {
    for (let i = 0; i < 600; i++) { if (who === 'cub' ? prompts().some(p => p.includes('GO')) : S.stage.interactions.list.find(x => x.id === 'crab-coach').view(cub)?.label?.includes('GO')) break; run(1) }
    const before = document.querySelector('.toast').textContent
    for (let i = 0; i < 90; i++) { run(1, ['KeyW']); if (bear.position.z < 12.5) break }
    run(5, [])
    if (bear.position.z < 13) return [tries, r(bear.position)]
    walkTo(bear, 0, 21.5, 400, 0.3); run(10)
  }
  return ['failed', r(bear.position)]
}
log('cub crossed', cross(cub, 'cub'))
cub.placeAt(V(-4, 0.2, 9)) // out of the way
log('mama crossed', cross(mama, 'mama'))
await shot('beach-crabs')
// Kick the ball: walk behind it and kick towards the net
play('cub')
const kick = () => {
  const b = S.stage.interactions.list.find(i => i.id === 'kick-cub').anchor()
  const ballX = b.x, ballZ = b.z
  walkTo(cub, ballX, ballZ + 1.8, 600, 0.3)
  // face the net
  const toX = 0 - ballX, toZ = -9.6 - ballZ
  for (let i = 0; i < 8; i++) run(1, [toZ < 0 ? 'KeyW' : 'KeyS', ...(Math.abs(toX) > 1 ? [toX > 0 ? 'KeyD' : 'KeyA'] : [])])
  run(2, []); tap('KeyE'); run(60)
}
for (let k = 0; k < 12 && !st().obj.includes('lift') && !st().obj.includes('bell'); k++) { kick(); }
log('after kicks', st().obj, document.querySelector('.toast').textContent)
await shot('beach-goal')
// Lighthouse
play('mama')
walkTo(mama, cub.position.x + 1.5, cub.position.z, 900, 0.5); tap('KeyE'); run(5)
walkTo(mama, -8, -9, 900, 0.4); walkTo(mama, -8, -16, 900, 0.4); walkTo(mama, 5.5, -26.6, 900, 0.4); run(10); tap('KeyE'); run(90)
log('lifted', r(cub.position), st().obj)
play('cub')
const bell = S.stage.swipes.targets.find(t => t.id === 'bell').position()
walkTo(cub, bell.x, bell.z, 300, 0.3); run(10)
log('bell', jumpSwipe()); run(420)
log(st().obj)
// both onto the boat
play('mama'); walkTo(mama, 12, -40, 900, 0.4); walkTo(mama, 15.6, -40, 300, 0.4); run(10)
play('cub'); walkTo(cub, 8, -28, 600, 0.4); walkTo(cub, 12, -40, 900, 0.4); walkTo(cub, 15.2, -39.6, 300, 0.4); run(120, [])
log('boat', st().obj, r(mama.position), r(cub.position))
run(600)
log('arrived', st().obj, r(mama.position))
await shot('beach-boat')
walkTo(cub, 25, -46, 600, 0.4); play('mama'); walkTo(mama, 24.5, -46, 600, 0.4); run(60)
log('done', S.stage.completeTime, r(mama.position), r(cub.position))
