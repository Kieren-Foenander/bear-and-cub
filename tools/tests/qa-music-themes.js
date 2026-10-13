// Render the actual synth/scheduler offline: every new theme must produce finite audible audio.
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const { MusicEngine } = await import('/src/services/music/engine.ts')
for (const id of ['night', 'snow', 'autumn', 'playground']) {
  const context = new OfflineAudioContext(2, 24000 * 6, 24000)
  const engine = new MusicEngine(context)
  engine.play(id)
  for (let now = 0; now < 5.8; now += 0.025) engine.tick(now)
  const buffer = await context.startRendering()
  const samples = buffer.getChannelData(0)
  let sum = 0, peak = 0
  for (const sample of samples) { assert(Number.isFinite(sample), `${id}: invalid audio sample`); sum += sample * sample; peak = Math.max(peak, Math.abs(sample)) }
  const rms = Math.sqrt(sum / samples.length)
  assert(rms > 0.0001 && peak < 1, `${id}: audio should be audible without clipping`)
  log('music rendered', id, { rms, peak })
  engine.dispose()
}
log('qa music themes passed')
