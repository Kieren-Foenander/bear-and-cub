// QA2-07: thin ice can't hold Mama up, even straddling two floes.
run(5)
const { mama, cub } = S.stage
cub.placeAt(V(-5, 0.2, 3.5)); play('mama')
mama.placeAt(V(2, 0.2, 2.6)); run(20)
let splashed = false
for (let i = 0; i < 600 && !splashed; i++) {
  run(1, i < 40 ? ['KeyW', 'KeyD'] : [])
  if (document.querySelector('.toast').textContent.includes('Splash')) splashed = true
}
if (!splashed) throw new Error('Mama should fall through the thin ice: ' + r(mama.position))
log('qa thin ice passed')
