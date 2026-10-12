// Cub must see the log coach while still safely on the approach bank.
run(5)
const { mama, cub } = S.stage
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const gate = S.stage.interactions.list.find(i => i.id === 'open-gate')
cub.placeAt(V(0, 0, 10))
play('cub'); run(30); tap('KeyE'); run(120)
assert(!gate.enabled(), 'gate should be open')
mama.placeAt(V(0, 0, 8))
const coach = S.stage.interactions.list.find(i => i.id.startsWith('ride-'))
for (const z of [5, 4, 3.3]) {
  cub.placeAt(V(0, 0, z)); run(30)
  log('bank', z, 'feet', cub.feetY, 'prompts', prompts())
  assert(cub.grounded, 'Cub should be safely on the bank')
  assert(coach.inRange(cub), `log coach missing on the approach at z=${z}`)
  assert(prompts().some(p => /Wait for the log|JUMP!/.test(p)), 'log timing prompt should be visible')
}
// Both timing states must be reachable without walking into the stream.
cub.placeAt(V(0, 0, 4)); run(30)
const seen = new Set()
for (let i = 0; i < 1000; i++) { run(1); for (const p of prompts()) seen.add(p) }
assert([...seen].some(p => p.includes('Wait for the log')), 'waiting prompt never appeared')
assert([...seen].some(p => p.includes('JUMP!')), 'jump timing prompt never appeared')
log('qa coaches passed', [...seen])
