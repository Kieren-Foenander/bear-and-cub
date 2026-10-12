// Check local splash checkpoints, moving-surface recovery and odd call/throw timing.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const safeSpots = [[0, -12], [0, -18], [-10, -3], [0, 7], [0, 12]]
const waterSpots = [[0, -21], [0, -8], [0, -12], [0, -1], [0, 8]]
for (let level = 0; level < 5; level++) {
  S.loadLevel(level); run(30)
  const stage = S.stage, { mama, cub } = stage
  const safe = safeSpots[level], water = waterSpots[level]
  for (const [bear, who, dx] of [[mama, 'mama', -0.9], [cub, 'cub', 0.9]]) {
    play(who)
    const x = safe[0] + dx, z = safe[1]
    // Use teleport, not placeAt: gameplay must remember this dry ground itself.
    bear.teleport(V(x, stage.terrain.heightAt(x, z) + bear.spec.halfHeight + bear.spec.radius + 0.3, z))
    bear.velocity.set(0, 0, 0); run(90)
    const checkpoint = bear.position.clone()
    assert(bear.grounded, `level ${level + 1}: ${who} should be on dry ground`)
    if (level === 2 || level === 3 || level === 4) {
      const surface = stage.surfaces.platforms[0].object.position
      const topOffset = level === 3 ? 0.4 : level === 2 ? 0.08 : 0
      bear.teleport(V(surface.x, surface.y + topOffset + bear.spec.halfHeight + bear.spec.radius + 0.05, surface.z))
      bear.velocity.set(0, 0, 0); run(who === 'mama' && level !== 3 ? 180 : 45)
      if (who === 'mama' && level !== 3) {
        assert(bear.position.distanceTo(checkpoint) < 0.5, 'heavy Mama should splash back from the sinking surface')
      }
    }
    bear.teleport(V(water[0], stage.terrain.waterY - 0.4 + bear.spec.halfHeight + bear.spec.radius, water[1]))
    bear.velocity.set(0, 0, 0); run(120)
    assert(bear.position.distanceTo(checkpoint) < 0.5, `level ${level + 1}: ${who} should respawn on recent dry ground, away from moving surfaces`)
    assert(bear.grounded && bear.mode === 'walk', `level ${level + 1}: ${who} respawn should be stable`)
  }
  // Calling a wandering Cub puts her on Mama, and a free throw gives control back.
  cub.teleport(V(water[0], 4, water[1])); cub.velocity.set(0, 0, 0)
  play('mama'); tap('KeyR')
  assert(stage.coop.carrying && cub.mode === 'carried', 'call should rescue Cub onto Mama')
  tap('KeyR'); run(300)
  assert(!stage.coop.carrying && cub.mode === 'walk', 'free throw should land or splash safely')
  assert(Number.isFinite(cub.position.y), 'throw should preserve a valid position')
  log('qa recovery passed', level + 1)
}
