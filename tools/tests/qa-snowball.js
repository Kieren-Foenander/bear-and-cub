// Sustained push should work for either bear alone, and two simultaneous pads are faster.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const pad = (moveY) => ({ moveX: 0, moveY, pressed: {}, held: {} })
const pushTime = (who) => {
  S.loadLevel(6); run(30)
  const { mama, cub } = S.stage
  S.stage.swipes.targets.find(t => t.id === 'bell').onHit(cub); run(200)
  mama.placeAt(V(who === 'both' ? 5.3 : 6, 0, who === 'cub' ? -17 : -12))
  cub.placeAt(V(who === 'both' ? 6.8 : 6, 0, who === 'mama' ? -17 : -12))
  run(30)
  let frames = 0
  for (; frames < 1000; frames++) {
    S.stage.update(1 / 60, { mama: pad(who === 'cub' ? 0 : -1), cub: pad(who === 'mama' ? 0 : -1), active: 'mama', twoPlayer: who === 'both', swapped: false })
    if (S.stage.objective().text.includes('cabin')) break
  }
  assert(frames < 1000, `${who}: sustained pushing should fill the crack`)
  return frames / 60
}
const mama = pushTime('mama'), cub = pushTime('cub'), both = pushTime('both')
assert(both < Math.min(mama, cub) * 0.8, 'two bears should push measurably faster')
log('qa snowball passed', { mama, cub, both })
