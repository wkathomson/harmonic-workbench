# Harmonic Workbench

## What this is
A browser-based music theory sandbox and idea generator for electronic music producers. Built as a React app. The user (Will) is a music producer, DJ, and monthly radio host — not a developer. He programs notes into hardware sequencers (Dirtywave M8, Polyend Tracker) and DAWs (Ableton Live) but doesn't play an instrument, so he needs tools that help him understand what notes/chords work together and generate musical ideas he can export as MIDI.

## Current state
The file `prototype.jsx` contains the complete v5 single-file prototype built iteratively in Claude.ai artifacts. It works but is reaching the limits of single-file architecture. This project is the proper multi-file port.

## Tech stack
- React (Vite)
- Tone.js for audio (replaces raw Web Audio API from the prototype — gives us proper synth sounds, 303 filter emulation, transport sync, effects)
- WebMidi.js for live MIDI output (future)
- No UI framework — custom CSS, dark theme with warm tones inspired by hardware music gear (Teenage Engineering, Elektron aesthetic)

## Design principles
- **Speed over polish**: the app should answer "what can I put here?" fast enough not to break creative flow
- **Sound first**: everything should be audible immediately on click — no silent UI
- **Export-oriented**: the real value is generating MIDI clips to drop into Ableton/M8/Polyend
- **Educational but optional**: theory explanations available on demand, never in the way
- **Instrument-grade aesthetic**: dark background, monospace type for data, serif for headings, warm orange accent colour, collapsible sections for density control

## Features to port from prototype

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

## Improvements to make in the proper version

### Audio
- Replace raw Web Audio oscillators with Tone.js synths
- Proper 303 emulation: Tone.MonoSynth with filter envelope, portamento for slides, accent via velocity
- Better piano/pad sounds using Tone.PolySynth
- Proper transport sync using Tone.Transport instead of setTimeout scheduling
- Add reverb/delay sends for melody and arp

### Architecture
- Split into modules: `src/audio/`, `src/theory/`, `src/components/`, `src/utils/`
- Separate component files for PianoRoll, ChordPalette, Progression, Sequencer, etc.
- Theory engine as pure functions in its own module
- Audio engine as a singleton service

### Future features (not for initial port)
- Percussion/drum machine with step sequencer
- Swing/humanisation on export
- Snapshots (save/recall progression + settings)
- Web MIDI output to connected soft synths
- Global transpose control
- Density macro (single knob controlling overall busyness)
- Pattern length per chord (1x, 2x, 0.5x)

## Communication style
Will is knowledgeable about music production and policy (his day job is Head of Policy at a radio industry body) but not a developer. Explain technical decisions clearly. When making architectural choices, briefly say why. Don't assume knowledge of npm, git, or React internals — explain when relevant.
