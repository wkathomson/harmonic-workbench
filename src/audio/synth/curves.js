import { MORPH_HARMONICS } from './constants.js';

export function generateNoise(length, type) {
  const out = new Float32Array(length);
  if (type === 'white') {
    for (let i = 0; i < length; i++) out[i] = Math.random() * 2 - 1;
    return out;
  }
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

export function makeDriveCurve(amount) {
  const N = 2048;
  const curve = new Float32Array(N);
  const k = 1 + amount * 24;
  const norm = Math.tanh(k);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    curve[i] = amount < 0.001 ? x : Math.tanh(k * x) / norm;
  }
  return curve;
}

/* comparator for the pulse trick: steep but not instantaneous, trading a
   sliver of edge softness for less aliasing */
export function makePulseCurve() {
  const N = 2048;
  const curve = new Float32Array(N);
  const k = 400;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
}

export function harmonicsAt(t) {
  // anchors: 0 = sine, 0.5 = saw, 1 = bright buzz
  const amps = new Float32Array(MORPH_HARMONICS);
  const lerp = (a, b, u) => a + (b - a) * u;
  for (let n = 1; n <= MORPH_HARMONICS; n++) {
    const sine = n === 1 ? 1 : 0;
    const saw = 1 / n;
    const buzz = (n % 2 === 1 ? 1 / Math.pow(n, 0.7) : 0.15 / n);
    amps[n - 1] = t < 0.5
      ? lerp(sine, saw, t * 2)
      : lerp(saw, buzz, (t - 0.5) * 2);
  }
  return amps;
}

export const fmDepth = x => x * x * 4000;   // squared taper: gentle low end, wild top
