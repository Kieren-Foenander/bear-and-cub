// QA-06: a bear under a raised lift is told to step back, and the lift comes down once she does.
run(5)
const { cub, mama } = S.stage
play('cub')
mama.placeAt(V(-14, 7, -8))
const lift = S.stage.surfaces.platforms.find(p => Math.abs(p.object.position.x + 4) < 0.1)
for (let i = 0; i < 1500 && lift.object.position.y < 10.5; i++) run(1)
cub.placeAt(V(-4, 7, -14.3)); run(120)
const blocked = lift.object.position.y
const prompt = prompts()
if (!prompt.some(p => p.includes('Step back'))) throw new Error('should ask to step back: ' + prompt)
cub.placeAt(V(-4, 7, -11.7)); for (let i = 0; i < 900 && lift.object.position.y > 7; i++) run(1)
if (lift.object.position.y > 7) throw new Error('lift should come down once the paw is used')
log('qa lift passed', blocked.toFixed(2), prompt)
