import { clamp } from './util.js';
import { MIXER_DEFAULTS, MIXER_PARAMS, SYNC_DIVS } from './constants.js';
import { getTransport } from '../transport.js';

/* --------------------------------------------------------------------------
   Mixer — the shared bus every part feeds. One delay, one chorus, one
   reverb, one limiter, one master gain, one analyser, one recorder tap:
   the things that belong to the MIX rather than to any one part's sound.
   Node-for-node and value-for-value this is the second half of what used
   to be createSynth's effects section (see synth.js) — split so three
   parts don't mean three reverbs.

   input:        parts connect their post-partLevel/partPan dry signal here
   sends.delay:   parts connect their own delaySend-amount gain here
   sends.chorus:  parts connect their own choSend-amount gain here
   sends.reverb:  parts connect their own verbSend-amount gain here
   -------------------------------------------------------------------------- */
export function createMixer(ctx) {
  const transport = getTransport();
  const state = structuredClone(MIXER_DEFAULTS);
  /* Adopt whatever tempo the transport is already running at rather than
     forcing this mixer's default onto it — in the Workbench the project's
     BPM is set before any mixer exists, and resetting it to 120 on
     construction would be a nasty surprise. */
  state.master.tempo = transport.getTempo();

  /* dry path: parts' finished (level/pan-applied) signal sums here and
     goes straight to the limiter, exactly as `post` did in createSynth */
  const input = ctx.createGain();

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;

  const masterGain = ctx.createGain();
  masterGain.gain.value = state.master.level;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;

  const limiterIn = ctx.createGain();
  input.connect(limiterIn);

  /* delay: the feedback loop runs entirely inside the audio graph.
     tone filter sits inside the loop, so each repeat gets darker.
     sends.delay is the summing bus every part's own delaySend-amount
     gain connects into — unity gain, so amount lives on the part. */
  const delaySendBus = ctx.createGain();
  const delayNode = ctx.createDelay(2);
  delayNode.delayTime.value = state.fx.delayTime;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = state.fx.delayTone;
  delayFilter.Q.value = 0.4;
  const delayFb = ctx.createGain();
  delayFb.gain.value = state.fx.delayFeedback;

  delaySendBus.connect(delayNode).connect(delayFilter);
  delayFilter.connect(delayFb).connect(delayNode);
  delayFilter.connect(limiterIn);

  /* reverb: convolution with a synthetic impulse response — stereo
     exponentially-decaying noise, damped by a one-pole lowpass whose
     smoothing grows over the tail. Copied verbatim from createSynth. */
  function makeImpulse(seconds, damp) {
    const len = Math.max(64, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(0.001, t);                    // −60 dB at the tail
        const k = Math.min(0.98, damp * (0.25 + 0.7 * t)); // more smoothing later
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * (1 - k);
        d[i] = lp * env;
      }
    }
    return buf;
  }

  /* chorus: two short delays modulated in quadrature by one LFO, panned
     hard left and right. sends.chorus is the summing bus every part's
     own choSend-amount gain connects into. */
  const choSendBus = ctx.createGain();
  const choLfo = ctx.createOscillator();
  choLfo.type = 'sine';
  choLfo.frequency.value = state.fx.choRate;
  const choDepthL = ctx.createGain();
  const choDepthR = ctx.createGain();
  choDepthL.gain.value = state.fx.choDepth * 0.003;
  choDepthR.gain.value = -state.fx.choDepth * 0.003;   // inverted = quadrature-ish
  const choDelayL = ctx.createDelay(0.06);
  const choDelayR = ctx.createDelay(0.06);
  choDelayL.delayTime.value = 0.011;
  choDelayR.delayTime.value = 0.017;
  const choPanL = ctx.createStereoPanner();
  const choPanR = ctx.createStereoPanner();
  choPanL.pan.value = -0.8;
  choPanR.pan.value = 0.8;

  choLfo.connect(choDepthL).connect(choDelayL.delayTime);
  choLfo.connect(choDepthR).connect(choDelayR.delayTime);
  choLfo.start();
  choSendBus.connect(choDelayL).connect(choPanL).connect(limiterIn);
  choSendBus.connect(choDelayR).connect(choPanR).connect(limiterIn);

  const verbSendBus = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(state.fx.verbSize, state.fx.verbDamp);
  verbSendBus.connect(convolver).connect(limiterIn);

  let irTimer = null;
  function scheduleIR() {
    clearTimeout(irTimer);
    irTimer = setTimeout(() => {
      convolver.buffer = makeImpulse(state.fx.verbSize, state.fx.verbDamp);
    }, 180);
  }

  limiterIn.connect(limiter);
  limiter.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(ctx.destination);

  /* recorder tap: a MediaStream carrying exactly what reaches the speakers */
  const recDest = ctx.createMediaStreamDestination();
  masterGain.connect(recDest);

  function updateDelayTime(t) {
    const div = SYNC_DIVS[state.fx.delaySync]?.[1] ?? 0;
    const secs = div > 0
      ? clamp(div * 60 / transport.getTempo(), 0.02, 2)
      : state.fx.delayTime;
    delayNode.delayTime.setTargetAtTime(secs, t, 0.05);
  }

  /* Tempo lives on the transport — one clock for the sequencer, the arp,
     LFO sync and this delay alike. The mixer owns the *parameter*: writing
     master.tempo writes through to the transport, and reads come back from
     it, so nothing keeps a second copy that can drift. Parts subscribe here
     so they can re-run their own LFO-rate resolution when it changes. */
  const tempoListeners = new Set();
  function onTempoChange(cb) {
    tempoListeners.add(cb);
    return () => tempoListeners.delete(cb);
  }

  function setParam(module, param, value) {
    const path = `${module}.${param}`;
    if (!MIXER_PARAMS.has(path)) return;
    /* scheduleIR() redraws the impulse from Math.random(), so — unlike
       every other case here — it must not fire on a no-op write. A full
       preset load (see presets.js's reset-then-overlay) writes every
       mixer key on every load, including verbSize/verbDamp when a preset
       doesn't touch them; re-rolling the IR on those unchanged writes
       would shift the random stream for no audible reason. Every other
       case is a plain setTargetAtTime ramp, which is already a no-op
       when the target doesn't move, so it doesn't need this guard. */
    const changed = state[module][param] !== value;
    state[module][param] = value;
    const t = ctx.currentTime;

    switch (path) {
      case 'fx.choRate': choLfo.frequency.setTargetAtTime(value, t, 0.02); break;
      case 'fx.choDepth':
        choDepthL.gain.setTargetAtTime(value * 0.003, t, 0.02);
        choDepthR.gain.setTargetAtTime(-value * 0.003, t, 0.02);
        break;
      case 'fx.delayTime': case 'fx.delaySync': updateDelayTime(t); break;
      case 'fx.delayFeedback': delayFb.gain.setTargetAtTime(value, t, 0.02); break;
      case 'fx.delayTone': delayFilter.frequency.setTargetAtTime(value, t, 0.02); break;
      case 'fx.verbSize': case 'fx.verbDamp': if (changed) scheduleIR(); break;
      case 'master.level': masterGain.gain.setTargetAtTime(value, t, 0.02); break;
      case 'master.tempo':
        transport.setTempo(value);
        updateDelayTime(t);
        tempoListeners.forEach(cb => cb(value));
        break;
      default: break;
    }
  }

  const getParam = (module, param) => state[module]?.[param];

  function getState() {
    /* tempo lives on the transport, so read it back rather than trusting a
       copy that another owner (the Workbench's BPM control) may have moved */
    state.master.tempo = transport.getTempo();
    const params = {};
    for (const [mod, group] of Object.entries(state))
      for (const [key, val] of Object.entries(group)) params[`${mod}.${key}`] = val;
    return { params };
  }

  function setState(preset) {
    for (const [path, val] of Object.entries(preset.params ?? {})) {
      const [mod, key] = path.split('.');
      if (state[mod] && key in state[mod]) setParam(mod, key, val);
    }
  }

  const getScope = array => analyser.getByteTimeDomainData(array);
  const getSpectrum = array => analyser.getByteFrequencyData(array);

  return {
    input,
    sends: { delay: delaySendBus, chorus: choSendBus, reverb: verbSendBus },
    setParam, getParam,
    getScope, getSpectrum,
    getTempo: () => transport.getTempo(),
    onTempoChange,
    get recStream() { return recDest.stream; },
    getState, setState
  };
}
