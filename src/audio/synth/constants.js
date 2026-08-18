/* ---- wavetable morph bank: harmonic recipes → PeriodicWaves ---- */
export const MORPH_TABLES = 33;
export const MORPH_HARMONICS = 64;

export const DEFAULTS = {
  osc1:      { waveform: 'sawtooth', coarse: 0, fine: 0, level: 0.7, pw: 0.5, morph: 0, fm: 0 },
  osc2:      { waveform: 'sawtooth', coarse: 0, fine: -7, level: 0.5, pw: 0.5, morph: 0 },
  noise:     { type: 'white', level: 0 },
  filter:    { type: 'lowpass', cutoff: 1100, resonance: 5.5, envAmount: 60,
               keytrack: 0, velToCutoff: 0, drive: 0 },
  filterEnv: { attack: 0.004, decay: 0.32, sustain: 0.12, release: 0.35 },
  ampEnv:    { attack: 0.006, decay: 0.4, sustain: 0.65, release: 0.32, velToAmp: 60 },
  auxEnv:    { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
  lfo1:      { shape: 'sine', rate: 5, sync: 0 },
  lfo2:      { shape: 'triangle', rate: 0.6, sync: 0 },
  arp:       { mode: 'up', rate: 1, octaves: 1, gate: 0.6 },
  fx:        { crushBits: 16, crushRate: 1, crushMix: 0,
               delayTime: 0.35, delaySync: 0, delayFeedback: 0.35,
               delayTone: 4500, delaySend: 0,
               choRate: 0.8, choDepth: 0.35, choSend: 0,
               verbSize: 2.2, verbDamp: 0.4, verbSend: 0 },
  voice:     { count: 6 },
  perf:      { mode: 'poly', glide: 0.08, uniVoices: 3, uniDetune: 18, bendRange: 2 },
  master:    { level: 0.7, curve: 'exponential', tempo: 120, spread: 0 }
};

/* Effect settings belong to the mix and are shared by every part; send
   amounts belong to the patch and travel with it. Everything else in
   DEFAULTS — including fx.delaySend/choSend/verbSend, all three
   fx.crush* (the crusher is a per-part insert), master.curve (envelope
   curve) and master.spread (stereo spread across the part's own voice
   pool) — stays with the part. */
export const MIXER_PARAMS = new Set([
  'fx.delayTime', 'fx.delaySync', 'fx.delayFeedback', 'fx.delayTone',
  'fx.choRate', 'fx.choDepth',
  'fx.verbSize', 'fx.verbDamp',
  'master.level', 'master.tempo',
]);

/* Split DEFAULTS along the MIXER_PARAMS line so neither half carries a key
   it doesn't own. Values are primitives, so a shallow copy is enough —
   callers structuredClone() their own working copy off of these. */
function splitDefaults(all, keep) {
  const out = {};
  for (const [mod, group] of Object.entries(all)) {
    const g = {};
    for (const [key, val] of Object.entries(group)) {
      if (keep(`${mod}.${key}`)) g[key] = val;
    }
    if (Object.keys(g).length) out[mod] = g;
  }
  return out;
}

export const MIXER_DEFAULTS = splitDefaults(DEFAULTS, p => MIXER_PARAMS.has(p));
export const PART_DEFAULTS = splitDefaults(DEFAULTS, p => !MIXER_PARAMS.has(p));
/* two params createSynth never had: part output level and pan, inserted
   in series after the bitcrush insert so behaviour is unchanged at their
   defaults (level 1 = transparent gain, pan 0 = identity stereo pan) */
PART_DEFAULTS.part = { level: 1, pan: 0 };

export const DEFAULT_SLOTS = [
  { source: 'lfo1', destination: 'cutoff', amount: 0 },
  { source: 'off',  destination: 'off',    amount: 0 },
  { source: 'off',  destination: 'off',    amount: 0 },
  { source: 'off',  destination: 'off',    amount: 0 }
];

export const SYNC_DIVS = [
  ['off', 0], ['1/1', 4], ['1/2', 2], ['1/4', 1],
  ['1/8', 0.5], ['1/16', 0.25], ['1/4T', 2/3], ['1/8T', 1/3]
];

/* per-destination scaling: what ±100% means */
export const DEST_SCALE = {
  pitch:   1200,   // cents, both oscillators
  pitchf:  50,     // cents — subtle vibrato range
  pitch1:  1200,
  pitch2:  1200,
  pw:      0.85,   // pulse offset swing: keeps duty inside ~7–93%
  fm:      3000,   // Hz added to FM depth
  cutoff:  6000,   // Hz, linear offset
  res:     12,     // Q
  trem:    0.9,    // tremolo depth
  mix2:    0.6,    // osc 2 level offset
  noise:   0.6,
  lfo1rate: 12     // Hz
};

export const POOL_SIZE = 8;
export const ENV_OCTAVES = 4;
export const VEL_OCTAVES = 3;
export const SILENT = 0.002;
export const KEY_CENTRE = 60;
export const STEAL_FADE = 0.006;
export const VOICE_HEADROOM = 0.4;
export const SH_STEPS = 32;
export const SH_STEP_HZ = 8;

export const ARP_DIVS = [['1/4', 1], ['1/8', 0.5], ['1/8T', 1/3], ['1/16', 0.25], ['1/16T', 1/6], ['1/32', 0.125]];
/* symmetric fan: voice 0 centre, pairs widen outwards */
export const PAN_POS = [0, -0.35, 0.35, -0.7, 0.7, -1, 1, -0.15];
