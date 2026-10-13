// Exercise the physical approach, then obey the jump cue.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
run(30); play('cub')
const { mama, cub } = S.stage
const coach = S.stage.interactions.list.find(i => i.id === 'seesaw-cub-playground')
const end = coach.anchor()
const ground = S.stage.terrain.heightAt(end.x, end.z + 2)
mama.placeAt(V(0, 0, -10))
cub.placeAt(V(end.x, ground, end.z + 2)); run(30)
walkTo(cub, end.x, end.z, 120, 0.2)
assert(coach.view(cub).label === 'Jump onto pink!' && coach.view(cub).buttons.includes('a'), 'playground seesaw should coach the required jump')
hopTo(cub, end.x, end.z); run(30)
assert(prompts().includes('Wait for Mama!'), 'a physical hop should reach the pink end')
log('qa playground seesaw passed')
