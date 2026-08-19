/* Port of drawNoise() (reference/web-synth-v11.html lines 2956–2974).
   Fixed contract: <NoiseWindow type />
   Prop-driven only — redraws on prop change (and container resize). Each
   redraw regenerates a fresh noise sample, exactly as the reference does;
   it is not an animation loop, just a new "grain" preview each time the
   noise type is picked. */

import { useRef } from 'react';
import { useCanvasRedraw, INK, GRID } from './canvas.js';
import { generateNoise } from '../../../audio/synth/curves.js';
import { clamp } from '../../../audio/synth/util.js';

export default function NoiseWindow({ type }) {
  const canvasRef = useRef(null);

  useCanvasRedraw(canvasRef, (c, w, h) => {
    const mid = h / 2, amp = h * 0.34;

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(w, mid + .5); c.stroke();

    const n = Math.max(2, Math.round(w));
    const data = generateNoise(n, type);
    const gain = type === 'pink' ? 3.2 : 1;

    c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath();
    for (let i = 0; i < n; i++) {
      const y = mid - clamp(data[i] * gain, -1, 1) * amp;
      i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
    }
    c.stroke();
  }, [type]);

  return (
    <div className="wave-window screen">
      <span className="screen-tag">Grain</span>
      <canvas ref={canvasRef} />
    </div>
  );
}
