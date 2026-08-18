// Tone.js audio engine.
//
// Public surface used by the app:
//   init()                          — must run from a user gesture
//   note(midi, dur, vel, v)         — fire a single note now
//   chord(notes, dur, voice)        — fire a chord now ("chord" voice layers piano+pad)
//   drum(which, time, vel)          — fire a drum hit
//   play(events, cbs, total, loop, onStep, onEnd)
//   stop()                          — kill anything playing
//   setBpm(n)                       — live tempo (also re-syncs delay time)
//   setLooping(bool)                — live loop toggle
//   setVoiceGain(v, 0..1)           — per-voice mixer fader
//   setMasterGain(0..1)             — master fader
//   setVoicePreset(v, presetKey)    — switch waveform for a voice
//   setVoiceMacro(v, name, value)   — set attack / decay / release / tone / reverb / delay (0..1)
//   setReverbSize(seconds)          — global reverb decay
//   setDelayTime(subdivision)       — delay time, BPM-synced ("8n.", "4n", etc.)
//   setDelayFeedback(0..1)          — delay regeneration amount
//   setDelayPingPong(bool)          — swap between mono FeedbackDelay and stereo PingPongDelay
//
// Signal path per tonal voice:
//   synth → toneFilter (Tone macro) → channelGain (mixer fader) → master
//                                          ↓                   ↓
//                                  reverbSend → reverb → master
//                                  delaySend  → delay  → master
//
// Drums share a `drums` mixer channel with a fixed light reverb send.

import * as Tone from "tone";
import {
  VOICE_PRESETS,
  macroToCutoff, macroToAttack, macroToDecay, macroToSustain, macroToRelease,
  buildInitialVoiceState,
} from "./presets.js";
import { CHORD_DESIGN_DEFAULTS, expandChord } from "./chordDesign.js";
import { ensureAudio } from "./context.js";
import {
  sendNoteOn as midiOn,
  sendNoteOff as midiOff,
  panic as midiPanic,
  sendClockStart, sendClockStop, sendClockTick,
} from "./midiOutput.js";

// GM drum-map: kit-key → standard MIDI drum note.
// Same constants as the MIDI export so the live stream and the file render
// match note-for-note when they hit Ableton.
const GM_DRUM_NOTE = {
  kick: 36, snare: 38, clap: 39, hatClosed: 42, hatOpen: 46,
};

// Default per-voice channel levels.
const VOICE_DEFAULTS = {
  piano:  0.80,
  pad:    0.50,    // pad layers under piano by default; user blends via mixer
  bass:   1.00,
  acid:   0.55,
  melody: 0.70,
  arp:    0.65,
  drums:  0.85,
};

const beats = (b) => ({ "4n": b });
const TONAL_VOICES = ["piano", "pad", "bass", "acid", "melody", "arp"];

class AudioEngine {
  constructor() {
    this.started = false;
    this.voices = null;
    this.gains = null;
    this.toneFilters = null;
    this.reverbSends = null;     // per-voice send to reverb bus
    this.delaySends  = null;     // per-voice send to delay bus
    this.master = null;
    this.reverb = null;
    this.delay = null;
    this.parts = [];
    this.endScheduleId = null;
    this.voiceState = buildInitialVoiceState();

    // Cached FX state (so the engine survives re-creation of nodes for ping-pong swap).
    this._delayTime = "8n.";
    this._delayFeedback = 0.25;
    this._delayPingPong = false;
    this._reverbDecay = 2.5;

    // Chord-design state (strum, spread, humanise). Applied to every chord
    // event — both live audition and scheduled playback (which calls
    // expandChord directly with this state).
    this._chordDesign = { ...CHORD_DESIGN_DEFAULTS };

    // MIDI output. When `enabled`, every scheduled note also fires as a
    // MIDI message to `port`. When `monitor` is true the local Tone.js
    // synths still play in parallel (for headphone monitoring). When
    // `clock` is true, MIDI Clock + Start/Stop drive a slave (Ableton, M8,
    // Tracker etc.) so it stays in sync with our transport.
    this._midi = {
      enabled: false,
      port: null,
      monitor: true,
      clock: false,
      // 0-indexed channels (UI displays them 1-indexed). GM defaults: drums
      // on channel 10 (index 9) so it routes to the standard drum slot.
      channels: { chord: 0, bass: 1, melody: 2, arp: 3, drums: 9 },
    };
    // Tone.Transport schedule id for the recurring clock-tick callback.
    this._midiClockId = null;
  }

