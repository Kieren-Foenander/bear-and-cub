run(5)
const { mama, cub } = S.stage
await shot('snow-start')
play('cub')
// Slide around the rink: walk to a few berries (slippery steering takes longer)
for (const [x, z] of [[5, 20], [0, 25], [-5, 20], [0, 15], [0, 20]]) walkTo(cub, x, z, 900, 0.6)
log('rink', st().berries, st().obj)
await shot('snow-rink')
// Across the floes
walkTo(cub, 2, 2.4, 900, 0.4); run(30)
for (const [x, z] of [[2, 0.3], [3.5, -1.9], [2.1, -4.1], [3.6, -6.3], [2.4, -8.5], [2.5, -10.8]]) {
  walkTo(cub, x, z, 400, 0.5); run(20)
}
log('cub across?', r(cub.position), st().obj)
await shot('snow-floes')
const bell = S.stage.swipes.targets.find(t => t.id === 'bell').position()
walkTo(cub, bell.x, bell.z, 400, 0.3); run(30)
log('bell', jumpSwipe()); run(180)
log(st().obj)
play('mama')
walkTo(mama, -8, 4, 900, 0.4); walkTo(mama, -8, -12, 900, 0.4); run(10)
log('mama across', r(mama.position), st().obj)
// Push the snowball (Mama alone, slowly)
walkTo(mama, -8, -10.2, 300, 0.4); walkTo(mama, 6, -10.2, 900, 0.3); run(10)
let frames = 0
for (; frames < 1500; frames++) { run(1, ['KeyW']); if (st().obj.includes('cabin')) break }
run(80, [])
log('pushed for', frames, 'frames', st().obj)
await shot('snow-snowball')
walkTo(mama, 6, -30, 900, 0.4); walkTo(mama, -1, -44, 900, 0.5)
play('cub'); walkTo(cub, 6, -18, 900, 0.4); walkTo(cub, 6, -30, 900, 0.4); walkTo(cub, 1, -44, 900, 0.5); run(40)
log('done', S.stage.completeTime)
await shot('snow-end')
