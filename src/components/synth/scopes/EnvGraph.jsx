/* Port of makeEnvGraph() (reference/web-synth-v11.html lines 2731–2820).
   Fixed contract: <EnvGraph prefix values={{ attack, decay, sustain, release }} />
   The reference builds this as imperative SVG with draggable handles that
   write back into the synth's shared `shadow`/`apply()` state. That write
   path has no equivalent in the fixed contract (no onChange prop), so this
   port keeps the geometry and visuals verbatim — axis lines, area/path
   fills, and the three a/d/r handle dots — as plain declarative SVG driven
   by `values`, and drops the pointerdown/pointermove drag wiring. Purely
   prop-driven: React re-renders the path/handle attributes on prop change,
   there is no imperative redraw() call or canvas involved. */

import { clamp } from '../../../audio/synth/util.js';

const W = 300, H = 74, PAD = 8, SUSW = 52;
const UNIT = (W - SUSW - PAD * 2) / 3;
const TOP = PAD, BOT = H - PAD;

/* Every env prefix (filterEnv/ampEnv/auxEnv) shares this shape in P
   (reference/params.js lines 27–30, 50–53, 54–57) — attack/decay/release
   are exponential-mapped knobs, sustain is already a plain 0–1 fraction. */
const RANGES = {
  attack:  { min: 0.001, max: 5,  curve: 'exp' },
  decay:   { min: 0.001, max: 5,  curve: 'exp' },
  release: { min: 0.001, max: 10, curve: 'exp' },
};

const toNorm = (v, d) =>
  Math.log(clamp(v, d.min, d.max) / d.min) / Math.log(d.max / d.min);

function geom(values) {
  const nA = toNorm(values.attack, RANGES.attack);
  const nD = toNorm(values.decay, RANGES.decay);
  const nR = toNorm(values.release, RANGES.release);
  const s = clamp(values.sustain, 0, 1);
  const x1 = PAD + nA * UNIT;
  const x2 = x1 + nD * UNIT;
  const x3 = x2 + SUSW;
  return { x1, x2, x3, x4: x3 + nR * UNIT, ys: BOT - s * (BOT - TOP) };
}

export default function EnvGraph({ prefix, values }) {
  const { x1, x2, x3, x4, ys } = geom(values);
  const d = `M ${PAD} ${BOT} L ${x1} ${TOP} L ${x2} ${ys} L ${x3} ${ys} L ${x4} ${BOT}`;
  const handles = [
    { id: 'a', cx: x1, cy: TOP },
    { id: 'd', cx: x2, cy: ys },
    { id: 'r', cx: x4, cy: BOT },
  ];

  return (
    <div className="env-graph screen" data-prefix={prefix}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line className="env-axis" x1={PAD} y1={BOT} x2={W - PAD} y2={BOT} />
        <line className="env-axis" x1={PAD} y1={TOP} x2={W - PAD} y2={TOP} />
        <path className="env-area" d={`${d} Z`} />
        <path className="env-path" d={d} />
        {handles.map(g => (
          <g key={g.id} data-id={g.id}>
            <circle className="env-hit" r={11} cx={g.cx} cy={g.cy} />
            <circle className="env-handle" r={4} cx={g.cx} cy={g.cy} />
          </g>
        ))}
      </svg>
    </div>
  );
}
