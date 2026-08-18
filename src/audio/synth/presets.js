import { DEFAULTS, DEFAULT_SLOTS } from './constants.js';

/* ==========================================================================
   PRESETS — flat dotted-key params + modSlots, versioned (spec §9)
   ========================================================================== */

export const FACTORY = {
  'Basement': { /* sub bass */
    params: {
      'perf.mode':'mono', 'perf.glide':0.06,
      'osc1.waveform':'sine', 'osc1.level':0.9,
      'osc2.waveform':'square', 'osc2.coarse':-12, 'osc2.fine':0, 'osc2.level':0.35,
      'filter.cutoff':300, 'filter.resonance':2, 'filter.envAmount':45,
      'filter.keytrack':40, 'filter.drive':0.25,
      'filterEnv.attack':0.004, 'filterEnv.decay':0.18, 'filterEnv.sustain':0.1, 'filterEnv.release':0.2,
      'ampEnv.attack':0.004, 'ampEnv.decay':0.3, 'ampEnv.sustain':0.8, 'ampEnv.release':0.18,
      'fx.verbSend':0.08, 'fx.verbSize':1.2
    },
    modSlots: []
  },
  'Solder': { /* brassy mono lead */
    params: {
      'perf.mode':'mono', 'perf.glide':0.04,
      'osc1.waveform':'sawtooth', 'osc1.level':0.7,
      'osc2.waveform':'sawtooth', 'osc2.fine':9, 'osc2.level':0.6,
      'filter.cutoff':900, 'filter.resonance':4, 'filter.envAmount':70, 'filter.drive':0.35,
      'filterEnv.attack':0.06, 'filterEnv.decay':0.5, 'filterEnv.sustain':0.55, 'filterEnv.release':0.3,
      'ampEnv.attack':0.05, 'ampEnv.decay':0.3, 'ampEnv.sustain':0.85, 'ampEnv.release':0.25,
      'lfo1.rate':5.5,
      'fx.delaySend':0.18, 'fx.delaySync':4, 'fx.delayFeedback':0.3
    },
    modSlots: [
      { source:'lfo1', destination:'pitch', amount:4 },
      { source:'wheel', destination:'cutoff', amount:40 }
    ]
  },
  'Ensemble': { /* PWM strings */
    params: {
      'voice.count':8,
      'osc1.waveform':'pulse', 'osc1.pw':0.5, 'osc1.level':0.65,
      'osc2.waveform':'pulse', 'osc2.pw':0.45, 'osc2.fine':-8, 'osc2.level':0.65,
      'filter.cutoff':2400, 'filter.resonance':1.5, 'filter.envAmount':20,
      'filterEnv.attack':0.4, 'filterEnv.decay':0.8, 'filterEnv.sustain':0.6, 'filterEnv.release':0.8,
      'ampEnv.attack':0.35, 'ampEnv.decay':0.5, 'ampEnv.sustain':0.8, 'ampEnv.release':0.9,
      'lfo1.rate':4.2, 'lfo2.shape':'triangle', 'lfo2.rate':0.5,
      'fx.delaySend':0.12, 'fx.verbSend':0.3, 'fx.verbSize':3, 'fx.verbDamp':0.5
    },
    modSlots: [
      { source:'lfo2', destination:'pw', amount:35 },
      { source:'lfo1', destination:'pitch', amount:2 }
    ]
  },
  'Droplet': { /* glassy pluck */
    params: {
      'osc1.waveform':'wave', 'osc1.morph':0.15, 'osc1.level':0.8,
      'osc2.waveform':'sine', 'osc2.coarse':12, 'osc2.level':0.3,
      'filter.cutoff':1800, 'filter.resonance':6, 'filter.envAmount':80,
      'filter.keytrack':80, 'filter.velToCutoff':60,
      'filterEnv.attack':0.002, 'filterEnv.decay':0.22, 'filterEnv.sustain':0, 'filterEnv.release':0.25,
      'ampEnv.attack':0.002, 'ampEnv.decay':0.35, 'ampEnv.sustain':0, 'ampEnv.release':0.4,
      'ampEnv.velToAmp':80,
      'fx.delaySend':0.3, 'fx.delaySync':6, 'fx.delayFeedback':0.45, 'fx.delayTone':3000,
      'fx.verbSend':0.15
    },
    modSlots: [
      { source:'velocity', destination:'cutoff', amount:25 }
    ]
  },
  'Substrate': { /* slow drone */
    params: {
      'perf.mode':'unison', 'perf.uniVoices':5, 'perf.uniDetune':22, 'perf.glide':0.4,
      'osc1.waveform':'sawtooth', 'osc1.level':0.65,
      'osc2.waveform':'wave', 'osc2.morph':0.65, 'osc2.coarse':-12, 'osc2.level':0.55,
      'noise.type':'pink', 'noise.level':0.2,
      'filter.cutoff':700, 'filter.resonance':8, 'filter.envAmount':15, 'filter.drive':0.4,
      'filterEnv.attack':1.5, 'filterEnv.decay':1, 'filterEnv.sustain':0.7, 'filterEnv.release':2,
      'ampEnv.attack':1.2, 'ampEnv.decay':0.5, 'ampEnv.sustain':1, 'ampEnv.release':2.5,
      'lfo1.rate':0.15, 'lfo2.shape':'triangle', 'lfo2.rate':0.08,
      'fx.verbSend':0.45, 'fx.verbSize':5, 'fx.verbDamp':0.6
    },
    modSlots: [
      { source:'lfo1', destination:'cutoff', amount:25 },
      { source:'lfo2', destination:'pitch2', amount:3 }
    ]
  },
  'Filament': { /* FM bell */
    params: {
      'osc1.waveform':'sine', 'osc1.level':0.85, 'osc1.fm':0.42,
      'osc2.waveform':'sine', 'osc2.coarse':7, 'osc2.level':0.5,
      'filter.cutoff':6000, 'filter.resonance':1, 'filter.envAmount':20,
      'filterEnv.attack':0.002, 'filterEnv.decay':0.6, 'filterEnv.sustain':0.2, 'filterEnv.release':0.6,
      'ampEnv.attack':0.002, 'ampEnv.decay':1.2, 'ampEnv.sustain':0, 'ampEnv.release':1.2,
      'ampEnv.velToAmp':70,
      'auxEnv.attack':0.001, 'auxEnv.decay':0.5, 'auxEnv.sustain':0, 'auxEnv.release':0.4,
      'fx.choSend':0.2, 'fx.verbSend':0.3, 'fx.verbSize':3.5,
      'master.spread':0.5
    },
    modSlots: [
      { source:'aux', destination:'fm', amount:-55 },
      { source:'velocity', destination:'fm', amount:30 }
    ]
  },
  'Clockwork': { /* arp showcase */
    params: {
      'arp.mode':'updown', 'arp.rate':3, 'arp.octaves':2, 'arp.gate':0.45,
      'osc1.waveform':'pulse', 'osc1.pw':0.35, 'osc1.level':0.75,
      'osc2.waveform':'sawtooth', 'osc2.coarse':-12, 'osc2.fine':6, 'osc2.level':0.45,
      'filter.cutoff':900, 'filter.resonance':9, 'filter.envAmount':65,
      'filter.keytrack':50, 'filter.drive':0.2,
      'filterEnv.attack':0.002, 'filterEnv.decay':0.16, 'filterEnv.sustain':0.05, 'filterEnv.release':0.15,
      'ampEnv.attack':0.002, 'ampEnv.decay':0.25, 'ampEnv.sustain':0.3, 'ampEnv.release':0.15,
      'auxEnv.attack':0.002, 'auxEnv.decay':0.25, 'auxEnv.sustain':0, 'auxEnv.release':0.2,
      'lfo2.shape':'triangle', 'lfo2.rate':0.22,
      'fx.delaySend':0.28, 'fx.delaySync':5, 'fx.delayFeedback':0.4, 'fx.delayTone':3500,
      'fx.choSend':0.25, 'fx.verbSend':0.2,
      'master.spread':0.7
    },
    modSlots: [
      { source:'aux', destination:'pw', amount:40 },
      { source:'lfo2', destination:'cutoff', amount:28 }
    ]
  },
  'Impact': { /* filtered noise percussion */
    params: {
      'osc1.waveform':'triangle', 'osc1.level':0.5,
      'osc2.level':0,
      'noise.type':'white', 'noise.level':0.8,
      'filter.type':'bandpass', 'filter.cutoff':1200, 'filter.resonance':9,
      'filter.envAmount':90, 'filter.velToCutoff':80,
      'filterEnv.attack':0.001, 'filterEnv.decay':0.12, 'filterEnv.sustain':0, 'filterEnv.release':0.12,
      'ampEnv.attack':0.001, 'ampEnv.decay':0.16, 'ampEnv.sustain':0, 'ampEnv.release':0.18,
      'ampEnv.velToAmp':100,
      'fx.crushMix':0.35, 'fx.crushBits':8, 'fx.crushRate':4,
      'fx.verbSend':0.1, 'fx.verbSize':1, 'fx.verbDamp':0.3
    },
    modSlots: [
      { source:'velocity', destination:'cutoff', amount:20 }
    ]
  }
};

