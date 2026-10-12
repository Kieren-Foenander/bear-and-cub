// Shared menu flow, pause/restart, saving, locked levels, completion and credits.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const menuText = () => document.querySelector('.screen.show')?.textContent ?? ''
run(5)
assert(S.screen === 'title', 'start this test with ?manual, without a level')
assert(menuText().includes('Bear'), 'title is visible')
tap('Space'); run(5)
assert(S.screen === 'map', 'title should open the map')
assert(document.querySelectorAll('.card.locked').length === 5, 'only Meadow starts unlocked')
tap('KeyD'); tap('Space')
assert(S.screen === 'map', 'locked Creek should not launch')
tap('KeyA'); tap('Space'); run(30)
assert(S.screen === 'playing', 'Meadow should launch')
const stage = S.stage
tap('Escape')
assert(S.screen === 'paused', 'Escape should pause')
const position = stage.mama.position.clone()
run(60, ['KeyW', 'KeyQ', 'KeyR'])
assert(stage.mama.position.equals(position), 'paused gameplay must stay frozen')
run(1); tap('Escape')
assert(S.screen === 'playing', 'Escape should resume')
tap('Escape'); tap('KeyS'); tap('KeyS'); tap('Space'); run(30)
assert(S.screen === 'playing' && S.stage !== stage, 'restart should replace the stage')
assert(S.stage.berries.collected === 0, 'restart should reset collectibles')
tap('Escape'); tap('KeyS'); tap('KeyS'); tap('KeyS'); tap('Space'); run(5)
assert(S.screen === 'map', 'pause should return to the map')

// Exercise real completion by opening each goal through its puzzle trigger, then
// placing both bears at the honey. Full physical puzzle routes have separate tests.
for (let level = 0; level < 5; level++) {
  S.loadLevel(level); run(30)
  const { mama, cub } = S.stage
  if (level === 0) S.stage.swipes.targets.find(t => t.id === 'bell').onHit(cub)
  if (level === 1) S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).onHit(cub)
  if (level === 2) S.stage.interactions.list.find(i => i.id === 'boop-frog').onComplete(cub)
  if (level === 3 || level === 4) {
    for (const target of S.stage.swipes.targets.filter(t => t.id.startsWith('pinecone'))) target.onHit(cub)
  }
  run(180)
  const goal = S.stage.goalPosition
  mama.placeAt(goal.clone().add(V(-1, 0, 0)))
  cub.placeAt(goal.clone().add(V(1, 0, 0)))
  run(240)
  assert(S.screen === 'complete', `level ${level + 1} should finish`)
  assert(menuText().includes('You did it!'), 'completion card is visible')
  const progress = S.save.load()
  assert(progress.levels[S.stage.def.id].done, 'completion should persist through the save service')
  tap('Space'); run(5)
  assert(S.screen === (level === 4 ? 'credits' : 'map'), 'next adventure/end flow')
  if (level < 4) {
    assert(document.querySelectorAll('.card.locked').length === 3 - level, 'next level should unlock')
    assert(document.querySelector('.card.selected .card-number').textContent === String(level + 2), 'map should select next adventure')
  }
}
assert(menuText().includes('The End'), 'credits should be visible')
tap('Space'); run(5)
assert(S.screen === 'map' && document.querySelectorAll('.card.locked').length === 0, 'credits should return to the fully unlocked map')
localStorage.setItem('bear-and-cub/progress', '{broken')
assert(Object.keys(S.save.load().levels).length === 0, 'corrupt saves should fall back safely')
log('qa flow passed')
