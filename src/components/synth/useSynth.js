// Holds the synth engine for a React tree: one shared mixer, one part.
//
// The engine lives in refs, never in state. A knob drag fires ~60 pointermove
// events a second, and running the reconciler on each one competes with the
// audio thread. Components keep their own displayed value in state; the write
// to the engine is an imperative setParam call.
//
// `start()` is idempotent and must be called from a user gesture. The promise
// guard means several controls touched at once share one construction rather
// than racing to build two contexts.

import { useCallback, useRef } from "react";
import { ensureAudio } from "../../audio/context.js";
import { createMixer } from "../../audio/synth/mixer.js";
import { createPart } from "../../audio/synth/part.js";

export function useSynth(opts = {}) {
  const mixerRef = useRef(null);
  const partRef = useRef(null);
  const initRef = useRef(null);

  const start = useCallback(async () => {
    if (!initRef.current) {
      initRef.current = (async () => {
        const { ctx, crusherReady } = await ensureAudio();
        mixerRef.current = createMixer(ctx);
        partRef.current = createPart(ctx, mixerRef.current, { crusherReady, ...opts });
      })();
    }
    await initRef.current;
    return { mixer: mixerRef.current, part: partRef.current };
  // opts is read once at construction; changing it later does not rebuild the part
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mixerRef, partRef, start };
}
