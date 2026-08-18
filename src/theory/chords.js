// Pure functions for deriving scales, chords, inversions and transpositions.

import { NOTE_NAMES, SCALES, PENTA, CHORD_FORMULAS, CHORD_SUFFIX } from "./constants.js";

// Return the pitch-class set for a given root + scale.
export function getScaleNotes(root, scaleKey) {
  return SCALES[scaleKey].iv.map(i => (root + i) % 12);
}

// Return pitch-class set for a pentatonic mode (major/minor) at a given root.
export function getPentaNotes(root, pentaType) {
  return PENTA[pentaType].map(i => (root + i) % 12);
}

// Decide which pentatonic to use over a chord. `pref` may be "auto" | "major" | "minor".
export function pentaFor(chord, pref) {
  if (pref !== "auto") return pref;
  return chord.quality === "maj" || chord.quality === "aug" ? "major" : "minor";
}

// Roman numeral labels for diatonic degrees in a given scale.
export function getRoman(scaleKey) {
  const q = SCALES[scaleKey].cq;
  const R = ["I", "II", "III", "IV", "V", "VI", "VII"];
  return q.map((qu, i) => {
    if (qu === "maj") return R[i];
    if (qu === "aug") return R[i] + "+";
    if (qu === "min") return R[i].toLowerCase();
    return R[i].toLowerCase() + "°";
  });
}

// Chord symbol for a root + quality + extension.
export function chordSymbol(rootName, quality, ext) {
  return rootName + (CHORD_SUFFIX[ext][quality] || "");
}

// Apply inversion to an ordered MIDI-note list. Positive = move lowest up. Negative = move highest down.
export function applyInversion(midi, inv) {
  if (inv === 0) return [...midi];
  const n = [...midi];
  for (let i = 0; i < Math.abs(inv); i++) {
    if (inv > 0) {
      const b = n.shift();
      n.push(b + 12);
    } else {
      const t = n.pop();
      n.unshift(t - 12);
    }
  }
  return n;
}

// Build a chord object (notes, symbol, pitch classes) from root + quality + extension + inversion.
export function makeChord(root, quality, ext, inv = 0, baseMidi = 48) {
  const formula = CHORD_FORMULAS[ext][quality] || CHORD_FORMULAS.triad[quality];
  const midi = applyInversion(formula.map(i => baseMidi + root + i), inv);
  return {
    root,
    quality,
    ext,
    inv,
    rootName: NOTE_NAMES[root],
    pitchClasses: [...new Set(midi.map(m => m % 12))],
    midiNotes: midi,
    symbol: chordSymbol(NOTE_NAMES[root], quality, ext),
    baseMidi,
  };
}

// All 7 diatonic chords of a scale.
export function getDiatonic(root, scaleKey, ext = "triad", baseMidi = 48) {
  const scale = SCALES[scaleKey];
  const sn = scale.iv.map(i => (root + i) % 12);
  return scale.cq.map((q, degree) => {
    const ch = makeChord(sn[degree], q, ext, 0, baseMidi);
    ch.degree = degree;
    return ch;
  });
}

// Borrowed chords from the parallel mode — only those containing at least one out-of-scale note.
export function getBorrowed(root, scaleKey, ext = "triad", baseMidi = 48) {
  const par = SCALES[scaleKey].par;
  if (!par) return [];
  const parChords = getDiatonic(root, par, ext, baseMidi);
  const currentScale = getScaleNotes(root, scaleKey);
  const parRomans = getRoman(par);
  return parChords
    .map((c, i) => ({ ...c, roman: parRomans[i], parScale: par }))
    .filter(c => c.pitchClasses.some(p => !currentScale.includes(p)));
}

// Transpose a chord by `semi` semitones and flag whether it stays diatonic to `scaleNotes`.
export function transposeInfo(chord, semi, scaleNotes) {
  const newRoot = (chord.root + semi + 120) % 12;
  const newChord = makeChord(newRoot, chord.quality, chord.ext, chord.inv, chord.baseMidi || 48);
  const octAdj = Math.round((chord.root + semi - newRoot) / 12);
  newChord.midiNotes = newChord.midiNotes.map(m => m + octAdj * 12);
  return { ...newChord, semi, inScale: newChord.pitchClasses.every(p => scaleNotes.includes(p)) };
}

// ---- Smart voicings ------------------------------------------------------
//
// Given a progression, re-voice each chord (after the first) to minimise the
// movement between adjacent chords. Producers call this "voice leading":
// smaller jumps between voices = smoother-sounding progressions.
//
// Strategy: for chord N, generate candidate voicings (every inversion + ±12
// octave shifts), score each against chord N-1, pick the lowest score.

// Score = how "far" the candidate is from the previous chord. Lower = better.
function scoreVoicing(prev, candidate) {
  // Top voice (the highest note) carries the strongest melodic line — keep it close.
  const topMove = Math.abs(prev[prev.length - 1] - candidate[candidate.length - 1]);
  // Bass movement matters but less than top movement for voice leading.
  const bassMove = Math.abs(prev[0] - candidate[0]);
  // "Cloud" distance: each candidate note's nearest prev note. Captures inner-voice motion.
  let cloud = 0;
  for (const m of candidate) {
    let nearest = Infinity;
    for (const p of prev) {
      const d = Math.abs(m - p);
      if (d < nearest) nearest = d;
    }
    cloud += nearest;
  }
  return topMove * 3 + bassMove * 1.5 + cloud * 0.5;
}

// Build every voicing candidate worth considering for one chord.
function voicingCandidates(chord) {
  const baseMidi = chord.baseMidi ?? 48;
  const base = makeChord(chord.root, chord.quality, chord.ext, 0, baseMidi);
  const n = base.midiNotes.length;
  const out = [];
  // Inversions from -2 (drop two notes down) through n-1 (full upward inversion).
  for (let inv = -2; inv < n; inv++) {
    const midi = applyInversion(base.midiNotes, inv);
    // Plus ±12 octave shifts on the whole voicing for register matching.
    for (const shift of [-12, 0, 12]) {
      out.push({ inv, midiNotes: midi.map(m => m + shift) });
    }
  }
  return out;
}

// Re-voice the progression using nearest-voicing voice leading. The first
// chord stays untouched (it's the "anchor"); each subsequent chord picks the
// inversion + octave that's closest to its predecessor.
//
// Returns a new array of chord objects with `midiNotes` and `inv` replaced.
// All other fields (id, roman, source, rhythm, symbol, etc.) are preserved.
export function smoothVoicings(prog) {
  if (prog.length < 2) return prog.map(ch => ({ ...ch }));
  const out = [{ ...prog[0] }];
  for (let i = 1; i < prog.length; i++) {
    const ch = prog[i];
    const prev = out[i - 1];
    const cands = voicingCandidates(ch);
    let best = cands[0];
    let bestScore = scoreVoicing(prev.midiNotes, best.midiNotes);
    for (let j = 1; j < cands.length; j++) {
      const s = scoreVoicing(prev.midiNotes, cands[j].midiNotes);
      if (s < bestScore) { bestScore = s; best = cands[j]; }
    }
    out.push({ ...ch, midiNotes: best.midiNotes, inv: best.inv });
  }
  return out;
}
