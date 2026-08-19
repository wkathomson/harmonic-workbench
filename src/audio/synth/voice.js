import { clamp, cancelHold, timeConstant } from './util.js';
import { KEY_CENTRE, VEL_OCTAVES, ENV_OCTAVES, SILENT } from './constants.js';
import { fmDepth } from './curves.js';
import { createOscUnit } from './oscUnit.js';

/* --------------------------------------------------------------------------
   Voice
   -------------------------------------------------------------------------- */
export function createVoice(ctx, state, shared, destination) {
  const unit1 = createOscUnit(ctx, state.osc1, shared, state.osc1.morph);
  const unit2 = createOscUnit(ctx, state.osc2, shared, state.osc2.morph);

  /* FM: osc 2's output modulates osc 1's frequency, linear through-zero.
     depth is an AudioParam so the matrix can drive it too */
  const fmGain = ctx.createGain();
  fmGain.gain.value = fmDepth(state.osc1.fm);
  unit2.out.connect(fmGain);
  fmGain.connect(unit1.fmTarget);

  /* aux envelope: a ConstantSource whose offset IS the envelope — a
     normalised 0..1 per-voice modulation source for the matrix */
  const auxEnv = ctx.createConstantSource();
  auxEnv.offset.value = 0;
  auxEnv.start();

  const osc1Level = ctx.createGain();
  osc1Level.gain.value = state.osc1.level;

  const osc2Level = ctx.createGain();
  osc2Level.gain.value = state.osc2.level;

  const mkNoise = buffer => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  };
  const whiteSrc = mkNoise(shared.buffers.white);
  const pinkSrc = mkNoise(shared.buffers.pink);
  const whiteGain = ctx.createGain();
  const pinkGain = ctx.createGain();
  whiteGain.gain.value = state.noise.type === 'white' ? state.noise.level : 0;
  pinkGain.gain.value = state.noise.type === 'pink' ? state.noise.level : 0;

  /* noise mod bus: matrix modulates this, so noise level knob and matrix
     never write the same param */
  const noiseMod = ctx.createGain();
  noiseMod.gain.value = 1;

  const mixBus = ctx.createGain();
  mixBus.gain.value = shared.mixNorm;

  const shaper = ctx.createWaveShaper();
  shaper.curve = shared.driveCurve;
  shaper.oversample = '4x';

  const filter = ctx.createBiquadFilter();
  filter.type = state.filter.type;
  filter.frequency.value = state.filter.cutoff;
  filter.Q.value = state.filter.resonance;

  const amp = ctx.createGain();
  amp.gain.value = 0;

  /* tremolo stage: base 1, matrix adds ±depth. separate from amp so the
     envelope and the LFO never fight over one gain param */
  const trem = ctx.createGain();
  trem.gain.value = 1;

  const panner = ctx.createStereoPanner();
  panner.pan.value = 0;

  const envSource = ctx.createConstantSource();
  envSource.offset.value = 1;
  const filterEnvGain = ctx.createGain();
  filterEnvGain.gain.value = 0;
  envSource.connect(filterEnvGain);
  filterEnvGain.connect(filter.frequency);

  unit1.out.connect(osc1Level).connect(mixBus);
  unit2.out.connect(osc2Level).connect(mixBus);
  whiteSrc.connect(whiteGain).connect(noiseMod).connect(mixBus);
  pinkSrc.connect(pinkGain).connect(noiseMod);
  mixBus.connect(shaper).connect(filter).connect(amp).connect(trem).connect(panner).connect(destination);

  envSource.start();
  whiteSrc.start(0, Math.random() * shared.buffers.white.duration);
  pinkSrc.start(0, Math.random() * shared.buffers.pink.duration);

  const v = {
    note: null, velocity: 1, detuneCt: 0, modOct: 0, fenvOff: 0,
    startedAt: -Infinity, releasedAt: -Infinity, freeAt: -Infinity,
    releasing: true
  };

  const hzFor = (note, cfg) =>
    440 * Math.pow(2, (note - 69 + cfg.coarse + shared.bendSemis + (cfg.fine + v.detuneCt) / 100) / 12);

  function setPitch(t, glide = 0) {
    if (v.note === null) return;
    const tc = glide > 0.002 ? glide / 4 : 0.003;
    unit1.setFreq(hzFor(v.note, state.osc1), t, tc);
    unit2.setFreq(hzFor(v.note, state.osc2), t, tc);
  }

  function baseCutoff() {
    const f = state.filter;
    let oct = v.modOct;
    if (v.note !== null)
      oct += (f.keytrack / 100) * (v.note - KEY_CENTRE) / 12;
    oct += (f.velToCutoff / 100) * VEL_OCTAVES * (v.velocity - 1);
    return clamp(f.cutoff * Math.pow(2, oct), 20, 20000);
  }

  function applyCutoff(t) {
    filter.frequency.setTargetAtTime(baseCutoff(), t, 0.015);
  }

  function triggerFilterEnv(t) {
    const fe = state.filterEnv;
    const linear = state.master.curve === 'linear';
    const base = baseCutoff();
    const envAmt = clamp(state.filter.envAmount + (v.fenvOff || 0), -100, 100);
    const oct = (envAmt / 100) * ENV_OCTAVES;
    const lo = 20 - base, hi = 20000 - base;
    const peak = clamp(base * Math.pow(2, oct) - base, lo, hi);
    const sus  = clamp(base * Math.pow(2, oct * fe.sustain) - base, lo, hi);

    const fg = filterEnvGain.gain;
    cancelHold(fg, t);
    if (linear) {
      fg.linearRampToValueAtTime(peak, t + fe.attack);
      fg.linearRampToValueAtTime(sus, t + fe.attack + fe.decay);
    } else {
      fg.setTargetAtTime(peak, t, timeConstant(fe.attack));
      fg.setTargetAtTime(sus, t + fe.attack, timeConstant(fe.decay));
    }
  }

  function noteOn(note, velocity, t, detuneCt = 0) {
    v.note = note;
    v.velocity = velocity;
    v.detuneCt = detuneCt;
    v.startedAt = t;
    v.releasing = false;
    v.freeAt = Infinity;

    /* note-static modulation: velocity and keytrack sources, sampled once */
    const statics = shared.staticMods(note, velocity);
    v.modOct = statics.cutoffOct;
    v.fenvOff = statics.fenvOff;
    unit1.setDetuneBase(statics.pitchCt1, t);
    unit2.setDetuneBase(statics.pitchCt2, t);

    setPitch(t);
    applyCutoff(t);

    const linear = state.master.curve === 'linear';
    const ae = state.ampEnv;
    const decay = clamp(ae.decay * statics.ampDecayMul, 0.001, 10);
    const sustain = clamp(ae.sustain + statics.ampSusOff, 0, 1);
    const sens = ae.velToAmp / 100;
    const level = (1 - sens) + sens * velocity;

    const g = amp.gain;
    cancelHold(g, t);
    if (linear) {
      g.linearRampToValueAtTime(level, t + ae.attack);
      g.linearRampToValueAtTime(level * sustain, t + ae.attack + decay);
    } else {
      g.setTargetAtTime(level, t, timeConstant(ae.attack));
      g.setTargetAtTime(level * sustain, t + ae.attack, timeConstant(decay));
    }

    const ax = state.auxEnv;
    const ag = auxEnv.offset;
    cancelHold(ag, t);
    if (linear) {
      ag.linearRampToValueAtTime(1, t + ax.attack);
      ag.linearRampToValueAtTime(ax.sustain, t + ax.attack + ax.decay);
    } else {
      ag.setTargetAtTime(1, t, timeConstant(ax.attack));
      ag.setTargetAtTime(ax.sustain, t + ax.attack, timeConstant(ax.decay));
    }

    triggerFilterEnv(t);
  }

  function glideTo(note, t, glide, detuneCt) {
    v.note = note;
    if (detuneCt !== undefined) v.detuneCt = detuneCt;
    setPitch(t, glide);
    applyCutoff(t);
  }

  function noteOff(t) {
    if (v.releasing) return;
    v.releasing = true;
    v.releasedAt = t;

    const linear = state.master.curve === 'linear';
    const ar = state.ampEnv.release, fr = state.filterEnv.release;

    const g = amp.gain;
    cancelHold(g, t);
    if (linear) {
      g.linearRampToValueAtTime(0, t + ar);
    } else {
      g.setTargetAtTime(0, t, timeConstant(ar));
      g.setValueAtTime(0, t + ar * 3);
    }

    const fg = filterEnvGain.gain;
    cancelHold(fg, t);
    if (linear) {
      fg.linearRampToValueAtTime(0, t + fr);
    } else {
      fg.setTargetAtTime(0, t, timeConstant(fr));
      fg.setValueAtTime(0, t + fr * 3);
    }

    const xr = state.auxEnv.release;
    const ag = auxEnv.offset;
    cancelHold(ag, t);
    if (linear) {
      ag.linearRampToValueAtTime(0, t + xr);
    } else {
      ag.setTargetAtTime(0, t, timeConstant(xr));
      ag.setValueAtTime(0, t + xr * 3);
    }

    v.freeAt = t + (linear ? ar : ar * 3);
  }

  function kill(t, fade = 0.004) {
    v.releasing = true;
    v.releasedAt = t;
    v.freeAt = t + fade * 3;
    const g = amp.gain;
    cancelHold(g, t);
    g.setTargetAtTime(0, t, fade);
    g.setValueAtTime(0, t + fade * 4);
    const fg = filterEnvGain.gain;
    cancelHold(fg, t);
    fg.setTargetAtTime(0, t, 0.02);
    const ag = auxEnv.offset;
    cancelHold(ag, t);
    ag.setTargetAtTime(0, t, 0.02);
  }

  function setNoise(t) {
    const { type, level } = state.noise;
    whiteGain.gain.setTargetAtTime(type === 'white' ? level : 0, t, 0.02);
    pinkGain.gain.setTargetAtTime(type === 'pink' ? level : 0, t, 0.02);
  }

  return {
    state: v,
    noteOn, noteOff, kill, glideTo, setNoise, applyCutoff,
    retune: t => setPitch(t),
    setMixNorm: (val, t) => mixBus.gain.setTargetAtTime(val, t, 0.02),
    setDriveCurve: curve => { shaper.curve = curve; },
    isFree: now => v.note === null || (v.releasing && (now >= v.freeAt || amp.gain.value < SILENT)),
    level: () => amp.gain.value,
    setWaveform: (which, w, t) => (which === 1 ? unit1 : unit2).setWaveform(w, t),
    setMorph: (which, m, t) => (which === 1 ? unit1 : unit2).setMorph(m, t),
    setPw: (which, pw, t) => (which === 1 ? unit1 : unit2).setPw(pw, t),
    setFm: (val, t) => fmGain.gain.setTargetAtTime(fmDepth(val), t, 0.02),
    setPan: (p, t) => panner.pan.setTargetAtTime(clamp(p, -1, 1), t, 0.02),
    auxOut: auxEnv,
    setOscLevel: (which, val, t) =>
      (which === 1 ? osc1Level : osc2Level).gain.setTargetAtTime(val, t, 0.02),
    setFilterType: type => { filter.type = type; },
    setResonance: (val, t) => filter.Q.setTargetAtTime(val, t, 0.02),
    currentCutoff: () => clamp(filter.frequency.value + filterEnvGain.gain.value, 20, 20000),
    /* modulation destinations: every entry is an ARRAY of AudioParams,
       because a destination may fan out (each osc unit has two detunes) */
    dest: {
      pitch1: unit1.detunes,
      pitch2: unit2.detunes,
      pw1: [unit1.pwOffset],
      pw2: [unit2.pwOffset],
      fm: [fmGain.gain],
      cutoff: [filter.frequency],
      res: [filter.Q],
      trem: [trem.gain],
      mix2: [osc2Level.gain],
      noise: [noiseMod.gain]
    }
  };
}
