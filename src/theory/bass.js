// Bass pattern generators.
//
// Each generator returns an array of length `steps`, where each entry is either
// `null` (rest) or `{ midi, accent, slide }`.
//
// The patterns are designed around a 4-beat bar — `stepsPerBeat = steps / 4` —
// so the same pattern feels right at 8 / 16 / 32 step resolutions:
//   - 8  steps = eighth notes
//   - 16 steps = sixteenths
//   - 32 steps = 32nds
//
// `octRoot` is the absolute MIDI number for the chord's root note in the bass
// register (e.g. midi 36 = C2 for C-rooted chord). Patterns build pitches
// relative to that anchor so the bass octave selector in the UI works.

// ---- Chord → pitch class helpers ----------------------------------------

// Returns root-relative semitone offsets for the chord's third / fifth / seventh.
// Defaults are sensible musical choices when the chord doesn't specify them.
function chordOffsets(chord) {
  const q = chord.quality;
  const third = (q === "min" || q === "dim") ? 3 : 4;
  const fifth = q === "dim" ? 6 : q === "aug" ? 8 : 7;
  // Seventh: maj7 over major, dom7 (b7) over minor/dim by default. Bass usually
  // outlines the chord without the seventh, but it's available for richer patterns.
  const seventh = (q === "maj" || q === "aug") ? 11 : 10;
  return { third, fifth, seventh };
}

// ---- Helpers ------------------------------------------------------------

const empty = (steps) => Array(steps).fill(null);

const place = (arr, i, midi, accent = false, slide = false) => {
  const idx = Math.round(i);
  if (idx >= 0 && idx < arr.length) arr[idx] = { midi, accent, slide };
};

// ---- Patterns -----------------------------------------------------------

// One root note on beat 1. Foundational, leaves room for everything else.
function patAnchor(chord, steps, octRoot) {
  const a = empty(steps);
  place(a, 0, octRoot, true);
  return a;
}

// Root on every beat. The classic four-on-the-floor club bass.
function patPulse(chord, steps, octRoot) {
  const a = empty(steps);
  const sb = steps / 4;
  for (let b = 0; b < 4; b++) place(a, b * sb, octRoot, b === 0);
  return a;
}

// Root on the &s — house/disco feel where the kick lives on the beats.
function patOffbeat(chord, steps, octRoot) {
  const a = empty(steps);
  const sb = steps / 4;
  for (let b = 0; b < 4; b++) place(a, b * sb + sb / 2, octRoot, false);
  return a;
}

// Walking line: R - 5(below) - R(8va) - 5. Jazz/funk feel.
function patWalking(chord, steps, octRoot) {
  const a = empty(steps);
  const { fifth } = chordOffsets(chord);
  const sb = steps / 4;
  // 5th below the root: octRoot - (12 - fifth). For dominants/majors with fifth=7
  // this yields octRoot - 5. Safe for dim too.
  const fifthBelow = octRoot - (12 - fifth);
  const fifthAbove = octRoot + fifth;
  place(a, 0,        octRoot, true);
  place(a, sb,       fifthBelow);
  place(a, sb * 2,   octRoot + 12);
  place(a, sb * 3,   fifthAbove);
  return a;
}

// R-3-5-8 broken chord, one note per beat. Outlines the harmony clearly.
function patArpeggio(chord, steps, octRoot) {
  const a = empty(steps);
  const { third, fifth } = chordOffsets(chord);
  const seq = [octRoot, octRoot + third, octRoot + fifth, octRoot + 12];
  const sb = steps / 4;
  for (let b = 0; b < 4; b++) place(a, b * sb, seq[b], b === 0);
  return a;
}

// Root + octave bounce with 16th-note ghosts on the &s.
function patBouncy(chord, steps, octRoot) {
  const a = empty(steps);
  const sb = steps / 4;
  place(a, 0,            octRoot, true);
  place(a, sb * 0.5,     octRoot + 12);            // ghost up
  place(a, sb * 2,       octRoot + 12, true);      // accented up on beat 3
  place(a, sb * 2.5,     octRoot);                 // ghost down
  place(a, sb * 3.5,     octRoot + 12);            // pickup to next bar
  return a;
}

