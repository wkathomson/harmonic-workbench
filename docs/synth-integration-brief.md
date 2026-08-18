# Workbench Voice → Harmonic Workbench: integration brief

**Repo:** `wkathomson/harmonic-workbench` (Vite + React, deployed to GitHub Pages)
**Source:** `reference/web-synth-v11.html` – a complete, self-contained subtractive
synthesiser built over nine stages. Engine and UI are cleanly separated inside that single
file: everything from the top of the module script down to the end of `createSynth` is the
engine and contains no DOM references.

**Goal:** the synth becomes the voice engine for Harmonic Workbench parts (bass, chords,
lead), sharing one AudioContext, one effects bus and one transport.

**Approach:** this is a file split followed by two architectural changes, not a rewrite.
Four commits of pure addition before anything existing is touched.

---

## Phase 0 – Prerequisites

1. Copy `web-synth-v11.html` into the repo as `reference/web-synth-v11.html` and commit it.
   Claude Code works from the file tree; without this the source is not available to it.
2. Append the audio architecture section to `CLAUDE.md`.
3. Branch: `git checkout -b synth-engine`.

Do not skip step 1. It is the difference between a five-minute task and pasting 140 KB into
a prompt.

---

## Phase 1 – Extract the engine unchanged

**Outcome:** the engine exists as ES modules; nothing has changed behaviourally.

Target layout:

```
src/audio/
  constants.js     DEFAULTS, DEFAULT_SLOTS, DEST_SCALE, SYNC_DIVS, ARP_DIVS,
                   PAN_POS, POOL_SIZE, ENV_OCTAVES, VEL_OCTAVES, KEY_CENTRE,
                   STEAL_FADE, VOICE_HEADROOM, SH_STEPS, SH_STEP_HZ, MORPH_*
  util.js          clamp, timeConstant, cancelHold
  curves.js        generateNoise, makeDriveCurve, makePulseCurve, harmonicsAt, fmDepth
  crusher.js       CRUSHER_SRC (worklet source string) + loadCrusher(ctx)
  oscUnit.js       createOscUnit
  voice.js         createVoice
  lfo.js           createLFO
  synth.js         createSynth
  presets.js       FACTORY, applyPreset, validatePreset
```

Rules for this phase:

- No behaviour changes. No renames beyond what module boundaries require.
- No React imports anywhere in `src/audio/`.
- `createSynth(ctx, crusherReady)` keeps its current signature for now.

**Verification target:** add a dev-only route at `/synth` mounting a minimal React wrapper
that constructs the engine on first gesture and provides a keyboard plus the existing panel
controls. It must sound identical to the reference HTML. Keep this route permanently – it
is the regression harness for every phase that follows.

**Suggested prompt:**

> Read `reference/web-synth-v11.html` and `CLAUDE.md`. Extract the audio engine into ES
> modules under `src/audio/` following the layout in `docs/synth-integration-brief.md`,
> changing no behaviour. Then add a dev-only route at `/synth` mounting a minimal React
> wrapper that instantiates the engine and exposes a playable keyboard, so I can verify it
> sounds identical. Do not port the full panel UI yet.

---

## Phase 2 – Split per-part from shared

**Outcome:** one `createPart` per Workbench part, one shared `createMixer`.

The reference build puts the whole chain inside `createSynth`. With three parts that means
three reverbs, three limiters and three analysers. Split along the line "does this belong to
the sound, or to the mix":

| Per part (`createPart`)                      | Shared (`createMixer`)                    |
| -------------------------------------------- | ----------------------------------------- |
| voice pool, filter, envelopes, matrix, LFOs   | delay, chorus, reverb                     |
| drive, bitcrush insert                        | limiter, master gain, analyser            |
| part level, pan                               | recorder tap (MediaStreamDestination)     |
| send **amounts** to each shared bus           | effect **settings** (time, size, damping) |

### Proposed contracts

```js
// mixer.js
createMixer(ctx) → {
  input,                       // GainNode: parts connect their dry output here
  sends: { delay, chorus, reverb },   // GainNodes: parts connect sends here
  setParam(module, param, value),     // 'fx.*' and 'master.*'
  getScope(arr), getSpectrum(arr),
  get recStream(),
  getState(), setState(preset)
}

// part.js
createPart(ctx, mixer, opts) → {
  noteOn(note, velocity, time), noteOff(note, time),
  panic(), setPedal(down), setBend(semis), setModWheel(v),
  setModSlot(i, slot),
  setParam(module, param, value),     // everything except 'fx.*' effect settings
  getState(), setState(preset),
  effectiveCutoff(), getVoiceStates(),
  get held()
}
```

`opts` carries at least `{ poolSize }` so a bass part can allocate two voices rather than
eight.

Per-part send amounts stay in the part's preset (`fx.delaySend`, `fx.choSend`,
`fx.verbSend`); effect settings (`fx.delayTime`, `fx.verbSize`, `fx.choRate` …) move to the
mixer and are saved at project level.

