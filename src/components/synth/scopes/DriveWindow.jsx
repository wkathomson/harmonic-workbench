/* Port of drawDrive() (reference/web-synth-v11.html lines 2976–3004).
   Fixed contract: <DriveWindow amount />
   Prop-driven only — redraws on prop change (and container resize). */

import { useRef } from 'react';
import { useCanvasRedraw, INK, GRID, DIM } from './canvas.js';
import { makeDriveCurve } from '../../../audio/synth/curves.js';

export default function DriveWindow({ amount }) {
  const canvasRef = useRef(null);

  useCanvasRedraw(canvasRef, (c, w, h) => {
    const pad = 7;

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.beginPath(); c.moveTo(pad, h / 2 + .5); c.lineTo(w - pad, h / 2 + .5); c.stroke();
    c.beginPath(); c.moveTo(w / 2 + .5, pad); c.lineTo(w / 2 + .5, h - pad); c.stroke();

    c.strokeStyle = DIM; c.setLineDash([2, 3]); c.lineWidth = 1;
    c.beginPath();
    c.moveTo(pad, h - pad); c.lineTo(w - pad, pad);
    c.stroke();
    c.setLineDash([]);

    const curve = makeDriveCurve(amount);
    c.strokeStyle = INK; c.lineWidth = 1.7; c.beginPath();
    for (let i = 0; i < curve.length; i += 8) {
      const x = pad + (i / (curve.length - 1)) * (w - pad * 2);
      const y = h / 2 - curve[i] * (h / 2 - pad);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }, [amount]);

  return (
    <div className="drive-window screen">
      <span className="screen-tag">Transfer</span>
      <canvas ref={canvasRef} />
    </div>
  );
}
