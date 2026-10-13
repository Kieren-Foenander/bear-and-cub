const assert = (ok, message) => { if (!ok) throw new Error(message) }
run(30); play('cub')
const { cub, mama } = S.stage
mama.placeAt(V(0, 0, 12))
const notes = []
const bellNote = S.sound.bell
S.sound.bell = note => { notes.push(note); bellNote(note) }
const bells = S.stage.swipes.targets.filter(t => t.id.startsWith('music-bell-'))
assert(bells.length === 6 && new Set(bells.map(t => t.id)).size === 6, 'musical bells should have distinct targets')
for (const bell of bells) {
  const p = bell.position()
  cub.placeAt(V(p.x, S.stage.terrain.heightAt(p.x, p.z), p.z)); run(30)
  for (let repeat = 0; repeat < 2; repeat++) {
    assert(prompts().includes('Jump!'), `${bell.id}: musical bells should keep coaching repeat play`)
    assert(jumpSwipe() >= 0, 'the visible timing cue should reach each bell')
    run(100)
  }
}
assert(JSON.stringify(notes) === JSON.stringify([-1, -1, 1, 1, 3, 3, 5, 5, 7, 7, 9, 9]), 'each bell should play its own tuned note on both swipes')
log('qa playground bells passed')
