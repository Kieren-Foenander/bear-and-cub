run(5)
const { mama, cub } = S.stage
await shot('mountain-start')
// Tier 0 -> 1
play('mama')
walkTo(mama, cub.position.x + 1.5, cub.position.z, 600, 0.5); tap('KeyE'); run(5)
walkTo(mama, 5, 18.6, 900, 0.4); run(10); tap('KeyE'); run(90)
log('lifted', r(cub.position), st().obj)
play('cub')
const pine = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone-2.0') || t.id.startsWith('pinecone--2.0')).position()
walkTo(cub, pine.x, pine.z, 600, 0.3); run(10)
log('pinecone', jumpSwipe()); run(150)
log(st().obj)
play('mama')
walkTo(mama, -8, 26, 900, 0.4); walkTo(mama, -8, 13, 900, 0.4); run(10)
log('mama up ramp', r(mama.position), st().obj)
await shot('mountain-ramp')
// Wobbly stones
play('cub')
walkTo(cub, 3.5, 11.2, 900, 0.3); run(10)
for (const [x, z] of [[3.5, 9.6], [5.4, 8.1], [3.8, 6.5], [4.5, 4.2]]) log('stone', hopTo(cub, x, z))
log(st().obj)
walkTo(cub, 8, 4.0, 300, 0.3); run(10)
log('bell', jumpSwipe()); run(150)
log(st().obj)
// Mama tries a stone (should crumble), then uses the bridge
play('mama')
walkTo(mama, 3.5, 11.6, 900, 0.3); run(5)
log('mama on stone', hopTo(mama, 3.5, 9.6)); run(120)
log('mama after', r(mama.position), document.querySelector('.toast').textContent)
walkTo(mama, -6, 12, 900, 0.3); walkTo(mama, -6, 4, 900, 0.3); run(10)
log('mama crossed', r(mama.position), st().obj)
await shot('mountain-bridge')
// Bounce up
play('cub')
const sh = S.stage.interactions.list.find(i => i.id.startsWith('bounce-')).anchor()
walkTo(cub, sh.x + 2.6, sh.z, 600, 0.3); run(10)
run(1, ['KeyA', 'Space'])
let pressed = false, big = false
for (let i = 0; i < 240; i++) {
  let codes = i < 18 ? ['KeyA'] : []
  if (!pressed && prompts().some(s => s.includes('NOW'))) { codes.push('Space'); pressed = true }
  if (cub.velocity.y > 12) big = true
  if (big && cub.position.z > -2) codes = ['KeyW']
  run(1, codes)
  if (big && cub.grounded && cub.position.z < -1) break
}
run(20, [])
log('bounced up', big, r(cub.position), st().obj)
const fl = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone-0.0')).position()
walkTo(cub, fl.x, fl.z, 600, 0.3); run(10)
log('flower', jumpSwipe()); run(220)
log(st().obj)
play('mama')
walkTo(mama, -14, 5, 600, 0.4)
for (const [x, z] of [[-14, 2.6], [-12, 2.2], [-10, 1.8], [-8, 1.4], [-6, 1], [-6, -2]]) log('step', hopTo(mama, x, z))
log('mama tier', r(mama.position), st().obj)
await shot('mountain-steps')
// Lifts: wait until a lift is down, hop on, wait to top, hop off
const ride = (bear, who) => {
  play(who)
  walkTo(bear, -4, -10.5, 600, 0.3)
  const lift = S.stage.surfaces.platforms.find(p => Math.abs(p.object.position.x + 4) < 0.1)
  for (let i = 0; i < 1200; i++) { if (lift.object.position.y < 6.9) break; run(1) }
  log(who, 'lift down at', lift.object.position.y.toFixed(2))
  hopTo(bear, -4, -14.3)
  for (let i = 0; i < 1200; i++) { if (lift.object.position.y > 10.6) break; run(1) }
  run(10)
  log(who, 'on lift at top', r(bear.position))
  return hopTo(bear, -4, -18.5)
}
log('cub summit', ride(cub, 'cub'))
log('mama summit', ride(mama, 'mama'), st().obj)
await shot('mountain-summit')
play('cub')
const comb = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone-2.0--35')).position()
walkTo(cub, comb.x, comb.z, 900, 0.3); run(10)
log('honeycomb', jumpSwipe()); run(60)
log(st().obj)
walkTo(cub, -1, -33, 600, 0.5); play('mama'); walkTo(mama, -3, -32, 900, 0.5); run(60)
log('done', S.stage.completeTime)
await shot('mountain-end')
