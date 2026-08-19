/* Port of drawScope() (reference/web-synth-v11.html lines 3055–3130).
   Fixed contract: <Scope getScope getSpectrum running />

   Owns the time/spectrum toggle itself (reference's module-scoped
   `scopeMode` + the scopeToggle button + scopeTag text) as ordinary React
   state — it only changes on a click, not once per audio frame, so it
   doesn't run into the "no state writes from a raf callback" rule.

   getScope/getSpectrum may be null before audio starts — the static grid
   line and "power on to view" text are drawn either way, exactly as the
   reference's `if (!engine)` branch, until `running`. */

import { useCallback, useRef, useState } from 'react';
import { fitCanvas, useCanvasRedraw, useLiveDraw, INK, GRID, DIM } from './canvas.js';
import { clamp } from '../../../audio/synth/util.js';

export default function Scope({ getScope, getSpectrum, running, sampleRate }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('time');
  const buf = useRef(null);
  if (!buf.current) {
    buf.current = { scope: new Uint8Array(1024), spec: new Uint8Array(1024) };
  }

  const drawFrame = useCallback((c, w, h) => {
    const padT = 20, padB = 8;

    if (!running || (mode === 'time' ? !getScope : !getSpectrum)) {
      c.strokeStyle = GRID; c.lineWidth = 1;
      const mid = padT + (h - padT - padB) / 2;
      c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(w, mid + .5); c.stroke();
      c.fillStyle = DIM; c.font = '8px "DM Mono", monospace';
      c.fillText('power on to view', 8, mid + 3);
      return;
    }

    if (mode === 'time') {
      const mid = padT + (h - padT - padB) / 2;
      c.strokeStyle = GRID; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, mid + .5); c.lineTo(w, mid + .5); c.stroke();

      const scopeData = buf.current.scope;
      getScope(scopeData);

      let start = 0;
      for (let i = 1; i < scopeData.length / 2; i++) {
        if (scopeData[i - 1] < 128 && scopeData[i] >= 128) { start = i; break; }
      }

      const span = Math.floor(scopeData.length / 2);
      const amp = (h - padT - padB) / 2 * 0.92;
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath();
      for (let i = 0; i < span; i++) {
        const v = (scopeData[start + i] - 128) / 128;
        const x = (i / (span - 1)) * w;
        const y = mid - v * amp;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      return;
    }

    const specData = buf.current.spec;
    getSpectrum(specData);
    const padX = 6;
    // The reference reads engine.sampleRate to convert frequency to a bin
    // index. The route passes the context's real rate; 44.1k is the fallback
    // for the pre-power-on draw, when there is no context to ask.
    const nyquist = (sampleRate ?? 44100) / 2;
    const fLo = 40, fHi = Math.min(16000, nyquist);

    c.strokeStyle = GRID; c.lineWidth = 1;
    c.font = '8px "DM Mono", monospace'; c.fillStyle = DIM; c.textAlign = 'center';
    [100, 1000, 10000].forEach(f => {
      if (f > fHi) return;
      const x = padX + (Math.log(f / fLo) / Math.log(fHi / fLo)) * (w - padX * 2);
      c.beginPath(); c.moveTo(x + .5, padT); c.lineTo(x + .5, h - padB - 8); c.stroke();
      c.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 2);
    });

    c.strokeStyle = INK; c.lineWidth = 1.5;
    c.fillStyle = 'rgba(240,168,60,.14)';
    c.beginPath();
    let started = false;
    const N = specData.length;
    for (let px = 0; px <= w - padX * 2; px++) {
      const f = fLo * Math.pow(fHi / fLo, px / (w - padX * 2));
      const bin = clamp(Math.round((f / nyquist) * N), 0, N - 1);
      const mag = specData[bin] / 255;
      const x = padX + px;
      const y = padT + (1 - mag) * (h - padT - padB - 8);
      if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
    }
    c.stroke();
    c.lineTo(w - padX, h - padB - 8);
    c.lineTo(padX, h - padB - 8);
    c.closePath();
    c.fill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScope, getSpectrum, running, mode]);

  useCanvasRedraw(canvasRef, drawFrame, [getScope, getSpectrum, running, mode]);
  useLiveDraw(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { c, w, h } = fitCanvas(canvas);
    drawFrame(c, w, h);
  }, running);

  return (
    <div className="screen" style={{ height: 132 }}>
      <span className="screen-tag">{mode === 'time' ? 'Oscilloscope' : 'Spectrum'}</span>
      <canvas ref={canvasRef} />
      <button
        type="button"
        className="screen-toggle"
        onClick={() => setMode(m => (m === 'time' ? 'spectrum' : 'time'))}
      >
        {mode === 'time' ? 'Spectrum' : 'Scope'}
      </button>
    </div>
  );
}
