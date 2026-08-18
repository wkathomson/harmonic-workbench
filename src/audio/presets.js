// Voice presets + macro definitions.
//
// A "preset" is a named starting point for a voice (piano "soft", bass "punch", etc.).
// Each voice exposes seven macro sliders the user can tweak after picking a preset:
//
//   Attack  — how fast the note starts (snappy stab → slow swell)
//   Decay   — how fast it falls from peak to sustain level
//   Sustain — held volume during note-hold (0 = note dies after decay → "stab"
//             or "pad that runs out"; high = note holds at level until release)
//   Release — how long it tails off after the note ends
//   Tone    — filter cutoff (dark ↔ bright). Logarithmic 200 Hz – 18 kHz.
//   Reverb  — per-voice send to the reverb bus
//   Delay   — per-voice send to the delay bus
//
// Each preset stores its *default* macro values + a fixed waveform. Switching
// preset resets the macros to that preset's defaults; the user can then drift.

// The voices the preset system controls. Order = display order in the UI.
export const VOICE_LIST = [
  { key: "piano",  label: "Piano / Chords",  color: "var(--ac)"   },
  { key: "pad",    label: "Pad",             color: "var(--ac)"   },
  { key: "bass",   label: "Bass",            color: "var(--bass)" },
  { key: "acid",   label: "Acid (303)",      color: "var(--bass)" },
  { key: "melody", label: "Melody",          color: "var(--mel)"  },
  { key: "arp",    label: "Arp",             color: "var(--arp)"  },
];

// Preset definitions. `wave` is fixed per-preset; the seven macros (attack,
// decay, sustain, release, tone, reverb, delay) are slider defaults the user
// can change after picking the preset.
//
// Sustain conventions:
//   0.00–0.05 = stab / pluck (note dies after decay, even if held)
//   0.20–0.40 = mid-body (held notes ring at moderate volume)
//   0.50+     = sustained pad (note holds full until release)
export const VOICE_PRESETS = {
  piano: {
    plucky: { label: "Plucky", wave: "triangle",   attack: 0.02, decay: 0.30, sustain: 0.00, release: 0.20, tone: 0.70, reverb: 0.15, delay: 0.08 },
    soft:   { label: "Soft",   wave: "triangle",   attack: 0.05, decay: 0.50, sustain: 0.10, release: 0.35, tone: 0.55, reverb: 0.20, delay: 0.10 },
    stab:   { label: "Stab",   wave: "triangle",   attack: 0.00, decay: 0.18, sustain: 0.00, release: 0.10, tone: 0.65, reverb: 0.10, delay: 0.05 },
    pad:    { label: "Pad",    wave: "triangle",   attack: 0.40, decay: 0.55, sustain: 0.45, release: 0.55, tone: 0.45, reverb: 0.40, delay: 0.15 },
    bell:   { label: "Bell",   wave: "sine",       attack: 0.02, decay: 0.55, sustain: 0.00, release: 0.50, tone: 0.85, reverb: 0.55, delay: 0.30 },
  },
  pad: {
    warm:   { label: "Warm",   wave: "fatsawtooth", attack: 0.30, decay: 0.50, sustain: 0.40, release: 0.45, tone: 0.40, reverb: 0.40, delay: 0.10 },
    bright: { label: "Bright", wave: "fatsawtooth", attack: 0.20, decay: 0.45, sustain: 0.45, release: 0.40, tone: 0.65, reverb: 0.35, delay: 0.10 },
    runout: { label: "Run-out", wave: "fatsawtooth", attack: 0.25, decay: 0.70, sustain: 0.00, release: 0.40, tone: 0.55, reverb: 0.45, delay: 0.15 },
    wash:   { label: "Wash",   wave: "fatsawtooth", attack: 0.55, decay: 0.65, sustain: 0.55, release: 0.70, tone: 0.50, reverb: 0.70, delay: 0.30 },
    vox:    { label: "Vox",    wave: "fattriangle", attack: 0.35, decay: 0.50, sustain: 0.40, release: 0.50, tone: 0.55, reverb: 0.50, delay: 0.20 },
  },
  bass: {
    round:  { label: "Round",  wave: "triangle", attack: 0.02, decay: 0.30, sustain: 0.40, release: 0.20, tone: 0.45, reverb: 0.05, delay: 0.00 },
    punch:  { label: "Punch",  wave: "sawtooth", attack: 0.01, decay: 0.20, sustain: 0.20, release: 0.10, tone: 0.55, reverb: 0.05, delay: 0.00 },
    sub:    { label: "Sub",    wave: "sine",     attack: 0.02, decay: 0.40, sustain: 0.55, release: 0.30, tone: 0.30, reverb: 0.00, delay: 0.00 },
  },
  acid: {
    // Wave is locked to sawtooth — that's the 303.
    squelchy: { label: "Squelchy", wave: "sawtooth", attack: 0.02, decay: 0.20, sustain: 0.25, release: 0.10, tone: 0.55, reverb: 0.10, delay: 0.10 },
    open:     { label: "Open",     wave: "sawtooth", attack: 0.02, decay: 0.30, sustain: 0.35, release: 0.20, tone: 0.75, reverb: 0.15, delay: 0.20 },
    tight:    { label: "Tight",    wave: "sawtooth", attack: 0.01, decay: 0.12, sustain: 0.00, release: 0.05, tone: 0.40, reverb: 0.05, delay: 0.05 },
  },
  melody: {
    lead:   { label: "Lead",   wave: "triangle", attack: 0.02, decay: 0.30, sustain: 0.30, release: 0.25, tone: 0.65, reverb: 0.25, delay: 0.20 },
    pluck:  { label: "Pluck",  wave: "triangle", attack: 0.01, decay: 0.18, sustain: 0.00, release: 0.12, tone: 0.70, reverb: 0.20, delay: 0.15 },
    bell:   { label: "Bell",   wave: "sine",     attack: 0.01, decay: 0.50, sustain: 0.00, release: 0.45, tone: 0.85, reverb: 0.45, delay: 0.30 },
    square: { label: "Square", wave: "square",   attack: 0.02, decay: 0.30, sustain: 0.20, release: 0.25, tone: 0.55, reverb: 0.25, delay: 0.20 },
  },
  arp: {
    pluck:  { label: "Pluck",  wave: "triangle", attack: 0.01, decay: 0.18, sustain: 0.00, release: 0.15, tone: 0.70, reverb: 0.30, delay: 0.30 },
    bell:   { label: "Bell",   wave: "sine",     attack: 0.01, decay: 0.40, sustain: 0.00, release: 0.35, tone: 0.85, reverb: 0.45, delay: 0.40 },
    pad:    { label: "Pad",    wave: "triangle", attack: 0.15, decay: 0.45, sustain: 0.30, release: 0.45, tone: 0.50, reverb: 0.50, delay: 0.35 },
  },
};