**Migration:** `presets.js` must accept v11-format files, route effect-setting keys to the
mixer and keep send amounts on the part. Write this now, while the mapping is fresh.

**Verification:** `/synth` route builds one part plus a mixer and still sounds identical.

---

## Phase 3 – Hoist the transport

**Outcome:** one lookahead scheduler drives everything musical.

The arpeggiator currently runs its own `setTimeout` loop inside `createSynth`. Extract that
pattern into a shared module; the arp becomes one subscriber among several.

```js
// transport.js
createTransport(ctx) → {
  start(), stop(), isRunning(),
  setTempo(bpm), getTempo(),
  subscribe(cb) → unsubscribe,   // cb(beat, audioTime) per step in the lookahead window
  currentBeat()
}
```

Implementation notes:

- Keep the working numbers from the reference: 25 ms timer interval, 100 ms lookahead
  window. Timer jitter is absorbed by the window; scheduled notes stay sample-accurate.
- Subscribers receive audio-clock times and must schedule, never play immediately.
- Tempo changes should not cause scheduled events to jump; recompute forward only.
- LFO sync and delay sync read tempo from the transport rather than a `master.tempo`
  parameter duplicated per part.

Consumers after this phase: Workbench sequencer, arpeggiator, metronome, LFO sync, delay
sync, and any future tap-tempo UI.

**Verification:** on `/synth`, arp with sync divisions still locks; changing tempo mid-run
does not produce a stuck or doubled note.

---

## Phase 4 – Wire into the Workbench

Only now does existing Workbench code change.

- The Workbench owns the AudioContext, constructs the mixer once, and instantiates one part
  per Workbench voice (bass, chords, lead).
- The Workbench's note source replaces the synth keyboard: parts receive `noteOn`/`noteOff`
  with audio-clock times from transport subscribers.
- Part presets are stored inside the Workbench project file alongside the existing
  harmonic data; mixer settings sit at project level.
- UI: do **not** port the full 1970s panel per part. Each part gets a compact strip
  (waveform, cutoff, resonance, envelope shape, level, pan, three sends), with the full
  panel available in an "advanced" drawer reusing the components already built for
  `/synth`.

---

## Known gotchas

**Worklet loading.** The blob-URL approach in the reference is deliberate and Vite-proof: it
behaves identically in dev and in the Pages build with no `base`-path handling. Do not
convert it to a `?worker&url` import. Load the module *before* constructing the graph and
wire the node synchronously – the v9 build loaded it asynchronously and swapped it in later,
which meant a failed load silently left the controls connected to nothing.

**GitHub Pages base path.** `vite.config.js` sets a base for Pages deployment. Anything
loaded by URL must respect it. Another reason to keep the blob.

**AudioContext gesture requirement.** Construction and `resume()` must happen inside a user
gesture. Guard with a promise so concurrent callers (a knob drag and a key press arriving
together) do not build two contexts.

**Voice count arithmetic.** Parts × voices × 2 oscillator units × 2 oscillators per unit.
The wavetable interpolation in v11 doubled the oscillator count. Size pools per part.

**Preset schema fork.** Once effects go global, a v11 patch file's `fx.verbSize` no longer
belongs to the part. Handle it in the loader, versioned, not by hand-editing files later.

**MIDI learn mappings** are session-only in the reference build and deliberately not saved
into presets, since a patch should not carry assumptions about specific hardware. If they
should persist in the Workbench, store them at application level, not in the project file.

---

## Reference: what the engine already provides

Nine build stages, all present in `web-synth-v11.html`:

1. Single voice, filter with bipolar envelope amount, two ADSRs, exponential envelopes
2. Eight-voice pool with same-note / idle / longest-releasing / oldest stealing
3. Two oscillators plus white and pink noise, normalised mix bus
4. Keytracking, velocity → cutoff and → amplitude, pre-filter tanh drive
5. Poly / mono / unison, glide, pitch bend, Web MIDI including sustain pedal
6. Two LFOs (five shapes, tempo sync), four-slot modulation matrix
7. Pulse width via saw-plus-comparator, wavetable morph via PeriodicWave bank
8. Bitcrush AudioWorklet, feedback delay with in-loop tone filter, synthetic-IR reverb
9. Preset system: sparse flat JSON, factory bank, curated randomiser

Plus v10 and v11: typed parameter entry, note latch, fine pitch and note-on modulation
destinations, arpeggiator with lookahead scheduler, FM cross-modulation, aux envelope as a
per-voice modulation source, continuous wavetable interpolation, chorus, stereo voice
spread, master recorder, A/B patch compare, MIDI learn.

The single architectural thread throughout: every control rides an AudioParam on the audio
thread, and JavaScript only ever rewires the graph and schedules values. Preserve that and
the port will behave.
