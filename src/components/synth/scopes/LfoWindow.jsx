/* Port of drawLfo() (reference/web-synth-v11.html lines 2929–2954).
   Fixed contract: <LfoWindow which shape />
   Prop-driven only — redraws on prop change (and container resize). */

import { useRef } from 'react';
import { useCanvasRedraw, INK, GRID } from './canvas.js';

function shapeValue(type, ph) {
  switch (type) {
    case 'sine':     return Math.sin(ph * 2 * Math.PI);
    case 'triangle': return 4 * Math.abs(ph - 0.5) - 1;
    case 'sawtooth': return 2 * ph - 1;
    case 'square':   return ph < 0.5 ? 1 : -1;
    default:         return 0;
  }
}

/* Fixed once at module load, exactly as the reference's module-scoped
   shPreview — the sample-&-hold preview is a stable-looking squiggle, not
   re-randomised on every redraw. */
const shPreview = Array.from({ length: 16 }, () => Math.random() * 2 - 1);

export default function LfoWindow({ which, shape }) {
  const canvasRef = useRef(null);

  useCanvasRedraw(canvasRef, (c, w, h) => {
    const mid = h / 2, amp = h * 0.3;

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(w, mid + .5); c.stroke();

    c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath();
    if (shape === 'sample-hold') {
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const v = shPreview[s % shPreview.length];
        const x0 = (s / steps) * w, x1 = ((s + 1) / steps) * w;
        const y = mid - v * amp;
        s === 0 ? c.moveTo(x0, y) : c.lineTo(x0, y);
        c.lineTo(x1, y);
      }
    } else {
      for (let i = 0; i <= w; i++) {
        const y = mid - shapeValue(shape, (i / w) * 2 % 1) * amp;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      }
    }
    c.stroke();
  }, [which, shape]);

  return (
    <div className="lfo-window screen">
      <span className="screen-tag">Shape</span>
      <canvas ref={canvasRef} />
    </div>
  );
}
