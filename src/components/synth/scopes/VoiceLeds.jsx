/* Port of drawVoices() (reference/web-synth-v11.html lines 2698–2729).
   Fixed contract: <VoiceLeds getVoiceStates running />

   Not a canvas — the reference writes background/boxShadow directly onto
   eight <span class="vled"> elements every frame, which this keeps as
   direct DOM writes through refs rather than React state (never write a
   per-frame value into state — same rule as the canvas scopes).

   The reference's `!engine` fallback greys LEDs past `shadow['voice.count']`
   so the pool preview still shows how many voices are configured before
   power-on. This fixed contract only hands VoiceLeds `getVoiceStates` and
   `running`, with no voice-count value, so that per-count preview can't be
   reproduced here; the `!running` (or empty-states) path instead clears
   every LED to its idle look and reads "idle", same as the reference
   shows once the pool text itself is concerned — see the reference's
   `poolRead.textContent = 'idle'` line, which this matches exactly even
   though the per-LED greying does not. */

import { useCallback, useEffect, useRef } from 'react';
import { useLiveDraw } from './canvas.js';
import { clamp } from '../../../audio/synth/util.js';

const VOICE_COUNT = 8;

export default function VoiceLeds({ getVoiceStates, running }) {
  const ledRefs = useRef([]);
  const readRef = useRef(null);

  const draw = useCallback(() => {
    const states = running && getVoiceStates ? getVoiceStates() : null;

    if (!states || !states.length) {
      ledRefs.current.forEach(el => {
        if (!el) return;
        delete el.dataset.disabled;
        el.style.background = '';
        el.style.boxShadow = '';
      });
      if (readRef.current) readRef.current.textContent = 'idle';
      return;
    }

    let lit = 0, enabled = 0;
    states.forEach((s, i) => {
      const el = ledRefs.current[i];
      if (!el) return;
      if (!s.enabled) {
        el.dataset.disabled = 'true';
        el.style.background = '';
        el.style.boxShadow = '';
        return;
      }
      enabled++;
      delete el.dataset.disabled;
      const g = clamp(s.level, 0, 1);
      if (g > 0.004) lit++;
      const b = Math.pow(g, 0.6);
      el.style.background = `rgb(${58 + b * 182}, ${36 + b * 132}, ${16 + b * 44})`;
      el.style.boxShadow = b > 0.05
        ? `0 0 ${(b * 8).toFixed(1)}px ${(b * 1.6).toFixed(1)}px rgba(240,168,60,${(b * .8).toFixed(2)}), inset 0 0 0 1px rgba(0,0,0,.45)`
        : '0 0 0 1px rgba(0,0,0,.55) inset, 0 1px 0 rgba(255,255,255,.42)';
    });
    if (readRef.current) {
      readRef.current.textContent = lit ? `${lit} of ${enabled} sounding` : `${enabled} available`;
    }
  }, [getVoiceStates, running]);

  /* one paint on mount and whenever running/getVoiceStates changes, so the
     idle look is correct even while the shared raf loop is inactive */
  useEffect(() => { draw(); }, [draw]);
  useLiveDraw(draw, running);

  return (
    <div className="pool">
      <span className="pool-legend">Voice activity</span>
      <div className="vleds">
        {Array.from({ length: VOICE_COUNT }, (_, i) => (
          <span
            key={i}
            className="vled"
            title={`Voice ${i + 1}`}
            ref={el => { ledRefs.current[i] = el; }}
          />
        ))}
      </div>
      <div className="pool-read" ref={readRef}>idle</div>
    </div>
  );
}
