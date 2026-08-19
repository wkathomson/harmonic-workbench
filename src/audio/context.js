// The application's single AudioContext.
//
// Everything that makes sound — the Tone.js engine (drums, sequencer, the
// existing tonal voices) and the extracted synth engine — runs on this one
// context. Two contexts would mean two clocks running at slightly different
// rates, and no way to schedule a synth note against a sequencer step.
//
// Construction is lazy and must happen inside a user gesture: a context built
// at module load is created suspended and swallows the first note. The promise
// guard means concurrent callers (a knob drag and a key press arriving in the
// same tick) share one construction rather than racing to build two.
//
// The bitcrusher worklet module is loaded here, before any graph is built, so
// createSynth/createPart can construct the node synchronously and know whether
// it is available. Loading it late and swapping the node in would leave the
// crush controls silently connected to nothing on a failed load.
//
// Per the audio architecture rules there is no DOM access here: the context
// constructor comes off globalThis, nothing is read from the page.

import * as Tone from "tone";
import { loadCrusher } from "./synth/crusher.js";

let ctx = null;
let crusherReady = false;
let initPromise = null;

// Resolves to the shared context, resuming it if the browser suspended it.
// Safe to call on every gesture — the expensive half runs once.
export async function ensureAudio() {
  if (!initPromise) {
    initPromise = (async () => {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      ctx = new Ctor({ latencyHint: "interactive" });

      crusherReady = await loadCrusher(ctx);

      // Hand the same context to Tone. `disposeOld: true` closes the context
      // Tone would otherwise have created for itself, so only ours survives.
      Tone.setContext(ctx, true);
    })();
  }
  await initPromise;
  if (ctx.state === "suspended") await ctx.resume();
  return { ctx, crusherReady };
}

// Synchronous accessors for code that already knows audio is running.
// Both return falsy before the first ensureAudio() call.
export const getAudioContext = () => ctx;
export const isCrusherReady = () => crusherReady;