// Every step is the root, beats accented, occasional octave on the upbeats.
// Driving 16ths feel — like a Moroder / italo / techno bass.
function patDriving(chord, steps, octRoot) {
  const a = empty(steps);
  const sb = steps / 4;
  for (let i = 0; i < steps; i++) {
    const onBeat = (i % sb) === 0;
    // Pop the octave on the &-of every beat for shape
    const onAnd = Math.abs((i % sb) - sb / 2) < 0.001;
    const midi = onAnd ? octRoot + 12 : octRoot;
    place(a, i, midi, onBeat);
  }
  return a;
}

// Sparse dub-style: long sustain on 1 with slide, octave hit on 3, ghost pickup.
function patDub(chord, steps, octRoot) {
  const a = empty(steps);
  const { fifth } = chordOffsets(chord);
  const sb = steps / 4;
  place(a, 0,            octRoot, true, true);          // root with slide
  place(a, sb * 2,       octRoot + 12, false, false);   // octave on beat 3
  place(a, sb * 3.5,     octRoot - (12 - fifth));        // fifth-below pickup
  return a;
}

// Classic syncopated R + &-of-2 + 4. Lives behind house/funk drums.
function patSyncopated(chord, steps, octRoot) {
  const a = empty(steps);
  const sb = steps / 4;
  place(a, 0,            octRoot, true);
  place(a, sb * 1.5,     octRoot);
  place(a, sb * 3,       octRoot, false, false);
  // Small ghost on the &-of-4 for the loop-around feel
  place(a, sb * 3.75,    octRoot + 12);
  return a;
}

// 303-style random acid bass. Per-step random from root/fifth/octave/lower-fifth
// with stochastic accent + slide. Density controls how busy the line is.
function genAcidBass(chord, steps, octRoot, density = 0.6) {
  const { fifth } = chordOffsets(chord);
  const notes = [octRoot, octRoot + 12, octRoot + fifth, octRoot - (12 - fifth)];
  return Array(steps).fill(null).map(() => {
    if (Math.random() > density) return null;
    return {
      midi: notes[Math.floor(Math.random() * notes.length)] + (Math.random() < 0.15 ? 12 : 0),
      accent: Math.random() < 0.3,
      slide:  Math.random() < 0.25,
    };
  });
}

// ---- Public API ---------------------------------------------------------

// Each entry: key for state + UI label.
export const BASS_MODES = [
  { v: "anchor",     l: "Anchor"   },
  { v: "pulse",      l: "Pulse"    },
  { v: "offbeat",    l: "Offbeat"  },
  { v: "walking",    l: "Walking"  },
  { v: "arpeggio",   l: "Arp"      },
  { v: "bouncy",     l: "Bouncy"   },
  { v: "driving",    l: "Driving"  },
  { v: "dub",        l: "Dub"      },
  { v: "syncopated", l: "Sync"     },
  { v: "acid",       l: "🔥 Acid"   },
];

const PATTERNS = {
  anchor:     patAnchor,
  pulse:      patPulse,
  offbeat:    patOffbeat,
  walking:    patWalking,
  arpeggio:   patArpeggio,
  bouncy:     patBouncy,
  driving:    patDriving,
  dub:        patDub,
  syncopated: patSyncopated,
};

// Generate a bass pattern for one chord.
//
// `mode`    — one of the BASS_MODES keys
// `chord`   — { root, quality, ... }
// `steps`   — total step count (8 / 16 / 32)
// `octRoot` — bass-register MIDI number for this chord's root (e.g. 24 + root for C1, 36 + root for C2)
export function genBass(mode, chord, steps, octRoot) {
  if (mode === "acid") return genAcidBass(chord, steps, octRoot);
  const fn = PATTERNS[mode] || patAnchor;
  return fn(chord, steps, octRoot);
}
