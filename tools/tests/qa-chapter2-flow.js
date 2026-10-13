// Unlock prerequisites, per-level music, hats and both finale credits use the real session.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const { LEVELS } = await import('/src/game/levels/index.ts')
const menuText = () => document.querySelector('.screen.show')?.textContent ?? ''
const themes = []
const playTheme = S.music.play
S.music.play = theme => { themes.push(theme); playTheme(theme) }
S.sound.unlock()
run(10); tap('Space'); run(10)
assert(S.screen === 'map', 'start from the title')
for (const [index, prerequisite] of [[5, 'mountain'], [6, 'night'], [7, 'snow'], [8, 'autumn'], [9, 'meadow']]) {
  assert(LEVELS[index].unlockAfter === prerequisite && !S.unlocked(index), 'new level should require its named predecessor')
}
const finish = () => {
  const goal = S.stage.goalPosition
  S.stage.mama.placeAt(goal.clone().add(V(-1, 0, 0)))
  S.stage.cub.placeAt(goal.clone().add(V(1, 0, 0)))
  run(240)
  assert(S.screen === 'complete', `${S.stage.def.id} should complete`)
  const save = S.save.load()
  assert(save.levels[S.stage.def.id].done, 'completion should persist')
  const hat = S.unlockedHats().find(h => h.unlockedBy === S.stage.def.id)
  assert(hat && save.hat === hat.id && menuText().includes(hat.name), 'the new hat should unlock, equip, save and appear on the card')
  tap('Space'); run(10)
}
S.loadLevel(0); run(30)
S.stage.swipes.targets.find(t => t.id === 'bell').onHit(S.stage.cub); run(200); finish()
assert(S.unlocked(9) && !S.unlocked(5), 'Meadow should open Playground without opening Night')
S.loadLevel(4); run(30)
for (const target of S.stage.swipes.targets.filter(t => t.id.startsWith('pinecone'))) target.onHit(S.stage.cub)
run(200); finish()
assert(S.screen === 'credits' && menuText().includes('The End'), 'Mountain should show credits')
tap('Space'); run(10)
assert(S.screen === 'map' && S.unlocked(5) && !S.unlocked(6), 'Mountain credits should return to a map with only Night newly open')
S.loadLevel(5); run(30)
for (const target of S.stage.swipes.targets.filter(t => t.id.startsWith('lantern'))) target.onHit(S.stage.cub)
S.stage.interactions.list.find(i => i.id === 'boop-owl').onComplete(S.stage.cub)
S.stage.swipes.targets.find(t => t.id.startsWith('pinecone')).onHit(S.stage.cub)
run(240); finish()
assert(S.screen === 'map' && S.unlocked(6) && !S.unlocked(7), 'Night should open only Snow')
S.loadLevel(6); run(30)
S.stage.swipes.targets.find(t => t.id === 'bell').onHit(S.stage.cub); run(200)
S.stage.mama.placeAt(V(6, 0, -11.5)); S.stage.cub.placeAt(V(-5, 0, -13)); run(30); play('mama')
for (let i = 0; i < 900 && !st().obj.includes('cabin'); i++) run(1, ['KeyW'])
run(90)
assert(st().obj.includes('cabin'), 'Mama should be able to push the snowball alone')
finish()
assert(S.screen === 'map' && S.unlocked(7), 'Snow should open Autumn')
S.loadLevel(7); run(30)
const tree = S.stage.swipes.targets.find(t => t.id === 'acorn-tree')
tree.onHit(S.stage.cub); run(180)
for (const id of ['hay', 'stump', 'tree']) {
  const pick = S.stage.interactions.list.find(i => i.id === `pick-${id}-cub`)
  pick.onComplete(S.stage.cub); run(30)
  S.stage.interactions.list.find(i => i.id.startsWith('zone-') && i.who === 'cub').onComplete(S.stage.cub)
}
run(240); finish()
assert(S.screen === 'credits' && menuText().includes('The End'), 'Autumn should show credits')
tap('Space'); run(10)
assert(S.screen === 'map' && S.unlocked(8), 'Autumn credits should return to the map with the Beach open')
S.loadLevel(9); run(30); finish()
assert(S.screen === 'map', 'Playground should finish without finale credits')
for (const id of ['night', 'snow', 'autumn', 'playground', 'menu']) assert(themes.includes(id), `music should select ${id}`)
tap('KeyM')
assert(localStorage.getItem('bears.music.muted') === 'true', 'M should persist music mute')
tap('KeyM')
assert(localStorage.getItem('bears.music.muted') === 'false', 'M should restore music')
log('qa chapter 2 flow passed')
