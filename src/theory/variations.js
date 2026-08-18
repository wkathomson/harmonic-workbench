// Progression-variation engine.
//
// Given a progression, generate a handful of musically-related alternatives.
// Each variation uses a single, named strategy so the user can see *why*
// it's different — this is a teaching tool as much as a generator.
//
// Strategies:
//   • Rotate     — start the progression on a different chord (changes
//                  emotional arc without changing the chord set)
//   • Substitute — swap one chord for a diatonic relative from the same
//                  function family (tonic / subdominant / dominant)
//   • Borrow     — swap one chord for its parallel-mode counterpart
//                  (introduces one out-of-scale note; surprising but musical)
//
// The output is a list of { label, description, prog } objects. `prog` is
// shaped exactly like App's chord array so it can drop straight in.

import { getDiatonic, getBorrowed, makeChord, getRoman } from "./chords.js";
import { SCALES } from "./constants.js";

// Function families per scale degree. Chords inside the same family share a
// musical role and substitute well for each other.
//
// Major-key families:
//   Tonic       — I, iii, vi          (degrees 0, 2, 5)
//   Subdominant — ii, IV              (degrees 1, 3)
//   Dominant    — V, vii°             (degrees 4, 6)
//
// Minor-key families work the same shape, just with shifted qualities.
const FUNCTION_FAMILIES = [
  [0, 2, 5],   // tonic
  [1, 3],      // subdominant
  [4, 6],      // dominant
];

// Find which family a degree belongs to.
function familyOf(degree) {
  return FUNCTION_FAMILIES.find(f => f.includes(degree));
}

// Replace chord at index `i` with a diatonic chord at degree `newDegree`.
// Preserves the existing chord's rhythm and identity (id stays the same so
// React can keep the DOM node — though App regenerates ids on apply anyway).
function replaceWithDegree(prog, i, newDegree, dCh, rom) {
  const old = prog[i];
  const fresh = dCh[newDegree];
  if (!fresh) return null;
  return prog.map((ch, j) => j === i ? {
    ...fresh,
    rhythm: old.rhythm,
    roman: rom[newDegree],
    source: "diatonic",
  } : ch);
}

// Try each chord in the progression: if it has a sibling in the same
// function family, that's a candidate substitution. Picks the chord with
// the most siblings (= most options to substitute with).
function buildSubstitution(prog, rootNote, scaleKey, ext, baseMidi) {
  const dCh = getDiatonic(rootNote, scaleKey, ext, baseMidi);
  const rom = getRoman(scaleKey);

  // Find each chord's degree in the diatonic set (matches by root+quality).
  const degrees = prog.map(ch => {
    const idx = dCh.findIndex(d => d.root === ch.root && d.quality === ch.quality);
    return idx === -1 ? null : idx;
  });

  // Skip the first chord (it anchors the progression). Find a middle chord
  // with siblings in its family.
  for (let i = 1; i < prog.length; i++) {
    const deg = degrees[i];
    if (deg == null) continue;
    const family = familyOf(deg);
    if (!family) continue;
    const siblings = family.filter(d => d !== deg);
    if (!siblings.length) continue;
    const newDeg = siblings[Math.floor(Math.random() * siblings.length)];
    const newProg = replaceWithDegree(prog, i, newDeg, dCh, rom);
    if (!newProg) continue;
    const oldRoman = rom[deg];
    const newRoman = rom[newDeg];
    return {
      label: "Substitute",
      description: `Swap ${oldRoman} for ${newRoman} (same family)`,
      prog: newProg,
    };
  }
  return null;
}

// Rotate — start the progression on a different chord. Choose a non-trivial
// rotation (offset 1, 2, or N-1) so the result actually feels different.
function buildRotation(prog) {
  if (prog.length < 3) return null;
  // Prefer a 1- or 2-step rotation; fall back to N-1 if those would be no-ops
  // (shouldn't happen, but defensive).
  const offsets = [1, 2, prog.length - 1].filter(o => o > 0 && o < prog.length);
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  const rotated = [...prog.slice(offset), ...prog.slice(0, offset)];
  return {
    label: "Rotate",
    description: `Same chords, starts on ${rotated[0].roman || rotated[0].symbol}`,
    prog: rotated,
  };
}

