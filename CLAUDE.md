# Harmonic Workbench

## What this is
A browser-based music theory sandbox and idea generator for electronic music producers. Built as a React app. The user (Will) is a music producer, DJ, and monthly radio host — not a developer. He programs notes into hardware sequencers (Dirtywave M8, Polyend Tracker) and DAWs (Ableton Live) but doesn't play an instrument, so he needs tools that help him understand what notes/chords work together and generate musical ideas he can export as MIDI.

## Current state
The port is done. Every feature listed below is built and working, plus a
good deal that was originally filed as future work (drum machine, snapshots,
live MIDI out). Roughly 6,900 lines across 36 files in `src/`.

- Repo: https://github.com/wkathomson/harmonic-workbench (public)
- Live: https://wkathomson.github.io/harmonic-workbench/
- Local dev: `npm run dev` → http://localhost:5173

GitHub Pages rebuilds the live site automatically from `.github/workflows/deploy.yml`
on every push to `main` — there's no manual deploy step.

The original v5 single-file prototype (`prototype.jsx`) has been removed now
that this supersedes it. It's still in git history at `git show 6575500:prototype.jsx`,
as is the standalone single-file build Pages used to serve: `git show d822b2a:index.html`.

## Tech stack
- React (Vite)
- Tone.js for audio (replaces raw Web Audio API from the prototype — gives us proper synth sounds, 303 filter emulation, transport sync, effects)
- Native Web MIDI API for live MIDI output (no library). Chromium-only — Safari and Firefox get a "not available" notice instead
- No UI framework — custom CSS, dark theme with warm tones inspired by hardware music gear (Teenage Engineering, Elektron aesthetic)

## Design principles
- **Speed over polish**: the app should answer "what can I put here?" fast enough not to break creative flow
- **Sound first**: everything should be audible immediately on click — no silent UI
- **Export-oriented**: the real value is generating MIDI clips to drop into Ableton/M8/Polyend
- **Educational but optional**: theory explanations available on demand, never in the way
- **Instrument-grade aesthetic**: dark background, monospace type for data, serif for headings, warm orange accent colour, collapsible sections for density control

## Features
All of the below are built. Section numbers match the numbered panels in the UI.

### 1. Key & Scale Picker
- 12 root notes, 8 scales/modes (Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Harmonic Minor, Melodic Minor)
- Displays current scale notes

### 2. Piano Roll
- Single octave display (C to C), octave transpose control (C1–C6)
- Three-tier colouring: chord tones (bold orange) → scale tones (cream) → out-of-scale (greyed/dimmed)
- Clickable keys that play notes
- Octave control also affects chord audition pitch

### 3. Diatonic Chord Palette
- 7 diatonic chords per scale with Roman numeral labels
- Click to audition, + button to add to progression
- Triad / 7th / 9th toggle (global)
- Chord detail panel showing notes and role

### 4. Inversions
- Root position, 1st, 2nd, 3rd inversions (up)
- Negative inversions: -1, -2 (drop top notes down an octave)
- Click to audition inversion, add to progression with inversion preserved

### 5. Modal Interchange (Borrowed Chords)
- Shows chords borrowed from the parallel mode
- Only displays chords that contain at least one out-of-scale note
- Purple accent colour to distinguish from diatonic chords
- Can be added to progression

### 6. Transpose Explorer
- ±12 semitone range, split into Down / Current / Up rows
- Each button shows: semitone offset, resulting chord symbol, in-scale (green) or chromatic (yellow) flag
- Click to preview (updates piano roll), + button to add transposed chord to progression

### 7. Progression Builder
- Drag-and-drop chord reordering
- BPM control (40–200)
- Beats per chord (1, 2, 4, 8)
- Remove individual chords
- Chord suggestions per scale (e.g. "House i–VI–VII–i", "Pop I–V–vi–IV")

### 8. Rhythmic Chord Sequencer
- Per-chord step grid (eighth-note resolution based on beats/chord)
- Toggle steps to create stabs, syncopation, rhythmic patterns
- Duration: chord plays until next active step

### 9. Bassline Generator
- Patterns: Root only, Root-fifth, Octave, Offbeat, **Acid (303)**
- Acid mode: per-step random notes from root/fifth/octave, random accent (~30%), random slide (~25%), random octave-up (~15%)
- Dedicated acid voice with sawtooth + resonant lowpass filter envelope
- Bass octave selector (C1–C3)
- Step grid with visual accent/slide indicators

