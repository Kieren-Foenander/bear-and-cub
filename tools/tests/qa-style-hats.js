// Switching styles must fit the same hat as putting a fresh one on that style.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const { HATS } = await import('/src/game/hats.ts')
run(30)
const { mama, cub } = S.stage
const changeLook = () => {
  tap('Escape'); tap('KeyS'); tap('KeyS'); tap('Space'); tap('Escape'); run(30)
}
for (const hat of HATS) {
  const worn = hat.build()
  cub.model.wear(worn)
  for (let i = 0; i < 3; i++) {
    changeLook()
    assert(mama.model.style === cub.model.style, 'pause Bear look should switch both bears')
    const fresh = hat.build()
    cub.model.wear(fresh)
    const expected = fresh.scale.clone()
    cub.model.wear(worn)
    assert(worn.scale.distanceTo(expected) < 0.001, `${hat.id}: reused hat keeps the wrong size in ${cub.model.style}`)
    assert(cub.model.root.getObjectById(worn.id), 'style swap must keep the hat attached')
  }
}
log('qa style hats passed')
