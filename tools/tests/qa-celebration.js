// Movement and free-throw input must stop when the honey celebration starts.
run(30)
const { mama, cub } = S.stage
const assert = (ok, message) => { if (!ok) throw new Error(message) }
S.stage.swipes.targets.find(t => t.id === 'bell').onHit(cub)
run(180)
const goal = S.stage.goalPosition
mama.placeAt(goal.clone().add(V(-1, 0, 0)))
cub.placeAt(goal.clone().add(V(1, 0, 0)))
run(1)
assert(S.stage.completeTime >= 0, 'honey celebration should have started')
const start = mama.position.clone()
run(60, ['KeyD'])
assert(Math.abs(mama.position.x - start.x) < 0.1, 'movement must be ignored while celebrating')

S.loadLevel(0); run(30)
S.stage.swipes.targets.find(t => t.id === 'bell').onHit(S.stage.cub)
run(180)
S.stage.mama.placeAt(goal.clone().add(V(-1, 0, 0)))
S.stage.cub.placeAt(goal.clone().add(V(1, 0, 0)))
run(1, ['KeyE']); run(1)
assert(S.stage.coop.carrying && S.stage.completeTime >= 0, 'carrying Cub should also reach the honey')
tap('KeyR')
assert(S.stage.coop.carrying && S.stage.cub.mode === 'carried', 'free throw must be ignored while celebrating')
run(240)
assert(S.screen === 'complete', 'celebration should still finish')
log('qa celebration passed')
