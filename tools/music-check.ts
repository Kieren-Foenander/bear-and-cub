/** Audio lifecycle and offline mix checks. Run with Vite on the given port:
 * bun tools/music-check.ts 5321
 * Uses the same Chromium installation as the existing playtests, with autoplay blocked.
 */
import { chromium } from "playwright-core"
import { homedir } from "node:os"

const port = process.argv[2] ?? "5321"
const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=document-user-activation-required"]
})
try {
  const page = await browser.newPage()
  // The base app has no favicon; keep that unrelated request out of audio diagnostics.
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }))
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error" || (message.type() === "warning" && /audio/i.test(message.text()))) errors.push(message.text())
  })
  await page.addInitScript(`
    window.__contexts = []
    window.__voices = 0
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__contexts.push(this) }
      createOscillator() { window.__voices++; return super.createOscillator() }
      createBufferSource() { window.__voices++; return super.createBufferSource() }
    }
  `)
  await page.goto(`http://localhost:${port}/?manual&level=1`)
  await page.waitForFunction("window.session !== undefined")
  await page.waitForTimeout(400)
  const check = async (expression: string, message: string) => {
    if (!await page.evaluate(expression)) throw new Error(message)
  }
  await check("__contexts.length === 1 && __contexts[0].state === 'suspended' && __voices === 0", "Audio must stay silent and suspended before a gesture, sharing one context")
  console.log("✅ No audio voices, errors, or unlock attempts before a gesture")

  await page.keyboard.press("m")
  await check("document.querySelector('button[aria-label=\"Background music\"]').getAttribute('aria-pressed') === 'false'", "M should mute music")
  await page.waitForTimeout(250)
  await check("__contexts[0].state === 'running' && __voices === 0", "A muted first gesture should unlock Sound without starting music")
  await page.keyboard.press("m")
  await page.waitForTimeout(350)
  await check("__voices > 0 && localStorage.getItem('bears.music.muted') === 'false'", "Second M should enable and schedule music")
  await page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyM', repeat: true}))")
  await check("localStorage.getItem('bears.music.muted') === 'false'", "Key repeats must not toggle mute")
  await page.getByRole("button", { name: "Background music" }).click()
  await page.reload()
  await page.waitForFunction("window.session !== undefined")
  await page.waitForTimeout(250)
  await check("localStorage.getItem('bears.music.muted') === 'true' && __voices === 0", "Mute must survive a reload")
  await page.getByRole("button", { name: "Background music" }).click()
  await page.getByRole("button", { name: "Background music" }).click()
  await page.waitForTimeout(180)
  await page.evaluate("window.__beforeFlower = __voices; window.session.sound.note(2)")
  await check("__voices > __beforeFlower", "Music mute must leave flower effects enabled")
  console.log("✅ Gesture unlock, M/button mute, repeat protection, persistence, and independent effects")

  const mixes = await page.evaluate(`(async () => {
    const { MusicEngine } = await import('/src/services/music/engine.ts')
    const { THEMES } = await import('/src/services/music/themes.ts')
    const results = []
    async function render(ids, muted = false) {
      const duration = ids.length === 1 ? 128 * 60 / THEMES[ids[0]].bpm + 3 : 36
      const ctx = new OfflineAudioContext(1, Math.ceil(24000 * duration), 24000)
      const engine = new MusicEngine(ctx)
      engine.setMuted(muted)
      engine.play(ids[0])
      for (let tick = 0; tick < duration * 40; tick++) {
        const now = tick / 40
        if (ids.length > 1) engine.play(ids[Math.floor(now / 6) % ids.length])
        engine.tick(now)
      }
      const buffer = await ctx.startRendering()
      const data = buffer.getChannelData(0)
      let peak = 0, squares = 0, jump = 0
      for (let i = 0; i < data.length; i++) {
        if (!Number.isFinite(data[i])) throw new Error('Non-finite audio sample')
        peak = Math.max(peak, Math.abs(data[i]))
        squares += data[i] ** 2
        if (i > 0) jump = Math.max(jump, Math.abs(data[i] - data[i - 1]))
      }
      if (!muted && ids.length > 1) {
        for (let start = 2; start < duration - 1; start++) {
          let energy = 0
          for (let i = start * 24000; i < (start + 1) * 24000; i++) energy += data[i] ** 2
          if (Math.sqrt(energy / 24000) < 0.0001) throw new Error('Gap during crossfade at ' + start)
        }
      }
      engine.dispose()
      return { theme: ids.join(' → '), peak, rms: Math.sqrt(squares / data.length), jump }
    }
    for (const id of Object.keys(THEMES)) results.push(await render([id]))
    results.push(await render(Object.keys(THEMES)))
    const silence = await render(['menu'], true)
    if (silence.peak !== 0) throw new Error('Muted offline render must be silent')
    for (const result of results) {
      if (result.peak >= 0.06 || result.rms < 0.0005 || result.jump > 0.025) {
        throw new Error('Unexpected loudness, silence, or discontinuity: ' + JSON.stringify(result))
      }
    }
    return results
  })()`)
  for (const mix of mixes) console.log(`✅ ${mix.theme}: peak ${mix.peak.toFixed(4)}, RMS ${mix.rms.toFixed(4)}, max sample step ${mix.jump.toFixed(4)}`)
  if (errors.length) throw new Error(errors.join("\n"))
  console.log("✅ No audio warnings or page errors")
} finally {
  await browser.close()
}