export const validPath = (path) => {
  const [mod, key] = path.split('.');
  return !!(DEFAULTS[mod] && key in DEFAULTS[mod]);
};

/* pure equivalent of the reference's applyPreset: reset to a known base,
   then overlay so sparse preset files still load fully resolved */
export function resolvePreset(preset) {
  const params = {};
  for (const [mod, group] of Object.entries(DEFAULTS))
    for (const [key, val] of Object.entries(group)) params[`${mod}.${key}`] = val;

  for (const [path, val] of Object.entries(preset.params ?? {}))
    if (validPath(path)) params[path] = val;

  const modSlots = DEFAULT_SLOTS.map(s => ({ ...s }));
  (preset.modSlots ?? []).forEach((s, i) => { if (i < 4) modSlots[i] = { ...s }; });

  return { params, modSlots };
}

export function applyPresetToEngine(engine, preset) {
  const resolved = resolvePreset(preset);
  for (const [path, val] of Object.entries(resolved.params)) {
    const [mod, key] = path.split('.');
    engine.setParam(mod, key, val);
  }
  resolved.modSlots.forEach((slot, i) => engine.setModSlot(i, slot));
  return resolved;
}

/* ---- randomise: curated chaos, never touches master level or bend ---- */
export function randomPreset() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const r = (lo, hi) => lo + Math.random() * (hi - lo);
  const ri = (lo, hi) => Math.round(r(lo, hi));
  const waves = ['sine', 'triangle', 'sawtooth', 'square', 'pulse', 'wave'];
  const params = {
    'osc1.waveform': pick(waves), 'osc2.waveform': pick(waves),
    'osc1.pw': r(0.15, 0.85), 'osc2.pw': r(0.15, 0.85),
    'osc1.morph': Math.random(), 'osc2.morph': Math.random(),
    'osc1.level': r(0.5, 0.85), 'osc2.level': r(0, 0.8),
    'osc2.coarse': pick([-12, -12, 0, 0, 0, 7, 12]), 'osc2.fine': ri(-12, 12),
    'noise.type': pick(['white', 'pink']),
    'noise.level': pick([0, 0, 0, r(0.1, 0.5)]),
    'filter.type': pick(['lowpass', 'lowpass', 'lowpass', 'highpass', 'bandpass']),
    'filter.cutoff': Math.round(200 * Math.pow(2, r(0, 5))),
    'filter.resonance': r(0.5, 14),
    'filter.envAmount': ri(-40, 90),
    'filter.keytrack': pick([0, 30, 60, 100]),
    'filter.velToCutoff': pick([0, 0, 40]),
    'filter.drive': r(0, 0.6),
    'filterEnv.attack': r(0.001, 0.8), 'filterEnv.decay': r(0.05, 1.2),
    'filterEnv.sustain': Math.random(), 'filterEnv.release': r(0.05, 1.5),
    'ampEnv.attack': r(0.001, 0.6), 'ampEnv.decay': r(0.05, 1),
    'ampEnv.sustain': r(0.2, 1), 'ampEnv.release': r(0.05, 2),
    'ampEnv.velToAmp': ri(0, 100),
    'lfo1.shape': pick(['sine', 'triangle', 'sawtooth', 'square', 'sample-hold']),
    'lfo1.rate': r(0.1, 9),
    'lfo2.shape': pick(['sine', 'triangle', 'sample-hold']),
    'lfo2.rate': r(0.05, 2),
    'fx.delaySend': pick([0, 0, r(0.1, 0.45)]),
    'fx.delaySync': pick([0, 3, 4, 6, 7]),
    'fx.delayFeedback': r(0.2, 0.6),
    'fx.delayTone': Math.round(r(800, 8000)),
    'fx.verbSend': pick([0, r(0.05, 0.45)]),
    'fx.verbSize': r(0.8, 4.5), 'fx.verbDamp': Math.random(),
    'fx.crushMix': pick([0, 0, 0, r(0.1, 0.5)]),
    'fx.crushBits': ri(5, 12), 'fx.crushRate': ri(1, 10)
  };
  const dests = ['pitch', 'pitch2', 'pw', 'cutoff', 'trem', 'mix2'];
  const modSlots = [
    { source: pick(['lfo1', 'lfo2']), destination: pick(dests), amount: ri(-50, 50) },
    { source: pick(['lfo1', 'lfo2', 'velocity', 'keytrack', 'wheel']),
      destination: pick(dests.concat(['res', 'noise'])), amount: ri(-60, 60) },
    { source: 'off', destination: 'off', amount: 0 },
    { source: 'off', destination: 'off', amount: 0 }
  ];
  return { name: 'Random', version: 1, params, modSlots };
}
