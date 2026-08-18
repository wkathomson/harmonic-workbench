// The application's musical clock.
//
// Everything with a tempo — the Workbench sequencer, the arpeggiator, LFO
// sync, delay sync — derives its timing from here. Timer callbacks decide
// *what* to schedule; the audio clock decides *when* it sounds.
//
// This wraps Tone.Transport rather than replacing it. The Workbench already
// drives its drums, sequencer Parts and MIDI clock from Tone.Transport, and a
// second lookahead scheduler alongside it would mean two clocks drifting apart
// with no way to schedule a synth note against a sequencer step. Tone.Transport
// already is a lookahead scheduler with sample-accurate scheduling, so this
// module is an adapter that gives it the subscribe() contract the synth engine
// expects, not a reimplementation.
//
// Tone.Transport is a singleton, so this returns one shared wrapper rather than
// constructing a new transport per call.

import * as Tone from "tone";

let wrapper = null;

export function getTransport() {
  if (wrapper) return wrapper;

  const tr = () => Tone.getTransport();

  const beatAt = (time) => {
    try {
      return tr().getTicksAtTime(time) / tr().PPQ;
    } catch {
      return tr().ticks / tr().PPQ;
    }
  };

  wrapper = {
    start() {
      if (tr().state !== "started") tr().start();
    },
    stop() {
      tr().stop();
    },
    isRunning: () => tr().state === "started",

    setTempo(bpm) {
      tr().bpm.value = bpm;
    },
    getTempo: () => tr().bpm.value,
    currentBeat: () => beatAt(Tone.now()),

    // `division` is Tone notation ('4n', '8t', '16n' …) so the interval stays
    // tempo-relative: changing tempo mid-run re-times the remaining steps
    // forward instead of leaving scheduled events stranded.
    //
    // The callback receives (beat, audioTime). audioTime is an audio-clock
    // time in the lookahead window — subscribers must schedule against it and
    // never play immediately.
    subscribe(cb, division = "16n") {
      const id = tr().scheduleRepeat((time) => cb(beatAt(time), time), division);
      return () => tr().clear(id);
    },
  };
  return wrapper;
}
