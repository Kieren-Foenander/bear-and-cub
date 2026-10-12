# Procedural music

`Music.ts` is the scoped Effect service. It shares Sound's AudioContext and gesture
unlocking. It owns the 25 ms lookahead timer, M key/button, saved mute preference
(`bears.music.muted`), and visibility listener. M mutes music and ambience together;
effects remain enabled. Hidden tabs fade out; missed beats are skipped on return.

`themes.ts` defines the menu and five level themes: tempo, instrument, pentatonic
motifs, rhythm slots (sixteenths in a four-beat bar), chord order, arpeggio density,
swing, ambience, and random seed. All themes share C-major pentatonic with the
flowers. Woods starts on Am; the other themes start on C. Motifs rotate and vary,
notes occasionally rest, and some eight-bar phrases get a short answering fill.
The 32-bar form includes quiet phrases and two bars of breathing space. Mountain
adds a little density and intensity over its first three eight-bar phrases, then
relaxes. Each visit gets a different deterministic seed. Bars continue indefinitely
on the audio clock, with no buffer loop seam or short fixed recording.

`synth.ts` makes gentle additive sine/triangle voices with soft attack and decaying
envelopes. Marimba adds a brief fourth harmonic. Bird/cricket chirps use frequency
sweeps; water/wind use a cached, generated noise buffer and quiet filters. Nothing
loads audio files or uses network access. Sources stop on the audio clock and
disconnect when finished; the scope finalizer stops/disconnects everything.

`engine.ts` owns scheduling and mixing. Change `MUSIC_VOLUME` (default **0.1**) for
overall music/ambience/sting volume. Sound's existing master is 0.35 and its voice
levels are larger. Theme melody voices are roughly 0.12–0.16 before the master,
leaving flower notes and effects prominent. Ambience levels live in `ambience()`;
set a theme's ambience to `"none"` to remove it. Change `CROSSFADE_SECONDS` (1.8) to
adjust transitions. `celebrate()` ducks the backing to 12% for about three seconds;
a lower C-major marimba answer follows the existing success effect by 0.85 seconds.

Integration stays small: main provides Music with Sound, Sound exposes its context,
and Session selects the level id while playing or `menu` on every other screen.
The idempotent selection allocates nothing in the frame loop. Session detects the
first completed frame and calls `celebrate()` alongside Stage's success effect,
before the three-second celebration ends and the completion menu appears.

With Vite on 5321, run `bun tools/music-check.ts 5321` for gesture/mute lifecycle
checks and full 32-bar offline renders of all themes plus crossfades. It checks
finite samples, conservative peaks, non-silent output, sample discontinuities,
and complete silence when muted. No audio artifacts are saved.
