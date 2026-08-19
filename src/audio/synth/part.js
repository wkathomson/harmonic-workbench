import { clamp } from './util.js';
import {
  DEFAULT_SLOTS, DEST_SCALE, SYNC_DIVS, ARP_DIVS, ARP_NOTATION, PAN_POS,
  POOL_SIZE, KEY_CENTRE, STEAL_FADE, VOICE_HEADROOM,
  PART_DEFAULTS, MIXER_PARAMS
} from './constants.js';
import { getTransport } from '../transport.js';
import { makeDriveCurve } from './curves.js';
import { getTables } from './tables.js';
import { createVoice } from './voice.js';
import { createLFO } from './lfo.js';

/* --------------------------------------------------------------------------
   Part — one voice pool, filter, envelopes, mod matrix, LFOs, drive,
   bitcrush insert and arpeggiator: everything that belongs to a patch's
   character rather than to the mix. A Workbench session builds one of
   these per voice (bass, chords, lead) against a single shared
   `createMixer(ctx)`.

   Node-for-node and value-for-value this is the first half of what used
   to be createSynth (see synth.js) — split so the sound doesn't change,
   only where the nodes live.
   -------------------------------------------------------------------------- */
export function createPart(ctx, mixer, opts = {}) {
  const poolSize = opts.poolSize ?? POOL_SIZE;
  const crusherReady = opts.crusherReady ?? false;
  const transport = getTransport();

  const state = structuredClone(PART_DEFAULTS);
  const modSlots = structuredClone(DEFAULT_SLOTS);

  const voiceBus = ctx.createGain();
  voiceBus.gain.value = VOICE_HEADROOM;

  /* ---- bitcrush insert ----
     voiceBus → [bitcrush insert, dry/wet] → post
     post splits three ways: to the three shared-mixer sends, and down
     through part level/pan to the mixer's dry input.                    */
  const fxDry = ctx.createGain();
  const crushIn = ctx.createGain();
  const fxWet = ctx.createGain();
  fxDry.gain.value = 1 - state.fx.crushMix;
  fxWet.gain.value = state.fx.crushMix;

  const post = ctx.createGain();

  voiceBus.connect(fxDry).connect(post);
  voiceBus.connect(crushIn);

  /* the crusher must run per-sample, which is AudioWorklet territory.
     the module was loaded before this constructor ran, so the node is
     built synchronously — no race, no silent rewiring. if it isn't
     available, a bypass keeps the wet path passing audio. */
  let crusherNode = null;
  if (crusherReady) {
    try {
      crusherNode = new AudioWorkletNode(ctx, 'bit-crusher', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]
      });
      crusherNode.parameters.get('bits').value = state.fx.crushBits;
      crusherNode.parameters.get('reduction').value = state.fx.crushRate;
      crushIn.connect(crusherNode).connect(fxWet);
    } catch { crusherNode = null; }
  }
  if (!crusherNode) crushIn.connect(ctx.createGain()).connect(fxWet);
  fxWet.connect(post);

  /* send amounts: the patch's own gain into each shared bus. the effect
     itself (delay time, chorus depth, reverb size...) lives on the
     mixer; only the amount travels with the part. */
  const delaySend = ctx.createGain();
  delaySend.gain.value = state.fx.delaySend;
  const choSend = ctx.createGain();
  choSend.gain.value = state.fx.choSend;
  const verbSend = ctx.createGain();
  verbSend.gain.value = state.fx.verbSend;

  post.connect(delaySend).connect(mixer.sends.delay);
  post.connect(choSend).connect(mixer.sends.chorus);
  post.connect(verbSend).connect(mixer.sends.reverb);

  /* part output stage: level then pan, inserted in series after the
     bitcrush insert so behaviour is unchanged at their defaults
     (level 1 = transparent gain, pan 0 = identity stereo pan). two
     separate nodes, never one param carrying both writers. */
  const partLevel = ctx.createGain();
  partLevel.gain.value = state.part.level;
  const partPan = ctx.createStereoPanner();
  partPan.pan.value = state.part.pan;
  post.connect(partLevel).connect(partPan).connect(mixer.input);

  const mixNorm = () =>
    1 / Math.max(1, state.osc1.level + state.osc2.level + state.noise.level);

  /* note-static modulation: velocity and keytrack sources sampled at note-on,
     reaching pitch and cutoff only. the audio-rate path handles everything else. */
  /* note-static modulation. two kinds of destination live here:
     - param offsets (pitch, cutoff) for the note-static sources
     - trigger-time destinations (fenv/adec/asus) that are read when the
       envelope fires, so ANY source must be reduced to a number at note-on.
       velocity and keytrack are numbers already; the wheel's value is
       sampled. LFOs can't be cheaply read from the main thread, so they
       don't reach trigger-time destinations — documented, not hidden. */
  const TRIGGER_DESTS = new Set(['fenv', 'adec', 'asus']);

  function staticMods(note, velocity) {
    let pitchCt1 = 0, pitchCt2 = 0, cutoffOct = 0;
    let fenvOff = 0, ampDecayMul = 1, ampSusOff = 0;
    for (const slot of modSlots) {
      let val;
      if (slot.source === 'velocity') val = velocity;
      else if (slot.source === 'keytrack') val = clamp((note - KEY_CENTRE) / 24, -1, 1);
      else if (slot.source === 'wheel') {
        /* wheel is an audio-rate source for param destinations (graph
           handles those) — sample it only for trigger-time ones */
        if (!TRIGGER_DESTS.has(slot.destination)) continue;
        val = wheelSource.offset.value;
      }
      else continue;
      const amt = slot.amount / 100;
      switch (slot.destination) {
        case 'pitch':  pitchCt1 += amt * 1200 * val;
                       pitchCt2 += amt * 1200 * val; break;
        case 'pitchf': pitchCt1 += amt * 50 * val;
                       pitchCt2 += amt * 50 * val; break;
        case 'pitch1': pitchCt1 += amt * 1200 * val; break;
        case 'pitch2': pitchCt2 += amt * 1200 * val; break;
        case 'cutoff': cutoffOct += amt * 4 * val; break;
        case 'fenv':   fenvOff += amt * 100 * val; break;
        case 'adec':   ampDecayMul *= Math.pow(2, 2 * amt * val); break;
        case 'asus':   ampSusOff += amt * val; break;
        default: break;
      }
    }
    return { pitchCt1, pitchCt2, cutoffOct, fenvOff, ampDecayMul, ampSusOff };
  }

  /* wavetable morph bank, noise buffers, S&H buffer and pulse curve are
     cached per AudioContext (see tables.js) rather than rebuilt per
     part — several parts now share one context. */
  const tables = getTables(ctx);
  const shared = {
    buffers: tables.buffers,
    driveCurve: makeDriveCurve(state.filter.drive),
    pulseCurve: tables.pulseCurve,
    morphWaves: tables.morphWaves,
    bendSemis: 0,
    mixNorm: mixNorm(),
    staticMods
  };

  const voices = Array.from({ length: poolSize },
    () => createVoice(ctx, state, shared, voiceBus));

  function applySpread(t) {
    voices.forEach((v, i) => v.setPan(state.master.spread * PAN_POS[i % PAN_POS.length], t));
  }
  applySpread(0);

  /* `voices.slice(0, n)` clamps itself to the pool's actual length, so a
     bass part (poolSize 2) is safe even when state.voice.count still
     carries a chord-sized default. */
  const activePoly = () => voices.slice(0, state.voice.count);
  const monoSet = () => state.perf.mode === 'unison'
    ? voices.slice(0, clamp(state.perf.uniVoices, 2, poolSize))
    : voices.slice(0, 1);

  /* ---- LFOs and mod sources ---- */
  const lfo1 = createLFO(ctx, state.lfo1, tables.shBuffer);
  const lfo2 = createLFO(ctx, state.lfo2, tables.shBuffer);

  const wheelSource = ctx.createConstantSource();
  wheelSource.offset.value = 0;
  wheelSource.start();

  const sourceNode = name =>
    name === 'lfo1' ? lfo1.out :
    name === 'lfo2' ? lfo2.out :
    name === 'wheel' ? wheelSource : null;

  /* the aux envelope is per-voice: there is no single node to fan out.
     a slot using it wires voice i's aux output to voice i's destination
     param, keeping the pairing correct. */
  const PER_VOICE_SOURCES = new Set(['aux']);

  /* each slot: one gain node. source → slotGain → same param on all voices. */
  const slotGains = modSlots.map(() => ctx.createGain());
  /* per-voice sources need one gain per voice, built lazily */
  const slotVoiceGains = modSlots.map(() => null);
  const slotWiring = modSlots.map(() => ({ source: null, dest: null, perVoice: null }));

  /* destination params for ONE voice — always an array, because a
     destination can fan out (each osc unit now has two detune params) */
  function voiceDest(v, dest) {
    switch (dest) {
      case 'pitch':  return v.dest.pitch1.concat(v.dest.pitch2);
      case 'pitchf': return v.dest.pitch1.concat(v.dest.pitch2);
      case 'pitch1': return v.dest.pitch1;
      case 'pitch2': return v.dest.pitch2;
      case 'pw':     return v.dest.pw1.concat(v.dest.pw2);
      case 'fm':     return v.dest.fm;
      case 'cutoff': return v.dest.cutoff;
      case 'res':    return v.dest.res;
      case 'trem':   return v.dest.trem;
      case 'mix2':   return v.dest.mix2;
      case 'noise':  return v.dest.noise;
      default: return [];
    }
  }

  function destParams(dest) {
    if (dest === 'lfo1rate') return [lfo1.freqParam];
    return voices.flatMap(v => voiceDest(v, dest));
  }

  function teardownSlot(i) {
    const g = slotGains[i];
    const w = slotWiring[i];
    if (w.source) { try { w.source.disconnect(g); } catch {} }
    if (w.dest) for (const p of w.dest) { try { g.disconnect(p); } catch {} }
    if (w.perVoice) {
      for (const { src, gain, params } of w.perVoice) {
        try { src.disconnect(gain); } catch {}
        for (const p of params) { try { gain.disconnect(p); } catch {} }
      }
    }
    w.source = null; w.dest = null; w.perVoice = null;
  }

  function rewireSlot(i) {
    const slot = modSlots[i];
    teardownSlot(i);

    const scale = DEST_SCALE[slot.destination] ?? 0;
    const amount = (slot.amount / 100) * scale;
    slotGains[i].gain.value = amount;

    if (!scale || slot.destination === 'off' || slot.source === 'off') return;

    /* the aux envelope is per-voice: wire voice i's envelope to voice i's
       param, so each note modulates only itself */
    if (PER_VOICE_SOURCES.has(slot.source)) {
      if (slot.destination === 'lfo1rate') return;
      if (!slotVoiceGains[i]) slotVoiceGains[i] = voices.map(() => ctx.createGain());
      const perVoice = [];
      voices.forEach((v, vi) => {
        const gain = slotVoiceGains[i][vi];
        gain.gain.value = amount;
        const params = voiceDest(v, slot.destination);
        if (!params.length) return;
        v.auxOut.connect(gain);
        params.forEach(p => gain.connect(p));
        perVoice.push({ src: v.auxOut, gain, params });
      });
      slotWiring[i].perVoice = perVoice;
      return;
    }

    const src = sourceNode(slot.source);
    if (!src) return;
    const params = destParams(slot.destination);
    if (!params.length) return;
    const g = slotGains[i];
    src.connect(g);
    params.forEach(p => g.connect(p));
    slotWiring[i].source = src;
    slotWiring[i].dest = params;
  }

  function setModSlot(i, slot) {
    const changedRouting =
      modSlots[i].source !== slot.source || modSlots[i].destination !== slot.destination;
    modSlots[i] = { ...slot };
    if (changedRouting) {
      rewireSlot(i);
    } else {
      const scale = DEST_SCALE[slot.destination] ?? 0;
      const amount = (slot.amount / 100) * scale;
      const t = ctx.currentTime;
      if (slotWiring[i].perVoice) {
        for (const { gain } of slotWiring[i].perVoice) gain.gain.setTargetAtTime(amount, t, 0.02);
      } else {
        slotGains[i].gain.setTargetAtTime(amount, t, 0.02);
      }
    }
  }
  modSlots.forEach((_, i) => rewireSlot(i));

  /* LFO rate resolution: sync division wins over the rate knob. tempo now
     lives on the mixer, so it's read through there rather than a
     master.tempo duplicated per part. */
  function lfoHz(which) {
    const cfg = state[which];
    const div = SYNC_DIVS[cfg.sync]?.[1] ?? 0;
    if (div > 0) return (mixer.getTempo() / 60) / div;
    return cfg.rate;
  }
  function updateLfoRates(t) {
    lfo1.setRate(lfoHz('lfo1'), t);
    lfo2.setRate(lfoHz('lfo2'), t);
  }
  mixer.onTempoChange(() => updateLfoRates(ctx.currentTime));

  const mirror = ctx.createBiquadFilter();

  let pedal = false;
  const pedalHeld = new Set();
  let monoHeld = [];
  const spread = (i, n) => n < 2 ? 0 : (i / (n - 1)) * 2 - 1;
  const uniDet = (i, n) => state.perf.mode === 'unison' ? state.perf.uniDetune * spread(i, n) : 0;
  const uniLevel = n => state.perf.mode === 'unison' ? 1 / Math.sqrt(n) : 1;

  function allocate(now) {
    const pool = activePoly();
    const idle = pool.find(v => v.isFree(now));
    if (idle) return idle;
    const releasing = pool.filter(v => v.state.releasing);
    if (releasing.length)
      return releasing.reduce((a, b) => (a.state.releasedAt <= b.state.releasedAt ? a : b));
    return pool.reduce((a, b) => (a.state.startedAt <= b.state.startedAt ? a : b));
  }

  function noteOn(note, velocity = 1, time) {
    const t = Math.max(time ?? ctx.currentTime, ctx.currentTime);
    velocity = clamp(velocity, 0, 1);
    pedalHeld.delete(note);

    if (state.perf.mode === 'poly') {
      const pool = activePoly();
      const existing = pool.find(v => v.state.note === note && !v.state.releasing);
      if (existing) { existing.noteOn(note, velocity, t); return; }
      const v = allocate(t);
      if (v.level() > 0.01) {
        v.kill(t, STEAL_FADE);
        v.noteOn(note, velocity, t + STEAL_FADE * 2.5);
      } else {
        v.noteOn(note, velocity, t);
      }
      return;
    }

    const vs = monoSet();
    const legato = monoHeld.length > 0;
    monoHeld = monoHeld.filter(h => h.note !== note);
    monoHeld.push({ note, velocity });

    vs.forEach((v, i) => {
      const det = uniDet(i, vs.length);
      if (legato && !v.state.releasing && v.state.note !== null) {
        v.glideTo(note, t, state.perf.glide, det);
      } else {
        v.noteOn(note, velocity * uniLevel(vs.length), t, det);
      }
    });
  }

  function realNoteOff(note, t) {
    if (state.perf.mode === 'poly') {
      activePoly().filter(v => v.state.note === note && !v.state.releasing)
                  .forEach(v => v.noteOff(t));
      return;
    }

    monoHeld = monoHeld.filter(h => h.note !== note);
    const vs = monoSet();
    const sounding = vs.some(v => !v.state.releasing && v.state.note !== null);
    if (!sounding) return;

    if (monoHeld.length) {
      const top = monoHeld[monoHeld.length - 1];
      vs.forEach((v, i) => v.glideTo(top.note, t, state.perf.glide, uniDet(i, vs.length)));
    } else {
      vs.forEach(v => v.noteOff(t));
    }
  }

  function noteOff(note, time) {
    const t = Math.max(time ?? ctx.currentTime, ctx.currentTime);
    if (pedal) { pedalHeld.add(note); return; }
    realNoteOff(note, t);
  }

  function setPedal(down, time) {
    const t = Math.max(time ?? ctx.currentTime, ctx.currentTime);
    pedal = down;
    if (!down) {
      pedalHeld.forEach(n => realNoteOff(n, t));
      pedalHeld.clear();
    }
  }

  /* ------------------------------------------------------------------
     Arpeggiator — one subscriber to the shared transport.
     The reference ran its own setTimeout lookahead loop here; that is now
     the transport's job, so the arp locks to the same clock as the
     Workbench sequencer instead of free-running alongside it. Each
     callback schedules exactly one step at the audio time it is handed.
     The division is Tone notation, so a tempo change re-times the
     remaining steps rather than stranding them.
     ------------------------------------------------------------------ */
  let arpOn = false;
  let arpHeld = [];          // notes currently held, in press order
  let arpPattern = [];       // expanded across octaves
  let arpStep = 0;
  let arpUnsub = null;
  let arpCurrent = null;     // note currently sounding from the arp
  let arpUpDown = 1;         // direction for up-down mode
  let arpLastNote = null;

  const arpInterval = () =>
    (ARP_DIVS[state.arp.rate]?.[1] ?? 0.5) * (60 / mixer.getTempo());
  const arpDivision = () => ARP_NOTATION[state.arp.rate] ?? '8n';

  function buildPattern() {
    const base = arpHeld.map(h => h.note);
    if (!base.length) { arpPattern = []; return; }
    const sorted = [...base].sort((a, b) => a - b);
    let seq;
    switch (state.arp.mode) {
      case 'down':     seq = [...sorted].reverse(); break;
      case 'updown':   seq = sorted; break;
      case 'random':   seq = sorted; break;
      case 'asplayed': seq = base; break;
      default:         seq = sorted;
    }
    const out = [];
    for (let o = 0; o < state.arp.octaves; o++)
      for (const n of seq) out.push(clamp(n + o * 12, 0, 127));
    arpPattern = out;
    if (arpStep >= out.length) arpStep = 0;
  }

  function arpNextIndex() {
    const len = arpPattern.length;
    if (!len) return 0;
    if (state.arp.mode === 'random') return Math.floor(Math.random() * len);
    if (state.arp.mode === 'updown') {
      if (len === 1) return 0;
      let next = arpStep + arpUpDown;
      if (next >= len) { arpUpDown = -1; next = Math.max(0, len - 2); }
      else if (next < 0) { arpUpDown = 1; next = Math.min(len - 1, 1); }
      return next;
    }
    return (arpStep + 1) % len;
  }

  /* One step, scheduled at the audio time the transport hands us. */
  function arpTick(time) {
    if (!arpPattern.length) return;
    const interval = arpInterval();
    const note = arpPattern[arpStep % arpPattern.length];
    const vel = arpHeld.find(h => h.note % 12 === note % 12)?.velocity ?? 0.85;

    /* release the previous arp note before starting the next, so mono
       and poly both behave; gate is a fraction of the step */
    if (arpLastNote !== null) realNoteOff(arpLastNote, time - 0.001);
    noteOn(note, vel, time);
    const gateLen = Math.max(0.02, interval * clamp(state.arp.gate, 0.05, 0.98));
    realNoteOff(note, time + gateLen);
    arpLastNote = null;         // gate already scheduled its own off
    arpCurrent = note;

    arpStep = arpNextIndex();
  }

  function arpStart() {
    if (arpUnsub) return;
    arpStep = 0;
    arpUpDown = 1;
    arpLastNote = null;
    /* the arp needs the clock running; on the standalone route nothing else
       starts it, in the Workbench it is usually running already */
    transport.start();
    arpUnsub = transport.subscribe((beat, time) => arpTick(time), arpDivision());
  }

  function arpStop() {
    arpUnsub?.();
    arpUnsub = null;
    const t = ctx.currentTime;
    if (arpCurrent !== null) realNoteOff(arpCurrent, t);
    arpCurrent = null;
    arpLastNote = null;
  }

  /* A rate change means a different subscription interval. */
  function arpRetime() {
    if (!arpUnsub) return;
    arpUnsub();
    arpUnsub = transport.subscribe((beat, time) => arpTick(time), arpDivision());
  }

  function arpNoteOn(note, velocity) {
    arpHeld = arpHeld.filter(h => h.note !== note);
    arpHeld.push({ note, velocity });
    buildPattern();
    if (arpHeld.length === 1) arpStart();
  }

  function arpNoteOff(note) {
    arpHeld = arpHeld.filter(h => h.note !== note);
    buildPattern();
    if (!arpHeld.length) arpStop();
  }

  function setArpEnabled(on) {
    if (arpOn === on) return;
    arpOn = on;
    if (!on) { arpStop(); arpHeld = []; arpPattern = []; panic(); }
  }

  const arpActive = () => arpOn;

  function setBend(semis) {
    shared.bendSemis = semis;
    const t = ctx.currentTime;
    voices.forEach(v => { if (v.state.note !== null) v.retune(t); });
  }

  function setModWheel(val) {
    wheelSource.offset.setTargetAtTime(clamp(val, 0, 1), ctx.currentTime, 0.02);
  }

  function panic() {
    const t = ctx.currentTime;
    monoHeld = [];
    pedalHeld.clear();
    voices.forEach(v => { v.kill(t); v.state.note = null; });
  }

  /* public note entry points route through the arp when it's enabled */
  function playNoteOn(note, velocity = 1, time) {
    if (arpOn) arpNoteOn(note, clamp(velocity, 0, 1));
    else noteOn(note, velocity, time);
  }
  function playNoteOff(note, time) {
    if (arpOn) arpNoteOff(note);
    else noteOff(note, time);
  }

  function setParam(module, param, value) {
    const path = `${module}.${param}`;
    if (MIXER_PARAMS.has(path)) return;               // belongs to the mixer, not this part
    if (!(module in state) || !(param in state[module])) return;
    state[module][param] = value;
    const t = ctx.currentTime;

    switch (path) {
      case 'osc1.waveform':
        voices.forEach(v => v.setWaveform(1, value, t));
        break;
      case 'osc2.waveform':
        voices.forEach(v => v.setWaveform(2, value, t));
        break;
      case 'osc1.pw': voices.forEach(v => v.setPw(1, value, t)); break;
      case 'osc2.pw': voices.forEach(v => v.setPw(2, value, t)); break;
      case 'osc1.morph': voices.forEach(v => v.setMorph(1, value, t)); break;
      case 'osc2.morph': voices.forEach(v => v.setMorph(2, value, t)); break;
      case 'osc1.fm': voices.forEach(v => v.setFm(value, t)); break;
      case 'master.spread': applySpread(t); break;
      case 'fx.choSend': choSend.gain.setTargetAtTime(value, t, 0.02); break;
      case 'arp.mode': case 'arp.octaves':
        buildPattern();
        break;
      case 'arp.rate':
        buildPattern();
        arpRetime();
        break;
      case 'osc1.coarse': case 'osc1.fine':
      case 'osc2.coarse': case 'osc2.fine':
        voices.forEach(v => { if (v.state.note !== null) v.retune(t); });
        break;
      case 'osc1.level': case 'osc2.level': {
        const which = module === 'osc1' ? 1 : 2;
        voices.forEach(v => v.setOscLevel(which, value, t));
        shared.mixNorm = mixNorm();
        voices.forEach(v => v.setMixNorm(shared.mixNorm, t));
        break;
      }
      case 'noise.type':
        voices.forEach(v => v.setNoise(t));
        break;
      case 'noise.level':
        voices.forEach(v => v.setNoise(t));
        shared.mixNorm = mixNorm();
        voices.forEach(v => v.setMixNorm(shared.mixNorm, t));
        break;
      case 'filter.type': voices.forEach(v => v.setFilterType(value)); break;
      case 'filter.cutoff':
      case 'filter.keytrack':
        voices.forEach(v => { if (v.state.note !== null) v.applyCutoff(t); });
        break;
      case 'filter.resonance': voices.forEach(v => v.setResonance(value, t)); break;
      case 'filter.drive':
        shared.driveCurve = makeDriveCurve(value);
        voices.forEach(v => v.setDriveCurve(shared.driveCurve));
        break;
      case 'lfo1.shape': lfo1.setShape(value, t); break;
      case 'lfo2.shape': lfo2.setShape(value, t); break;
      case 'lfo1.rate': case 'lfo1.sync':
      case 'lfo2.rate': case 'lfo2.sync':
        updateLfoRates(t);
        break;
      case 'fx.crushBits':
        if (crusherNode) crusherNode.parameters.get('bits').setTargetAtTime(value, t, 0.02);
        break;
      case 'fx.crushRate':
        if (crusherNode) crusherNode.parameters.get('reduction').setTargetAtTime(value, t, 0.02);
        break;
      case 'fx.crushMix':
        fxDry.gain.setTargetAtTime(1 - value, t, 0.02);
        fxWet.gain.setTargetAtTime(value, t, 0.02);
        break;
      case 'fx.delaySend': delaySend.gain.setTargetAtTime(value, t, 0.02); break;
      case 'fx.verbSend': verbSend.gain.setTargetAtTime(value, t, 0.02); break;
      case 'part.level': partLevel.gain.setTargetAtTime(value, t, 0.02); break;
      case 'part.pan': partPan.pan.setTargetAtTime(value, t, 0.02); break;
      case 'voice.count':
        if (state.perf.mode === 'poly')
          voices.slice(value).forEach(v => { v.kill(t); v.state.note = null; });
        break;
      case 'perf.mode':
      case 'perf.uniVoices':
        panic();
        break;
      default: break;
    }
  }

  const getParam = (module, param) => state[module]?.[param];

  function getState() {
    const params = {};
    for (const [mod, group] of Object.entries(state))
      for (const [key, val] of Object.entries(group)) params[`${mod}.${key}`] = val;
    return { params, modSlots: structuredClone(modSlots) };
  }

  function setState(preset) {
    for (const [path, val] of Object.entries(preset.params ?? {})) {
      const [mod, key] = path.split('.');
      if (state[mod] && key in state[mod]) setParam(mod, key, val);
    }
    (preset.modSlots ?? []).forEach((slot, i) => { if (i < 4) setModSlot(i, slot); });
  }

  function newestVoice() {
    let best = null;
    for (const v of voices)
      if (v.state.note !== null && (!best || v.state.startedAt > best.state.startedAt)) best = v;
    return best;
  }

  function effectiveCutoff() {
    const v = newestVoice();
    return v ? v.currentCutoff() : state.filter.cutoff;
  }

  function getFilterResponse(freqs, mag, phase) {
    mirror.type = state.filter.type;
    mirror.frequency.value = effectiveCutoff();
    mirror.Q.value = state.filter.resonance;
    mirror.getFrequencyResponse(freqs, mag, phase);
  }

  const getVoiceStates = () => voices.map((v, i) => ({
    index: i,
    enabled: state.perf.mode === 'poly' ? i < state.voice.count : i < monoSet().length,
    note: v.state.note,
    releasing: v.state.releasing,
    level: v.level()
  }));

  const heldNotes = () => {
    if (state.perf.mode !== 'poly')
      return monoHeld.map(h => h.note).sort((a, b) => a - b);
    return activePoly()
      .filter(v => v.state.note !== null && !v.state.releasing)
      .sort((a, b) => a.state.note - b.state.note)
      .map(v => v.state.note);
  };

  return {
    noteOn: playNoteOn, noteOff: playNoteOff,
    panic, setPedal, setBend, setModWheel, setModSlot,
    setArpEnabled, arpActive,
    setParam, getParam, getState, setState,
    getFilterResponse, effectiveCutoff, getVoiceStates,
    get held() { return heldNotes(); },
    get crusherActive() { return !!crusherNode; }
  };
}
