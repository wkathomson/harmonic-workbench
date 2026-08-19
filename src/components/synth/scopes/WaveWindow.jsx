/* Port of drawWave() (reference/web-synth-v11.html lines 2888–2927).
   Fixed contract: <WaveWindow which waveform morph pw />
   Prop-driven only — redraws on prop change (and container resize), no
   animation loop, per useCanvasRedraw. */

import { useRef } from 'react';
import { useCanvasRedraw, INK, GRID } from './canvas.js';
import { harmonicsAt } from '../../../audio/synth/curves.js';

function shapeValue(type, ph) {
  switch (type) {
    case 'sine':     return Math.sin(ph * 2 * Math.PI);
    case 'triangle': return 4 * Math.abs(ph - 0.5) - 1;
    case 'sawtooth': return 2 * ph - 1;
    case 'square':   return ph < 0.5 ? 1 : -1;
    default:         return 0;
  }
}

/* wavetable preview: sum the same harmonic recipe the engine uses */
function morphValue(t, ph) {
  const amps = harmonicsAt(t);
  let v = 0;
  for (let n = 1; n <= 24; n++) v += amps[n - 1] * Math.sin(2 * Math.PI * n * ph);
  return v;
}

export default function WaveWindow({ which, waveform, morph, pw }) {
  const canvasRef = useRef(null);

  useCanvasRedraw(canvasRef, (c, w, h) => {
    const mid = h / 2, amp = h * 0.29;

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(w, mid + .5); c.stroke();

    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath();

    if (waveform === 'wave') {
      const vals = [];
      let peak = 0.0001;
      for (let i = 0; i <= w; i++) {
        const v = morphValue(morph, (i / w) * 2 % 1);
        vals.push(v);
        peak = Math.max(peak, Math.abs(v));
      }
      vals.forEach((v, i) => {
        const y = mid - (v / peak) * amp;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      });
    } else if (waveform === 'pulse') {
      const duty = pw;
      for (let i = 0; i <= w; i++) {
        const ph = (i / w) * 2 % 1;
        const y = mid - (ph < duty ? 1 : -1) * amp;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      }
    } else {
      for (let i = 0; i <= w; i++) {
        const y = mid - shapeValue(waveform, (i / w) * 2 % 1) * amp;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      }
    }
    c.stroke();
  }, [which, waveform, morph, pw]);

  return (
    <div className="wave-window screen">
      <span className="screen-tag">Wave</span>
      <canvas ref={canvasRef} />
    </div>
  );
}
