run(5)
const { mama, cub } = S.stage
await shot('autumn-start')
const deliver = (bear) => {
  walkTo(bear, 2.2, 14.4, 900, 0.5); run(5)
  const before = st().obj
  tap('KeyE'); run(30)
  return [before, st().obj, document.querySelector('.toast').textContent]
}
// Acorn 3 (hanging): swipe it down, pick it up, deliver.
play('cub')
const hang = S.stage.swipes.targets.find(t => t.id === 'acorn-tree').position()
walkTo(cub, hang.x, hang.z + 2, 900, 0.4); walkTo(cub, hang.x, hang.z, 300, 0.3); run(10)
log('swipe acorn', jumpSwipe()); run(90)
log('prompts', st().prompts)
tap('KeyE'); run(5)
log('holding?', st().obj)
log('deliver 1', deliver(cub))
// Acorn 1 (hay): Mama lifts Cub up, Cub grabs it and jumps down.
play('mama')
walkTo(mama, cub.position.x + 1.5, cub.position.z, 900, 0.5); tap('KeyE'); run(5)
walkTo(mama, -18, 21.5, 900, 0.4); run(10); tap('KeyE'); run(90)
log('cub on hay', r(cub.position))
play('cub'); walkTo(cub, -16.6, 15, 300, 0.4); run(5); tap('KeyE'); run(5)
walkTo(cub, -18, 22, 600, 0.4); walkTo(cub, -8, 22, 600, 0.4); run(30)
log('deliver 2', deliver(cub))
await shot('autumn-carry')
// Acorn 2 (stump): super bounce up.
walkTo(cub, 10, 16, 900, 0.4); walkTo(cub, 14.1 - 2.6, 12, 900, 0.3); run(10)
run(1, ['KeyD', 'Space'])
let pressed = false, big = false
for (let i = 0; i < 240; i++) {
  let codes = i < 18 ? ['KeyD'] : []
  if (!pressed && prompts().some(s => s.includes('NOW'))) { codes.push('Space'); pressed = true }
  if (cub.velocity.y > 12) big = true
  if (big && cub.position.x < 17.5) codes = ['KeyD']
  run(1, codes)
  if (big && cub.grounded && cub.position.x > 16.5) break
}
run(20, [])
log('on stump', big, r(cub.position))
walkTo(cub, 19.5, 12, 300, 0.4); run(5); tap('KeyE'); run(5)
walkTo(cub, 15, 12, 300, 0.4); walkTo(cub, 10, 12, 300, 0.4); run(30)
log('deliver 3', deliver(cub))
await shot('autumn-gate')
run(90)
walkTo(cub, 1, 5, 600, 0.4); walkTo(cub, 1, -37, 900, 0.5)
play('mama'); walkTo(mama, -10, 23, 900, 0.4); walkTo(mama, -1, 5, 900, 0.4); walkTo(mama, -1, -37, 900, 0.5); run(60)
log('done', S.stage.completeTime, r(mama.position), r(cub.position))
