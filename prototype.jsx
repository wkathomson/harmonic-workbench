import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, Plus, X, Info, Music, Trash2, Download, Sparkles, ChevronDown, ChevronRight, GripVertical, ArrowUp, ArrowDown, Check, Shuffle, RotateCcw, Lock, Unlock, Repeat, Zap } from "lucide-react";

// ---- DATA ----
const NT = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = {
  major:{name:"Major (Ionian)",iv:[0,2,4,5,7,9,11],cq:["maj","min","min","maj","maj","min","dim"],par:"minor"},
  minor:{name:"Natural Minor",iv:[0,2,3,5,7,8,10],cq:["min","dim","maj","min","min","maj","maj"],par:"major"},
  dorian:{name:"Dorian",iv:[0,2,3,5,7,9,10],cq:["min","min","maj","maj","min","dim","maj"],par:"mixolydian"},
  phrygian:{name:"Phrygian",iv:[0,1,3,5,7,8,10],cq:["min","maj","maj","min","dim","maj","min"],par:"lydian"},
  lydian:{name:"Lydian",iv:[0,2,4,6,7,9,11],cq:["maj","maj","min","dim","maj","min","min"],par:"phrygian"},
  mixolydian:{name:"Mixolydian",iv:[0,2,4,5,7,9,10],cq:["maj","min","dim","maj","min","min","maj"],par:"dorian"},
  harmonicMinor:{name:"Harmonic Minor",iv:[0,2,3,5,7,8,11],cq:["min","dim","aug","min","maj","maj","dim"],par:"major"},
  melodicMinor:{name:"Melodic Minor",iv:[0,2,3,5,7,9,11],cq:["min","min","aug","maj","maj","dim","dim"],par:"major"},
};
const PENTA = {major:[0,2,4,7,9], minor:[0,3,5,7,10]};
const CF = {
  triad:{maj:[0,4,7],min:[0,3,7],dim:[0,3,6],aug:[0,4,8]},
  seventh:{maj:[0,4,7,11],min:[0,3,7,10],dim:[0,3,6,9],aug:[0,4,8,11]},
  ninth:{maj:[0,4,7,11,14],min:[0,3,7,10,14],dim:[0,3,6,9,13],aug:[0,4,8,11,14]},
};
const CSuf = {triad:{maj:"",min:"m",dim:"°",aug:"+"},seventh:{maj:"M7",min:"m7",dim:"°7",aug:"+M7"},ninth:{maj:"M9",min:"m9",dim:"°9",aug:"+9"}};

const PROGS = {
  major:[{n:"Pop I–V–vi–IV",d:[0,4,5,3]},{n:"Jazz ii–V–I",d:[1,4,0]},{n:"Cinematic I–iii–IV–vi",d:[0,2,3,5]}],
  minor:[{n:"Andalusian i–VII–VI–V",d:[0,6,5,4]},{n:"House i–VI–VII–i",d:[0,5,6,0]},{n:"Epic i–VII–VI–VII",d:[0,6,5,6]}],
  dorian:[{n:"Dorian vamp i–IV",d:[0,3]}],
  phrygian:[{n:"Spanish i–♭II–♭III–i",d:[0,1,2,0]}],
  lydian:[{n:"Lydian float I–II",d:[0,1]}],
  mixolydian:[{n:"Rock I–♭VII–IV",d:[0,6,3]}],
  harmonicMinor:[{n:"Classical i–iv–V–i",d:[0,3,4,0]}],
  melodicMinor:[{n:"Jazz minor i–ii–V",d:[0,1,4]}],
};

// ---- AUDIO ----
class Synth {
  constructor() { this.ctx = null; this.mg = null; this.inst = "piano"; this.timers = []; }
  init() { if (this.ctx) return; this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.mg = this.ctx.createGain(); this.mg.gain.value = 0.3; this.mg.connect(this.ctx.destination); }
  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  stop() { this.timers.forEach(t => clearTimeout(t)); this.timers = []; }

  note(midi, dur = 1.5, vel = 0.8, voice) {
    this.init();
    if (this.ctx.state === "suspended") this.ctx.resume();
    const now = this.ctx.currentTime, fr = this.freq(midi), g = this.ctx.createGain();
    const v = voice || this.inst;
    if (v === "pad") {
      const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o1.type = "sawtooth"; o2.type = "sawtooth";
      o1.frequency.value = fr; o2.frequency.value = fr * 1.005;
      const fl = this.ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 2;
      fl.frequency.setValueAtTime(400, now); fl.frequency.linearRampToValueAtTime(2200, now + 0.4);
      o1.connect(fl); o2.connect(fl); fl.connect(g);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vel * 0.25, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      g.connect(this.mg); o1.start(now); o2.start(now); o1.stop(now + dur + 0.1); o2.stop(now + dur + 0.1);
    } else if (v === "acid") {
      const o = this.ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr;
      const fl = this.ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 12;
      const am = vel > 0.7 ? 2.5 : 1;
      fl.frequency.setValueAtTime(300 * am, now); fl.frequency.linearRampToValueAtTime(3000 * am, now + 0.02);
      fl.frequency.exponentialRampToValueAtTime(200, now + dur * 0.8);
      o.connect(fl); fl.connect(g);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vel * 0.6, now + 0.005);
      g.gain.setValueAtTime(vel * 0.6, now + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      g.connect(this.mg); o.start(now); o.stop(now + dur + 0.05);
    } else {
      const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o1.type = "triangle"; o2.type = "sine";
      o1.frequency.value = fr; o2.frequency.value = fr * 2;
      const g1 = this.ctx.createGain(), g2 = this.ctx.createGain();
      g1.gain.value = v === "bass" ? 0.85 : 0.7; g2.gain.value = v === "bass" ? 0.1 : 0.2;
      o1.connect(g1); o2.connect(g2); g1.connect(g); g2.connect(g);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vel * 0.5, now + 0.005);
      g.gain.exponentialRampToValueAtTime(vel * 0.15, now + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      g.connect(this.mg); o1.start(now); o2.start(now); o1.stop(now + dur + 0.1); o2.stop(now + dur + 0.1);
    }
  }

  chord(notes, dur = 2, voice) {
    notes.forEach((n, i) => { const t = setTimeout(() => this.note(n, dur, 0.55, voice), i * 12); this.timers.push(t); });
  }

  scheduleAll(events, onStep, onEnd, totalMs, cbs) {
    this.init(); if (this.ctx.state === "suspended") this.ctx.resume(); this.stop();
    events.forEach(ev => { const t = setTimeout(() => this.note(ev.midi, ev.dur, ev.vel || 0.5, ev.voice), ev.t); this.timers.push(t); });
    (cbs || []).forEach(cb => { const t = setTimeout(() => onStep(cb.ci, cb.si), cb.t); this.timers.push(t); });
    this.timers.push(setTimeout(() => onEnd(), totalMs));
  }
}

// ---- THEORY ----
function getSN(r, sk) { return SCALES[sk].iv.map(i => (r + i) % 12); }
function getPN(r, pt) { return PENTA[pt].map(i => (r + i) % 12); }
function pentaFor(ch, pref) { return pref === "auto" ? (ch.quality === "maj" || ch.quality === "aug" ? "major" : "minor") : pref; }
function getRom(sk) {
  const q = SCALES[sk].cq, R = ["I","II","III","IV","V","VI","VII"];
  return q.map((qu, i) => qu === "maj" ? R[i] : qu === "aug" ? R[i]+"+" : qu === "min" ? R[i].toLowerCase() : R[i].toLowerCase()+"°");
}
function cSym(rn, q, ext) { return rn + (CSuf[ext][q] || ""); }
function applyInv(midi, inv) {
  if (inv === 0) return [...midi];
  const n = [...midi];
  for (let i = 0; i < Math.abs(inv); i++) {
    if (inv > 0) { const b = n.shift(); n.push(b + 12); }
    else { const t = n.pop(); n.unshift(t - 12); }
  }
  return n;
}
function mkChord(root, quality, ext, inv = 0, base = 48) {
  const f = CF[ext][quality] || CF.triad[quality];
  const midi = applyInv(f.map(i => base + root + i), inv);
  return { root, quality, ext, inv, rootName: NT[root], pitchClasses: [...new Set(midi.map(m => m % 12))], midiNotes: midi, symbol: cSym(NT[root], quality, ext), baseMidi: base };
}
function getDia(r, sk, ext = "triad", base = 48) {
  const s = SCALES[sk], sn = s.iv.map(i => (r + i) % 12);
  return s.cq.map((q, d) => { const ch = mkChord(sn[d], q, ext, 0, base); ch.degree = d; return ch; });
}
function getBor(r, sk, ext = "triad", base = 48) {
  const par = SCALES[sk].par; if (!par) return [];
  const pc = getDia(r, par, ext, base), cs = getSN(r, sk), pr = getRom(par);
  return pc.map((c, i) => ({...c, roman: pr[i], parScale: par})).filter(c => c.pitchClasses.some(p => !cs.includes(p)));
}
function transInfo(ch, semi, sn) {
  const nr = (ch.root + semi + 120) % 12;
  const nc = mkChord(nr, ch.quality, ch.ext, ch.inv, ch.baseMidi || 48);
  const adj = Math.round((ch.root + semi - nr) / 12);
  nc.midiNotes = nc.midiNotes.map(m => m + adj * 12);
  return {...nc, semi, inScale: nc.pitchClasses.every(p => sn.includes(p))};
}

