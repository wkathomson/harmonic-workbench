import { MORPH_TABLES, MORPH_HARMONICS, SH_STEPS, SH_STEP_HZ } from './constants.js';
import { generateNoise, makePulseCurve, harmonicsAt } from './curves.js';

/* --------------------------------------------------------------------------
   Tables — the morph PeriodicWave bank, noise buffers, S&H buffer and pulse
   curve that createSynth used to rebuild from scratch on every call. Several
   parts now share one AudioContext, so these are generated once per context
   and cached here instead of once per part: parts share one noise buffer
   rather than each generating its own — the same 2-second loop, inaudible,
   and it saves regenerating tables per part. Generation code is copied
   verbatim from createSynth.
   -------------------------------------------------------------------------- */
const cache = new WeakMap();

export function getTables(ctx) {
  const cached = cache.get(ctx);
  if (cached) return cached;

  const morphWaves = [];
  for (let i = 0; i < MORPH_TABLES; i++) {
    const amps = harmonicsAt(i / (MORPH_TABLES - 1));
    const real = new Float32Array(MORPH_HARMONICS + 1);
    const imag = new Float32Array(MORPH_HARMONICS + 1);
    for (let n = 1; n <= MORPH_HARMONICS; n++) imag[n] = amps[n - 1];
    morphWaves.push(ctx.createPeriodicWave(real, imag));
  }

  const noiseLen = Math.floor(ctx.sampleRate * 2);
  const buffers = {};
  for (const type of ['white', 'pink']) {
    const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    buf.copyToChannel(generateNoise(noiseLen, type), 0);
    buffers[type] = buf;
  }

  /* S&H buffer: 32 random steps looping */
  const shLen = Math.floor(ctx.sampleRate * (SH_STEPS / SH_STEP_HZ));
  const shBuffer = ctx.createBuffer(1, shLen, ctx.sampleRate);
  {
    const data = shBuffer.getChannelData(0);
    const per = Math.floor(shLen / SH_STEPS);
    for (let s = 0; s < SH_STEPS; s++) {
      const val = Math.random() * 2 - 1;
      for (let i = s * per; i < Math.min((s + 1) * per, shLen); i++) data[i] = val;
    }
  }

  const pulseCurve = makePulseCurve();

  const tables = { morphWaves, buffers, shBuffer, pulseCurve };
  cache.set(ctx, tables);
  return tables;
}
