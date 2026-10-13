/**
 * Headless playtest harness.
 *
 *   bun tools/playtest.ts tools/tests/meadow.js [--url http://localhost:5317/?manual&level=1]
 *
 * The test file is the body of an async function run inside the page, with helpers in scope:
 *   run(frames, keys[])     step the game N frames holding the given key codes
 *   walkTo(bear, x, z)      steer the active bear somewhere
 *   tap(code)               press and release a key
 *   jumpSwipe()             jump and swipe on the NOW prompt
 *   st()                    snapshot of state
 *   prompts()               visible prompt labels
 *   shot(name)              save /tmp/shots/<name>.png
 *   log(...)                print to the terminal
 *   S                       the session (S.stage, S.stage.mama, ...)
 */
import { chromium } from "playwright-core"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"

const file = process.argv[2]
if (!file) throw new Error("usage: bun tools/playtest.ts <test.js> [--url URL]")
const urlFlag = process.argv.indexOf("--url")
const url = urlFlag > 0 ? process.argv[urlFlag + 1]! : "http://localhost:5317/?manual"
const body = readFileSync(file, "utf8")

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]
})
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } })
const errors: Array<string> = []
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`[page ${m.type()}]`, m.text())
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => {
  console.log("[page error]", e.message)
  errors.push(e.message)
})
await page.exposeFunction("__shot", async (name: string) => {
  await new Promise((resolve) => setTimeout(resolve, 450))
  await page.screenshot({ path: `/tmp/shots/${name}.png` })
  console.log(`  📸 /tmp/shots/${name}.png`)
})
await page.exposeFunction("__log", (...args: Array<unknown>) => console.log(" ", ...args))
await page.goto(url)
await page.waitForFunction(() => "session" in window, null, { timeout: 30000 })

const helpers = `
const S = window.session
S.renderEnabled = false
const keys = new Set()
const setKeys = (codes) => {
  for (const c of [...keys]) if (!codes.includes(c)) { window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); keys.delete(c) }
  for (const c of codes) if (!keys.has(c)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); keys.add(c) }
}
const run = (frames, codes = []) => { setKeys(codes); for (let i = 0; i < frames; i++) S.frame(1 / 60) }
const tap = (code) => { run(2, [code]); run(2, []) }
const log = (...a) => window.__log(...a.map(x => typeof x === 'string' ? x : JSON.stringify(x)))
const shot = (name) => { S.render(); return window.__shot(name) }
const r = (v) => v.toArray().map(n => +n.toFixed(2))
const prompts = () => [...document.querySelectorAll('.prompt')].map(e => e.querySelector('.prompt-label').textContent + (e.classList.contains('now') ? ' [NOW]' : ''))
const st = () => ({ mama: r(S.stage.mama.position), cub: r(S.stage.cub.position), cubMode: S.stage.cub.mode, carrying: S.stage.coop.carrying, active: S.router.active, obj: S.stage.objective().text, prompts: prompts(), berries: S.stage.berries.collected + '/' + S.stage.berries.total, screen: S.screen })
const active = () => S.router.active === 'mama' ? S.stage.mama : S.stage.cub
const play = (who) => { if (S.router.active !== who) tap('Tab') }
const walkTo = (bear, x, z, maxFrames = 900, tol = 0.4) => {
  for (let i = 0; i < maxFrames; i++) {
    const dx = x - bear.position.x, dz = z - bear.position.z
    if (Math.hypot(dx, dz) < tol) { run(1); return i }
    const codes = []
    if (dx > tol * 0.5) codes.push('KeyD'); if (dx < -tol * 0.5) codes.push('KeyA')
    if (dz > tol * 0.5) codes.push('KeyS'); if (dz < -tol * 0.5) codes.push('KeyW')
    run(1, codes)
  }
  return -1
}
const hopTo = (bear, x, z, frames = 120) => {
  for (let i = 0; i < frames; i++) {
    const dx = x - bear.position.x, dz = z - bear.position.z, d = Math.hypot(dx, dz)
    const codes = []
    if (d > 0.3) { if (dx > 0.3 * d) codes.push('KeyD'); if (dx < -0.3 * d) codes.push('KeyA'); if (dz > 0.3 * d) codes.push('KeyS'); if (dz < -0.3 * d) codes.push('KeyW') }
    if (i === 0) codes.push('Space')
    run(1, codes)
    if (i > 8 && bear.grounded && d < 0.5) break
  }
  run(5, [])
  return r(bear.position)
}
const V = (x, y, z) => S.stage.mama.position.clone().set(x, y, z)
const jumpSwipe = () => { run(2, ['Space']); for (let i = 0; i < 80; i++) { if (prompts().some(p => p.includes('[NOW]'))) { run(2, ['KeyQ']); run(3, []); return i } run(1) } run(1, []); return -1 }
`
try {
  await page.evaluate(`(async () => { ${helpers}\n{\n${body}\n}\n })()`)
  if (errors.length > 0) throw new Error(`browser errors: ${errors.join("; ")}`)
} catch (error) {
  console.log("TEST FAILED:", (error as Error).message)
  await page.screenshot({ path: "/tmp/shots/failure.png" })
  process.exitCode = 1
}
await browser.close()