// ---- RHYTHM ----
function euclidean(hits, steps) {
  if (hits >= steps) return Array(steps).fill(true);
  if (hits <= 0) return Array(steps).fill(false);
  const p = []; let b = 0;
  for (let i = 0; i < steps; i++) { b += hits; if (b >= steps) { b -= steps; p.push(true); } else p.push(false); }
  return p;
}
function randRhy(steps, density) { return Array(steps).fill(0).map(() => Math.random() < density); }

// ---- ACID BASS ----
function genAcid(chord, steps, density = 0.6) {
  const bm = 36 + chord.root;
  const notes = [bm, bm + 12, bm + 7, bm - 5];
  return Array(steps).fill(null).map(() => {
    if (Math.random() > density) return { midi: null, accent: false, slide: false };
    return { midi: notes[Math.floor(Math.random() * notes.length)] + (Math.random() < 0.15 ? 12 : 0), accent: Math.random() < 0.3, slide: Math.random() < 0.25 };
  });
}

// ---- ARPEGGIATOR ----
function arpChord(midiNotes, steps, mode = "up") {
  const notes = [...midiNotes].sort((a, b) => a - b);
  const seq = [];
  if (mode === "up") for (let i = 0; i < steps; i++) seq.push(notes[i % notes.length]);
  else if (mode === "down") { const r = [...notes].reverse(); for (let i = 0; i < steps; i++) seq.push(r[i % r.length]); }
  else if (mode === "updown") { const ud = [...notes, ...[...notes].reverse().slice(1, -1)]; for (let i = 0; i < steps; i++) seq.push(ud[i % ud.length]); }
  else for (let i = 0; i < steps; i++) seq.push(notes[Math.floor(Math.random() * notes.length)]);
  return seq;
}

