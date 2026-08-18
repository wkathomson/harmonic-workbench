// Step-level note editing helpers.
//
// Used by Bass / Melody / Arp sequencers to nudge an individual step's
// pitch up or down within a sensible note set, or shift it by an octave.
// Each track has a different pool of "valid" pitches:
//   • Melody — current chord's pentatonic
//   • Arp    — current chord's tones (already a small set)
//   • Bass   — chord's root / third / fifth / octave in the bass register
//
// Returning the same shape as input keeps callers simple — they just swap
// the step in place with whatever this returns.

// Find the index of `value` in `pool`, or the closest match by pitch class.
// Returns -1 if `value` is null or pool is empty.
function nearestIndex(pool, value) {
  if (value == null || !pool?.length) return -1;
  const exact = pool.indexOf(value);
  if (exact !== -1) return exact;
  // Fallback: nearest by absolute distance, ties broken by lower index.
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const d = Math.abs(pool[i] - value);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Step a pitch up or down within a pool of valid pitches.
// `dir` is +1 or -1. Wraps at edges by jumping an octave so the user can
// keep stepping without dead-ending — feels more like a continuous knob.
//
//   pool — sorted ascending list of valid MIDI numbers (one octave's worth)
//   midi — current value
//   dir  — +1 (up) or -1 (down)
export function stepWithinPool(pool, midi, dir) {
  if (!pool?.length) return midi;
  const i = nearestIndex(pool, midi);
  const next = i + dir;
  if (next >= 0 && next < pool.length) return pool[next];
  // Wrap with octave shift so repeated wheel-up keeps climbing.
  if (next >= pool.length) return pool[0] + 12;
  return pool[pool.length - 1] - 12;
}

// Octave shift, clamped so the result stays inside the audible MIDI range.
export function octaveShift(midi, dir) {
  if (midi == null) return midi;
  const next = midi + 12 * dir;
  if (next < 12 || next > 120) return midi;
  return next;
}

// Render a MIDI number as note-with-octave (e.g. midi 60 → "C4"). The
// per-step labels use this so you can see at a glance when a note has
// crossed an octave boundary after a knob nudge.
const NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function midiToLabel(midi) {
  if (midi == null) return "";
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return NN[pc] + oct;
}
