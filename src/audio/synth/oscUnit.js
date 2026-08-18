import { clamp } from './util.js';
import { MORPH_TABLES } from './constants.js';

/* --------------------------------------------------------------------------
   Oscillator unit. Three personalities behind one interface:
   - native shapes: oscA alone through the direct gain
   - pulse: oscA as saw + DC offset → comparator → dc-block
   - wavetable: oscA and oscB hold ADJACENT tables, crossfaded by the
     fractional morph position — continuous interpolation, and each osc's
     table only ever changes while its own gain is near zero
   -------------------------------------------------------------------------- */
export function createOscUnit(ctx, cfg, shared, morph) {
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const direct = ctx.createGain();
  const directB = ctx.createGain();
  directB.gain.value = 0;
  const out = ctx.createGain();
  out.gain.value = 1;

  const pwSum = ctx.createGain();
  const pwConst = ctx.createConstantSource();
  pwConst.offset.value = cfg.pw * 2 - 1;
  const comparator = ctx.createWaveShaper();
  comparator.curve = shared.pulseCurve;
  comparator.oversample = '4x';
  const dcBlock = ctx.createBiquadFilter();
  dcBlock.type = 'highpass';
  dcBlock.frequency.value = 8;
  dcBlock.Q.value = 0.5;
  const pulseGain = ctx.createGain();

  oscA.connect(direct).connect(out);
  oscB.connect(directB).connect(out);
  oscA.connect(pwSum);
  pwConst.connect(pwSum);
  pwSum.connect(comparator).connect(dcBlock).connect(pulseGain).connect(out);

  let waveform = cfg.waveform;
  let morphVal = morph;

  const tables = m => {
    const x = clamp(m, 0, 1) * (MORPH_TABLES - 1);
    const idx = Math.min(MORPH_TABLES - 2, Math.floor(x));
    return { a: shared.morphWaves[idx], b: shared.morphWaves[idx + 1], frac: x - idx };
  };

  function applyMode(t, tc = 0.008) {
    const pulse = waveform === 'pulse';
    let gA = 1, gB = 0;
    if (waveform === 'wave') {
      const { a, b, frac } = tables(morphVal);
      oscA.setPeriodicWave(a);
      oscB.setPeriodicWave(b);
      gA = 1 - frac;
      gB = frac;
    } else {
      oscA.type = pulse ? 'sawtooth' : waveform;
      if (pulse) gA = 0;
    }
    direct.gain.setTargetAtTime(gA, t, tc);
    directB.gain.setTargetAtTime(gB, t, tc);
    pulseGain.gain.setTargetAtTime(pulse ? 1 : 0, t, tc);
  }
  applyMode(0, 0.001);

  oscA.start();
  oscB.start();
  pwConst.start();

  return {
    out,
    detunes: [oscA.detune, oscB.detune],
    pwOffset: pwConst.offset,
    fmTarget: oscA.frequency,
    setFreq(hz, t, tc) {
      oscA.frequency.setTargetAtTime(hz, t, tc);
      oscB.frequency.setTargetAtTime(hz, t, tc);
    },
    setDetuneBase(ct, t) {
      oscA.detune.setTargetAtTime(ct, t, 0.003);
      oscB.detune.setTargetAtTime(ct, t, 0.003);
    },
    setWaveform(w, t) { waveform = w; applyMode(t); },
    setMorph(m, t) { morphVal = m; if (waveform === 'wave') applyMode(t, 0.012); },
    setPw(pw, t) { pwConst.offset.setTargetAtTime(pw * 2 - 1, t, 0.01); }
  };
}