// ---- MIDI EXPORT ----
function writeVL(v) { const b = []; let buf = v & 0x7f; v >>= 7; while (v) { buf <<= 8; buf |= ((v & 0x7f) | 0x80); v >>= 7; } while (true) { b.push(buf & 0xff); if (buf & 0x80) buf >>= 8; else break; } return b; }
function mkTrack(events) {
  const d = []; events.forEach(e => { d.push(...writeVL(e.dt)); d.push(...e.b); });
  d.push(...writeVL(0)); d.push(0xff, 0x2f, 0x00);
  const l = d.length; return [0x4d,0x54,0x72,0x6b, (l>>24)&0xff, (l>>16)&0xff, (l>>8)&0xff, l&0xff, ...d];
}
function mkEvStream(notes) {
  const all = [];
  notes.forEach(n => {
    all.push({tick: n.st, type: "on", midi: n.midi, vel: n.vel || 96, ch: n.ch || 0});
    all.push({tick: n.et, type: "off", midi: n.midi, vel: 64, ch: n.ch || 0});
  });
  all.sort((a, b) => a.tick - b.tick || (a.type === "off" ? -1 : 1));
  const de = []; let lt = 0;
  all.forEach(e => { de.push({dt: e.tick - lt, b: [(e.type === "on" ? 0x90 : 0x80) | (e.ch & 0xf), e.midi & 0x7f, e.vel & 0x7f]}); lt = e.tick; });
  return de;
}
function doExport(prog, bpm, bpc, bassP, melP, arpP) {
  const tpb = 480, tpc = tpb * bpc;
  const mpqn = Math.round(60000000 / bpm);
  const tempoTr = mkTrack([{dt: 0, b: [0xff, 0x51, 0x03, (mpqn>>16)&0xff, (mpqn>>8)&0xff, mpqn&0xff]}]);
  const cn = [];
  prog.forEach((ch, i) => {
    const ts = bpc * 2;
    const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
    const sd = tpc / ts;
    rhy.forEach((on, si) => {
      if (!on) return;
      let ds = 1; for (let j = si + 1; j < ts; j++) { if (rhy[j]) break; ds++; }
      ch.midiNotes.forEach(m => cn.push({st: Math.round(i*tpc+si*sd), et: Math.round(i*tpc+si*sd+ds*sd*0.95), midi: m, vel: 90, ch: 0}));
    });
  });
  const tracks = [tempoTr, mkTrack(mkEvStream(cn))];
  if (bassP) {
    const bn = [];
    prog.forEach((ch, i) => { const bp = bassP[i]; if (!bp) return; const sd = tpc / bp.length;
      bp.forEach((s, si) => { if (!s || s.midi === null) return; bn.push({st: Math.round(i*tpc+si*sd), et: Math.round(i*tpc+si*sd+sd*(s.slide?1.1:0.8)), midi: s.midi, vel: s.accent?110:85, ch: 1}); });
    });
    if (bn.length) tracks.push(mkTrack(mkEvStream(bn)));
  }
  if (melP) {
    const mn = [];
    prog.forEach((ch, i) => { const mp = melP[i]; if (!mp) return; const sd = tpc / mp.length;
      mp.forEach((midi, si) => { if (midi === null) return; mn.push({st: Math.round(i*tpc+si*sd), et: Math.round(i*tpc+si*sd+sd*0.9), midi, vel: 85, ch: 2}); });
    });
    if (mn.length) tracks.push(mkTrack(mkEvStream(mn)));
  }
  if (arpP) {
    const an = [];
    prog.forEach((ch, i) => { const ap = arpP[i]; if (!ap) return; const sd = tpc / ap.length;
      ap.forEach((midi, si) => { if (midi == null) return; an.push({st: Math.round(i*tpc+si*sd), et: Math.round(i*tpc+si*sd+sd*0.8), midi, vel: 80, ch: 3}); });
    });
    if (an.length) tracks.push(mkTrack(mkEvStream(an)));
  }
  const hdr = [0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,tracks.length,(tpb>>8)&0xff,tpb&0xff];
  const all = [...hdr]; tracks.forEach(t => all.push(...t));
  const blob = new Blob([new Uint8Array(all)], {type: "audio/midi"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "harmonic_workbench.mid";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ---- Collapsible Section ----
function Sec({ num, title, color, open, toggle, badge, children }) {
  return (
    <div className={`hw-s ${open ? "" : "hw-s-cl"}`} style={color ? {"--sc": color} : {}}>
      <button className="hw-sh" onClick={toggle}>
        <span className="hw-sn" style={{color: color || "var(--ac)"}}>{num}</span>
        <span style={{flex: 1, textAlign: "left"}}>{title}</span>
        {badge && <span className="hw-sb" style={{background: color || "var(--ac)"}}>{badge}</span>}
        {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
      </button>
      {open && <div className="hw-sc">{children}</div>}
    </div>
  );
}

// ---- Seg Button Group ----
function Seg({ options, value, onChange, color }) {
  return (
    <div className="hw-sg">
      {options.map(o => (
        <button key={o.v} className={value === o.v ? "on" : ""}
          style={value === o.v && color ? {background: color} : {}}
          onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

// ---- PIANO ROLL ----
function PianoRoll({ sn, sc, os, onC }) {
  const bo = 3 + os, sm = 12 * (bo + 1), nk = 13;
  const wp = [1,0,1,0,1,1,0,1,0,1,0,1];
  const wi = [];
  for (let i = 0; i < nk; i++) { if (wp[(sm + i) % 12]) wi.push(i); }
  const ww = 100 / wi.length, bw = ww * 0.62;
  const cpc = new Set(sc ? sc.pitchClasses : []);
  const ib = sc?.source === "borrowed", ip = sc?.isPreview, pin = sc?.inScale;

  const gc = (m) => {
    const pc = m % 12, isW = wp[pc];
    let c = "hw-pk " + (isW ? "wh" : "bl");
    if (sc && cpc.has(pc)) { c += " ct"; if (ip) c += pin ? " pi" : " po"; else if (ib) c += " bw"; }
    else if (sn.includes(pc)) c += " is";
    return c;
  };

  let wIdx = 0;
  const whites = [];
  const blacks = [];
  let bwIdx = 0;
  for (let i = 0; i < nk; i++) {
    const m = sm + i, pc = m % 12;
    if (wp[pc]) {
      const left = wIdx * ww;
      whites.push(
        <div key={"w" + m} className={gc(m)} style={{left: left + "%", width: ww + "%"}} onClick={() => onC(m)}>
          {NT[pc]}{pc === 0 ? Math.floor(m / 12) - 1 : ""}
        </div>
      );
      wIdx++;
    }
  }
  let w2 = 0;
  for (let i = 0; i < nk; i++) {
    const m = sm + i, pc = m % 12;
    if (wp[pc]) { w2++; }
    else {
      blacks.push(
        <div key={"b" + m} className={gc(m)} style={{left: (w2 * ww - bw / 2) + "%", width: bw + "%"}} onClick={() => onC(m)}>
          {NT[pc]}
        </div>
      );
    }
  }

  return (
    <div className="hw-pi">
      {whites}
      {blacks}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [rootNote, setRootNote] = useState(0);
  const [scaleKey, setScaleKey] = useState("minor");
  const [selChord, setSelChord] = useState(null);
  const [prog, setProg] = useState([]);
  const [inst, setInst] = useState("piano");
  const [bpm, setBpm] = useState(90);
  const [bpc, setBpc] = useState(4);
  const [ext, setExt] = useState("triad");
  const [inv, setInv] = useState(0);
  const [octS, setOctS] = useState(0);
  const [prevS, setPrevS] = useState(null);
  const [showBor, setShowBor] = useState(false);
  const [looping, setLooping] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [curStep, setCurStep] = useState(-1);
  const [curMel, setCurMel] = useState(null);
  const [openS, setOpenS] = useState({key: true, piano: true, chords: true, prog: true, mel: false, bass: false, arp: false});
  const togS = (k) => setOpenS(p => ({...p, [k]: !p[k]}));

  // Bass
  const [bassOn, setBassOn] = useState(false);
  const [bassMode, setBassMode] = useState("acid");
  const [bassPat, setBassPat] = useState({});

  // Melody
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

  // Arp
  const [arpOn, setArpOn] = useState(false);
  const [arpMode, setArpMode] = useState("up");
  const [arpSteps, setArpSteps] = useState(16);
  const [arpPat, setArpPat] = useState({});

  const [dragI, setDragI] = useState(null);
  const [dragO, setDragO] = useState(null);

  const synth = useRef(null);
  if (!synth.current) synth.current = new Synth();
  useEffect(() => { synth.current.inst = inst; }, [inst]);

  const baseMidi = 48 + octS * 12;
  const sn = getSN(rootNote, scaleKey);
  const dCh = useMemo(() => getDia(rootNote, scaleKey, ext, baseMidi), [rootNote, scaleKey, ext, baseMidi]);
  const bCh = useMemo(() => getBor(rootNote, scaleKey, ext, baseMidi), [rootNote, scaleKey, ext, baseMidi]);
  const rom = useMemo(() => getRom(scaleKey), [scaleKey]);
  const sugg = PROGS[scaleKey] || [];

  let selObj = null;
  if (selChord) {
    const list = selChord.src === "borrowed" ? bCh : dCh;
    const b = list[selChord.i];
    if (b) {
      selObj = mkChord(b.root, b.quality, ext, inv, baseMidi);
      selObj.roman = selChord.src === "borrowed" ? b.roman : rom[selChord.i];
      selObj.source = selChord.src;
    }
  }

  let dispCh = selObj;
  if (selObj && prevS !== null && prevS !== 0) {
    const p = transInfo(selObj, prevS, sn);
    dispCh = {...p, source: selObj.source, roman: selObj.roman, isPreview: true};
  }

  useEffect(() => { setInv(0); setPrevS(null); }, [selChord, ext]);

  const clickCh = (i, src) => {
    setSelChord({i, src});
    const list = src === "borrowed" ? bCh : dCh;
    synth.current.chord(mkChord(list[i].root, list[i].quality, ext, 0, baseMidi).midiNotes, 1.8);
  };

  const chgInv = (i) => {
    setInv(i);
    if (selObj) synth.current.chord(mkChord(selObj.root, selObj.quality, ext, i, baseMidi).midiNotes, 1.5);
  };

  const clickTrans = (s) => {
    if (!selObj) return;
    if (s === 0) { setPrevS(null); synth.current.chord(selObj.midiNotes, 1.5); return; }
    setPrevS(s);
    synth.current.chord(transInfo(selObj, s, sn).midiNotes, 1.5);
  };

  const addProg = (chord, roman, source) => {
    setProg(p => [...p, {...chord, roman, source, id: Date.now() + Math.random(), rhythm: null}]);
  };

  const addTransP = (s) => {
    if (!selObj) return;
    const t = transInfo(selObj, s, sn);
    addProg(t, selObj.roman + (s > 0 ? "+" : "") + s, t.inScale ? "diatonic" : "chromatic");
  };

  const loadSug = (s) => {
    stopP();
    setProg(s.d.map((deg, i) => {
      const ch = mkChord(dCh[deg].root, dCh[deg].quality, ext, 0, baseMidi);
      return {...ch, roman: rom[deg], source: "diatonic", id: Date.now() + Math.random() + i, rhythm: null};
    }));
    setMelPat({}); setBassPat({}); setArpPat({});
  };

  const clearP = () => { stopP(); setProg([]); setMelPat({}); setBassPat({}); setArpPat({}); };

  const toggleChStep = (ci, si) => {
    setProg(p => {
      const np = [...p]; const ch = {...np[ci]};
      const ts = bpc * 2;
      const rhy = ch.rhythm ? [...ch.rhythm] : Array(ts).fill(false).map((_, j) => j === 0);
      rhy[si] = !rhy[si]; ch.rhythm = rhy; np[ci] = ch; return np;
    });
  };

  // Melody
  const regenMel = () => {
    if (!prog.length) return;
    const np = {};
    if (melMode === "transposed") {
      const rhy = melFill === "euclidean" ? euclidean(melEucH, melSteps) : randRhy(melSteps, melDens);
      const degP = rhy.map(a => a ? {di: Math.floor(Math.random() * 5), oo: Math.floor(Math.random() * 2)} : null);
      prog.forEach((ch, i) => {
        if (melLock[i] && melPat[i]) { np[i] = melPat[i]; return; }
        const pt = pentaFor(ch, melPenta), pn = getPN(ch.root, pt);
        np[i] = degP.map(s => s ? 12 * (melOct + 1) + pn[s.di] + s.oo * 12 : null);
      });
    } else {
      prog.forEach((ch, i) => {
        if (melLock[i] && melPat[i]) { np[i] = melPat[i]; return; }
        const rhy = melFill === "euclidean" ? euclidean(melEucH, melSteps) : randRhy(melSteps, melDens);
        const pt = pentaFor(ch, melPenta), pn = getPN(ch.root, pt);
        const opts = []; for (let o = 0; o < 2; o++) pn.forEach(pc => opts.push(12 * (melOct + 1) + pc + o * 12));
        np[i] = rhy.map(a => a ? opts[Math.floor(Math.random() * opts.length)] : null);
      });
    }
    setMelPat(np);
  };

  const togMelStep = (ci, si) => {
    const p = {...melPat};
    if (!p[ci]) p[ci] = Array(melSteps).fill(null);
    p[ci] = [...p[ci]];
    if (p[ci][si] !== null) { p[ci][si] = null; }
    else {
      const ch = prog[ci], pt = pentaFor(ch, melPenta), pn = getPN(ch.root, pt);
      const opts = pn.map(pc => 12 * (melOct + 1) + pc);
      p[ci][si] = opts[Math.floor(Math.random() * opts.length)];
    }
    setMelPat(p);
  };

  // Bass
  const regenBass = () => {
    if (!prog.length) return;
    const np = {};
    prog.forEach((ch, i) => {
      if (bassMode === "acid") { np[i] = genAcid(ch, melSteps, 0.6); return; }
      const bm = 36 + ch.root, fifth = 36 + ((ch.root + 7) % 12);
      const steps = bpc * 2;
      const pattern = [];
      for (let s = 0; s < steps; s++) {
        let midi = null;
        if (bassMode === "rootOnly") midi = bm;
        else if (bassMode === "rootFifth") midi = s % 2 === 0 ? bm : fifth;
        else if (bassMode === "octave") midi = s % 2 === 0 ? bm : bm + 12;
        else if (bassMode === "offbeat") { if (s % 2 === 1) midi = bm; }
        pattern.push({midi, accent: false, slide: false});
      }
      np[i] = pattern;
    });
    setBassPat(np);
  };

  // Arp
  const regenArp = () => {
    if (!prog.length) return;
    const np = {};
    prog.forEach((ch, i) => { np[i] = arpChord(ch.midiNotes, arpSteps, arpMode); });
    setArpPat(np);
  };

  // Playback
  const loopRef = useRef(looping);
  loopRef.current = looping;

  const playOnce = useCallback(() => {
    if (!prog.length) return;
    setPlaying(true);
    const beatMs = (60 / bpm) * 1000, chMs = beatMs * bpc;
    const events = [], cbs = [];

    prog.forEach((ch, ci) => {
      const ts = bpc * 2;
      const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
      const sd = chMs / ts;
      rhy.forEach((on, si) => {
        if (!on) return;
        let ds = 1; for (let j = si + 1; j < ts; j++) { if (rhy[j]) break; ds++; }
        ch.midiNotes.forEach(m => events.push({t: ci*chMs+si*sd, midi: m, dur: (ds*sd*0.95)/1000, vel: 0.5, voice: inst}));
      });
      if (bassOn && bassPat[ci]) {
        const bp = bassPat[ci], bsd = chMs / bp.length;
        bp.forEach((s, si) => {
          if (!s || s.midi === null) return;
          events.push({t: ci*chMs+si*bsd, midi: s.midi, dur: (bsd*(s.slide?1.1:0.8))/1000, vel: s.accent?0.85:0.55, voice: bassMode==="acid"?"acid":"bass"});
        });
      }
      if (melOn && melPat[ci]) {
        const mp = melPat[ci], msd = chMs / mp.length;
        mp.forEach((midi, si) => {
          if (midi === null) return;
          events.push({t: ci*chMs+si*msd, midi, dur: (msd*0.9)/1000, vel: 0.55, voice: "melody"});
        });
        for (let si = 0; si < mp.length; si++) cbs.push({t: ci*chMs+si*msd, ci, si});
      }
      if (arpOn && arpPat[ci]) {
        const ap = arpPat[ci], asd = chMs / ap.length;
        ap.forEach((midi, si) => { if (midi == null) return; events.push({t: ci*chMs+si*asd, midi, dur: (asd*0.8)/1000, vel: 0.45, voice: inst}); });
      }
      cbs.push({t: ci * chMs, ci, si: -1});
    });

    synth.current.scheduleAll(events, (ci, si) => {
      if (si === -1) setCurStep(ci);
      if (si >= 0) setCurMel({c: ci, s: si});
    }, () => {
      setCurStep(-1); setCurMel(null);
      if (loopRef.current) setTimeout(() => playOnce(), 50);
      else setPlaying(false);
    }, prog.length * chMs, cbs);
  }, [prog, bpm, bpc, inst, bassOn, bassPat, bassMode, melOn, melPat, arpOn, arpPat]);

  const startP = () => { if (!playing) playOnce(); };
  const stopP = () => { synth.current.stop(); setPlaying(false); setCurStep(-1); setCurMel(null); };

  const onDS = (i) => setDragI(i);
  const onDO = (e, i) => { e.preventDefault(); setDragO(i); };
  const onDE = () => {
    if (dragI !== null && dragO !== null && dragI !== dragO) {
      const np = [...prog]; const [m] = np.splice(dragI, 1); np.splice(dragO, 0, m); setProg(np);
    }
    setDragI(null); setDragO(null);
  };

  const playNote = (m) => synth.current.note(m, 0.8);

  // ---- RENDER ----
  return (
    <div className="hw">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&display=swap');
.hw{--bg:#15130f;--bg2:#1c1a15;--pn:#23201a;--pn2:#2b2822;--bd:#3a362d;--bdb:#5a5244;--tx:#e8e3d6;--txd:#a09a8a;--txf:#6a6456;--ac:#ff7a3c;--acd:#b8542a;--acf:#4a2a18;--bw:#9a6ee0;--bwf:#3a2a55;--grn:#8ab87a;--grnf:#2a3a22;--bass:#5cb8d4;--mel:#e8b84a;--melf:#3a2e18;--arp:#e06ea0;--ck:#ff7a3c;--sk:#d4cfc0;--dng:#c94a3c;font-family:'JetBrains Mono',monospace;background:var(--bg);color:var(--tx);min-height:100vh;padding:20px;font-size:13px;}
.hw *{box-sizing:border-box;}
.hw-hdr{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--bd);gap:14px;flex-wrap:wrap;}
.hw-t{font-family:'Playfair Display',serif;font-size:2rem;font-weight:900;margin:0;line-height:1;}
.hw-t .a{color:var(--ac);font-style:italic;}
.hw-st{font-size:.65rem;color:var(--txf);text-transform:uppercase;letter-spacing:.3em;margin-top:5px;}
.hw-hc{display:flex;gap:8px;flex-wrap:wrap;}
.hw-sg{display:flex;background:var(--pn);border:1px solid var(--bd);border-radius:2px;overflow:hidden;}
.hw-sg button{background:transparent;border:none;color:var(--txd);padding:7px 10px;font-family:inherit;font-size:.63rem;text-transform:uppercase;letter-spacing:.12em;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;}
.hw-sg button.on{background:var(--ac);color:var(--bg);font-weight:700;}
.hw-sg button:hover:not(.on){color:var(--tx);background:var(--pn2);}
.hw-lay{display:grid;grid-template-columns:1fr;gap:14px;}
@media(min-width:1100px){.hw-lay{grid-template-columns:280px 1fr;}}
.hw-s{background:var(--pn);border:1px solid var(--bd);border-radius:3px;margin-bottom:2px;}
.hw-s-cl{opacity:.85;}
.hw-sh{display:flex;align-items:center;gap:8px;padding:12px 14px;width:100%;background:none;border:none;color:var(--txf);font-family:inherit;font-size:.63rem;text-transform:uppercase;letter-spacing:.25em;cursor:pointer;}
.hw-sh:hover{color:var(--tx);}
.hw-sn{display:inline-block;width:18px;height:18px;border:1px solid var(--bdb);text-align:center;line-height:16px;font-size:.65rem;}
.hw-sb{color:var(--bg);font-size:.55rem;padding:2px 6px;border-radius:2px;font-weight:700;letter-spacing:.1em;}
.hw-sc{padding:0 14px 14px;}
.hw-btn{background:var(--pn2);border:1px solid var(--bd);color:var(--tx);padding:6px 12px;font-family:inherit;font-size:.65rem;text-transform:uppercase;letter-spacing:.18em;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .15s;border-radius:2px;}
.hw-btn:hover{border-color:var(--bdb);}
.hw-btn.pri{background:var(--ac);border-color:var(--ac);color:var(--bg);font-weight:700;}
.hw-btn:disabled{opacity:.4;cursor:not-allowed;}
.hw-inp{display:flex;align-items:center;gap:6px;color:var(--txd);font-size:.63rem;text-transform:uppercase;letter-spacing:.18em;}
.hw-inp input,.hw-inp select{background:var(--bg2);border:1px solid var(--bd);color:var(--tx);padding:5px 8px;font-family:inherit;font-size:.78rem;border-radius:2px;width:55px;}
.hw-lbl{font-size:.6rem;text-transform:uppercase;letter-spacing:.22em;color:var(--txf);margin-bottom:6px;display:block;}
.hw-ng{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;}
.hw-nb{background:var(--pn2);border:1px solid var(--bd);color:var(--txd);padding:8px 3px;font-family:inherit;font-size:.8rem;cursor:pointer;border-radius:2px;}
.hw-nb:hover{color:var(--tx);border-color:var(--bdb);}
.hw-nb.on{background:var(--ac);color:var(--bg);border-color:var(--ac);font-weight:700;}
.hw-ss{width:100%;background:var(--pn2);border:1px solid var(--bd);color:var(--tx);padding:8px 10px;font-family:inherit;font-size:.8rem;border-radius:2px;}
.hw-ck{background:var(--bg2);border:1px solid var(--bd);padding:12px;text-align:center;border-radius:2px;margin-top:10px;}
.hw-ck .v{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--ac);}
.hw-ck .n{margin-top:6px;font-size:.68rem;color:var(--txd);letter-spacing:.12em;}
.hw-pi{position:relative;height:150px;width:100%;background:var(--bg2);border:1px solid var(--bd);border-radius:2px;}
.hw-pk{position:absolute;bottom:0;cursor:pointer;transition:background .08s,opacity .08s;display:flex;align-items:flex-end;justify-content:center;padding-bottom:7px;font-size:.6rem;font-weight:600;user-select:none;}
.hw-pk.wh{background:#6a6456;border:1px solid #1a1813;color:#2a2620;z-index:1;height:100%;opacity:.35;}
.hw-pk.bl{background:#2a2620;border:1px solid #000;color:#4a453a;z-index:2;height:62%;opacity:.45;}
.hw-pk.wh:hover{opacity:.55;}.hw-pk.bl:hover{opacity:.65;}
.hw-pk.is.wh{background:var(--sk);color:#3a362d;opacity:1;}.hw-pk.is.bl{background:#5a5244;color:var(--sk);opacity:1;}
.hw-pk.ct.wh{background:var(--ck);color:#1a1813;opacity:1;}.hw-pk.ct.bl{background:#d96028;color:#fff;opacity:1;}
.hw-pk.ct.bw.wh{background:var(--bw);}.hw-pk.ct.bw.bl{background:#7a4ec0;}
.hw-pk.ct.pi.wh{background:var(--grn);color:#1a1813;}.hw-pk.ct.po.wh{background:var(--mel);color:#1a1813;}
.hw-pi-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;}
.hw-oct{display:flex;align-items:center;gap:6px;font-size:.6rem;text-transform:uppercase;letter-spacing:.22em;color:var(--txf);}
.hw-oct button{background:var(--pn2);border:1px solid var(--bd);color:var(--tx);width:26px;height:26px;cursor:pointer;border-radius:2px;display:flex;align-items:center;justify-content:center;padding:0;}
.hw-oct button:hover{border-color:var(--ac);color:var(--ac);}
.hw-oct button:disabled{opacity:.3;cursor:not-allowed;}
.hw-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:.63rem;color:var(--txd);}
.hw-legend-i{display:flex;align-items:center;gap:5px;}
.hw-sw{width:12px;height:12px;border:1px solid var(--bd);border-radius:2px;}
.hw-cg{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
@media(max-width:640px){.hw-cg{grid-template-columns:repeat(4,1fr);}}
.hw-cb{background:var(--pn2);border:1px solid var(--bd);padding:12px 4px 8px;cursor:pointer;transition:all .15s;position:relative;border-radius:2px;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:inherit;color:var(--tx);}
.hw-cb:hover{border-color:var(--ac);transform:translateY(-1px);}
.hw-cb.sel{background:var(--acf);border-color:var(--ac);box-shadow:0 0 0 1px var(--ac);}
.hw-cb.bw{border-color:var(--bw);border-style:dashed;}.hw-cb.bw:hover{border-style:solid;}
.hw-cb.bw.sel{background:var(--bwf);box-shadow:0 0 0 1px var(--bw);border-style:solid;}
.hw-cb .rm{font-family:'Playfair Display',serif;font-size:1.2rem;font-style:italic;color:var(--ac);font-weight:700;line-height:1;}
.hw-cb.bw .rm{color:var(--bw);}
.hw-cb .sy{font-size:.88rem;font-weight:700;}
.hw-cb .qu{font-size:.53rem;text-transform:uppercase;letter-spacing:.18em;color:var(--txf);}
.hw-ab{position:absolute;top:3px;right:3px;background:var(--bg2);border:1px solid var(--bd);color:var(--txf);width:18px;height:18px;border-radius:2px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:all .15s;padding:0;}
.hw-cb:hover .hw-ab{opacity:1;}.hw-ab:hover{background:var(--ac);color:var(--bg);border-color:var(--ac);}
.hw-inv{display:flex;align-items:center;gap:8px;margin-top:10px;padding:10px;background:var(--bg2);border-left:3px solid var(--ac);border-radius:2px;flex-wrap:wrap;}
.hw-inv.bw{border-left-color:var(--bw);}
.hw-iv{background:var(--pn2);border:1px solid var(--bd);color:var(--txd);padding:5px 10px;font-family:inherit;font-size:.65rem;cursor:pointer;border-radius:2px;min-width:44px;text-align:center;}
.hw-iv:hover{color:var(--tx);border-color:var(--bdb);}
.hw-iv.on{background:var(--ac);color:var(--bg);border-color:var(--ac);font-weight:700;}
.hw-inv.bw .hw-iv.on{background:var(--bw);border-color:var(--bw);}
.hw-add-sel{margin-left:auto;background:var(--ac);border:1px solid var(--ac);color:var(--bg);padding:5px 10px;font-family:inherit;font-size:.62rem;text-transform:uppercase;letter-spacing:.18em;cursor:pointer;border-radius:2px;display:flex;align-items:center;gap:5px;font-weight:700;}
.hw-cd{margin-top:10px;padding:10px;background:var(--bg2);border-left:3px solid var(--ac);border-radius:2px;font-size:.72rem;color:var(--txd);}
.hw-cd.bw{border-left-color:var(--bw);}
.hw-cd strong{color:var(--tx);}
.hw-tr-p{margin-top:10px;background:var(--bg2);border:1px solid var(--bd);border-radius:2px;padding:10px;}
.hw-tr-r{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin:4px 0;}
@media(max-width:900px){.hw-tr-r{grid-template-columns:repeat(6,1fr);}}
.hw-tr-b{background:var(--pn2);border:1px solid var(--bd);padding:5px 2px;cursor:pointer;border-radius:2px;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:inherit;color:var(--tx);transition:all .12s;position:relative;min-height:50px;font-size:.7rem;}
.hw-tr-b:hover{transform:translateY(-1px);}
.hw-tr-b.in{border-color:var(--grn);background:var(--grnf);}
.hw-tr-b.out{border-color:#8a7a4a;background:#2a2418;}
.hw-tr-b.cur{border-color:var(--ac);background:var(--acf);}
.hw-tr-b.pre{box-shadow:0 0 0 2px var(--ac);}
.hw-tr-b .sh{font-size:.55rem;color:var(--txf);font-weight:700;}
.hw-tr-b.cur .sh{color:var(--ac);}
.hw-tr-b .ts{font-weight:700;font-size:.72rem;line-height:1.1;}
.hw-tr-b .tf{font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;}
.hw-tr-b.in .tf{color:var(--grn);}.hw-tr-b.out .tf{color:var(--mel);}
.hw-tr-ab{position:absolute;top:1px;right:1px;background:var(--bg2);border:1px solid var(--bd);color:var(--txf);width:14px;height:14px;border-radius:2px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:all .15s;padding:0;}
.hw-tr-b:hover .hw-tr-ab{opacity:1;}.hw-tr-ab:hover{background:var(--ac);color:var(--bg);}
.hw-tr-lbl{font-size:.55rem;text-transform:uppercase;letter-spacing:.2em;color:var(--txf);margin:4px 0 2px;}
.hw-pr{display:flex;gap:6px;align-items:stretch;flex-wrap:wrap;min-height:80px;padding:10px;background:var(--bg2);border:1px dashed var(--bd);border-radius:2px;}
.hw-pc{background:var(--pn);border:1px solid var(--bd);padding:8px 12px 6px 5px;border-radius:2px;position:relative;min-width:78px;text-align:center;transition:all .15s;cursor:grab;display:flex;align-items:center;gap:3px;}
.hw-pc.bw{border-color:var(--bw);border-style:dashed;}.hw-pc.chr{border-color:var(--mel);border-style:dashed;}
.hw-pc.act{background:var(--ac);border-color:var(--ac);border-style:solid;color:var(--bg);transform:scale(1.05);}
.hw-pc.act .pc-rm{color:var(--bg);}.hw-pc.bw.act{background:var(--bw);}.hw-pc.chr.act{background:var(--mel);color:var(--bg);}
.hw-pc.dg{opacity:.4;}.hw-pc.dov{transform:translateX(6px);border-color:var(--ac);}
.hw-pc .pc-rm{font-family:'Playfair Display',serif;font-style:italic;color:var(--ac);font-size:.78rem;font-weight:700;}
.hw-pc.bw .pc-rm{color:var(--bw);}.hw-pc.chr .pc-rm{color:var(--mel);}
.hw-pc .pc-sy{font-weight:700;font-size:.88rem;}
.hw-pc-x{position:absolute;top:-5px;right:-5px;background:var(--dng);border:none;width:16px;height:16px;border-radius:50%;color:var(--tx);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-size:9px;z-index:3;}
.hw-cr{margin-top:8px;}
.hw-cr-row{display:flex;gap:2px;align-items:center;margin-bottom:4px;}
.hw-cr-lbl{min-width:65px;font-size:.6rem;color:var(--txd);}
.hw-cr-lbl strong{color:var(--ac);font-family:'Playfair Display',serif;font-style:italic;font-size:.78rem;}
.hw-cr-steps{display:flex;gap:1px;flex:1;}
.hw-cr-step{flex:1;min-width:10px;height:22px;background:var(--pn2);border:1px solid var(--bd);border-radius:1px;cursor:pointer;transition:all .1s;}
.hw-cr-step:hover{border-color:var(--ac);}
.hw-cr-step.on{background:var(--ac);border-color:var(--ac);}
.hw-cr-step.beat{border-left:2px solid var(--bdb);}
.hw-prog-ctrl{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;}
.hw-suggs{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.hw-sugg{background:var(--pn2);border:1px solid var(--bd);color:var(--txd);padding:6px 10px;font-family:inherit;font-size:.65rem;cursor:pointer;border-radius:2px;display:flex;align-items:center;gap:5px;transition:all .15s;}
.hw-sugg:hover{background:var(--acf);color:var(--tx);border-color:var(--ac);}
.hw-seq-ctrl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;padding:10px;background:var(--bg2);border:1px solid var(--bd);border-radius:2px;}
.hw-seq{background:var(--bg2);border:1px solid var(--bd);border-radius:2px;padding:6px;overflow-x:auto;}
.hw-seq-row{display:flex;gap:3px;align-items:center;margin-bottom:4px;}
.hw-seq-lbl{min-width:80px;font-size:.62rem;color:var(--txd);display:flex;flex-direction:column;gap:1px;}
.hw-seq-lbl .cn{font-family:'Playfair Display',serif;font-style:italic;font-size:.78rem;font-weight:700;}
.hw-seq-steps{display:flex;gap:1px;flex:1;min-width:0;}
.hw-seq-step{flex:1;min-width:12px;height:24px;background:var(--pn2);border:1px solid var(--bd);border-radius:1px;cursor:pointer;position:relative;transition:all .1s;}
.hw-seq-step:hover{border-color:var(--sc,var(--ac));}
.hw-seq-step.on{background:var(--sc,var(--ac));border-color:var(--sc,var(--ac));}
.hw-seq-step.on.accent{box-shadow:inset 0 -3px 0 rgba(255,255,255,.4);}
.hw-seq-step.on.slide{border-right:none;border-top-right-radius:0;border-bottom-right-radius:0;}
.hw-seq-step.playing{box-shadow:0 0 0 2px var(--ac);transform:scaleY(1.1);}
.hw-seq-step.beat{border-left:2px solid var(--bdb);}
.hw-seq-step .pch{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.5rem;color:var(--bg);font-weight:700;pointer-events:none;}
.hw-seq-empty{color:var(--txf);font-size:.68rem;font-style:italic;text-align:center;padding:16px;}
.hw-lock{background:none;border:1px solid var(--bd);color:var(--txf);padding:2px 4px;border-radius:2px;cursor:pointer;display:flex;align-items:center;}
.hw-lock.lk{color:var(--mel);border-color:var(--mel);}
.hw-sub-t{font-size:.62rem;text-transform:uppercase;letter-spacing:.25em;color:var(--bw);margin:14px 0 8px;display:flex;align-items:center;gap:6px;}
.hw-sub-t .dot{width:7px;height:7px;background:var(--bw);border-radius:50%;}
      `}</style>

      <div className="hw-hdr">
        <div>
          <h1 className="hw-t">Harmonic <span className="a">Workbench</span></h1>
          <div className="hw-st">Theory · Progression · Melody · Bass · Arp · v5</div>
        </div>
        <div className="hw-hc">
          <Seg options={[{v:"triad",l:"Triad"},{v:"seventh",l:"7th"},{v:"ninth",l:"9th"}]} value={ext} onChange={setExt}/>
          <Seg options={[{v:"piano",l:"♪ Piano"},{v:"pad",l:"~ Pad"}]} value={inst} onChange={setInst}/>
        </div>
      </div>

      <div className="hw-lay">
        <div>
          <Sec num="1" title="Key & Scale" open={openS.key} toggle={() => togS("key")} badge={NT[rootNote] + " " + SCALES[scaleKey].name.split(" ")[0]}>
            <div className="hw-lbl">Root Note</div>
            <div className="hw-ng">
              {NT.map((n, i) => <button key={i} className={"hw-nb " + (rootNote===i?"on":"")} onClick={() => setRootNote(i)}>{n}</button>)}
            </div>
            <div className="hw-lbl" style={{marginTop: 12}}>Scale / Mode</div>
            <select className="hw-ss" value={scaleKey} onChange={e => { setScaleKey(e.target.value); setSelChord(null); }}>
              {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
            <div className="hw-ck">
              <div className="v">{NT[rootNote]} {SCALES[scaleKey].name}</div>
              <div className="n">{sn.map(n => NT[n]).join(" · ")}</div>
            </div>
          </Sec>
        </div>

        <div>
          {/* Piano Roll */}
          <Sec num="2" title="Piano Roll" open={openS.piano} toggle={() => togS("piano")}>
            <div className="hw-pi-hdr">
              <div style={{fontSize: ".75rem", color: "var(--txd)"}}>
                {dispCh ? <span>Showing <strong style={{color: "var(--ac)"}}>{dispCh.symbol}</strong></span> : <span style={{color: "var(--txf)"}}>Select a chord below</span>}
              </div>
              <div className="hw-oct">
                Oct
                <button onClick={() => setOctS(Math.max(octS-1,-2))} disabled={octS<=-2}><ArrowDown size={12}/></button>
                <span style={{minWidth:36,textAlign:"center",color:"var(--tx)",fontWeight:700}}>C{3+octS}</span>
                <button onClick={() => setOctS(Math.min(octS+1,3))} disabled={octS>=3}><ArrowUp size={12}/></button>
              </div>
            </div>
            <PianoRoll sn={sn} sc={dispCh} os={octS} onC={playNote}/>
            <div className="hw-legend">
              <div className="hw-legend-i"><span className="hw-sw" style={{background:"var(--ck)"}}/> In chord</div>
              <div className="hw-legend-i"><span className="hw-sw" style={{background:"var(--sk)"}}/> In scale</div>
              <div className="hw-legend-i"><span className="hw-sw" style={{background:"#6a6456",opacity:.5}}/> Out</div>
            </div>
          </Sec>

          {/* Chords */}
          <Sec num="3" title="Chords" open={openS.chords} toggle={() => togS("chords")}>
            <div className="hw-cg">
              {dCh.map((ch, i) => (
                <button key={i} className={"hw-cb " + (selChord?.src==="diatonic"&&selChord.i===i?"sel":"")} onClick={() => clickCh(i,"diatonic")}>
                  <span className="rm">{rom[i]}</span>
                  <span className="sy">{cSym(NT[ch.root],ch.quality,ext)}</span>
                  <span className="qu">{ch.quality}</span>
                  <span className="hw-ab" onClick={e => {e.stopPropagation(); addProg(mkChord(ch.root,ch.quality,ext,0,baseMidi),rom[i],"diatonic");}}><Plus size={10}/></span>
                </button>
              ))}
            </div>

            {bCh.length > 0 && (
              <div style={{marginTop: 12}}>
                <button className="hw-btn" onClick={() => setShowBor(!showBor)} style={showBor?{borderColor:"var(--bw)",color:"var(--bw)"}:{}}>
                  {showBor ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                  {showBor ? "Hide" : "Show"} borrowed chords
                </button>
                {showBor && (
                  <div>
                    <div className="hw-sub-t"><span className="dot"/> Borrowed from {SCALES[SCALES[scaleKey].par].name}</div>
                    <div className="hw-cg">
                      {bCh.map((ch, i) => (
                        <button key={i} className={"hw-cb bw " + (selChord?.src==="borrowed"&&selChord.i===i?"sel":"")} onClick={() => clickCh(i,"borrowed")}>
                          <span className="rm">{ch.roman}</span>
                          <span className="sy">{cSym(NT[ch.root],ch.quality,ext)}</span>
                          <span className="qu">{ch.quality}</span>
                          <span className="hw-ab" onClick={e => {e.stopPropagation(); addProg(mkChord(ch.root,ch.quality,ext,0,baseMidi),ch.roman,"borrowed");}}><Plus size={10}/></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selObj && (
              <div>
                <div className={"hw-cd " + (selObj.source==="borrowed"?"bw":"")}>
                  <strong>{selObj.symbol}</strong> — Notes: {selObj.midiNotes.map(m => NT[m%12]).join("–")}
                </div>
                <div className={"hw-inv " + (selObj.source==="borrowed"?"bw":"")}>
                  <span className="hw-lbl" style={{margin: 0}}>Inv</span>
                  <div style={{display:"flex",gap:3}}>
                    {[-2,-1,0,1,2,3].filter(i => i >= -2 && i <= Math.min((CF[ext][selObj.quality]||CF.triad[selObj.quality]).length, 4)-1).map(i => (
                      <button key={i} className={"hw-iv " + (inv===i?"on":"")} onClick={() => chgInv(i)}>
                        {i < 0 ? Math.abs(i)+"↓" : i === 0 ? "Root" : i + (i===1?"st":i===2?"nd":"rd")}
                      </button>
                    ))}
                  </div>
                  <button className="hw-add-sel" onClick={() => addProg(selObj, selObj.roman, selObj.source)}><Plus size={10}/> Add</button>
                </div>

                <div className="hw-tr-p">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:6}}>
                    <span className="hw-lbl" style={{margin:0}}>Transpose</span>
                    <span style={{fontSize:".6rem",color:"var(--txf)",fontStyle:"italic"}}>green = in scale · yellow = chromatic</span>
                  </div>
                  <div className="hw-tr-lbl">Down</div>
                  <div className="hw-tr-r">
                    {[-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1].map(s => {
                      const info = transInfo(selObj, s, sn);
                      return (
                        <div key={s} className={"hw-tr-b " + (info.inScale?"in":"out") + " " + (prevS===s?"pre":"")} onClick={() => clickTrans(s)}>
                          <span className="sh">{s}</span>
                          <span className="ts">{info.symbol}</span>
                          <span className="tf">{info.inScale ? <span><Check size={8}/> in</span> : "out"}</span>
                          <div className="hw-tr-ab" onClick={e => {e.stopPropagation(); addTransP(s);}}><Plus size={8}/></div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{textAlign:"center",margin:"4px 0"}}>
                    <div className={"hw-tr-b cur " + (prevS===null?"pre":"")} onClick={() => clickTrans(0)} style={{maxWidth:100,margin:"0 auto",display:"inline-flex"}}>
                      <span className="sh">0</span><span className="ts">{selObj.symbol}</span><span className="tf" style={{color:"var(--ac)"}}>current</span>
                    </div>
                  </div>
                  <div className="hw-tr-lbl">Up</div>
                  <div className="hw-tr-r">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => {
                      const info = transInfo(selObj, s, sn);
                      return (
                        <div key={s} className={"hw-tr-b " + (info.inScale?"in":"out") + " " + (prevS===s?"pre":"")} onClick={() => clickTrans(s)}>
                          <span className="sh">+{s}</span>
                          <span className="ts">{info.symbol}</span>
                          <span className="tf">{info.inScale ? <span><Check size={8}/> in</span> : "out"}</span>
                          <div className="hw-tr-ab" onClick={e => {e.stopPropagation(); addTransP(s);}}><Plus size={8}/></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Sec>

          {/* Progression */}
          <Sec num="4" title="Progression" open={openS.prog} toggle={() => togS("prog")} badge={prog.length ? prog.length+" chords" : null}>
            <div className="hw-pr">
              {prog.length === 0 ? <div style={{color:"var(--txf)",fontSize:".7rem",fontStyle:"italic",width:"100%",textAlign:"center",alignSelf:"center"}}>Click + on a chord or try a suggestion</div> :
                prog.map((ch, i) => (
                  <div key={ch.id}
                    className={"hw-pc " + (ch.source==="borrowed"?"bw ":"") + (ch.source==="chromatic"?"chr ":"") + (curStep===i?"act ":"") + (dragI===i?"dg ":"") + (dragO===i&&dragI!==i?"dov":"")}
                    draggable={!playing} onDragStart={() => onDS(i)} onDragOver={e => onDO(e,i)} onDragEnd={onDE} onDrop={onDE}>
                    <div style={{color:"var(--txf)",display:"flex",alignItems:"center"}}><GripVertical size={12}/></div>
                    <div style={{flex:1}}>
                      <div className="pc-rm">{ch.roman}</div>
                      <div className="pc-sy">{ch.symbol}</div>
                    </div>
                    <button className="hw-pc-x" onClick={() => setProg(p => p.filter(c => c.id !== ch.id))}><X size={9}/></button>
                  </div>
                ))
              }
            </div>

            {prog.length > 0 && (
              <div className="hw-cr">
                <div className="hw-lbl" style={{marginTop:10}}>Chord Rhythm</div>
                {prog.map((ch, ci) => {
                  const ts = bpc * 2;
                  const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
                  return (
                    <div key={ch.id} className="hw-cr-row">
                      <div className="hw-cr-lbl"><strong>{ch.symbol}</strong></div>
                      <div className="hw-cr-steps">
                        {rhy.map((on, si) => (
                          <div key={si} className={"hw-cr-step " + (on?"on ":"") + (si>0&&si%4===0?"beat":"")} onClick={() => toggleChStep(ci, si)}/>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="hw-prog-ctrl">
              {playing ?
                <button className="hw-btn pri" onClick={stopP}><Pause size={11}/> Stop</button> :
                <button className="hw-btn pri" onClick={startP} disabled={!prog.length}><Play size={11}/> Play</button>
              }
              <button className={"hw-btn " + (looping?"pri":"")} onClick={() => setLooping(!looping)}><Repeat size={11}/> {looping?"Loop On":"Loop"}</button>
              <button className="hw-btn" onClick={() => doExport(prog,bpm,bpc,bassOn?bassPat:null,melOn?melPat:null,arpOn?arpPat:null)} disabled={!prog.length}><Download size={11}/> MIDI</button>
              <button className="hw-btn" onClick={clearP} disabled={!prog.length}><Trash2 size={11}/> Clear</button>
              <div className="hw-inp">BPM <input type="number" min="40" max="200" value={bpm} onChange={e => setBpm(parseInt(e.target.value)||90)}/></div>
              <div className="hw-inp">Beats
                <select value={bpc} onChange={e => setBpc(parseInt(e.target.value))} style={{width:"auto"}}>
                  <option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8">8</option>
                </select>
              </div>
            </div>

            {sugg.length > 0 && (
              <div className="hw-suggs">
                {sugg.map((s, i) => <button key={i} className="hw-sugg" onClick={() => loadSug(s)}><Sparkles size={10}/> {s.n}</button>)}
              </div>
            )}
          </Sec>

          {/* Bassline */}
          <Sec num="5" title="Bassline" color="var(--bass)" open={openS.bass} toggle={() => togS("bass")} badge={bassOn ? bassMode : null}>
            <div className="hw-seq-ctrl" style={{"--sc": "var(--bass)"}}>
              <Seg options={[{v:false,l:"Off"},{v:true,l:"On"}]} value={bassOn} onChange={setBassOn} color="var(--bass)"/>
              {bassOn && (
                <>
                  <Seg options={[{v:"rootOnly",l:"Root"},{v:"rootFifth",l:"R+5th"},{v:"octave",l:"Oct"},{v:"offbeat",l:"Offbeat"},{v:"acid",l:"🔥 Acid"}]} value={bassMode} onChange={setBassMode} color="var(--bass)"/>
                  <button className="hw-btn" onClick={regenBass} disabled={!prog.length} style={{background:"var(--bass)",borderColor:"var(--bass)",color:"var(--bg)",fontWeight:700}}><Shuffle size={10}/> Gen</button>
                  <button className="hw-btn" onClick={() => setBassPat({})}><RotateCcw size={10}/> Clear</button>
                </>
              )}
            </div>
            {bassOn && prog.length > 0 && Object.keys(bassPat).length > 0 && (
              <div className="hw-seq" style={{"--sc": "var(--bass)"}}>
                {prog.map((ch, ci) => {
                  const bp = bassPat[ci]; if (!bp) return null;
                  return (
                    <div key={ch.id} className="hw-seq-row">
                      <div className="hw-seq-lbl"><span className="cn" style={{color:"var(--bass)"}}>{ch.symbol}</span></div>
                      <div className="hw-seq-steps">
                        {bp.map((step, si) => {
                          const on = step && step.midi !== null;
                          return (
                            <div key={si} className={"hw-seq-step " + (on?"on ":"") + (on&&step.accent?"accent ":"") + (on&&step.slide?"slide ":"") + (si>0&&si%4===0?"beat":"")}>
                              {on && <span className="pch">{NT[step.midi%12]}{step.accent?"!":""}{step.slide?"~":""}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Sec>

          {/* Melody */}
          <Sec num="6" title="Melodic Playground" color="var(--mel)" open={openS.mel} toggle={() => togS("mel")} badge={melOn ? "On" : null}>
            <div className="hw-seq-ctrl" style={{"--sc": "var(--mel)"}}>
              <Seg options={[{v:false,l:"Off"},{v:true,l:"On"}]} value={melOn} onChange={setMelOn} color="var(--mel)"/>
              {melOn && (
                <>
                  <Seg options={[{v:"auto",l:"Auto"},{v:"major",l:"Maj"},{v:"minor",l:"Min"}]} value={melPenta} onChange={setMelPenta} color="var(--mel)"/>
                  <Seg options={[{v:8,l:"8"},{v:16,l:"16"},{v:32,l:"32"}]} value={melSteps} onChange={v => {setMelSteps(v);setMelPat({});}} color="var(--mel)"/>
                  <Seg options={[{v:"transposed",l:"Trans"},{v:"free",l:"Free"}]} value={melMode} onChange={setMelMode} color="var(--mel)"/>
                  <Seg options={[{v:"random",l:"Rand"},{v:"euclidean",l:"Euclid"}]} value={melFill} onChange={setMelFill} color="var(--mel)"/>
                  {melFill === "random" ?
                    <div className="hw-inp">Den <input type="number" min="1" max="100" step="5" value={Math.round(melDens*100)} onChange={e => setMelDens(Math.max(1,Math.min(100,parseInt(e.target.value)||40))/100)} style={{width:45}}/>%</div> :
                    <div className="hw-inp">Hits <input type="number" min="1" max={melSteps} value={melEucH} onChange={e => setMelEucH(Math.max(1,Math.min(melSteps,parseInt(e.target.value)||5)))} style={{width:45}}/></div>
                  }
                  <div className="hw-inp">Oct
                    <select value={melOct} onChange={e => setMelOct(parseInt(e.target.value))} style={{width:"auto"}}>
                      <option value="4">C4</option><option value="5">C5</option><option value="6">C6</option>
                    </select>
                  </div>
                  <button className="hw-btn" onClick={regenMel} disabled={!prog.length} style={{background:"var(--mel)",borderColor:"var(--mel)",color:"var(--bg)",fontWeight:700}}><Shuffle size={10}/> Gen</button>
                  <button className="hw-btn" onClick={() => {setMelPat({});setMelLock({});}}><RotateCcw size={10}/> Clear</button>
                </>
              )}
            </div>
            {melOn && prog.length > 0 && (
              <div className="hw-seq" style={{"--sc": "var(--mel)"}}>
                {Object.keys(melPat).length === 0 ?
                  <div className="hw-seq-empty">Press Gen or click cells</div> :
                  prog.map((ch, ci) => {
                    const mp = melPat[ci] || Array(melSteps).fill(null);
                    const locked = !!melLock[ci];
                    return (
                      <div key={ch.id} className={"hw-seq-row " + (curStep===ci?"current":"")}>
                        <div className="hw-seq-lbl">
                          <span className="cn" style={{color:"var(--mel)"}}>{ch.symbol}</span>
                          <button className={"hw-lock " + (locked?"lk":"")} onClick={() => setMelLock(p => ({...p,[ci]:!p[ci]}))} title={locked?"Unlock":"Lock"}>
                            {locked ? <Lock size={10}/> : <Unlock size={10}/>}
                          </button>
                        </div>
                        <div className="hw-seq-steps">
                          {mp.map((midi, si) => {
                            const on = midi !== null;
                            const pl = curMel && curMel.c === ci && curMel.s === si;
                            return (
                              <div key={si} className={"hw-seq-step " + (on?"on ":"") + (pl?"playing ":"") + (si>0&&si%4===0?"beat":"")} onClick={() => togMelStep(ci,si)}>
                                {on && <span className="pch">{NT[midi%12]}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </Sec>

          {/* Arp */}
          <Sec num="7" title="Arpeggiator" color="var(--arp)" open={openS.arp} toggle={() => togS("arp")} badge={arpOn ? arpMode : null}>
            <div className="hw-seq-ctrl" style={{"--sc": "var(--arp)"}}>
              <Seg options={[{v:false,l:"Off"},{v:true,l:"On"}]} value={arpOn} onChange={setArpOn} color="var(--arp)"/>
              {arpOn && (
                <>
                  <Seg options={[{v:"up",l:"Up"},{v:"down",l:"Down"},{v:"updown",l:"Up-Dn"},{v:"random",l:"Rand"}]} value={arpMode} onChange={setArpMode} color="var(--arp)"/>
                  <Seg options={[{v:8,l:"8"},{v:16,l:"16"},{v:32,l:"32"}]} value={arpSteps} onChange={v => {setArpSteps(v);setArpPat({});}} color="var(--arp)"/>
                  <button className="hw-btn" onClick={regenArp} disabled={!prog.length} style={{background:"var(--arp)",borderColor:"var(--arp)",color:"var(--bg)",fontWeight:700}}><Zap size={10}/> Gen</button>
                  <button className="hw-btn" onClick={() => setArpPat({})}><RotateCcw size={10}/> Clear</button>
                </>
              )}
            </div>
            {arpOn && prog.length > 0 && Object.keys(arpPat).length > 0 && (
              <div className="hw-seq" style={{"--sc": "var(--arp)"}}>
                {prog.map((ch, ci) => {
                  const ap = arpPat[ci]; if (!ap) return null;
                  return (
                    <div key={ch.id} className="hw-seq-row">
                      <div className="hw-seq-lbl"><span className="cn" style={{color:"var(--arp)"}}>{ch.symbol}</span></div>
                      <div className="hw-seq-steps">
                        {ap.map((midi, si) => (
                          <div key={si} className={"hw-seq-step " + (midi!=null?"on ":"") + (si>0&&si%4===0?"beat":"")}>
                            {midi != null && <span className="pch">{NT[midi%12]}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Sec>
        </div>
      </div>
    </div>
  );
}
