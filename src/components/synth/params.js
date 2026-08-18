/* Parameter table, formatters, and knob-bank/switch-option layout,
   ported verbatim from reference/web-synth-v11.html (lines 2181–2270,
   2548–2591). No React, no DOM — data plus pure functions only. */

import { clamp } from '../../audio/synth/util.js';

function pct(v) { return `${Math.round(v * 100)}%`; }
function hz(v) { return v >= 1000 ? `${(v / 1000).toFixed(v < 10000 ? 2 : 1)}k` : `${Math.round(v)} Hz`; }
function hzLfo(v) { return v < 1 ? `${v.toFixed(2)} Hz` : `${v.toFixed(1)} Hz`; }
function sec(v) { return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`; }
const st = v => `${v > 0 ? '+' : ''}${v} st`;
const ct = v => `${v > 0 ? '+' : ''}${v} ct`;

export const SYNC_DIVS_UI = [
  ['off', 0], ['1/1', 4], ['1/2', 2], ['1/4', 1],
  ['1/8', 0.5], ['1/16', 0.25], ['1/4T', 2 / 3], ['1/8T', 1 / 3]
];
export const ARP_DIVS_UI = [['1/4', 1], ['1/8', 0.5], ['1/8T', 1 / 3], ['1/16', 0.25], ['1/16T', 1 / 6], ['1/32', 0.125]];

export const P = {
  'osc1.coarse':        { label:'Coarse',    min:-24,  max:24,    curve:'lin', step:1, fmt:st },
  'osc1.fine':          { label:'Fine',      min:-50,  max:50,    curve:'lin', step:1, fmt:ct },
  'osc1.level':         { label:'Level',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'osc1.pw':            { label:'Pulse W',   min:0.05, max:0.95,  curve:'lin',         fmt:pct },
  'osc1.morph':         { label:'Morph',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'osc1.fm':            { label:'FM ←2',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'auxEnv.attack':      { label:'Attack',    min:0.001,max:5,     curve:'exp',         fmt:sec },
  'auxEnv.decay':       { label:'Decay',     min:0.001,max:5,     curve:'exp',         fmt:sec },
  'auxEnv.sustain':     { label:'Sustain',   min:0,    max:1,     curve:'lin',         fmt:pct },
  'auxEnv.release':     { label:'Release',   min:0.001,max:10,    curve:'exp',         fmt:sec },
  'arp.rate':           { label:'Rate',      min:0,    max:5,     curve:'lin', step:1, fmt:v=>ARP_DIVS_UI[v][0] },
  'arp.octaves':        { label:'Octaves',   min:1,    max:4,     curve:'lin', step:1, fmt:v=>`${v}` },
  'arp.gate':           { label:'Gate',      min:0.05, max:0.98,  curve:'lin',         fmt:pct },
  'fx.choRate':         { label:'Rate',      min:0.05, max:6,     curve:'exp',         fmt:hzLfo },
  'fx.choDepth':        { label:'Depth',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'fx.choSend':         { label:'Send',      min:0,    max:1,     curve:'lin',         fmt:pct },
  'master.spread':      { label:'Spread',    min:0,    max:1,     curve:'lin',         fmt:pct },
  'osc2.coarse':        { label:'Coarse',    min:-24,  max:24,    curve:'lin', step:1, fmt:st },
  'osc2.fine':          { label:'Fine',      min:-50,  max:50,    curve:'lin', step:1, fmt:ct },
  'osc2.level':         { label:'Level',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'osc2.pw':            { label:'Pulse W',   min:0.05, max:0.95,  curve:'lin',         fmt:pct },
  'osc2.morph':         { label:'Morph',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'noise.level':        { label:'Level',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'filter.cutoff':      { label:'Cutoff',    min:20,   max:20000, curve:'exp',         fmt:hz },
  'filter.resonance':   { label:'Resonance', min:0.1,  max:30,    curve:'exp',         fmt:v=>`Q ${v.toFixed(1)}` },
  'filter.envAmount':   { label:'Env amt',   min:-100, max:100,   curve:'lin', bipolar:true, fmt:v=>`${v>0?'+':''}${Math.round(v)}%` },
  'filter.keytrack':    { label:'Keytrack',  min:0,    max:100,   curve:'lin',         fmt:v=>`${Math.round(v)}%` },
  'filter.velToCutoff': { label:'Vel→cut',   min:0,    max:100,   curve:'lin',         fmt:v=>`${Math.round(v)}%` },
  'filter.drive':       { label:'Drive',     min:0,    max:1,     curve:'lin',         fmt:pct },
  'filterEnv.attack':   { label:'Attack',    min:0.001,max:5,     curve:'exp',         fmt:sec },
  'filterEnv.decay':    { label:'Decay',     min:0.001,max:5,     curve:'exp',         fmt:sec },
  'filterEnv.sustain':  { label:'Sustain',   min:0,    max:1,     curve:'lin',         fmt:pct },
  'filterEnv.release':  { label:'Release',   min:0.001,max:10,    curve:'exp',         fmt:sec },
  'ampEnv.attack':      { label:'Attack',    min:0.001,max:5,     curve:'exp',         fmt:sec },
  'ampEnv.decay':       { label:'Decay',     min:0.001,max:5,     curve:'exp',         fmt:sec },
  'ampEnv.sustain':     { label:'Sustain',   min:0,    max:1,     curve:'lin',         fmt:pct },
  'ampEnv.release':     { label:'Release',   min:0.001,max:10,    curve:'exp',         fmt:sec },
  'ampEnv.velToAmp':    { label:'Vel→amp',   min:0,    max:100,   curve:'lin',         fmt:v=>`${Math.round(v)}%` },
  'lfo1.rate':          { label:'Rate',      min:0.05, max:40,    curve:'exp',         fmt:hzLfo },
  'lfo1.sync':          { label:'Sync',      min:0,    max:7,     curve:'lin', step:1, fmt:v=>SYNC_DIVS_UI[v][0] },
  'lfo2.rate':          { label:'Rate',      min:0.05, max:40,    curve:'exp',         fmt:hzLfo },
  'lfo2.sync':          { label:'Sync',      min:0,    max:7,     curve:'lin', step:1, fmt:v=>SYNC_DIVS_UI[v][0] },
  'fx.crushBits':       { label:'Bits',      min:2,    max:16,    curve:'lin', step:1, fmt:v=>`${v} bit` },
  'fx.crushRate':       { label:'Downsmpl',  min:1,    max:40,    curve:'lin', step:1, fmt:v=>`÷${v}` },
  'fx.crushMix':        { label:'Mix',       min:0,    max:1,     curve:'lin',         fmt:pct },
  'fx.delayTime':       { label:'Time',      min:0.02, max:1.5,   curve:'exp',         fmt:sec },
  'fx.delaySync':       { label:'Sync',      min:0,    max:7,     curve:'lin', step:1, fmt:v=>SYNC_DIVS_UI[v][0] },
  'fx.delayFeedback':   { label:'Feedback',  min:0,    max:0.9,   curve:'lin',         fmt:pct },
  'fx.delayTone':       { label:'Tone',      min:300,  max:12000, curve:'exp',         fmt:hz },
  'fx.delaySend':       { label:'Send',      min:0,    max:1,     curve:'lin',         fmt:pct },
  'fx.verbSize':        { label:'Size',      min:0.3,  max:6,     curve:'exp',         fmt:sec },
  'fx.verbDamp':        { label:'Damping',   min:0,    max:1,     curve:'lin',         fmt:pct },
  'fx.verbSend':        { label:'Send',      min:0,    max:1,     curve:'lin',         fmt:pct },
  'voice.count':        { label:'Voices',    min:1,    max:8,     curve:'lin', step:1, fmt:v=>`${v}` },
  'perf.glide':         { label:'Glide',     min:0,    max:1.5,   curve:'lin',         fmt:sec },
  'perf.uniVoices':     { label:'Uni voices',min:2,    max:6,     curve:'lin', step:1, fmt:v=>`${v}` },
  'perf.uniDetune':     { label:'Uni detune',min:0,    max:50,    curve:'lin', step:1, fmt:v=>`${v} ct` },
  'perf.bendRange':     { label:'Bend range',min:0,    max:12,    curve:'lin', step:1, fmt:v=>`±${v} st` },
  'master.tempo':       { label:'Tempo',     min:40,   max:220,   curve:'lin', step:1, fmt:v=>`${v} bpm` },
  'master.level':       { label:'Master',    min:0,    max:1,     curve:'lin',         fmt:pct },
  'slot0.amount':       { label:'Amount',    min:-100, max:100,   curve:'lin', step:1, bipolar:true, fmt:v=>`${v>0?'+':''}${v}%` },
  'slot1.amount':       { label:'Amount',    min:-100, max:100,   curve:'lin', step:1, bipolar:true, fmt:v=>`${v>0?'+':''}${v}%` },
  'slot2.amount':       { label:'Amount',    min:-100, max:100,   curve:'lin', step:1, bipolar:true, fmt:v=>`${v>0?'+':''}${v}%` },
  'slot3.amount':       { label:'Amount',    min:-100, max:100,   curve:'lin', step:1, bipolar:true, fmt:v=>`${v>0?'+':''}${v}%` }
};

export const toNorm = (v, d) => d.curve === 'exp'
  ? Math.log(clamp(v, d.min, d.max) / d.min) / Math.log(d.max / d.min)
  : (clamp(v, d.min, d.max) - d.min) / (d.max - d.min);

export const fromNorm = (n, d) => {
  n = clamp(n, 0, 1);
  let v = d.curve === 'exp' ? d.min * Math.pow(d.max / d.min, n) : d.min + (d.max - d.min) * n;
  if (d.step) v = Math.round(v / d.step) * d.step;
  return clamp(v, d.min, d.max);
};

/* ---- switch option lists (reference lines 2548–2595) ---- */
export const WAVES = [
  ['sine', 'Sin'], ['triangle', 'Tri'], ['sawtooth', 'Saw'],
  ['square', 'Sqr'], ['pulse', 'Pls'], ['wave', 'Wav']
];
export const LFO_SHAPES = [['sine', 'Sin'], ['triangle', 'Tri'], ['sawtooth', 'Saw'], ['square', 'Sqr'], ['sample-hold', 'S&H']];
export const NOISE_TYPES = [['white', 'White'], ['pink', 'Pink']];
export const FILTER_TYPES = [
  ['lowpass', 'LP'], ['highpass', 'HP'], ['bandpass', 'BP'], ['notch', 'Notch']
];
export const CURVES = [
  ['exponential', 'Exp'], ['linear', 'Lin']
];
export const MODES = [
  ['poly', 'Poly'], ['mono', 'Mono'], ['unison', 'Unison']
];
export const ARP_MODES = [
  ['up', 'Up'], ['down', 'Dn'], ['updown', 'U/D'], ['random', 'Rnd'], ['asplayed', 'Play']
];

/* ---- knob-bank layout (reference lines 2572–2591) ---- */
export const BANKS = {
  bankOsc1:      ['osc1.coarse', 'osc1.fine', 'osc1.level', 'osc1.pw', 'osc1.morph', 'osc1.fm'],
  bankOsc2:      ['osc2.coarse', 'osc2.fine', 'osc2.level', 'osc2.pw', 'osc2.morph'],
  bankNoise:     ['noise.level'],
  bankFilter:    ['filter.cutoff', 'filter.resonance', 'filter.envAmount'],
  bankTracking:  ['filter.keytrack', 'filter.velToCutoff'],
  bankDrive:     ['filter.drive'],
  bankFilterEnv: ['filterEnv.attack', 'filterEnv.decay', 'filterEnv.sustain', 'filterEnv.release'],
  bankAmpEnv:    ['ampEnv.attack', 'ampEnv.decay', 'ampEnv.sustain', 'ampEnv.release', 'ampEnv.velToAmp'],
  bankLfo1:      ['lfo1.rate', 'lfo1.sync'],
  bankLfo2:      ['lfo2.rate', 'lfo2.sync'],
  bankVoice:     ['voice.count', 'perf.glide', 'perf.bendRange'],
  bankUnison:    ['perf.uniVoices', 'perf.uniDetune', 'master.tempo'],
  bankOutput:    ['master.level'],
  bankCrush:     ['fx.crushBits', 'fx.crushRate', 'fx.crushMix'],
  bankDelay:     ['fx.delayTime', 'fx.delaySync', 'fx.delayFeedback', 'fx.delayTone', 'fx.delaySend'],
  bankVerb:      ['fx.verbSize', 'fx.verbDamp', 'fx.verbSend'],
  bankChorus:    ['fx.choRate', 'fx.choDepth', 'fx.choSend'],
  bankAuxEnv:    ['auxEnv.attack', 'auxEnv.decay', 'auxEnv.sustain', 'auxEnv.release'],
  bankArp:       ['arp.rate', 'arp.octaves', 'arp.gate'],
  bankSpread:    ['master.spread']
};
