/* Port of drawResponse() (reference/web-synth-v11.html lines 3006–3053).
   Fixed contract: <FilterResponse getResponse cutoff resonance type running />

   `getResponse(freqs, mag, phase)` mirrors engine.getFilterResponse(...) in
   the reference — it fills the three typed arrays we own and reuse every
   frame. `cutoff` is the plain knob value (not the reference's live
   engine.effectiveCutoff(), which reads instantaneous envelope-modulated
   cutoff off the audio graph every frame — no such per-frame getter exists
   in this fixed contract, and turning it into one would mean re-rendering
   React on every audio frame, which CLAUDE.md's audio rules forbid). The
   cutoff marker line and readout use the static knob value instead; this is
   a deliberate, documented simplification.

   `resonance` and `type` are accepted for parity with the Filter module's
   own values (and for the aria-label) but aren't otherwise drawn — the
   reference doesn't draw them either: engine.getFilterResponse() already
   bakes resonance and filter type into the curve, drawResponse() never
   reads them directly.

   getResponse may be null before audio starts — the static grid/labels are
   drawn either way, but the trace and cutoff marker are skipped, exactly as
   the reference's `if (!engine)` branch does, until `running`. */

import { useCallback, useRef } from 'react';
import { fitCanvas, useCanvasRedraw, useLiveDraw, INK, GRID, DIM } from './canvas.js';
import { clamp } from '../../../audio/synth/util.js';
import { P } from '../params.js';

const RESP_N = 220;

export default function FilterResponse({ getResponse, cutoff, resonance, type, running }) {
  const canvasRef = useRef(null);
  const readRef = useRef(null);
  const buf = useRef(null);
  if (!buf.current) {
    buf.current = {
      freqs: new Float32Array(RESP_N),
      mag: new Float32Array(RESP_N),
      phase: new Float32Array(RESP_N),
    };
    for (let i = 0; i < RESP_N; i++) buf.current.freqs[i] = 20 * Math.pow(1000, i / (RESP_N - 1));
  }

  const drawFrame = useCallback((c, w, h) => {
    const padT = 20, padB = 12, padX = 6;

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.font = '8px "DM Mono", monospace'; c.fillStyle = DIM; c.textAlign = 'center';
    [100, 1000, 10000].forEach(f => {
      const x = padX + (Math.log(f / 20) / Math.log(1000)) * (w - padX * 2);
      c.beginPath(); c.moveTo(x + .5, padT); c.lineTo(x + .5, h - padB); c.stroke();
      c.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 3);
    });

    if (!running || !getResponse) {
      c.textAlign = 'left'; c.fillText('power on to view', padX + 2, h / 2);
      if (readRef.current) readRef.current.textContent = '—';
      return;
    }

    const { freqs, mag, phase } = buf.current;
    getResponse(freqs, mag, phase);
    const yFor = db => padT + (1 - (clamp(db, -40, 24) + 40) / 64) * (h - padT - padB);

    c.strokeStyle = GRID;
    c.beginPath(); c.moveTo(padX, yFor(0) + .5); c.lineTo(w - padX, yFor(0) + .5); c.stroke();

    c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath();
    for (let i = 0; i < RESP_N; i++) {
      const x = padX + (i / (RESP_N - 1)) * (w - padX * 2);
      const y = yFor(20 * Math.log10(Math.max(mag[i], 1e-6)));
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    const fc = cutoff;
    const xc = padX + (Math.log(clamp(fc, 20, 20000) / 20) / Math.log(1000)) * (w - padX * 2);
    c.strokeStyle = 'rgba(240,168,60,.5)'; c.lineWidth = 1; c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(xc, padT); c.lineTo(xc, h - padB); c.stroke();
    c.setLineDash([]);
    if (readRef.current) readRef.current.textContent = P['filter.cutoff'].fmt(fc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getResponse, cutoff, running]);

  useCanvasRedraw(canvasRef, drawFrame, [getResponse, cutoff, resonance, type, running]);
  useLiveDraw(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { c, w, h } = fitCanvas(canvas);
    drawFrame(c, w, h);
  }, running);

  return (
    <div
      className="screen"
      style={{ height: 132 }}
      aria-label={`Filter response, ${type}, resonance ${resonance}`}
    >

      <span className="screen-tag">Filter response</span>
      <span className="screen-read" ref={readRef}>—</span>
      <canvas ref={canvasRef} />
    </div>
  );
}
