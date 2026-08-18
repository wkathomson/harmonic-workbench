// Chord-design helpers — strum, spread, humanise.
//
// Given a list of MIDI notes (a chord), expand it into a list of timed
// note events that the player can fire. The same logic powers both:
//   • live audition (engine.chord) — offsets are seconds from "now"
//   • scheduled playback (App.playOnce) — offsets get converted to beats
//
// Knobs:
//   strum     — 0..1 ; 0 = block chord, 1 = ~90ms gap between adjacent notes
//   strumDir  — "up" plays low→high (typical guitar/keyboard strum),
//               "down" plays high→low (more classical, harp-like)
//   spread    — bool ; if true, adds an extra note one octave below the
//               lowest chord note (fattens the chord root, sounds wider)
//   humanise  — 0..1 ; introduces small per-note timing + velocity jitter
//               so each chord hit feels played, not programmed

export const CHORD_DESIGN_DEFAULTS = {
  strum:    0,
  strumDir: "up",
  spread:   false,
  humanise: 0,
};

// Per-note strum gap at slider 1.0. We index this PER NOTE rather than
// across the whole chord, so a 7-note 9th chord doesn't get a wildly
// different feel from a triad — the gap stays the same. At 90ms/note a
// triad spans ~180ms (clearly rolled, harp-like) and at slider 0.4 it's
// ~36ms/note which is a tight but audible piano "swing" feel.
const STRUM_MS_PER_NOTE_MAX = 90;
// Humanise jitter ranges. Tuned to feel organic without sounding sloppy.
const HUMANISE_MS_MAX  = 22;   // ±11ms timing drift at full humanise
const HUMANISE_VEL_MAX = 0.30; // ±15% velocity drift at full humanise

// Expand a chord into per-note events.
//
// Returns: [{ midi, secondsOffset, velMod }, ...]
//   secondsOffset = real-time offset from the "downbeat" of the chord
//   velMod        = multiplier on the base velocity (0..~1.15 typical)
//
// Pass `rng` to make output deterministic (e.g. for tests). Defaults to Math.random.
export function expandChord(notes, design = CHORD_DESIGN_DEFAULTS, rng = Math.random) {
  if (!notes?.length) return [];
  const d = { ...CHORD_DESIGN_DEFAULTS, ...design };

  // Decide playback order. Down-strum reverses to high→low.
  const ordered = d.strumDir === "down" ? [...notes].reverse() : [...notes];

  // Per-note strum delay step. Gap is PER NOTE so chord size doesn't squish
  // the feel. Slight power curve so the lower half of the slider stays subtle
  // and the upper half opens out into clearly-rolled territory.
  const strumCurve = Math.pow(d.strum, 0.85);
  const stepMs = strumCurve * STRUM_MS_PER_NOTE_MAX;

  const out = [];

  // Spread: octave-double the *original* lowest note. Fires on the downbeat
  // (offset 0) regardless of strum direction — the doubled root anchors
  // the chord even when the rest is rolled.
  if (d.spread) {
    const lowest = Math.min(...notes);
    out.push({
      midi: lowest - 12,
      secondsOffset: 0,
      velMod: 0.80,   // a touch quieter so it doesn't dominate
    });
  }

  ordered.forEach((midi, i) => {
    const strumDelay = (i * stepMs) / 1000;
    const humDelay   = d.humanise * (rng() - 0.5) * (HUMANISE_MS_MAX / 1000);
    const humVel     = 1 + d.humanise * (rng() - 0.5) * HUMANISE_VEL_MAX;
    out.push({
      midi,
      secondsOffset: Math.max(0, strumDelay + humDelay),
      velMod:        humVel,
    });
  });

  return out;
}