### 10. Melodic Playground
- Step sequencer: 8, 16, or 32 steps per chord
- Pentatonic scale selection: Auto (matches chord quality — major penta over major chords, minor over minor), or force Major/Minor
- Fill modes: Random (density control) or Euclidean (hits/steps)
- Chord interaction modes: Transposed (same shape, adapted to each chord's pentatonic) or Free (independent random per chord)
- **Lockable rows**: lock individual chord melodies to protect from regeneration
- Click cells to manually toggle notes
- Melody octave selector (C4–C6)

### 11. Arpeggiator
- Modes: Up, Down, Up-Down, Random
- Step count: 8, 16, 32
- Generates from chord tones

### 12. Playback
- Unified scheduler: chords, bass, melody, and arp all play in sync
- Loop mode (continuous restart)
- Visual step highlighting during playback

### 13. MIDI Export
- Type 1 multi-track MIDI file
- Separate tracks/channels: chords (ch1), bass (ch2), melody (ch3), arp (ch4)
- Tempo embedded in file
- Respects chord rhythm, bass accent/slide, melody patterns

### 14. Collapsible UI Sections
- Each feature in a collapsible panel with numbered header
- Badges show active state when collapsed
- Key/Scale, Piano Roll, Chords, Progression default open
- Bass, Melody, Arp default closed

## Also built (beyond the original port scope)
- **Drum machine** — 4 kits, own step grid, velocity editing
- **Snapshots** — save/recall whole sessions to localStorage, plus autosave
- **Live MIDI out** — device picker, per-track channels, MIDI clock, local-monitor toggle
- **Mixer** — 8 channels with per-channel reset
- **Voices** — per-voice presets and A/D/R/Tone/Reverb/Delay macros
- **Global FX** — ping-pong delay, reverb size
- **Chord Design** — strum, spread, humanise; shapes every chord event
- **Compose / Arrange mode split** — theory panels vs pattern panels, Progression bridges both
- **Per-track MIDI export** — download one part at a time
- **Voice-leading tools** — Smooth (minimises movement between chords) and Variations

## Architecture
- `src/theory/` — pure functions, no React, no audio. Scales, chords, rhythm, bass, drums
- `src/audio/` — `engine.js` is a singleton service wrapping Tone.js; presets and chord design alongside it
- `src/components/` — one file per UI panel
- `src/utils/` — MIDI file writing, snapshot persistence, click disambiguation
- `App.jsx` holds all state and wires the panels together

Scheduling goes through `Tone.Transport` with `Tone.Part`, not `setTimeout`.
Edits made mid-playback hot-swap the Parts so they land on the next loop
without an audible stop/start.

### Known pressure point
`App.jsx` is ~1,350 lines and owns every piece of state. It's the same
single-file pressure the port was meant to relieve, just moved up a level.
Pulling the sequencer state (bass/melody/arp/drums) into custom hooks would
take most of the weight out of it. Not urgent.

## Future features
- Swing/humanisation on export (humanise exists live in Chord Design, but `midiExport.js` doesn't apply it — exports are dead-straight)
- Global transpose control
- Density macro (single knob controlling overall busyness)
- Pattern length per chord (1x, 2x, 0.5x)

## Communication style
Will is knowledgeable about music production and policy (his day job is Head of Policy at a radio industry body) but not a developer. Explain technical decisions clearly. When making architectural choices, briefly say why. Don't assume knowledge of npm, git, or React internals — explain when relevant.

# Audio architecture

These rules govern everything under `src/audio/` and any React code that touches it.
Several are counterintuitive; follow them even where the alternative looks tidier.

## Hard rules

1. **No React, no DOM in `src/audio/`.** Files under `src/audio/` must not import React,
   reference `document`/`window`, or read from the DOM. They are plain ES modules that take
   an `AudioContext` and return imperative APIs. If a module needs a value from the UI, it
   is passed in as an argument.

2. **The engine lives in a ref, never in state.** Store engine and part objects in
   `useRef`. Never put an audio parameter value in React state in a way that causes a
   re-render on every change. A knob drag fires ~60 pointermove events per second; running
   the reconciler on each one competes with the audio thread and causes audible glitching.
   Components may hold their own displayed value in state, but the write to the engine is
   an imperative `setParam` call, not a prop flowing down.

3. **One AudioContext for the whole application**, created lazily inside a user gesture and
   guarded by a promise so concurrent callers do not construct two. See `ensureAudio()` in
   the reference build for the shape. Never construct a context at module load: browsers
   will create it suspended and the first note will be swallowed.

4. **All parameter changes are scheduled on AudioParams**, using `setTargetAtTime`,
   `linearRampToValueAtTime`, `setValueAtTime` or `cancelAndHoldAtTime`. Never write audio
   values from a `setInterval` or `requestAnimationFrame` loop. If a value needs to change
   continuously, it is a signal (a node connected to a param), not a JavaScript variable
   polled on a timer.

5. **Timing comes from the transport.** All musical timing – sequencer, arpeggiator, LFO
   sync, delay sync, metronome – derives from `src/audio/transport.js` and its lookahead
   scheduler. No module may start its own `setTimeout` loop to schedule notes. Timer
   callbacks decide *what* to schedule; the audio clock decides *when* it sounds.

6. **Never write two independent values to the same AudioParam.** AudioParams sum all
   connected inputs, which is how the filter cutoff can carry a knob value, an envelope
   offset and matrix modulation at once. But two writers *scheduling* on the same param
   will fight. If a new control needs to affect something already scheduled, insert another
   node in series (this is why tremolo has its own gain stage after the amp envelope, and
   why noise level has a separate `noiseMod` gain).

7. **Presets are flat dotted-key JSON with a `version` field.** Loading resets to defaults
   first, then overlays the file, so preset files may be sparse and older files keep
   working when new parameters are added. Never write a loader that assumes every key is
   present.

## Structural conventions

- **Per-part vs shared.** Anything that belongs to a patch's character lives in the part
  (oscillators, filter, envelopes, drive, bitcrush insert, send amounts). Anything that
  belongs to the mix lives in the mixer and is shared by all parts (delay, chorus, reverb,
  limiter, master, analyser, recorder). Do not instantiate a reverb per part.

- **Modulation destinations are arrays of AudioParams.** A single destination may fan out
  to several params (each oscillator unit holds two oscillators for wavetable
  interpolation, so a pitch destination touches two detune params per unit). Destination
  lookup functions return arrays even when the array has one element.

- **Per-voice modulation sources wire per voice.** The aux envelope is a per-voice
  `ConstantSource`; a matrix slot using it connects voice *i*'s envelope to voice *i*'s
  destination param, so each note modulates only itself. Global sources (LFOs, mod wheel)
  use one gain node fanned out to all voices. These two paths are deliberately separate.

- **Note-static modulation is sampled at note-on.** Velocity and keytrack are numbers that
  only exist when a note fires; they are folded into the voice's base pitch and cutoff
  rather than streamed through the graph. Trigger-time destinations (filter env amount, amp
  decay, amp sustain) are read at the same moment. Audio-rate sources cannot reach them.

- **The bitcrusher AudioWorklet is loaded from a Blob URL**, not a file path. This is
  deliberate: it works identically in dev and in the GitHub Pages build without any
  `base`-path handling. Do not "improve" it into a `?worker&url` import.

- **The worklet module is loaded before the graph is constructed**, and the node is wired
  synchronously. Do not load asynchronously and swap the node in later: a failed load then
  leaves controls connected to nothing, silently.

## Performance notes

- Oscillator count multiplies fast: parts × voices × 2 units × 2 oscillators per unit.
  Default voice pools should be sized to the part's job (a bass part needs 1–2, a chord
  part 6) rather than uniformly maximal.

- Analysis drawing (scopes, response curves, voice LEDs) runs at half frame rate and should
  stay that way. Canvas work on the main thread competes with audio.

- Keep the master level at or below about 70 % so the limiter is not in sustained gain
  reduction, which modulates gain within waveform cycles and sounds like distortion.

## Verification

There is a dev-only route at `#/synth` that mounts the standalone synthesiser panel against
the extracted engine modules. After any change to `src/audio/`, that route must still sound
identical to `reference/web-synth-v11.html`. It is the regression target for the whole
audio layer – check it before wiring anything into the Workbench UI.

`scripts/render-compare.mjs` makes that check objective. It renders the same note sequence
through the reference engine and through `src/audio/synth/`, offline in headless Chromium,
for every factory preset, and compares the samples. Run it after any change to the audio
layer:

```
npm install --no-save playwright     # not a project dependency
node scripts/render-compare.mjs
```

Chromium's own rendering is not bit-reproducible between two OfflineAudioContexts, so the
pass threshold is that noise floor (1e-4, about -80 dB) rather than zero. `CONTROL=1` runs
the reference against itself to show the baseline.

## Decisions taken during the integration

These deviate from `docs/synth-integration-brief.md` where the Workbench as it stands
made the brief's assumption wrong. The brief is the plan; this is what was actually done.

- **The synth engine lives in `src/audio/synth/`, not `src/audio/` directly.** The brief
  assumed an empty `src/audio/`. It already holds the Tone.js engine and its own
  `presets.js`, which the synth's `presets.js` would have clobbered. The rules above apply
  to the whole of `src/audio/` regardless.

- **Tone.js stays, and shares one AudioContext with the synth.** `src/audio/context.js`
  creates the single native AudioContext inside a user gesture and hands it to Tone
  (`Tone.setContext`) as well as to the synth engine. Tone keeps driving the drums, the
  sequencer scheduling and MIDI clock; the synth engine provides the tonal voices. Two
  contexts would mean two clocks and no way to schedule synth notes against the sequencer.

- **`transport.js` wraps `Tone.Transport` rather than replacing it.** It exposes the
  `subscribe(cb) → unsubscribe` contract from the brief, with `cb(beat, audioTime)` in
  audio-clock time. The arpeggiator's own `setTimeout` loop becomes one subscriber. Rule 5
  above holds: modules schedule against the audio clock and never start their own loops.

- **The route is `#/synth`, not `/synth`.** The app has no router and GitHub Pages serves
  it from a sub-path, so a hash route works identically in dev and on Pages without adding
  a routing dependency or any `base`-path handling.
