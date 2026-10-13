const assert = (ok, message) => { if (!ok) throw new Error(message) }
// Night: glowing stones are transient platforms and cannot replace the bank checkpoint.
S.loadLevel(5); run(30); play('cub')
for (const target of S.stage.swipes.targets.filter(t => t.id.startsWith('lantern'))) target.onHit(S.stage.cub)
run(180)
let { cub, mama } = S.stage
cub.placeAt(V(0, 0, 16.6)); run(60)
let safe = cub.lastSafe.clone()
hopTo(cub, 0, 14); hopTo(cub, 0.6, 11.6); run(60)
assert(cub.surfaceBelow?.kind === 'platform', 'Cub should land on a glowing stone')
assert(cub.lastSafe.distanceTo(safe) < 0.1, 'glowing stone should not become a respawn checkpoint')
cub.teleport(V(4, -2, 12)); run(60)
assert(cub.position.distanceTo(safe) < 1, 'Night splash should return to the approach bank')
// Snow: a heavy bear cracks a floe and recovers; Cub can safely linger and retry.
S.loadLevel(6); run(30); play('cub')
;({ cub, mama } = S.stage)
cub.placeAt(V(2, 0, 2.6)); run(60); safe = cub.lastSafe.clone()
hopTo(cub, 2, 0.3); run(180)
assert(cub.grounded && cub.feetY > -0.7, 'thin ice should support Cub indefinitely')
assert(cub.lastSafe.distanceTo(safe) < 0.1, 'thin ice should not become a checkpoint')
cub.teleport(V(-3, -2, -4)); run(60)
assert(cub.position.distanceTo(safe) < 1, 'Cub should respawn on the Snow bank')
cub.placeAt(V(-5, 0, 3.5)); mama.placeAt(V(2, 0, 2.6)); run(60); play('mama')
walkTo(mama, 3.5, -1.9, 600, 0.25); run(1800)
safe = mama.lastSafe.clone()
log('Mama thin ice after walking and waiting 30 seconds', r(mama.position), mama.feetY)
assert(mama.lastSafe.z > 1, 'thin ice should never replace Mama’s bank checkpoint')
await shot('qa2-mama-thin-ice-wait')
mama.teleport(V(-3, -2, -4)); run(60)
assert(mama.position.distanceTo(safe) < 1 && mama.mode === 'walk', 'Mama should recover locally after falling into the frozen river')
// Measure ice vs snow stopping, then verify normal traction in the next level.
const stopDistance = (x, z) => {
  cub.placeAt(V(x, S.stage.terrain.heightAt(x, z), z)); run(60); play('cub')
  run(24, ['KeyD']); const start = cub.position.x; run(60); return cub.position.x - start
}
const iceStop = stopDistance(0, 20)
const snowStop = stopDistance(0, 30)
assert(iceStop > snowStop * 2, 'ice should preserve substantially more momentum than snow')
S.loadLevel(7); run(30); cub = S.stage.cub
const orchardStop = stopDistance(0, 24)
assert(orchardStop < iceStop / 2, 'traction should reset when leaving Snow')
log('qa chapter 2 recovery passed', { iceStop, snowStop, orchardStop })
