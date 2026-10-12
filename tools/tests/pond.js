run(5)
const { mama, cub } = S.stage
await shot('pond-start')
// generic hop: face toward (x,z) target, jump while holding direction
const hopTo = (bear, x, z) => {
  for (let i = 0; i < 180; i++) {
    const dx = x - bear.position.x, dz = z - bear.position.z
    const d = Math.hypot(dx, dz)
    const codes = []
    if (d > 0.25) { if (dx > 0.2 * d) codes.push('KeyD'); if (dx < -0.2 * d) codes.push('KeyA'); if (dz > 0.2 * d) codes.push('KeyS'); if (dz < -0.2 * d) codes.push('KeyW') }
    if (i === 0) codes.push('Space')
    run(1, codes)
    if (i > 8 && bear.grounded) break
  }
  run(10, [])
  return r(bear.position)
}
play('cub')
walkTo(cub, -10, 10, 600, 0.3)
log('stone1', hopTo(cub, -10, 7.2))
log('stone2', hopTo(cub, -10.4, 3.6))
log('island', hopTo(cub, -10, 0), st().obj)
walkTo(cub, -9, -3.5, 300, 0.3)
play('mama')
walkTo(mama, -10, 10.2, 600, 0.3)
log('mama stone1', hopTo(mama, -10, 7.2))
log('mama stone2', hopTo(mama, -10.4, 3.6))
log('mama island', hopTo(mama, -10, -0.5))
walkTo(mama, -10.5, -2, 300, 0.3); run(30)
// mama tries a lily pad
walkTo(mama, -7.2, -3.6, 300, 0.3)
log('mama pad', hopTo(mama, -4.9, -3.8)); run(120)
log('mama after pad', r(mama.position), document.querySelector('.toast').textContent)
play('cub')
log('cub walk', walkTo(cub, -7.3, -3.6, 300, 0.3))
for (const [x, z] of [[-4.9, -3.8], [-1.8, -5], [1.4, -6.2], [4.4, -7.3], [7.2, -7.9]]) log('pad', hopTo(cub, x, z))
log(st().obj, st().prompts)
await shot('pond-frog')
walkTo(cub, 8, -7.2, 200, 0.3)
tap('KeyE'); run(300)
log('booped', st().obj)
await shot('pond-turtles')
play('mama')
walkTo(mama, -10, -5.2, 300, 0.3)
for (const [x, z] of [[-10, -8.6], [-10.5, -12.2], [-10, -15.8], [-10, -21]]) log('turtle', hopTo(mama, x, z))
log(st().obj)
play('cub')
walkTo(cub, 9.2, -10, 300, 0.3)
for (const [x, z] of [[9.4, -12.4], [8.6, -15.3], [9.3, -18.1], [9, -21.5]]) log('pad2', hopTo(cub, x, z))
log(st().obj)
walkTo(cub, 1, -31, 600, 0.5)
play('mama'); walkTo(mama, -1, -30, 600, 0.5); run(30)
log('done', S.stage.completeTime)
