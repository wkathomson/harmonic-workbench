// Holds the synth engine for a React tree.
//
// The engine lives in a ref, never in state: a knob drag fires ~60
// pointermove events a second, and running the reconciler on each one
// competes with the audio thread. Components keep their own displayed value
// in state and write to the engine imperatively.
//
// `start()` is idempotent and must be called from a user gesture. The promise
// guard means several controls touched at once share one construction.

import { useCallback, useRef } from "react";
import { ensureAudio } from "../../audio/context.js";
import { createSynth } from "../../audio/synth/synth.js";

export function useSynth() {
  const engineRef = useRef(null);
  const initRef = useRef(null);

  const start = useCallback(async () => {
    if (!initRef.current) {
      initRef.current = (async () => {
        const { ctx, crusherReady } = await ensureAudio();
        engineRef.current = createSynth(ctx, crusherReady);
      })();
    }
    await initRef.current;
    return engineRef.current;
  }, []);

  return { engineRef, start };
}
