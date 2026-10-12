run(5)
const { mama, cub } = S.stage
const V = cub.position.constructor
const logs = S.stage.surfaces.platforms
// Riding: put each bear on a log and check they move with it.
for (const [bear, who] of [[cub, 'cub'], [mama, 'mama']]) {
  play(who)
  const l = logs[0].object.position
  bear.placeAt(new V(l.x, l.y + 0.45, l.z))
  run(30)
  const start = [bear.position.x, l.x]
  run(60)
  log(who, 'rides log: bear moved', (bear.position.x - start[0]).toFixed(2), 'log moved', (l.x - start[1]).toFixed(2), 'grounded', bear.grounded, 'y', bear.feetY.toFixed(2))
}
// Seesaw
const A = S.stage.interactions.list.find(i => i.id === 'seesaw-cub').anchor().clone().setY(0)
const B = S.stage.interactions.list.find(i => i.id === 'seesaw-mama').anchor().clone()
cub.placeAt(new V(A.x, 0.7, A.z)); mama.placeAt(new V(B.x + 2.6, 0, B.z)); run(30)
log('cub prompts', st().prompts, st().obj)
await shot('woods-seesaw-ready')
play('mama')
run(1, ['Space', 'KeyA']); for (let i = 0; i < 60; i++) { run(1, i < 24 ? ['KeyA'] : []); if (i > 5 && mama.grounded) break }
log('mama landed side', S.stage.interactions.list.length)
run(90, [])
log('cub after seesaw', r(cub.position), st().obj)
await shot('woods-launched')
play('cub')
const fl = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).position()
walkTo(cub, fl.x, fl.z, 600, 0.3); run(10)
log('flower', jumpSwipe()); run(240)
log(st().obj)
await shot('woods-steps')
play('mama')
walkTo(mama, 9, -9.5, 600, 0.3)
const hopTo = (bear, x, z) => {
  for (let i = 0; i < 120; i++) {
    const dx = x - bear.position.x, dz = z - bear.position.z, d = Math.hypot(dx, dz)
    const codes = []
    if (d > 0.3) { if (dx > 0.3 * d) codes.push('KeyD'); if (dx < -0.3 * d) codes.push('KeyA'); if (dz > 0.3 * d) codes.push('KeyS'); if (dz < -0.3 * d) codes.push('KeyW') }
    if (i === 0) codes.push('Space')
    run(1, codes)
    if (i > 8 && bear.grounded && d < 0.5) break
  }
  run(5, [])
  return r(bear.position)
}
for (const z of [-12, -14, -16, -18, -20, -22, -26]) log('step', hopTo(mama, 9, z))
log('mama top?', r(mama.position), st().obj)
walkTo(mama, 9, -30, 300, 0.5); walkTo(mama, -1, -40, 900, 0.5)
play('cub'); walkTo(cub, 1, -41, 900, 0.5); run(30)
log('done', S.stage.completeTime)
await shot('woods-end')
