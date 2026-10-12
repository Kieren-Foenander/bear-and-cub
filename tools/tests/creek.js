run(5)
const { mama, cub } = S.stage
const V = cub.position.constructor
await shot('creek-start')
// Standing jump at creek 1 should fail (splash), running jump succeeds.
play('cub')
walkTo(cub, 0, 11.6, 600, 0.3); run(10)
log('at edge', st().prompts)
run(2, ['Space']); run(60, [])
log('standing jump result z', r(cub.position))
// Running jumps: run from 6m back toward -z and press jump at the edge
const runJump = (bear, edgeZ) => {
  walkTo(bear, 0, edgeZ + 6, 600, 0.3); run(10, [])
  let jumped = false
  for (let i = 0; i < 240; i++) {
    const codes = ['KeyW']
    if (!jumped && bear.position.z < edgeZ + 0.5) { codes.push('Space'); jumped = true }
    run(1, codes)
    if (jumped && bear.grounded && i > 5) break
  }
  run(30, [])
  return r(bear.position)
}
log('cub creek1', runJump(cub, 18 + 0.9 + 0.35))
log('cub creek2', runJump(cub, 6 + 1.5 + 0.35), st().obj)
log('cub creek3', runJump(cub, -8 + 2.3 + 0.35), st().obj)
// Mama tries creek 3 (should fail) after crossing 1 and 2
play('mama')
log('mama creek1', runJump(mama, 18 + 0.9 + 0.35))
log('mama creek2', runJump(mama, 6 + 1.5 + 0.35))
log('mama creek3 (should splash back)', runJump(mama, -8 + 2.3 + 0.35))
// Cub pushes tree
play('cub')
walkTo(cub, -7, -13.5, 600, 0.4); run(5)
log('at tree', st().prompts)
for (let i = 0; i < 4; i++) { tap('KeyE'); run(3) }
run(120)
log('tree', st().obj)
await shot('creek-tree')
play('mama')
walkTo(mama, -7, 1, 600, 0.3); walkTo(mama, -7, -16, 600, 0.4); run(10)
log('mama crossed', r(mama.position), st().obj)
// Cub climbs pillars
play('cub')
walkTo(cub, -3, -13, 600, 0.4); walkTo(cub, 6, -19, 600, 0.3); run(10)
const hop = (z) => { let jumped = false; for (let i = 0; i < 200; i++) { const codes = ['KeyW']; if (!jumped) { codes.push('Space'); jumped = true } run(1, i < 40 ? codes : []); if (i > 10 && cub.grounded) break } run(20, []); return r(cub.position) }
log('p1', hop()); walkTo(cub, 6, -22.4 + 0.2, 100, 0.3)
log('p2', hop()); walkTo(cub, 6, -26.7 + 0.2, 100, 0.3)
log('p3', hop()); walkTo(cub, 6, -31 + 0.2, 100, 0.3)
log('plateau', hop(), st().obj)
await shot('creek-pillars')
const pine = S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).position()
walkTo(cub, pine.x, pine.z, 600, 0.3); run(10)
log('pinecone', jumpSwipe()); run(150)
log('ramp', st().obj)
play('mama')
walkTo(mama, -8, -20, 600, 0.5); walkTo(mama, -8, -36, 600, 0.5); walkTo(mama, -1, -49, 600, 0.5)
play('cub'); walkTo(cub, 1, -50, 900, 0.5)
run(30)
log('done', S.stage.completeTime, r(mama.position))
await shot('creek-end')
