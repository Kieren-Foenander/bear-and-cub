// Reaching the frog by the outer shore / north pads must advance the objective,
// even when Cub never visited the stepping-stone island.
run(30)
const { mama, cub } = S.stage
const assert = (ok, message) => { if (!ok) throw new Error(message) }
play('cub')
// Set up the shortcut's final landing; the boop itself uses the real input path.
cub.placeAt(V(8, 0, -7.2)); run(30)
assert(S.stage.objective().text === 'Hop across the stepping stones!', 'island has not been visited')
assert(prompts().includes('Boop!'), 'frog should offer its action')
tap('KeyE'); run(300)
assert(!S.stage.interactions.list.find(i => i.id === 'boop-frog').enabled(), 'frog should be booped')
assert(S.stage.objective().text === 'Mama: hop across the turtles!', 'booping by a shortcut must advance the objective')
const target = S.stage.objective().target
assert(target.x === -10 && target.z === -8.6, 'arrow should point at the turtle path')
log('qa pond shortcut passed')
