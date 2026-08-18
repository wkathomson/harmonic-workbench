import { SH_STEP_HZ } from './constants.js';

/* --------------------------------------------------------------------------
   LFO — oscillator for the four analytic shapes, looping random-step buffer
   for sample & hold, crossfaded by shape selection
   -------------------------------------------------------------------------- */
export function createLFO(ctx, cfg, shBuffer) {
  const osc = ctx.createOscillator();
  osc.type = cfg.shape === 'sample-hold' ? 'sine' : cfg.shape;
  osc.frequency.value = cfg.rate;

  const sh = ctx.createBufferSource();
  sh.buffer = shBuffer;
  sh.loop = true;
  sh.playbackRate.value = cfg.rate / SH_STEP_HZ;

  const oscGain = ctx.createGain();
  const shGain = ctx.createGain();
  oscGain.gain.value = cfg.shape === 'sample-hold' ? 0 : 1;
  shGain.gain.value = cfg.shape === 'sample-hold' ? 1 : 0;

  const out = ctx.createGain();
  out.gain.value = 1;

  osc.connect(oscGain).connect(out);
  sh.connect(shGain).connect(out);
  osc.start();
  sh.start();

  return {
    out,
    freqParam: osc.frequency,   // exposed as a mod destination
    setShape(shape, t) {
      if (shape !== 'sample-hold') osc.type = shape;
      oscGain.gain.setTargetAtTime(shape === 'sample-hold' ? 0 : 1, t, 0.02);
      shGain.gain.setTargetAtTime(shape === 'sample-hold' ? 1 : 0, t, 0.02);
    },
    setRate(hz, t) {
      osc.frequency.setTargetAtTime(hz, t, 0.02);
      sh.playbackRate.setTargetAtTime(hz / SH_STEP_HZ, t, 0.02);
    }
  };
}
