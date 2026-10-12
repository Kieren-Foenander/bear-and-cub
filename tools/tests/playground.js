run(5)
const { mama, cub } = S.stage
await shot('playground-start')
play('cub')
const b0 = S.stage.swipes.targets.find(t => t.id === 'music-bell-2').position()
walkTo(cub, b0.x, b0.z + 3, 900, 0.3); walkTo(cub, b0.x, b0.z, 300, 0.3); run(10)
log('bell', jumpSwipe())
await shot('playground-bells')
// seesaw
const A = S.stage.interactions.list.find(i => i.id === 'seesaw-cub-playground').anchor().clone()
cub.placeAt(V(A.x, A.y - 1.5, A.z)); run(20)
const B = A.clone().setX(A.x + 4.6)
mama.placeAt(V(B.x + 2.6, A.y - 1.4, B.z)); run(20)
play('mama')
run(1, ['Space', 'KeyA']); for (let i = 0; i < 60; i++) { run(1, i < 24 ? ['KeyA'] : []); if (i > 5 && mama.grounded) break }
run(90, [])
log('cub on treehouse?', r(cub.position))
await shot('playground-treehouse')
// home
play('cub'); cub.placeAt(V(1, 0.5, -26)); play('mama'); mama.placeAt(V(-1, 0.5, -26)); run(30)
log('done', S.stage.completeTime)
