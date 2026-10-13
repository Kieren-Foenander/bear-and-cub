// Dropping an acorn on a raised solid platform must not lose it inside that platform.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
run(30); play('cub')
const { mama, cub } = S.stage
mama.placeAt(V(0, 0, 25))
cub.placeAt(V(-18, 3.2, 14)); run(30)
const pick = S.stage.interactions.list.find(i => i.id === 'pick-hay-cub')
tap('KeyE'); run(30)
assert(!pick.enabled() && st().obj.includes('Bring'), 'Cub should pick up the hay acorn')
cub.yaw = 0
tap('KeyE'); run(240)
const itemAt = pick.anchor().sub(V(0, 1.3, 0))
log('dropped on hay', r(itemAt), 'Cub feet', cub.feetY, prompts())
assert(itemAt.y >= 3.2, 'dropped acorn must remain above the hay, not fall into its collider')
walkTo(cub, itemAt.x, itemAt.z, 240, 0.3); run(30); tap('KeyE'); run(30)
assert(st().obj.includes('Bring'), 'Cub should pick the acorn back up from the hay')
// The taller stump also has a solid top, even though terrain underneath is low.
cub.placeAt(V(19, 4.2, 12)); run(30); cub.yaw = Math.PI / 2; tap('KeyE'); run(240)
const stumpAt = pick.anchor().sub(V(0, 1.3, 0))
assert(stumpAt.y >= 4.2, 'dropped acorn must stay on the stump')
log('qa acorn platform drop passed')