  // ---- MIDI output --------------------------------------------------------

  setMidiPort(port) {
    if (this._midi.port && this._midi.port !== port) midiPanic(this._midi.port);
    this._midi.port = port;
  }

  setMidiEnabled(b) {
    if (!b && this._midi.enabled && this._midi.port) midiPanic(this._midi.port);
    this._midi.enabled = !!b;
    this._syncMidiClockSchedule();
  }

  setMidiMonitor(b) { this._midi.monitor = !!b; }

  setMidiChannels(patch) {
    this._midi.channels = { ...this._midi.channels, ...patch };
  }

  setMidiClock(b) {
    this._midi.clock = !!b;
    this._syncMidiClockSchedule();
  }

  // Schedule (or unschedule) the 24-PPQN tick callback as needed. Re-runs
  // whenever clock/enabled/port changes so the tick is only firing when
  // it's actually being used.
  _syncMidiClockSchedule() {
    const transport = Tone.getTransport();
    if (this._midiClockId !== null) {
      try { transport.clear(this._midiClockId); } catch {}
      this._midiClockId = null;
    }
    if (!this._midi.enabled || !this._midi.clock || !this._midi.port) return;
    // 24 ticks per quarter note. "16n" = sixteenth = 4 ticks; we need 24
    // per quarter, so use a scheduleRepeat at the per-tick interval. Tone
    // doesn't have a notation for "1/24 of a quarter", so pass seconds
    // computed from the live BPM.
    const tickSec = 60 / (transport.bpm.value * 24);
    this._midiClockId = transport.scheduleRepeat((time) => {
      const ms = this._audioToPerformance(time);
      sendClockTick(this._midi.port, ms);
    }, tickSec);
  }

  // Convert a Tone.js audio-context time (sec) to a performance.now()
  // timestamp (ms) that Web MIDI can schedule against. The two clocks
  // tick on different rates and origins; this snapshot should drift only
  // a few ms over a typical session, which is well below MIDI's audible
  // jitter floor for note events.
  _audioToPerformance(audioTimeSec) {
    const audioNow = Tone.now();
    const aheadMs = (audioTimeSec - audioNow) * 1000;
    return performance.now() + aheadMs;
  }

  _voiceToChannel(voice) {
    if (voice === "piano" || voice === "pad")  return this._midi.channels.chord;
    if (voice === "bass"  || voice === "acid") return this._midi.channels.bass;
    if (voice === "melody")                    return this._midi.channels.melody;
    if (voice === "arp")                       return this._midi.channels.arp;
    if (voice === "drums")                     return this._midi.channels.drums;
    return null;
  }

  // Fire a MIDI note-on at `time` and a matching note-off `durSec` later.
  // No-op if MIDI is off or the event is flagged `midiSilent` (used for
  // pad-events-in-both-mode, where the piano voice already carries the chord).
  _maybeSendMidi(value, time, durSec) {
    if (!this._midi.enabled || !this._midi.port) return;
    if (value.midiSilent) return;
    const channel = this._voiceToChannel(value.voice);
    if (channel == null) return;
    const note = value.voice === "drums" ? GM_DRUM_NOTE[value.drum] : value.midi;
    if (note == null) return;
    const onMs  = this._audioToPerformance(time);
    const offMs = onMs + Math.max(20, durSec * 1000);
    const vel   = Math.max(1, Math.min(127, Math.round((value.vel ?? 0.7) * 127)));
    midiOn (this._midi.port, channel, note, vel, onMs);
    midiOff(this._midi.port, channel, note,      offMs);
  }

  // Public read for the App so playOnce can use the same expansion logic.
  getChordDesign() { return this._chordDesign; }

  setChordDesign(patch) {
    this._chordDesign = { ...this._chordDesign, ...patch };
  }

  // ---- Setup --------------------------------------------------------------