// Borrow — replace one diatonic chord with its parallel-mode equivalent.
// Looks for a borrowed chord that shares the same scale degree as one of
// the existing diatonic chords, then swaps them.
function buildBorrow(prog, rootNote, scaleKey, ext, baseMidi) {
  const par = SCALES[scaleKey].par;
  if (!par) return null;
  const borrowed = getBorrowed(rootNote, scaleKey, ext, baseMidi);
  if (!borrowed.length) return null;

  const dCh = getDiatonic(rootNote, scaleKey, ext, baseMidi);

  // Match each diatonic chord against borrowed-chord roots. Same root =
  // borrowing the parallel-mode flavour at the same degree.
  for (let i = 1; i < prog.length; i++) {
    const ch = prog[i];
    const dDeg = dCh.findIndex(d => d.root === ch.root && d.quality === ch.quality);
    if (dDeg === -1) continue;
    const candidate = borrowed.find(b => b.root === ch.root);
    if (!candidate) continue;
    const newProg = prog.map((c, j) => j === i ? {
      ...candidate,
      rhythm: c.rhythm,
      roman: candidate.roman,
      source: "borrowed",
    } : c);
    return {
      label: "Borrow",
      description: `Swap ${ch.roman || ch.symbol} for ${candidate.roman} (from parallel ${SCALES[par].name.split(" ")[0]})`,
      prog: newProg,
    };
  }

  // Fallback: if no same-root borrowing matched, just slot a borrowed chord
  // in for the second-to-last chord. Strong cadential effect.
  if (prog.length >= 2) {
    const i = prog.length - 2;
    const candidate = borrowed[Math.floor(Math.random() * borrowed.length)];
    const newProg = prog.map((c, j) => j === i ? {
      ...candidate,
      rhythm: c.rhythm,
      roman: candidate.roman,
      source: "borrowed",
    } : c);
    return {
      label: "Borrow",
      description: `Drop in ${candidate.roman} before the resolution`,
      prog: newProg,
    };
  }

  return null;
}

// Reharmonise — substitute multiple chords at once, each from its function
// family. More dramatic than a single-chord swap; the progression keeps its
// overall shape (tonic→sub→dom→tonic feel) but the colours change.
function buildReharmonise(prog, rootNote, scaleKey, ext, baseMidi) {
  if (prog.length < 3) return null;
  const dCh = getDiatonic(rootNote, scaleKey, ext, baseMidi);
  const rom = getRoman(scaleKey);

  const degrees = prog.map(ch => {
    const idx = dCh.findIndex(d => d.root === ch.root && d.quality === ch.quality);
    return idx === -1 ? null : idx;
  });

  // Walk the progression; for every middle chord with siblings, swap to a
  // sibling. First chord stays put as the harmonic anchor.
  let newProg = [...prog];
  let swaps = 0;
  for (let i = 1; i < prog.length; i++) {
    const deg = degrees[i];
    if (deg == null) continue;
    const family = familyOf(deg);
    if (!family) continue;
    const siblings = family.filter(d => d !== deg);
    if (!siblings.length) continue;
    const newDeg = siblings[Math.floor(Math.random() * siblings.length)];
    const swapped = replaceWithDegree(newProg, i, newDeg, dCh, rom);
    if (!swapped) continue;
    newProg = swapped;
    swaps++;
  }
  if (swaps < 2) return null; // not enough substitutions to feel like a reharm
  return {
    label: "Reharmonise",
    description: `Swap ${swaps} chords for diatonic relatives — same shape, new colours`,
    prog: newProg,
  };
}

// Cadence — make sure the progression ends with a strong V → I (or v → i).
// Replaces the last chord with the tonic and the second-to-last with the
// dominant. Skipped if the progression already ends that way.
function buildCadence(prog, rootNote, scaleKey, ext, baseMidi) {
  if (prog.length < 2) return null;
  const dCh = getDiatonic(rootNote, scaleKey, ext, baseMidi);
  const rom = getRoman(scaleKey);

  const last = prog.length - 1;
  const second = prog.length - 2;
  const lastDeg   = dCh.findIndex(d => d.root === prog[last].root && d.quality === prog[last].quality);
  const secondDeg = dCh.findIndex(d => d.root === prog[second].root && d.quality === prog[second].quality);

  if (lastDeg === 0 && secondDeg === 4) return null; // already a V→I cadence

  let next = replaceWithDegree(prog,  last,   0, dCh, rom);  // tonic
  if (!next) return null;
  next     = replaceWithDegree(next,  second, 4, dCh, rom);  // dominant
  if (!next) return null;
  return {
    label: "Add cadence",
    description: `End on ${rom[4]} → ${rom[0]} for a strong resolution`,
    prog: next,
  };
}

// Double-time — duplicate every chord in place. The progression sounds the
// same but each chord lasts half as long, making it feel busier / more urgent.
// (No actual chord change — just rhythmic re-shaping.)
function buildDoubleTime(prog) {
  if (prog.length < 2 || prog.length > 6) return null; // > 6 gets unwieldy
  const out = [];
  prog.forEach(ch => {
    out.push({ ...ch });
    out.push({ ...ch, rhythm: null }); // strip rhythm on the duplicate so it just hits once
  });
  return {
    label: "Double-time",
    description: "Each chord plays twice — busier, more urgent",
    prog: out,
  };
}

// Public API: return up to 6 variations, one per strategy. Filters out any
// that came back null (e.g. progression too short for the strategy).
export function suggestVariations(prog, rootNote, scaleKey, ext, baseMidi) {
  if (!prog?.length) return [];
  const candidates = [
    buildSubstitution(prog, rootNote, scaleKey, ext, baseMidi),
    buildReharmonise(prog, rootNote, scaleKey, ext, baseMidi),
    buildRotation(prog),
    buildBorrow(prog, rootNote, scaleKey, ext, baseMidi),
    buildCadence(prog, rootNote, scaleKey, ext, baseMidi),
    buildDoubleTime(prog),
  ];
  return candidates.filter(Boolean);
}
