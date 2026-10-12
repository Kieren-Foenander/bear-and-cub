// Cub cannot walk up the seesaw's raised board, so coach the required jump.
run(30); play('cub')
const { mama, cub } = S.stage
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const coach = S.stage.interactions.list.find(i => i.id === 'seesaw-cub')
const end = coach.anchor()
mama.placeAt(V(0, 0, -10))
cub.placeAt(V(end.x, 0, end.z + 2)); run(30)
walkTo(cub, end.x, end.z, 120, 0.2)
const view = coach.view(cub)
assert(view.label === 'Jump onto pink!' && view.buttons.includes('a'), 'seesaw should coach the required jump')
hopTo(cub, end.x, end.z); run(30)
assert(prompts().includes('Hold on tight!'), 'jumping onto the pink end should make Cub ready')
log('qa seesaw passed')