  async init() {
    if (this.started) return;
    // Build (or reuse) the application's one AudioContext and give it to Tone
    // before any Tone node exists, so the synth engine and Tone share a clock.
    await ensureAudio();
    await Tone.start();

    this.master = new Tone.Gain(0.7).toDestination();

    // Reverb. Decay (size) is tweakable later via setReverbSize.
    this.reverb = new Tone.Reverb({ decay: this._reverbDecay, preDelay: 0.02, wet: 1 });
    await this.reverb.ready;
    this.reverb.connect(this.master);

    // Delay. We keep a reference and can swap to a PingPongDelay later.
    this.delay = this._buildDelay(this._delayPingPong);
    this.delay.connect(this.master);

    // Per-voice mixer channels.
    this.gains = {};
    for (const [v, level] of Object.entries(VOICE_DEFAULTS)) {
      this.gains[v] = new Tone.Gain(level).connect(this.master);
    }

    // Per-voice tone filter + per-voice reverb/delay sends.
    this.toneFilters = {};
    this.reverbSends = {};
    this.delaySends  = {};
    for (const v of TONAL_VOICES) {
      const filt = new Tone.Filter({ type: "lowpass", frequency: 8000, Q: 0.7 });
      filt.connect(this.gains[v]);
      this.toneFilters[v] = filt;

      const rSend = new Tone.Gain(0);
      this.gains[v].connect(rSend);
      rSend.connect(this.reverb);
      this.reverbSends[v] = rSend;

      const dSend = new Tone.Gain(0);
      this.gains[v].connect(dSend);
      dSend.connect(this.delay);
      this.delaySends[v] = dSend;
    }

    // Tonal synths.
    this.voices = {
      piano: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3 },
      }).connect(this.toneFilters.piano),

      pad: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
        envelope: { attack: 0.08, decay: 0.4, sustain: 0.3, release: 0.5 },
      }).connect(this.toneFilters.pad),

      bass: new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3 },
        filter: { Q: 1, type: "lowpass" },
        filterEnvelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2, baseFrequency: 200, octaves: 3 },
      }).connect(this.toneFilters.bass),

      acid: new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1 },
        filter: { Q: 8, type: "lowpass", rolloff: -24 },
        filterEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.1, release: 0.2, baseFrequency: 180, octaves: 4 },
        portamento: 0.05,
      }).connect(this.toneFilters.acid),

      melody: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.35 },
      }).connect(this.toneFilters.melody),

      arp: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.003, decay: 0.15, sustain: 0.3, release: 0.3 },
      }).connect(this.toneFilters.arp),
    };

    // Drum kit.
    const drumsBus = this.gains.drums;
    const drumsReverb = new Tone.Gain(0.18);
    drumsReverb.connect(this.reverb);
    drumsBus.connect(drumsReverb);

    this.drums = {
      kick: new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 1.4, attackCurve: "exponential" },
      }).connect(drumsBus),

      snare: {
        noise: new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
        }).connect(drumsBus),
        body: new Tone.MembraneSynth({
          pitchDecay: 0.02, octaves: 2,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
          volume: -8,
        }).connect(drumsBus),
      },

      hatClosed: (() => {
        const filt = new Tone.Filter({ type: "highpass", frequency: 7000 }).connect(drumsBus);
        return new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
          volume: -10,
        }).connect(filt);
      })(),

      hatOpen: (() => {
        const filt = new Tone.Filter({ type: "highpass", frequency: 6000 }).connect(drumsBus);
        return new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.32, sustain: 0 },
          volume: -12,
        }).connect(filt);
      })(),

      clap: (() => {
        const filt = new Tone.Filter({ type: "bandpass", frequency: 1500, Q: 1.2 }).connect(drumsBus);
        return new Tone.NoiseSynth({
          noise: { type: "pink" },
          envelope: { attack: 0.001, decay: 0.13, sustain: 0 },
          volume: -6,
        }).connect(filt);
      })(),
    };

    this.started = true;

    // Apply each voice's preset + macros so audio matches the UI.
    for (const v of TONAL_VOICES) {
      const s = this.voiceState[v];
      this._applyPreset(v, s.preset);
      this._applyEnvelope(v, s.attack, s.decay, s.sustain, s.release);
      this._applyToneMacro(v, s.tone);
      this._applySendMacro(v, "reverb", s.reverb);
      this._applySendMacro(v, "delay",  s.delay);
    }

    // Ensure delay time matches current Transport BPM.
    this._syncDelayTime();
  }

  // ---- Mixer setters ------------------------------------------------------

  setVoiceGain(voice, value) {
    if (!this.gains?.[voice]) return;
    this.gains[voice].gain.rampTo(value, 0.05);
  }
  setMasterGain(v) { if (this.master) this.master.gain.rampTo(v, 0.05); }

  // ---- Voice preset + macros ---------------------------------------------

  setVoicePreset(voice, presetKey) {
    const preset = VOICE_PRESETS[voice]?.[presetKey];
    if (!preset) return null;
    this.voiceState[voice] = {
      preset: presetKey,
      attack: preset.attack, decay: preset.decay, sustain: preset.sustain, release: preset.release,
      tone: preset.tone, reverb: preset.reverb, delay: preset.delay,
    };
    if (!this.started) return preset;
    this._applyPreset(voice, presetKey);
    this._applyEnvelope(voice, preset.attack, preset.decay, preset.sustain, preset.release);
    this._applyToneMacro(voice, preset.tone);
    this._applySendMacro(voice, "reverb", preset.reverb);
    this._applySendMacro(voice, "delay",  preset.delay);
    return preset;
  }

  // `name` ∈ {attack, decay, sustain, release, tone, reverb, delay}
  setVoiceMacro(voice, name, value) {
    if (!this.voiceState[voice]) return;
    this.voiceState[voice][name] = value;
    if (!this.started) return;
    if (name === "tone")  return this._applyToneMacro(voice, value);
    if (name === "reverb") return this._applySendMacro(voice, "reverb", value);
    if (name === "delay")  return this._applySendMacro(voice, "delay",  value);
    // Envelope macros all touch the same node, so apply the whole envelope.
    if (name === "attack" || name === "decay" || name === "sustain" || name === "release") {
      const s = this.voiceState[voice];
      this._applyEnvelope(voice, s.attack, s.decay, s.sustain, s.release);
    }
  }

  _applyPreset(voice, presetKey) {
    const preset = VOICE_PRESETS[voice]?.[presetKey];
    const synth = this.voices?.[voice];
    if (!preset || !synth) return;
    synth.set({ oscillator: { type: preset.wave } });
  }

  _applyEnvelope(voice, atk, dec, sus, rel) {
    const synth = this.voices?.[voice];
    if (!synth) return;
    synth.set({
      envelope: {
        attack: macroToAttack(atk),
        decay: macroToDecay(dec),
        sustain: macroToSustain(sus),
        release: macroToRelease(rel),
      },
    });
  }

  _applyToneMacro(voice, value) {
    const filt = this.toneFilters?.[voice];
    if (!filt) return;
    filt.frequency.rampTo(macroToCutoff(value), 0.05);
  }

  _applySendMacro(voice, which, value) {
    const send = which === "reverb" ? this.reverbSends?.[voice] : this.delaySends?.[voice];
    if (!send) return;
    send.gain.rampTo(value, 0.05);
  }

  // ---- Global FX ----------------------------------------------------------

  setReverbSize(seconds) {
    this._reverbDecay = seconds;
    if (!this.reverb) return;
    // Tone.Reverb regenerates its impulse response when decay changes.
    this.reverb.decay = seconds;
  }

  setDelayTime(subdivision) {
    this._delayTime = subdivision;
    this._syncDelayTime();
  }

  setDelayFeedback(value) {
    this._delayFeedback = value;
    if (this.delay) this.delay.feedback.rampTo(value, 0.05);
  }

  // Swap between FeedbackDelay (mono) and PingPongDelay (stereo bouncing).
  // We rebuild the node and re-route every voice's delaySend to it.
  setDelayPingPong(on) {
    if (this._delayPingPong === on) return;
    this._delayPingPong = on;
    if (!this.started) return;
    const old = this.delay;
    this.delay = this._buildDelay(on);
    this.delay.connect(this.master);
    for (const v of TONAL_VOICES) {
      try { this.delaySends[v].disconnect(old); } catch {}
      this.delaySends[v].connect(this.delay);
    }
    try { old.disconnect(); old.dispose(); } catch {}
    this._syncDelayTime();
  }

  _buildDelay(pingPong) {
    const opts = {
      delayTime: this._delayTime,
      feedback: this._delayFeedback,
      wet: 1,
    };
    return pingPong ? new Tone.PingPongDelay(opts) : new Tone.FeedbackDelay(opts);
  }

  _syncDelayTime() {
    if (!this.delay) return;
    const seconds = Tone.Time(this._delayTime).toSeconds();
    this.delay.delayTime.value = seconds;
  }

  // ---- Transport controls -------------------------------------------------

  setBpm(bpm) {
    Tone.getTransport().bpm.value = bpm;
    // Delay subdivision time depends on BPM — re-sync.
    this._syncDelayTime();
    // MIDI clock interval is BPM-dependent — re-arm the schedule so ticks
    // remain at 24 PPQN of the new tempo.
    this._syncMidiClockSchedule();
  }

  setLooping(bool) {
    this.parts.forEach(p => { p.loop = bool; });
  }

  // ---- Free play ----------------------------------------------------------

  async note(midi, dur = 1.5, vel = 0.8, voice = "piano") {
    if (!this.started) await this.init();
    const synth = this.voices[voice] || this.voices.piano;
    const noteName = Tone.Frequency(midi, "midi").toNote();
    synth.triggerAttackRelease(noteName, dur, undefined, vel);
  }

  // `voice` defaults to the layered "chord" sound (piano + pad together).
  // Pass a specific voice name to play through just that voice.
  //
  // Chord design (strum / spread / humanise) is applied here via expandChord.
  async chord(notes, dur = 2, voice = "chord") {
    if (!this.started) await this.init();
    const expanded = expandChord(notes, this._chordDesign);
    if (voice === "chord") {
      this._fireExpanded(expanded, dur, "piano");
      this._fireExpanded(expanded, dur, "pad");
      return;
    }
    this._fireExpanded(expanded, dur, voice);
  }

  // Fire a pre-expanded chord (list of { midi, secondsOffset, velMod } events).
  _fireExpanded(expanded, dur, voice) {
    const synth = this.voices[voice] || this.voices.piano;
    const baseTime = Tone.now();
    expanded.forEach(({ midi, secondsOffset, velMod }) => {
      const t = baseTime + secondsOffset;
      const note = Tone.Frequency(midi, "midi").toNote();
      const vel = Math.max(0, Math.min(1, 0.6 * velMod));
      synth.triggerAttackRelease(note, dur, t, vel);
    });
  }

  drum(which, time, vel = 0.9) {
    if (!this.started || !this.drums) return;
    const d = this.drums[which];
    if (!d) return;
    const t = time !== undefined ? time : Tone.now();
    if (which === "kick") {
      d.triggerAttackRelease("C2", "8n", t, vel);
    } else if (which === "snare") {
      d.noise.triggerAttackRelease("16n", t, vel);
      d.body.triggerAttackRelease("E2", "16n", t, vel * 0.7);
    } else if (which === "clap") {
      [0, 0.012, 0.024, 0.04].forEach(off => {
        d.triggerAttackRelease("16n", t + off, vel * (off === 0 ? 1 : 0.6));
      });
    } else {
      d.triggerAttackRelease(which === "hatOpen" ? "8n" : "32n", t, vel);
    }
  }

  // ---- Scheduled playback -------------------------------------------------
  //
  // play() and update() share the same Part-construction code. The only
  // difference is that play() resets the transport to 0 and starts it,
  // while update() swaps Parts on a transport that's already running so
  // edits made during playback take effect on the next loop iteration
  // without an audible stop/start.

  // Build the note + callback Parts and attach them to the transport.
  // Caller is responsible for transport start/stop and end-of-song scheduling.
  _buildParts(events, cbs, totalBeats, looping, onStep, onEnd) {
    const transport = Tone.getTransport();
    const loopEnd = beats(totalBeats);

    const notePart = new Tone.Part((time, value) => {
      // Local synth — skipped only when MIDI is on AND the user has turned
      // off "Local monitor" (i.e. they want to hear ONLY external gear).
      const playLocal = !this._midi.enabled || this._midi.monitor;
      if (playLocal) {
        if (value.voice === "drums") {
          this.drum(value.drum, time, value.vel);
        } else {
          const v = value.voice || "piano";
          const synth = this.voices[v] || this.voices.piano;
          const noteName = Tone.Frequency(value.midi, "midi").toNote();
          synth.triggerAttackRelease(noteName, beats(value.durBeats), time, value.vel);
        }
      }
      // MIDI fan-out. Duration in seconds derived from current BPM so the
      // note-off lands on the same musical position the local synth releases.
      const durSec = (value.durBeats * 60) / Tone.getTransport().bpm.value;
      this._maybeSendMidi(value, time, durSec);
    }, events.map(e => [beats(e.beat), e]));
    notePart.loop = looping;
    notePart.loopStart = 0;
    notePart.loopEnd = loopEnd;
    notePart.start(0);
    this.parts.push(notePart);

    if (cbs && cbs.length) {
      const cbPart = new Tone.Part((time, value) => {
        Tone.getDraw().schedule(() => onStep(value.ci, value.si), time);
      }, cbs.map(cb => [beats(cb.beat), cb]));
      cbPart.loop = looping;
      cbPart.loopStart = 0;
      cbPart.loopEnd = loopEnd;
      cbPart.start(0);
      this.parts.push(cbPart);
    }

    if (!looping) {
      this.endScheduleId = transport.scheduleOnce((time) => {
        Tone.getDraw().schedule(() => {
          this.stop();
          if (onEnd) onEnd();
        }, time);
      }, loopEnd);
    }
  }

  async play(events, cbs, totalBeats, looping, onStep, onEnd) {
    if (!this.started) await this.init();
    this.stop();
    const transport = Tone.getTransport();
    transport.position = 0;
    this._buildParts(events, cbs, totalBeats, looping, onStep, onEnd);
    // Re-establish the clock-tick schedule against the fresh transport
    // (stop() clears it via transport.cancel) and emit a Start byte so
    // an external slave begins from position 0.
    this._syncMidiClockSchedule();
    if (this._midi.enabled && this._midi.clock && this._midi.port) {
      sendClockStart(this._midi.port);
    }
    transport.start();
  }

  // Hot-swap the Parts on a running transport. Called when state changes
  // during playback so new notes / patterns / chord edits land on the next
  // loop iteration without an audible stop/start. Returns true if it did
  // anything; false if the transport wasn't running (caller should fall
  // back to play() in that case).
  update(events, cbs, totalBeats, looping, onStep, onEnd) {
    const transport = Tone.getTransport();
    if (transport.state !== "started") return false;
    // Tear down old parts WITHOUT stopping the transport.
    this.parts.forEach(p => { try { p.stop(); p.dispose(); } catch {} });
    this.parts = [];
    if (this.endScheduleId !== null) {
      try { transport.clear(this.endScheduleId); } catch {}
      this.endScheduleId = null;
    }
    this._buildParts(events, cbs, totalBeats, looping, onStep, onEnd);
    return true;
  }

  stop() {
    const transport = Tone.getTransport();
    // External slave: stop the clock first so the receiver halts on the
    // same bar we do (rather than ticking past while we're tearing down).
    if (this._midi.enabled && this._midi.port) {
      if (this._midi.clock) sendClockStop(this._midi.port);
      midiPanic(this._midi.port);
    }
    transport.stop();
    transport.cancel();
    this.parts.forEach(p => { try { p.stop(); p.dispose(); } catch {} });
    this.parts = [];
    this.endScheduleId = null;
    this._midiClockId = null;   // transport.cancel() invalidates the id
    if (!this.voices) return;
    try { this.voices.piano.releaseAll(); } catch {}
    try { this.voices.pad.releaseAll(); } catch {}
    try { this.voices.melody.releaseAll(); } catch {}
    try { this.voices.arp.releaseAll(); } catch {}
    try { this.voices.bass.triggerRelease(); } catch {}
    try { this.voices.acid.triggerRelease(); } catch {}
  }
}

let instance = null;
export function getAudioEngine() {
  if (!instance) instance = new AudioEngine();
  return instance;
}

export const VOICE_CHANNELS = Object.keys(VOICE_DEFAULTS);
export { VOICE_DEFAULTS };