// Default preset per voice. These also seed the default macro values.
export const VOICE_PRESET_DEFAULTS = {
  piano:  "soft",
  pad:    "warm",
  bass:   "round",
  acid:   "squelchy",
  melody: "lead",
  arp:    "pluck",
};

// Build the initial voice state for the app:
//   { voice: { preset, attack, decay, sustain, release, tone, reverb, delay } }
export function buildInitialVoiceState() {
  const out = {};
  for (const v of Object.keys(VOICE_PRESETS)) {
    const p = VOICE_PRESET_DEFAULTS[v];
    const def = VOICE_PRESETS[v][p];
    out[v] = {
      preset: p,
      attack: def.attack, decay: def.decay, sustain: def.sustain, release: def.release,
      tone: def.tone, reverb: def.reverb, delay: def.delay,
    };
  }
  return out;
}

// ---- Macro → synth-parameter mappings ----------------------------------

// Filter cutoff. Log scale so the lower half of the slider has more musical
// resolution (most musical movement happens between 200 Hz and 4 kHz).
export const macroToCutoff = (tone) => 200 * Math.pow(90, Math.max(0, Math.min(1, tone)));

// Envelope time mappings. Power curve `^2.5` keeps short presets short
// (the bottom half of the slider clusters near zero) while letting the top
// half reach ~4-second decays/releases for proper long pads.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const macroToAttack  = (v) => 0.001 + Math.pow(clamp01(v), 2)   * 0.50;
export const macroToDecay   = (v) => 0.05  + Math.pow(clamp01(v), 2.5) * 4.00;
export const macroToRelease = (v) => 0.05  + Math.pow(clamp01(v), 2.5) * 4.00;
// Sustain is just identity (0 → 1 maps directly to held-volume 0 → 1).
export const macroToSustain = (v) => clamp01(v);
