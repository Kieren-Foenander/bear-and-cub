// Reuse the actual chapter 2 journeys under both alternate art styles.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
run(30)
for (const style of ['toy', 'classic']) {
  tap('Escape'); tap('KeyS'); tap('KeyS'); tap('Space'); tap('Escape'); run(30)
  assert(S.stage.cub.model.style === style, 'pause Bear look should select the next style')
  for (const [index, name] of [[5, 'night'], [6, 'snow'], [7, 'autumn'], [8, 'beach'], [9, 'playground']]) {
    S.loadLevel(index); run(30)
    const body = await (await fetch(`/tools/tests/${name}.js`)).text()
    await eval(`(async () => {\n${body}\n})()`)
    assert(S.stage.completeTime >= 0, `${style}: ${name} should complete`)
    assert(S.stage.mama.model.style === style && S.stage.cub.model.style === style, 'level changes should preserve Bear look')
    log('style journey passed', style, name)
  }
  // The previous journey may already be on its completion card.
  S.loadLevel(9); run(30)
}
log('qa style routes passed')
