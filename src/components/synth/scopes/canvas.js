/* Shared canvas helpers for the scope/window components.
   Ports the fitCanvas() DPR-sizing helper and the loop()/redrawStatics()
   scheduling from reference/web-synth-v11.html (lines 2860–2874, 3132–3151)
   into two small pieces components can reuse:

     - fitCanvas(canvas): same DPR-aware resize-and-clear as the reference,
       keyed per-canvas via a WeakMap instead of a module-global Map so
       multiple mounted instances never collide.
     - useCanvasRedraw(ref, draw, deps): for canvases that only need to
       redraw when their props change or their container resizes (wave,
       noise, LFO, drive previews) — no animation loop involved.
     - subscribeDraw(cb): the shared half-rate requestAnimationFrame loop
       for canvases that read live audio data (filter response, scope,
       voice LEDs). The reference's loop() deliberately runs analysis
       drawing at half frame rate to keep the main thread light for audio;
       this is the same idea, just shared across every subscriber instead
       of each component running its own rAF. */

import { useEffect, useRef } from 'react';

/* reference/web-synth-v11.html line 2865 */
export const INK = '#F0A83C';
export const GRID = '#3A2E12';
export const DIM = '#8A6220';

const canvasCache = new WeakMap();

/* Verbatim port of fitCanvas() (reference lines 2860–2874): resizes the
   backing store for the current devicePixelRatio only when the CSS size
   or DPR actually changed, resets the transform, and clears. Returns the
   2d context plus the CSS-pixel width/height to draw in. */
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  let entry = canvasCache.get(canvas);
  if (!entry || entry.cssW !== r.width || entry.cssH !== r.height || entry.dpr !== dpr) {
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    entry = { cssW: r.width, cssH: r.height, dpr, c: canvas.getContext('2d') };
    canvasCache.set(canvas, entry);
  }
  const c = entry.c;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, entry.cssW, entry.cssH);
  return { c, w: entry.cssW, h: entry.cssH };
}

/* For canvases whose picture depends only on props: redraw immediately
   and whenever `deps` changes, and also whenever the container resizes
   (a folded module's canvas has zero size until it reopens — the
   reference handles that with redrawStatics() on module unfold, a
   ResizeObserver covers the same case plus window resizes for free). */
export function useCanvasRedraw(canvasRef, draw, deps) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const run = () => {
      const { c, w, h } = fitCanvas(canvas);
      draw(c, w, h);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* ---------- shared half-rate raf loop ---------- */

const subscribers = new Set();
let rafId = null;
let frameCount = 0;

function tick() {
  frameCount++;
  if (frameCount % 2 === 0) {
    subscribers.forEach(cb => cb());
  }
  rafId = requestAnimationFrame(tick);
}

/* Subscribe a draw callback to the shared half-rate loop. Returns an
   unsubscribe function. The loop itself only runs while at least one
   subscriber is registered. */
export function subscribeDraw(cb) {
  subscribers.add(cb);
  if (rafId === null) rafId = requestAnimationFrame(tick);
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/* Convenience hook: subscribe `cb` to the shared loop for as long as
   `running` is true. Draws straight to the canvas from the raf callback —
   never put per-frame values in React state. `cb` is read through a ref
   so a fresh closure every render (the common case — it closes over
   props like getScope/cutoff) doesn't force a resubscribe; only the
   `running` transition does. */
export function useLiveDraw(cb, running) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!running) return;
    return subscribeDraw(() => cbRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
}
