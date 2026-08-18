import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

import { NOTE_NAMES, SCALES, PROGRESSIONS } from "./theory/constants.js";
import { getScaleNotes, getPentaNotes, pentaFor, getRoman, getDiatonic, getBorrowed, makeChord, transposeInfo, smoothVoicings } from "./theory/chords.js";
import { euclidean, randomRhythm, arpeggiate } from "./theory/rhythm.js";
import { genBass } from "./theory/bass.js";
import { stepWithinPool, octaveShift } from "./theory/stepEdit.js";
import { makeClickHandler } from "./utils/clickHandler.js";
import { loadKit, emptyDrumPattern, resizeDrumPattern, DRUMS, DRUM_STEPS } from "./theory/drums.js";
import { getAudioEngine, VOICE_DEFAULTS } from "./audio/engine.js";
import { VOICE_PRESETS, buildInitialVoiceState } from "./audio/presets.js";
// (buildInitialVoiceState is also used inside applyState() to fill gaps in
//  older snapshots that pre-date newer macros like Sustain.)
import { CHORD_DESIGN_DEFAULTS, expandChord } from "./audio/chordDesign.js";
import { exportMidi } from "./utils/midiExport.js";
import { readAutosave, writeAutosave } from "./utils/snapshots.js";

import Section from "./components/Section.jsx";
import Seg from "./components/Seg.jsx";
import PianoRoll from "./components/PianoRoll.jsx";
import KeyScale from "./components/KeyScale.jsx";
import ChordPalette from "./components/ChordPalette.jsx";
import Progression from "./components/Progression.jsx";
import TransportBar from "./components/TransportBar.jsx";
import Mixer from "./components/Mixer.jsx";
import Voices from "./components/Voices.jsx";
import SynthParts from "./components/SynthParts.jsx";
import { useWorkbenchSynth } from "./components/synth/useWorkbenchSynth.js";
import FX from "./components/FX.jsx";
import BassSequencer from "./components/BassSequencer.jsx";
import MelodySequencer from "./components/MelodySequencer.jsx";
import ArpSequencer from "./components/ArpSequencer.jsx";
import DrumMachine from "./components/DrumMachine.jsx";
import Snapshots from "./components/Snapshots.jsx";
import ChordDesign from "./components/ChordDesign.jsx";
import TrackExports from "./components/TrackExports.jsx";
import MidiOut from "./components/MidiOut.jsx";

import { suggestVariations } from "./theory/variations.js";

// Default mixer levels (matches engine defaults so the UI shows the truth at boot).
// Reverb/delay returns are no longer here — those moved to per-voice sends + global FX.
const MIXER_DEFAULTS = {
  ...VOICE_DEFAULTS,
  master: 0.7,
};

// Default global FX state. Delay subdivision stays BPM-synced via the engine.
const FX_DEFAULTS = {
  delayTime:     "8n.",
  delayFeedback: 0.25,
  delayPingPong: false,
  reverbSize:    2.5,
};

// Default Live MIDI Out state. Channels are 0-indexed internally (UI is 1-16).
// Drums default to GM channel 10 (index 9) so external drum machines fire
// on the standard channel without setup.
const MIDI_DEFAULTS = {
  enabled:    false,
  monitor:    true,
  clock:      false,
  deviceId:   null,
  deviceName: null,    // remembered for friendly "device not found" copy
  channels:   { chord: 0, bass: 1, melody: 2, arp: 3, drums: 9 },
};

// ============================================================
// App — orchestrates state, audio, and composition across all panels.
// ============================================================
export default function App() {
  // ---- Key + chord state ----
  const [rootNote, setRootNote] = useState(0);
  const [scaleKey, setScaleKey] = useState("minor");
  const [selChord, setSelChord] = useState(null);
  const [ext, setExt] = useState("triad");
  const [inv, setInv] = useState(0);
  const [octS, setOctS] = useState(0);
  const [prevS, setPrevS] = useState(null);
  const [showBor, setShowBor] = useState(false);

  // ---- Progression + transport ----
  const [prog, setProg] = useState([]);
  // Which voice plays chords. "both" fires piano + pad together (mixer-blended);
  // "piano" or "pad" sends only that one. Lives here (not in voiceState) because
  // it's a routing decision, not a per-voice macro.
  const [chordVoice, setChordVoice] = useState("both");
  const [bpm, setBpm] = useState(90);
  const [bpc, setBpc] = useState(4);
  const [looping, setLooping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [curStep, setCurStep] = useState(-1);
  const [curMel, setCurMel] = useState(null);

  // ---- Mixer ----
  const [mixer, setMixer] = useState(MIXER_DEFAULTS);

  // ---- Voice presets + macros (A/D/R, Tone, Reverb, Delay per voice) ----
  const [voiceState, setVoiceState] = useState(buildInitialVoiceState());

  // ---- Global FX (delay time/feedback/pingpong, reverb size) ----
  const [fx, setFx] = useState(FX_DEFAULTS);

  // ---- Chord design (strum, spread, humanise) — shapes every chord event ----
  const [chordDesign, setChordDesign] = useState(CHORD_DESIGN_DEFAULTS);

  // ---- Live MIDI output ----
  const [midi, setMidi] = useState(MIDI_DEFAULTS);

  // ---- Mode (which family of panels is visible) ----
  // "compose" = theory + chord exploration (Key, Piano Roll, Chords, Progression)
  // "arrange" = pattern + sound shaping  (Progression, Bass, Mel, Arp, Drums, Mixer, Voices, FX)
  // Progression is shared — it's the bridge between the two modes.
  const [mode, setMode] = useState("compose");

  // ---- Collapsible sections ----
  const [openS, setOpenS] = useState({
    key: true, piano: true, chords: true, prog: true, snap: false,
    mix: true, voices: false, synth: false, fx: false, design: false, tracks: false, midi: false,
    bass: true, mel: true, arp: false, drums: true,
  });
  const togS = (k) => setOpenS(p => ({ ...p, [k]: !p[k] }));

  // Synth parts: any track can be handed to the synth engine instead of its
  // Tone voice. The hook owns the parts and the shared mixer; live control
  // values stay in refs inside it rather than in App state, so a knob drag
  // never re-renders the Workbench.
  const synth = useWorkbenchSynth();

  // ---- Bass ----
  const [bassOn, setBassOn] = useState(false);
  const [bassMode, setBassMode] = useState("syncopated");
  const [bassSteps, setBassSteps] = useState(16);
  const [bassOct, setBassOct] = useState(2);   // 1 / 2 / 3 → MIDI C1 / C2 / C3
  const [bassPat, setBassPat] = useState({});

  // ---- Melody ----
  const [melOn, setMelOn] = useState(false);
  const [melPenta, setMelPenta] = useState("auto");
  const [melSteps, setMelSteps] = useState(16);
  const [melOct, setMelOct] = useState(5);
  const [melMode, setMelMode] = useState("transposed");
  const [melFill, setMelFill] = useState("random");
  const [melDens, setMelDens] = useState(0.4);
  const [melEucH, setMelEucH] = useState(5);
  const [melPat, setMelPat] = useState({});
  const [melLock, setMelLock] = useState({});

  // ---- Arp ----
  const [arpOn, setArpOn] = useState(false);
  const [arpMode, setArpMode] = useState("up");
  const [arpRhythm, setArpRhythm] = useState("straight");
  const [arpSteps, setArpSteps] = useState(16);
  const [arpPat, setArpPat] = useState({});

  // ---- Drums ----
  const [drumOn, setDrumOn] = useState(false);
  const [drumKit, setDrumKit] = useState("house");
  const [drumSteps, setDrumSteps] = useState(DRUM_STEPS);
  const [drumPat, setDrumPat] = useState(loadKit("house", DRUM_STEPS));

  // ---- DnD ----
  const [dragI, setDragI] = useState(null);
  const [dragO, setDragO] = useState(null);

  // ---- Per-track selection ---------------------------------------------
  // Each Set holds string keys identifying selected cells. Format varies:
  //   melody / bass / arp:  "ci-si"  (chord index, step index)
  //   drums:                "drumKey-si"
  // Selection is preserved across renders but cleared on regenerate /
  // step-count changes (the indices wouldn't mean the same thing anyway).
  const [melSel,  setMelSel]  = useState(() => new Set());
  const [bassSel, setBassSel] = useState(() => new Set());
  const [arpSel,  setArpSel]  = useState(() => new Set());
  const [drumSel, setDrumSel] = useState(() => new Set());

  // ---- Variation suggestions (computed on demand, then displayed inline) ----
  // null = panel hidden; array = currently showing N variations to choose from.
  const [variations, setVariations] = useState(null);

  // ---- Audio engine (singleton) ----
  const audio = useRef(null);
  if (!audio.current) audio.current = getAudioEngine();

  // BPM is live: push every change directly to the Transport. With the
  // Tone.Part scheduler, this rescales the currently-playing sequence.
  useEffect(() => { audio.current.setBpm(bpm); }, [bpm]);

  // Loop toggle is also live — engine flips the .loop flag on running Parts.
  useEffect(() => { audio.current.setLooping(looping); }, [looping]);

  // Mixer fader changes → engine. No reverb/delay returns any more — those
  // are per-voice sends inside Voices, with the global FX panel for the bus.
  useEffect(() => {
    const eng = audio.current;
    eng.setMasterGain(mixer.master);
    Object.keys(VOICE_DEFAULTS).forEach(v => eng.setVoiceGain(v, mixer[v] ?? VOICE_DEFAULTS[v]));
  }, [mixer]);

  // Global FX → engine. Pushed any time the FX panel state changes.
  useEffect(() => {
    const eng = audio.current;
    eng.setReverbSize(fx.reverbSize);
    eng.setDelayTime(fx.delayTime);
    eng.setDelayFeedback(fx.delayFeedback);
    eng.setDelayPingPong(fx.delayPingPong);
  }, [fx]);

  // Chord design → engine. Strum/spread/humanise apply to live audition
  // (engine.chord). Scheduled playback uses expandChord directly in playOnce.
  useEffect(() => { audio.current.setChordDesign(chordDesign); }, [chordDesign]);

  // MIDI state → engine. Each toggle pushed individually so a partial
  // change (e.g. just flipping monitor) doesn't stomp the live port.
  useEffect(() => { audio.current.setMidiEnabled(midi.enabled); }, [midi.enabled]);
  useEffect(() => { audio.current.setMidiMonitor(midi.monitor); }, [midi.monitor]);
  useEffect(() => { audio.current.setMidiClock(midi.clock);     }, [midi.clock]);
  useEffect(() => { audio.current.setMidiChannels(midi.channels); }, [midi.channels]);

  // Mirror voice presets/macros into the engine on first init. Per-change
  // updates flow through onVoicePreset / onVoiceMacro directly.
  useEffect(() => {
    const eng = audio.current;
    Object.entries(voiceState).forEach(([voice, s]) => {
      eng.setVoicePreset(voice, s.preset);
      eng.setVoiceMacro(voice, "attack",  s.attack);
      eng.setVoiceMacro(voice, "decay",   s.decay);
      eng.setVoiceMacro(voice, "sustain", s.sustain);
      eng.setVoiceMacro(voice, "release", s.release);
      eng.setVoiceMacro(voice, "tone",    s.tone);
      eng.setVoiceMacro(voice, "reverb",  s.reverb);
      eng.setVoiceMacro(voice, "delay",   s.delay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Derived values ----
  const baseMidi = 48 + octS * 12;
  const sn = getScaleNotes(rootNote, scaleKey);
  const dCh = useMemo(() => getDiatonic(rootNote, scaleKey, ext, baseMidi), [rootNote, scaleKey, ext, baseMidi]);
  const bCh = useMemo(() => getBorrowed(rootNote, scaleKey, ext, baseMidi), [rootNote, scaleKey, ext, baseMidi]);
  const rom = useMemo(() => getRoman(scaleKey), [scaleKey]);
  const sugg = PROGRESSIONS[scaleKey] || [];

  let selObj = null;
  if (selChord) {
    const list = selChord.src === "borrowed" ? bCh : dCh;
    const b = list[selChord.i];
    if (b) {
      selObj = makeChord(b.root, b.quality, ext, inv, baseMidi);
      selObj.roman = selChord.src === "borrowed" ? b.roman : rom[selChord.i];
      selObj.source = selChord.src;
    }
  }

  let dispCh = selObj;
  if (selObj && prevS !== null && prevS !== 0) {
    const p = transposeInfo(selObj, prevS, sn);
    dispCh = { ...p, source: selObj.source, roman: selObj.roman, isPreview: true };
  }

  useEffect(() => { setInv(0); setPrevS(null); }, [selChord, ext]);

  // ---- Chord interactions ----
  // Helper: route chord audition to the currently-selected voice(s).
  // engine.chord("chord") fires both piano + pad; "piano" / "pad" fires one.
  const chordVoiceArg = () => chordVoice === "both" ? "chord" : chordVoice;

  const clickCh = (i, src) => {
    setSelChord({ i, src });
    const list = src === "borrowed" ? bCh : dCh;
    audio.current.chord(makeChord(list[i].root, list[i].quality, ext, 0, baseMidi).midiNotes, 1.8, chordVoiceArg());
  };

  const chgInv = (i) => {
    setInv(i);
    if (selObj) audio.current.chord(makeChord(selObj.root, selObj.quality, ext, i, baseMidi).midiNotes, 1.5, chordVoiceArg());
  };

  const clickTrans = (s) => {
    if (!selObj) return;
    if (s === 0) { setPrevS(null); audio.current.chord(selObj.midiNotes, 1.5, chordVoiceArg()); return; }
    setPrevS(s);
    audio.current.chord(transposeInfo(selObj, s, sn).midiNotes, 1.5, chordVoiceArg());
  };

  // ---- Progression ops ----
  const addProg = (chord, roman, source) => {
    setProg(p => [...p, { ...chord, roman, source, id: Date.now() + Math.random(), rhythm: null }]);
  };

  const addTransP = (s) => {
    if (!selObj) return;
    const t = transposeInfo(selObj, s, sn);
    addProg(t, selObj.roman + (s > 0 ? "+" : "") + s, t.inScale ? "diatonic" : "chromatic");
  };

  const loadSug = (s) => {
    stopP();
    setProg(s.d.map((deg, i) => {
      const ch = makeChord(dCh[deg].root, dCh[deg].quality, ext, 0, baseMidi);
      return { ...ch, roman: rom[deg], source: "diatonic", id: Date.now() + Math.random() + i, rhythm: null };
    }));
    setMelPat({}); setBassPat({}); setArpPat({});
  };

  const clearP = () => { stopP(); setProg([]); setMelPat({}); setBassPat({}); setArpPat({}); };

  // Re-voice the whole progression so each chord moves smoothly from the previous.
  // First chord stays put; each subsequent gets its closest inversion/octave.
  const smoothP = () => setProg(p => smoothVoicings(p));

  const toggleChStep = (ci, si) => {
    setProg(p => {
      const np = [...p];
      const ch = { ...np[ci] };
      const ts = bpc * 2;
      const rhy = ch.rhythm ? [...ch.rhythm] : Array(ts).fill(false).map((_, j) => j === 0);
      rhy[si] = !rhy[si];
      ch.rhythm = rhy;
      np[ci] = ch;
      return np;
    });
  };

  // ---- Generators ----
  const regenMel = () => {
    if (!prog.length) return;
    const np = {};
    if (melMode === "transposed") {
      const rhy = melFill === "euclidean" ? euclidean(melEucH, melSteps) : randomRhythm(melSteps, melDens);
      const degP = rhy.map(a => a ? { di: Math.floor(Math.random() * 5), oo: Math.floor(Math.random() * 2) } : null);
      prog.forEach((ch, i) => {
        if (melLock[i] && melPat[i]) { np[i] = melPat[i]; return; }
        const pt = pentaFor(ch, melPenta);
        const pn = getPentaNotes(ch.root, pt);
        np[i] = degP.map(s => s ? 12 * (melOct + 1) + pn[s.di] + s.oo * 12 : null);
      });
    } else {
      prog.forEach((ch, i) => {
        if (melLock[i] && melPat[i]) { np[i] = melPat[i]; return; }
        const rhy = melFill === "euclidean" ? euclidean(melEucH, melSteps) : randomRhythm(melSteps, melDens);
        const pt = pentaFor(ch, melPenta);
        const pn = getPentaNotes(ch.root, pt);
        const opts = [];
        for (let o = 0; o < 2; o++) pn.forEach(pc => opts.push(12 * (melOct + 1) + pc + o * 12));
        np[i] = rhy.map(a => a ? opts[Math.floor(Math.random() * opts.length)] : null);
      });
    }
    setMelPat(np);
    setMelSel(new Set());
  };

  const togMelStep = (ci, si) => {
    const p = { ...melPat };
    if (!p[ci]) p[ci] = Array(melSteps).fill(null);
    p[ci] = [...p[ci]];
    if (p[ci][si] !== null) {
      p[ci][si] = null;
    } else {
      const ch = prog[ci];
      const pt = pentaFor(ch, melPenta);
      const pn = getPentaNotes(ch.root, pt);
      const opts = pn.map(pc => 12 * (melOct + 1) + pc);
      p[ci][si] = opts[Math.floor(Math.random() * opts.length)];
    }
    setMelPat(p);
  };

  // ---- Per-step pitch editing -------------------------------------------
  // Wheel up / down on an active step nudges its pitch within the part's
  // valid pool; shift+wheel shifts by an octave. The pools are built fresh
  // per chord so the result always sits inside the chord's harmony.

  // Pool builders — return a sorted MIDI list spanning 2–3 octaves so the
  // user can scroll through a meaningful range without immediately wrapping.
  const melodyPool = (ci) => {
    const ch = prog[ci]; if (!ch) return [];
    const pt = pentaFor(ch, melPenta);
    const pn = getPentaNotes(ch.root, pt);
    const out = [];
    // Cover the user-selected octave plus one above and one below so any
    // existing note has neighbours in the pool.
    for (let o = -1; o <= 2; o++) pn.forEach(pc => out.push(12 * (melOct + 1) + pc + o * 12));
    return [...new Set(out)].sort((a, b) => a - b);
  };

  const bassPool = (ci) => {
    const ch = prog[ci]; if (!ch) return [];
    const octRoot = 12 + bassOct * 12 + ch.root;
    // root, third, fifth, octave — across a couple of octaves around the bass anchor.
    const q = ch.quality;
    const third = (q === "min" || q === "dim") ? 3 : 4;
    const fifth = q === "dim" ? 6 : q === "aug" ? 8 : 7;
    const out = [];
    for (let o = -1; o <= 1; o++) {
      [0, third, fifth, 12].forEach(off => out.push(octRoot + off + o * 12));
    }
    return [...new Set(out)].sort((a, b) => a - b);
  };

  const arpPool = (ci) => {
    const ch = prog[ci]; if (!ch) return [];
    const sorted = [...ch.midiNotes].sort((a, b) => a - b);
    const out = [];
    // 3 octaves of chord tones — gives plenty of room for arp lines.
    for (let o = -1; o <= 1; o++) sorted.forEach(m => out.push(m + o * 12));
    return [...new Set(out)].sort((a, b) => a - b);
  };

  // Apply a step edit. action ∈ "up" | "down" | "oct-up" | "oct-down".
  const editMelStep = (ci, si, action) => {
    setMelPat(p => {
      if (!p[ci]) return p;
      const cur = p[ci][si];
      if (cur == null) return p;
      let next;
      if (action === "oct-up")        next = octaveShift(cur, +1);
      else if (action === "oct-down") next = octaveShift(cur, -1);
      else                            next = stepWithinPool(melodyPool(ci), cur, action === "up" ? +1 : -1);
      const row = [...p[ci]]; row[si] = next;
      return { ...p, [ci]: row };
    });
  };

  const editBassStep = (ci, si, action) => {
    setBassPat(p => {
      const row = p[ci]; if (!row) return p;
      const cur = row[si]; if (!cur || cur.midi == null) return p;
      let next;
      if (action === "oct-up")        next = octaveShift(cur.midi, +1);
      else if (action === "oct-down") next = octaveShift(cur.midi, -1);
      else                            next = stepWithinPool(bassPool(ci), cur.midi, action === "up" ? +1 : -1);
      const updated = [...row]; updated[si] = { ...cur, midi: next };
      return { ...p, [ci]: updated };
    });
  };

  const editArpStep = (ci, si, action) => {
    setArpPat(p => {
      const row = p[ci]; if (!row) return p;
      const cur = row[si]; if (cur == null) return p;
      let next;
      if (action === "oct-up")        next = octaveShift(cur, +1);
      else if (action === "oct-down") next = octaveShift(cur, -1);
      else                            next = stepWithinPool(arpPool(ci), cur, action === "up" ? +1 : -1);
      const updated = [...row]; updated[si] = next;
      return { ...p, [ci]: updated };
    });
  };

  // ---- Selection helpers ------------------------------------------------
  // Single click → toggle selection of an active step (or clear the row's
  // selection if the click landed on an empty step).
  // Double click → insert (if empty) or remove (if active).
  // The Knob then operates on the current selection, falling back to "all
  // active in the row" if nothing's selected.
  const cellKey = (a, b) => `${a}-${b}`;

  const toggleSelMel = (ci, si, isOn) => {
    setMelSel(s => {
      const k = cellKey(ci, si);
      const next = new Set(s);
      if (!isOn) {
        // Click on empty cell: drop everything in that row so the user can
        // start a fresh selection without cross-row debris.
        for (const key of next) if (key.startsWith(`${ci}-`)) next.delete(key);
      } else if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const toggleSelBass = (ci, si, isOn) => {
    setBassSel(s => {
      const k = cellKey(ci, si);
      const next = new Set(s);
      if (!isOn) { for (const key of next) if (key.startsWith(`${ci}-`)) next.delete(key); }
      else if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const toggleSelArp = (ci, si, isOn) => {
    setArpSel(s => {
      const k = cellKey(ci, si);
      const next = new Set(s);
      if (!isOn) { for (const key of next) if (key.startsWith(`${ci}-`)) next.delete(key); }
      else if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const toggleSelDrum = (drum, si, isOn) => {
    setDrumSel(s => {
      const k = cellKey(drum, si);
      const next = new Set(s);
      if (!isOn) { for (const key of next) if (key.startsWith(`${drum}-`)) next.delete(key); }
      else if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Insert / remove note on double-click. Bass and arp gain insert
  // capability here for the first time — empty cells default to a
  // sensible note (bass: chord root in bass register; arp: lowest tone).
  const insertOrRemoveBass = (ci, si) => {
    setBassPat(p => {
      const ch = prog[ci]; if (!ch) return p;
      const row = p[ci] ? [...p[ci]] : Array(bassSteps).fill(null);
      if (row[si] && row[si].midi != null) {
        row[si] = null;
      } else {
        const octRoot = 12 + bassOct * 12 + ch.root;
        row[si] = { midi: octRoot, accent: false, slide: false };
      }
      return { ...p, [ci]: row };
    });
  };
  const insertOrRemoveArp = (ci, si) => {
    setArpPat(p => {
      const ch = prog[ci]; if (!ch) return p;
      const row = p[ci] ? [...p[ci]] : Array(arpSteps).fill(null);
      if (row[si] != null) {
        row[si] = null;
      } else {
        const sorted = [...ch.midiNotes].sort((a, b) => a - b);
        row[si] = sorted[0] ?? null;
      }
      return { ...p, [ci]: row };
    });
  };

  // ---- Per-row in-scale transpose (the Polyend-style pitch dial) -----
  // Shifts every active note in a single row by `dir` (±1 step) within
  // that track's note pool. Wired up to the per-row Knob component on
  // each sequencer.

  // Helper: should step `si` in chord `ci` be affected by a row dial?
  // Yes if it's in the current selection. If the row has no selection at all
  // we fall back to "all active in this row" so the dial keeps working
  // before the user has selected anything.
  const inMelSel  = (ci, si) => melSel.has(cellKey(ci, si));
  const inBassSel = (ci, si) => bassSel.has(cellKey(ci, si));
  const inArpSel  = (ci, si) => arpSel.has(cellKey(ci, si));
  const rowHasSel = (sel, ci) => {
    for (const k of sel) if (k.startsWith(`${ci}-`)) return true;
    return false;
  };

  const transposeMelRow = (ci, dir) => {
    setMelPat(p => {
      const row = p[ci]; if (!row) return p;
      const pool = melodyPool(ci);
      const useSel = rowHasSel(melSel, ci);
      const updated = row.map((m, si) => {
        if (m == null) return m;
        if (useSel && !inMelSel(ci, si)) return m;
        return stepWithinPool(pool, m, dir);
      });
      return { ...p, [ci]: updated };
    });
  };
  const transposeBassRow = (ci, dir) => {
    setBassPat(p => {
      const row = p[ci]; if (!row) return p;
      const pool = bassPool(ci);
      const useSel = rowHasSel(bassSel, ci);
      const updated = row.map((s, si) => {
        if (!s || s.midi == null) return s;
        if (useSel && !inBassSel(ci, si)) return s;
        return { ...s, midi: stepWithinPool(pool, s.midi, dir) };
      });
      return { ...p, [ci]: updated };
    });
  };
  const transposeArpRow = (ci, dir) => {
    setArpPat(p => {
      const row = p[ci]; if (!row) return p;
      const pool = arpPool(ci);
      const useSel = rowHasSel(arpSel, ci);
      const updated = row.map((m, si) => {
        if (m == null) return m;
        if (useSel && !inArpSel(ci, si)) return m;
        return stepWithinPool(pool, m, dir);
      });
      return { ...p, [ci]: updated };
    });
  };

  const regenBass = () => {
    if (!prog.length) return;
    const np = {};
    // Bass octave anchor: 12 (C0) + bassOct*12 puts midi 24/36/48 = C1/C2/C3 for root C.
    const octBase = 12 + bassOct * 12;
    prog.forEach((ch, i) => {
      np[i] = genBass(bassMode, ch, bassSteps, octBase + ch.root);
    });
    setBassPat(np);
    setBassSel(new Set());
  };

  const regenArp = () => {
    if (!prog.length) return;
    const np = {};
    prog.forEach((ch, i) => { np[i] = arpeggiate(ch.midiNotes, arpSteps, arpMode, arpRhythm); });
    setArpPat(np);
    setArpSel(new Set());
  };

  // ---- Playback (Tone.Transport scheduling, beat-relative positions) ----
  // Build events + step callbacks for the current state. Pure function over
  // the relevant state — no setState, no audio side effects. Both playOnce
  // (start fresh) and the live-update useEffect call this.
  const buildPlayback = useCallback(() => {
    if (!prog.length) return null;
    const events = [];
    const cbs = [];

    prog.forEach((ch, ci) => {
      // Chord rhythm
      const ts = bpc * 2;
      const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
      const stepBeats = bpc / ts;
      // Convert chord-design seconds-offsets into beats at current BPM.
      // (Strum/spread/humanise are designed in real time; the scheduler
      //  needs beats since the Transport speaks in beats.)
      const beatsPerSec = bpm / 60;
      rhy.forEach((on, si) => {
        if (!on) return;
        let dsteps = 1;
        for (let j = si + 1; j < ts; j++) { if (rhy[j]) break; dsteps++; }
        const baseBeat = ci * bpc + si * stepBeats;
        const baseDur  = dsteps * stepBeats * 0.95;
        // expandChord returns one event per voiced note, with seconds offset
        // (strum) and a velocity multiplier (humanise + spread).
        const expanded = expandChord(ch.midiNotes, chordDesign);
        expanded.forEach(({ midi, secondsOffset, velMod }) => {
          const evt = {
            beat:     baseBeat + secondsOffset * beatsPerSec,
            midi,
            durBeats: baseDur,
            vel:      Math.max(0, Math.min(1, 0.5 * velMod)),
          };
          // Route based on chord-voice selector. "both" fires piano + pad
          // (mixer-blended); "piano" or "pad" sends only that one.
          // For MIDI: in "both" mode, the piano voice carries the chord
          // out so we tag the pad copy as `midiSilent` to avoid duplicate
          // notes hitting the same channel.
          if (chordVoice === "both" || chordVoice === "piano") events.push({ ...evt, voice: "piano" });
          if (chordVoice === "both" || chordVoice === "pad")   events.push({ ...evt, voice: "pad", midiSilent: chordVoice === "both" });
        });
      });

      // Bass
      if (bassOn && bassPat[ci]) {
        const bp = bassPat[ci];
        const bStep = bpc / bp.length;
        bp.forEach((s, si) => {
          if (!s || s.midi === null) return;
          events.push({
            beat: ci * bpc + si * bStep,
            midi: s.midi,
            durBeats: bStep * (s.slide ? 1.1 : 0.8),
            vel: s.accent ? 0.85 : 0.55,
            voice: bassMode === "acid" ? "acid" : "bass",
          });
        });
      }

      // Melody (+ per-step UI callback for the playing-cell highlight)
      if (melOn && melPat[ci]) {
        const mp = melPat[ci];
        const mStep = bpc / mp.length;
        mp.forEach((midi, si) => {
          if (midi === null) return;
          events.push({
            beat: ci * bpc + si * mStep,
            midi,
            durBeats: mStep * 0.9,
            vel: 0.55,
            voice: "melody",
          });
        });
        for (let si = 0; si < mp.length; si++) cbs.push({ beat: ci * bpc + si * mStep, ci, si });
      }

      // Arp (rides on the chord-instrument voice — could split out later)
      if (arpOn && arpPat[ci]) {
        const ap = arpPat[ci];
        const aStep = bpc / ap.length;
        ap.forEach((midi, si) => {
          if (midi == null) return;
          events.push({
            beat: ci * bpc + si * aStep,
            midi,
            durBeats: aStep * 0.8,
            vel: 0.45,
            voice: "arp",
          });
        });
      }

      // Drums. Each step is a sixteenth (bpc/16). Pattern length is
      // `drumSteps` (16 / 32 / 64). Longer patterns span multiple chord
      // bars: bar N reads pattern slice `(N * 16) % drumSteps .. +16`,
      // so a 32-step pattern alternates first-half / second-half across
      // chords (bar 2 fills land on the 2nd chord, etc.).
      if (drumOn) {
        const stepsPerBar = 16;
        const stepBeats = bpc / stepsPerBar;
        const winStart = (ci * stepsPerBar) % drumSteps;
        DRUMS.forEach(d => {
          const row = drumPat[d.key];
          if (!row) return;
          for (let si = 0; si < stepsPerBar; si++) {
            const cell = row[winStart + si];
            const vel = cell === true ? 0.85 : (typeof cell === "number" ? cell : 0);
            if (vel <= 0) continue;
            events.push({
              beat: ci * bpc + si * stepBeats,
              voice: "drums",
              drum: d.key,
              vel,
              midi: 0, durBeats: stepBeats * 0.5,
            });
          }
        });
      }

      // Chord-position UI callback
      cbs.push({ beat: ci * bpc, ci, si: -1 });
    });

    const totalBeats = prog.length * bpc;
    return { events, cbs, totalBeats };
  }, [prog, bpc, bpm, chordDesign, chordVoice, bassOn, bassPat, bassMode, melOn, melPat, arpOn, arpPat, drumOn, drumPat, drumSteps]);

  // Step / end callbacks — same shape for both play and update so the engine
  // can reattach them to fresh Parts on every rebuild.
  const onStep = useCallback((ci, si) => {
    if (si === -1) setCurStep(ci);
    if (si >= 0) setCurMel({ c: ci, s: si });
  }, []);
  const onEnd = useCallback(() => {
    setCurStep(-1); setCurMel(null); setPlaying(false);
  }, []);

  const playOnce = useCallback(() => {
    const built = buildPlayback();
    if (!built) return;
    setPlaying(true);
    audio.current.play(built.events, built.cbs, built.totalBeats, looping, onStep, onEnd);
  }, [buildPlayback, looping, onStep, onEnd]);

  // Hot-reload: when playing, push pattern / progression / chord-design
  // changes into the engine without stopping. Edits land on the next loop
  // iteration so the transport never has to skip. This is what makes
  // tweaking notes during playback feel live.
  useEffect(() => {
    if (!playing) return;
    const built = buildPlayback();
    if (!built) return;
    audio.current.update(built.events, built.cbs, built.totalBeats, looping, onStep, onEnd);
  }, [playing, buildPlayback, looping, onStep, onEnd]);

  const startP = () => { if (!playing) playOnce(); };
  const stopP = () => { audio.current.stop(); setPlaying(false); setCurStep(-1); setCurMel(null); };

  // ---- DnD ----
  const onDS = (i) => setDragI(i);
  const onDO = (e, i) => { e.preventDefault(); setDragO(i); };
  const onDE = () => {
    if (dragI !== null && dragO !== null && dragI !== dragO) {
      const np = [...prog];
      const [m] = np.splice(dragI, 1);
      np.splice(dragO, 0, m);
      setProg(np);
    }
    setDragI(null); setDragO(null);
  };

  const playNote = (m) => audio.current.note(m, 0.8);

  // ---- Drum handlers ----
  // Loading a kit always re-emits a pattern at the current step count, so
  // House (a 16-bar groove) at 64 steps gets its bar-2/3/4 fills baked in.
  const onLoadKit = (kitKey) => setDrumPat(loadKit(kitKey, drumSteps));
  const onClearDrums = () => setDrumPat(emptyDrumPattern(drumSteps));
  const onAuditionDrum = (which) => audio.current.drum(which);
  // Step-count change tiles the existing pattern up (or truncates) so the
  // user keeps their work — it just gets longer / shorter in place.
  const onDrumStepsChange = (newSteps) => {
    setDrumPat(p => resizeDrumPattern(p, drumSteps, newSteps));
    setDrumSteps(newSteps);
  };

  // Per-row velocity scaling. Knob emits ±1 per notch; map to ±0.05 vel.
  // Honours the drum selection: if any cells in this row are selected,
  // only those get scaled; otherwise every active cell in the row does.
  const adjustDrumVel = (drumKey, dir) => {
    setDrumPat(p => {
      const row = p[drumKey]; if (!row) return p;
      const useSel = rowHasSel(drumSel, drumKey);
      const updated = row.map((cell, si) => {
        const cur = cell === true ? 0.85 : (typeof cell === "number" ? cell : 0);
        if (cur <= 0) return cell;
        if (useSel && !drumSel.has(cellKey(drumKey, si))) return cell;
        return Math.max(0.1, Math.min(1.0, Math.round((cur + dir * 0.05) * 100) / 100));
      });
      return { ...p, [drumKey]: updated };
    });
  };

  // ---- Mixer handlers ----
  const onMixChange = (key, value) => setMixer(m => ({ ...m, [key]: value }));
  const onMixReset = () => setMixer(MIXER_DEFAULTS);

  // ---- FX handlers ----
  const onFxChange = (key, value) => setFx(f => ({ ...f, [key]: value }));

  // ---- Chord design handlers ----
  const onChordDesignChange = (key, value) => setChordDesign(d => ({ ...d, [key]: value }));

  // ---- MIDI Out handlers ----
  // Picking a device hands the live MIDIOutput port to the engine
  // (engine doesn't know how to look it up itself), and stashes the id
  // + display name so an autosave restore can reconnect cleanly.
  const onMidiSetDevice = (id, port) => {
    audio.current.setMidiPort(port || null);
    setMidi(m => ({
      ...m,
      deviceId: id,
      deviceName: port?.name || (id == null ? null : m.deviceName),
    }));
  };
  const onMidiSetEnabled = (b) => setMidi(m => ({ ...m, enabled: b }));
  const onMidiSetMonitor = (b) => setMidi(m => ({ ...m, monitor: b }));
  const onMidiSetClock   = (b) => setMidi(m => ({ ...m, clock: b }));
  const onMidiSetChannels = (patch) => setMidi(m => ({ ...m, channels: { ...m.channels, ...patch } }));

  // ---- Voice preset / macro handlers ----
  // Switching a preset resets the macros to that preset's defaults so the
  // sliders snap and the engine + UI stay in sync.
  const onVoicePreset = (voice, presetKey) => {
    const def = VOICE_PRESETS[voice]?.[presetKey];
    if (!def) return;
    setVoiceState(s => ({
      ...s,
      [voice]: {
        preset: presetKey,
        attack: def.attack, decay: def.decay, sustain: def.sustain, release: def.release,
        tone: def.tone, reverb: def.reverb, delay: def.delay,
      },
    }));
    audio.current.setVoicePreset(voice, presetKey);
  };

  const onVoiceMacro = (voice, name, value) => {
    setVoiceState(s => ({ ...s, [voice]: { ...s[voice], [name]: value } }));
    audio.current.setVoiceMacro(voice, name, value);
  };

  // ---- Snapshot save/restore ---------------------------------------------
  // Capture every piece of state that defines a "session" — everything you'd
  // want to recall later. Skips transient UI bits (selection, drag, playback)
  // and collapsible state (so loading a snapshot doesn't surprise-fold panels).
  const getCurrentState = () => ({
    schema: 1,
    rootNote, scaleKey, ext, octS, showBor, mode,
    prog, bpm, bpc, chordVoice,
    mixer, voiceState, fx, chordDesign,
    // MIDI: persist channels + monitor/clock + remembered device name
    // (so the next session can hint "saved device X isn't connected"),
    // but force enabled=false on save — we don't want a restore to start
    // streaming notes to whatever's listening before the user has confirmed.
    midi: { ...midi, enabled: false },
    bassOn, bassMode, bassSteps, bassOct, bassPat,
    melOn, melPenta, melSteps, melOct, melMode, melFill, melDens, melEucH, melPat, melLock,
    arpOn, arpMode, arpRhythm, arpSteps, arpPat,
    drumOn, drumKit, drumSteps, drumPat,
    // Patches travel with the project: one per slot, plus the shared mix.
    synth: synth.collect(),
  });

  // Apply a saved snapshot. Each `??` fallback means an old snapshot missing
  // a newer field still loads cleanly. The mixer/voices/FX useEffects fire
  // on the next render and push the engine state automatically.
  const applyState = (s) => {
    if (!s || typeof s !== "object") return;
    stopP();
    if (s.rootNote != null) setRootNote(s.rootNote);
    if (s.scaleKey)         setScaleKey(s.scaleKey);
    if (s.ext)              setExt(s.ext);
    if (s.octS != null)     setOctS(s.octS);
    if (s.showBor != null)  setShowBor(s.showBor);
    if (s.mode)             setMode(s.mode);

    setProg(s.prog || []);
    if (s.bpm) setBpm(s.bpm);
    if (s.bpc) setBpc(s.bpc);
    if (s.chordVoice) setChordVoice(s.chordVoice);

    if (s.mixer)      setMixer({ ...MIXER_DEFAULTS, ...s.mixer });
    if (s.voiceState) {
      // Migrate older snapshots that lacked the `sustain` field. Fall back
      // to the preset's default sustain (or 0.3 if even that's missing).
      const fresh = buildInitialVoiceState();
      const merged = {};
      for (const [v, st] of Object.entries(s.voiceState)) {
        const presetDef = VOICE_PRESETS[v]?.[st.preset];
        merged[v] = {
          ...fresh[v],
          ...st,
          sustain: st.sustain ?? presetDef?.sustain ?? 0.3,
        };
      }
      setVoiceState(merged);
    }
    if (s.fx)         setFx({ ...FX_DEFAULTS, ...s.fx });
    // Chord design — older snapshots predating this feature get the defaults.
    setChordDesign({ ...CHORD_DESIGN_DEFAULTS, ...(s.chordDesign || {}) });
    // MIDI — channels + toggles + remembered device id/name. The live port
    // can't survive serialisation; the MidiOut component will try to
    // re-resolve it once the user re-grants Web MIDI access.
    if (s.midi) {
      setMidi(m => ({
        ...MIDI_DEFAULTS,
        ...m,
        ...s.midi,
        // Force enabled false on restore — user confirms via the UI.
        enabled: false,
        channels: { ...MIDI_DEFAULTS.channels, ...(s.midi.channels || {}) },
      }));
    }

    setBassOn(!!s.bassOn);
    if (s.bassMode)         setBassMode(s.bassMode);
    if (s.bassSteps)        setBassSteps(s.bassSteps);
    if (s.bassOct != null)  setBassOct(s.bassOct);
    setBassPat(s.bassPat || {});

    setMelOn(!!s.melOn);
    if (s.melPenta)         setMelPenta(s.melPenta);
    if (s.melSteps)         setMelSteps(s.melSteps);
    if (s.melOct != null)   setMelOct(s.melOct);
    if (s.melMode)          setMelMode(s.melMode);
    if (s.melFill)          setMelFill(s.melFill);
    if (s.melDens != null)  setMelDens(s.melDens);
    if (s.melEucH != null)  setMelEucH(s.melEucH);
    setMelPat(s.melPat || {});
    setMelLock(s.melLock || {});

    setArpOn(!!s.arpOn);
    if (s.arpMode)          setArpMode(s.arpMode);
    if (s.arpRhythm)        setArpRhythm(s.arpRhythm);
    if (s.arpSteps)         setArpSteps(s.arpSteps);
    setArpPat(s.arpPat || {});

    setDrumOn(!!s.drumOn);
    if (s.drumKit)   setDrumKit(s.drumKit);
    if (s.drumSteps) setDrumSteps(s.drumSteps);
    if (s.drumPat)   setDrumPat(s.drumPat);

    // Synth patches. Async because switching a slot on may have to build the
    // audio graph; restoring always happens from a click, so the gesture
    // requirement is satisfied. Snapshots predating the synth simply have
    // nothing here and every slot stays on its Tone voice.
    if (s.synth) synth.apply(s.synth);

    // Clear transient bits that don't belong in a snapshot.
    setSelChord(null);
    setInv(0);
    setPrevS(null);
    setVariations(null);
  };

  // ---- Auto-save / restore ------------------------------------------------
  // Restore the last session on first mount. We do this once and bail if no
  // autosave exists. Wrapped in a ref-guarded effect so it can't fire twice
  // under React strict mode (which intentionally double-invokes effects in dev).
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const last = readAutosave();
    if (last) applyState(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced write of the whole session to localStorage. Fires on every
  // state change but only persists ~600ms after the last change — so dragging
  // a slider doesn't hammer storage. Skipped while restore-on-mount is still
  // pending to avoid clobbering the restored state with the initial defaults.
  useEffect(() => {
    if (!didRestoreRef.current) return;
    const id = setTimeout(() => writeAutosave(getCurrentState()), 600);
    return () => clearTimeout(id);
    // We deliberately depend on the entire state surface — any change should
    // bump the debounce. JSON.stringify of the captured state is heavy but
    // simple; if this ever shows up in profiling we can swap to specific deps.
  }, [
    rootNote, scaleKey, ext, octS, showBor, mode,
    prog, bpm, bpc, chordVoice,
    mixer, voiceState, fx, chordDesign, midi,
    bassOn, bassMode, bassSteps, bassOct, bassPat,
    melOn, melPenta, melSteps, melOct, melMode, melFill, melDens, melEucH, melPat, melLock,
    arpOn, arpMode, arpRhythm, arpSteps, arpPat,
    drumOn, drumKit, drumSteps, drumPat,
  ]);

  // ---- Variation suggestions ---------------------------------------------
  // Compute three alternative progressions, each using a different strategy.
  // The user previews / applies them inline in the Progression panel.
  const onSuggestVariation = () => {
    if (!prog.length) return;
    const v = suggestVariations(prog, rootNote, scaleKey, ext, baseMidi, dCh);
    setVariations(v);
  };

  const onApplyVariation = (variation) => {
    if (!variation?.prog) return;
    setProg(variation.prog.map((c, i) => ({ ...c, id: Date.now() + Math.random() + i })));
    // Patterns no longer match the new chord set — clear them so the user
    // either regenerates from scratch or builds them up step-by-step.
    setMelPat({}); setBassPat({}); setArpPat({});
    setVariations(null);
  };

  const onPreviewVariation = (variation) => {
    if (!variation?.prog?.length) return;
    // Audition all chords back-to-back with a short interval.
    let t = 0;
    const voiceArg = chordVoiceArg();
    variation.prog.forEach((ch) => {
      setTimeout(() => audio.current.chord(ch.midiNotes, 0.9, voiceArg), t);
      t += 700;
    });
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="hw">
      <div className="hw-hdr">
        <div>
          <h1 className="hw-t">Harmonic <span className="a">Workbench</span></h1>
          <div className="hw-st">Theory · Progression · Melody · Bass · Arp</div>
        </div>
        <div className="hw-hc">
          <Seg
            options={[{ v: "compose", l: "Compose" }, { v: "arrange", l: "Arrange" }]}
            value={mode}
            onChange={setMode}
          />
          {mode === "compose" && (
            <Seg
              options={[{ v: "triad", l: "Triad" }, { v: "seventh", l: "7th" }, { v: "ninth", l: "9th" }]}
              value={ext}
              onChange={setExt}
            />
          )}
          {/* Chord voice — which synth(s) the chord events route to. Visible
              in both modes since it affects audition AND playback. */}
          <Seg
            options={[
              { v: "both",  l: "Pno + Pad" },
              { v: "piano", l: "Piano" },
              { v: "pad",   l: "Pad" },
            ]}
            value={chordVoice}
            onChange={setChordVoice}
          />
        </div>
      </div>

      <div className="hw-lay">
        <div>
          {/* Snapshots — visible in both modes; saving / loading is a session-level concern. */}
          <Section
            num="S" title="Snapshots" color="var(--bw)"
            open={openS.snap} toggle={() => togS("snap")}
            badge={null}
          >
            <Snapshots
              getCurrentState={getCurrentState}
              applyState={applyState}
            />
          </Section>

          {mode === "compose" && (
            <Section
              num="1" title="Key & Scale"
              open={openS.key} toggle={() => togS("key")}
              badge={NOTE_NAMES[rootNote] + " " + SCALES[scaleKey].name.split(" ")[0]}
            >
              <KeyScale
                rootNote={rootNote} setRootNote={setRootNote}
                scaleKey={scaleKey} setScaleKey={setScaleKey}
                onScaleChange={() => setSelChord(null)}
                scaleNotes={sn}
              />
            </Section>
          )}

          {mode === "arrange" && (
            <Section
              num="M" title="Mixer" color="var(--ac)"
              open={openS.mix} toggle={() => togS("mix")}
              badge={null}
            >
              <Mixer
                levels={mixer}
                defaults={MIXER_DEFAULTS}
                onChange={onMixChange}
                onReset={onMixReset}
              />
            </Section>
          )}

          {mode === "arrange" && (
            <Section
              num="V" title="Voices" color="var(--ac)"
              open={openS.voices} toggle={() => togS("voices")}
              badge={null}
            >
              <Voices
                voiceState={voiceState}
                onPreset={onVoicePreset}
                onMacro={onVoiceMacro}
              />
            </Section>
          )}

          {mode === "arrange" && (
            <Section
              num="S" title="Synth" color="var(--bw)"
              open={openS.synth} toggle={() => togS("synth")}
              badge={Object.values(synth.slots).some(s => s.on) ? "ON" : null}
            >
              <SynthParts synth={synth} />
            </Section>
          )}

          {mode === "arrange" && (
            <Section
              num="F" title="FX" color="var(--grn)"
              open={openS.fx} toggle={() => togS("fx")}
              badge={fx.delayPingPong ? "PP" : null}
            >
              <FX fx={fx} onChange={onFxChange} />
            </Section>
          )}

          {/* Live MIDI Output — visible in both modes since "send to my
              hardware" is something you'd want during composing too
              (audition through your real synth) and arranging (record
              into Ableton). */}
          <Section
            num="O" title="MIDI Out" color="var(--grn)"
            open={openS.midi} toggle={() => togS("midi")}
            badge={midi.enabled && midi.deviceId ? "Live" : null}
          >
            <MidiOut
              enabled={midi.enabled}    setEnabled={onMidiSetEnabled}
              monitor={midi.monitor}    setMonitor={onMidiSetMonitor}
              clock={midi.clock}        setClock={onMidiSetClock}
              channels={midi.channels}  setChannels={onMidiSetChannels}
              deviceId={midi.deviceId}  setDeviceId={onMidiSetDevice}
              deviceName={midi.deviceName}
            />
          </Section>
        </div>

        <div>
          {mode === "compose" && (
          <Section num="2" title="Piano Roll" open={openS.piano} toggle={() => togS("piano")}>
            <div className="hw-pi-hdr">
              <div style={{ fontSize: ".75rem", color: "var(--txd)" }}>
                {dispCh ? (
                  <span>Showing <strong style={{ color: "var(--ac)" }}>{dispCh.symbol}</strong></span>
                ) : (
                  <span style={{ color: "var(--txf)" }}>Select a chord below</span>
                )}
              </div>
              <div className="hw-oct">
                Oct
                <button onClick={() => setOctS(Math.max(octS - 1, -2))} disabled={octS <= -2}><ArrowDown size={12} /></button>
                <span style={{ minWidth: 36, textAlign: "center", color: "var(--tx)", fontWeight: 700 }}>C{3 + octS}</span>
                <button onClick={() => setOctS(Math.min(octS + 1, 3))} disabled={octS >= 3}><ArrowUp size={12} /></button>
              </div>
            </div>
            <PianoRoll scaleNotes={sn} chord={dispCh} octShift={octS} onClick={playNote} />
            <div className="hw-legend">
              <div className="hw-legend-i"><span className="hw-sw" style={{ background: "var(--ck)" }} /> In chord</div>
              <div className="hw-legend-i"><span className="hw-sw" style={{ background: "var(--sk)" }} /> In scale</div>
              <div className="hw-legend-i"><span className="hw-sw" style={{ background: "#6a6456", opacity: .5 }} /> Out</div>
            </div>
          </Section>
          )}

          {mode === "compose" && (
          <Section num="3" title="Chords" open={openS.chords} toggle={() => togS("chords")}>
            <ChordPalette
              diatonic={dCh} borrowed={bCh}
              ext={ext} inv={inv} baseMidi={baseMidi} rom={rom}
              selChord={selChord} selObj={selObj}
              scaleKey={scaleKey} scaleNotes={sn}
              prevSemi={prevS}
              showBor={showBor} setShowBor={setShowBor}
              onClickChord={clickCh}
              onChangeInv={chgInv}
              onClickTranspose={clickTrans}
              onAddProg={addProg}
              onAddTransP={addTransP}
            />
          </Section>
          )}

          {/* Progression — bridge panel, visible in both modes */}
          <Section
            num="4" title="Progression"
            open={openS.prog} toggle={() => togS("prog")}
            badge={prog.length ? prog.length + " chords" : null}
          >
            <Progression
              prog={prog} setProg={setProg}
              bpc={bpc}
              playing={playing} curStep={curStep}
              dragI={dragI} dragO={dragO} onDS={onDS} onDO={onDO} onDE={onDE}
              clearP={clearP}
              smoothP={smoothP}
              suggestions={sugg}
              loadSug={loadSug}
              toggleChStep={toggleChStep}
              onSuggestVariation={onSuggestVariation}
              variations={variations}
              onApplyVariation={onApplyVariation}
              onPreviewVariation={onPreviewVariation}
              onClearVariations={() => setVariations(null)}
            />
          </Section>

          {/* Chord Design — shapes every chord event (live + scheduled).
              Visible in both modes: in Compose it changes how palette chords
              audition; in Arrange it shapes the chord track in playback. */}
          <Section
            num="C" title="Chord Design" color="var(--ac)"
            open={openS.design} toggle={() => togS("design")}
            badge={
              chordDesign.strum > 0 || chordDesign.spread || chordDesign.humanise > 0
                ? "On" : null
            }
          >
            <ChordDesign design={chordDesign} onChange={onChordDesignChange} />
          </Section>

          {mode === "arrange" && (
          <Section
            num="5" title="Bassline" color="var(--bass)"
            open={openS.bass} toggle={() => togS("bass")}
            badge={bassOn ? bassMode : null}
          >
            <BassSequencer
              bassOn={bassOn} setBassOn={setBassOn}
              bassMode={bassMode} setBassMode={setBassMode}
              bassSteps={bassSteps} setBassSteps={setBassSteps}
              bassOct={bassOct} setBassOct={setBassOct}
              bassPat={bassPat} setBassPat={setBassPat}
              prog={prog}
              regenBass={regenBass}
              editBassStep={editBassStep}
              transposeBassRow={transposeBassRow}
              selection={bassSel} onSelect={toggleSelBass}
              insertOrRemove={insertOrRemoveBass}
            />
          </Section>
          )}

          {mode === "arrange" && (
          <Section
            num="6" title="Melodic Playground" color="var(--mel)"
            open={openS.mel} toggle={() => togS("mel")}
            badge={melOn ? "On" : null}
          >
            <MelodySequencer
              melOn={melOn} setMelOn={setMelOn}
              melPenta={melPenta} setMelPenta={setMelPenta}
              melSteps={melSteps} setMelSteps={setMelSteps}
              melMode={melMode} setMelMode={setMelMode}
              melFill={melFill} setMelFill={setMelFill}
              melDens={melDens} setMelDens={setMelDens}
              melEucH={melEucH} setMelEucH={setMelEucH}
              melOct={melOct} setMelOct={setMelOct}
              melPat={melPat} setMelPat={setMelPat}
              melLock={melLock} setMelLock={setMelLock}
              prog={prog}
              regenMel={regenMel}
              togMelStep={togMelStep}
              editMelStep={editMelStep}
              transposeMelRow={transposeMelRow}
              selection={melSel} onSelect={toggleSelMel}
              curStep={curStep} curMel={curMel}
            />
          </Section>
          )}

          {mode === "arrange" && (
          <Section
            num="7" title="Arpeggiator" color="var(--arp)"
            open={openS.arp} toggle={() => togS("arp")}
            badge={arpOn ? `${arpMode}·${arpRhythm}` : null}
          >
            <ArpSequencer
              arpOn={arpOn} setArpOn={setArpOn}
              arpMode={arpMode} setArpMode={setArpMode}
              arpRhythm={arpRhythm} setArpRhythm={setArpRhythm}
              arpSteps={arpSteps} setArpSteps={setArpSteps}
              arpPat={arpPat} setArpPat={setArpPat}
              prog={prog}
              regenArp={regenArp}
              editArpStep={editArpStep}
              transposeArpRow={transposeArpRow}
              selection={arpSel} onSelect={toggleSelArp}
              insertOrRemove={insertOrRemoveArp}
            />
          </Section>
          )}

          {mode === "arrange" && (
          <Section
            num="8" title="Drum Machine" color="var(--arp)"
            open={openS.drums} toggle={() => togS("drums")}
            badge={drumOn ? drumKit : null}
          >
            <DrumMachine
              drumOn={drumOn} setDrumOn={setDrumOn}
              drumKit={drumKit} setDrumKit={setDrumKit}
              drumSteps={drumSteps}
              drumPat={drumPat} setDrumPat={setDrumPat}
              onLoadKit={onLoadKit}
              onClear={onClearDrums}
              onAuditionDrum={onAuditionDrum}
              onStepsChange={onDrumStepsChange}
              onAdjustVel={adjustDrumVel}
              selection={drumSel} onSelect={toggleSelDrum}
            />
          </Section>
          )}

          {/* Per-track MIDI export. Visible in both modes — exporting is a
              session-end concern that doesn't belong inside Compose/Arrange. */}
          <Section
            num="X" title="Track Exports" color="var(--grn)"
            open={openS.tracks} toggle={() => togS("tracks")}
            badge={prog.length ? "MIDI" : null}
          >
            <TrackExports
              prog={prog} bpm={bpm} bpc={bpc}
              bassPat={bassPat} melPat={melPat} arpPat={arpPat} drumPat={drumPat}
              bassOn={bassOn}   melOn={melOn}   arpOn={arpOn}   drumOn={drumOn}
            />
          </Section>
        </div>
      </div>

      {/* Sticky global transport — fixed to the bottom of the viewport */}
      <TransportBar
        playing={playing} looping={looping} setLooping={setLooping}
        bpm={bpm} setBpm={setBpm} bpc={bpc} setBpc={setBpc}
        startP={startP} stopP={stopP}
        onExport={() => exportMidi(prog, bpm, bpc, bassOn ? bassPat : null, melOn ? melPat : null, arpOn ? arpPat : null, drumOn ? drumPat : null)}
        hasProg={!!prog.length}
      />
    </div>
  );
}
