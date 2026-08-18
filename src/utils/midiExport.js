// MIDI file builders.
//
// Two flavours are exposed:
//   • exportMidi(...)         — full Type-1 multi-track file (download all)
//   • buildTrackBlob(kind, …) — single-track Type-1 file for one part, used
//                               by TrackExports for per-track download AND
//                               for native drag-out into Ableton/Logic.
//
// Drums use GM channel 10 (index 9) and standard GM drum-map note numbers so
// the file plays correctly in any DAW (Ableton drum rack, Logic, etc.).
//
// Why single-track Type-1 (not Type-0)? Ableton imports both fine, but Type-1
// preserves the tempo as its own meta-track which is closer to how DAWs
// internally store tempo and feels safer across hosts.

const GM_DRUM_NOTE = {
  kick:      36,
  snare:     38,
  clap:      39,
  hatClosed: 42,
  hatOpen:   46,
};

// MIDI channel per track-kind. Matches the multi-track file layout so the
// drag-and-drop output is consistent with the "Export all" file.
const TRACK_CHANNEL = {
  chords: 0,
  bass:   1,
  melody: 2,
  arp:    3,
  drums:  9,   // GM channel 10
};

// ---------- low-level MIDI byte plumbing ----------

function writeVariableLength(v) {
  const b = [];
  let buf = v & 0x7f;
  v >>= 7;
  while (v) { buf <<= 8; buf |= ((v & 0x7f) | 0x80); v >>= 7; }
  while (true) {
    b.push(buf & 0xff);
    if (buf & 0x80) buf >>= 8;
    else break;
  }
  return b;
}

function makeTrack(events) {
  const d = [];
  events.forEach(e => { d.push(...writeVariableLength(e.dt)); d.push(...e.b); });
  d.push(...writeVariableLength(0));
  d.push(0xff, 0x2f, 0x00); // end-of-track meta
  const l = d.length;
  return [0x4d, 0x54, 0x72, 0x6b, (l >> 24) & 0xff, (l >> 16) & 0xff, (l >> 8) & 0xff, l & 0xff, ...d];
}

// Sort + diff note events into delta-time encoded bytes for a single track.
function makeEventStream(notes) {
  const all = [];
  notes.forEach(n => {
    all.push({ tick: n.st, type: "on",  midi: n.midi, vel: n.vel || 96, ch: n.ch || 0 });
    all.push({ tick: n.et, type: "off", midi: n.midi, vel: 64,          ch: n.ch || 0 });
  });
  all.sort((a, b) => a.tick - b.tick || (a.type === "off" ? -1 : 1));
  const de = [];
  let last = 0;
  all.forEach(e => {
    de.push({ dt: e.tick - last, b: [(e.type === "on" ? 0x90 : 0x80) | (e.ch & 0xf), e.midi & 0x7f, e.vel & 0x7f] });
    last = e.tick;
  });
  return de;
}

function makeTempoTrack(bpm) {
  const mpqn = Math.round(60000000 / bpm);
  return makeTrack([
    { dt: 0, b: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] }
  ]);
}

function assembleFile(tempoTrack, contentTracks, tpb) {
  const tracks = [tempoTrack, ...contentTracks];
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (tpb >> 8) & 0xff, tpb & 0xff];
  const all = [...header];
  tracks.forEach(t => all.push(...t));
  return new Uint8Array(all);
}

// ---------- per-track note builders ----------
// Each returns an array of { st, et, midi, vel, ch } note events at the
// given ticks-per-chord (tpc). They're pure — no I/O, no DOM.

function chordNotes(prog, tpc, beatsPerChord) {
  const out = [];
  prog.forEach((ch, i) => {
    const ts = beatsPerChord * 2;
    const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
    const sd = tpc / ts;
    rhy.forEach((on, si) => {
      if (!on) return;
      let dsteps = 1;
      for (let j = si + 1; j < ts; j++) { if (rhy[j]) break; dsteps++; }
      ch.midiNotes.forEach(m => out.push({
        st: Math.round(i * tpc + si * sd),
        et: Math.round(i * tpc + si * sd + dsteps * sd * 0.95),
        midi: m, vel: 90, ch: TRACK_CHANNEL.chords,
      }));
    });
  });
  return out;
}

function bassNotes(prog, tpc, bassPat) {
  const out = [];
  prog.forEach((_, i) => {
    const bp = bassPat?.[i]; if (!bp) return;
    const sd = tpc / bp.length;
    bp.forEach((s, si) => {
      if (!s || s.midi === null) return;
      out.push({
        st: Math.round(i * tpc + si * sd),
        et: Math.round(i * tpc + si * sd + sd * (s.slide ? 1.1 : 0.8)),
        midi: s.midi, vel: s.accent ? 110 : 85, ch: TRACK_CHANNEL.bass,
      });
    });
  });
  return out;
}

function melodyNotes(prog, tpc, melPat) {
  const out = [];
  prog.forEach((_, i) => {
    const mp = melPat?.[i]; if (!mp) return;
    const sd = tpc / mp.length;
    mp.forEach((midi, si) => {
      if (midi === null) return;
      out.push({
        st: Math.round(i * tpc + si * sd),
        et: Math.round(i * tpc + si * sd + sd * 0.9),
        midi, vel: 85, ch: TRACK_CHANNEL.melody,
      });
    });
  });
  return out;
}

function arpNotes(prog, tpc, arpPat) {
  const out = [];
  prog.forEach((_, i) => {
    const ap = arpPat?.[i]; if (!ap) return;
    const sd = tpc / ap.length;
    ap.forEach((midi, si) => {
      if (midi == null) return;
      out.push({
        st: Math.round(i * tpc + si * sd),
        et: Math.round(i * tpc + si * sd + sd * 0.8),
        midi, vel: 80, ch: TRACK_CHANNEL.arp,
      });
    });
  });
  return out;
}

function drumNotes(prog, tpc, drumPat) {
  const out = [];
  if (!drumPat) return out;
  // Step grid is 16 sixteenths per chord-bar regardless of pattern length.
  // 32/64-step patterns: bar N reads pattern[(N*16)%len .. +16] so bar-2 /
  // bar-4 fills baked into the kit land at the right place.
  const stepsPerBar = 16;
  const patternLen  = drumPat.kick?.length || stepsPerBar;
  const sd = tpc / stepsPerBar;
  prog.forEach((_, i) => {
    const winStart = (i * stepsPerBar) % patternLen;
    Object.entries(drumPat).forEach(([drum, row]) => {
      if (!row) return;
      const note = GM_DRUM_NOTE[drum];
      if (!note) return;
      for (let si = 0; si < stepsPerBar; si++) {
        const cell = row[winStart + si];
        const v01 = cell === true ? 0.85 : (typeof cell === "number" ? cell : 0);
        if (v01 <= 0) continue;
        out.push({
          st: Math.round(i * tpc + si * sd),
          et: Math.round(i * tpc + si * sd + sd * 0.5),
          midi: note, vel: Math.max(1, Math.min(127, Math.round(v01 * 127))), ch: TRACK_CHANNEL.drums,
        });
      }
    });
  });
  return out;
}

// ---------- Public API ----------

// Build raw MIDI file bytes for one track-kind. Returns null if the part
// has no notes (so the caller can disable its drag/download button).
//
//   kind   — "chords" | "bass" | "melody" | "arp" | "drums"
//   data   — the part's pattern data (bassPat, melPat, etc.); ignored for chords
//
// Tempo is embedded so the dropped clip lands at the right BPM in the DAW.
export function buildTrackBytes({ kind, prog, bpm, beatsPerChord, data }) {
  if (!prog?.length) return null;
  const tpb = 480;
  const tpc = tpb * beatsPerChord;

  let notes;
  switch (kind) {
    case "chords": notes = chordNotes(prog, tpc, beatsPerChord); break;
    case "bass":   notes = bassNotes(prog, tpc, data); break;
    case "melody": notes = melodyNotes(prog, tpc, data); break;
    case "arp":    notes = arpNotes(prog, tpc, data); break;
    case "drums":  notes = drumNotes(prog, tpc, data); break;
    default: return null;
  }
  if (!notes.length) return null;

  const tempoTrack = makeTempoTrack(bpm);
  const trackBytes = makeTrack(makeEventStream(notes));
  return assembleFile(tempoTrack, [trackBytes], tpb);
}

// Convenience wrapper: same args, returns a Blob. Used by the per-track
// Download button (Blobs are what URL.createObjectURL likes).
export function buildTrackBlob(args) {
  const bytes = buildTrackBytes(args);
  return bytes ? new Blob([bytes], { type: "audio/midi" }) : null;
}

// Convert raw bytes to a base64-encoded data URL synchronously. Needed for
// the drag-out flow because the dragstart handler must populate the
// dataTransfer object synchronously — there's no time to wait on FileReader.
//
// MIDI files are tiny (a few KB even for long progressions), so the
// Uint8Array → binary-string → btoa path is fine.
export function bytesToMidiDataUrl(bytes) {
  if (!bytes) return null;
  let binary = "";
  // Chunk to avoid arg-list length limits on older engines.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return "data:audio/midi;base64," + btoa(binary);
}

// Trigger a download from a Blob — used by the per-track Download buttons.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser actually completes the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Original full-file export — kept for the "Export MIDI" transport button.
// Builds a multi-track Type-1 file with all parts on their assigned channels.
export function exportMidi(prog, bpm, beatsPerChord, bassPat, melPat, arpPat, drumPat) {
  const tpb = 480;
  const tpc = tpb * beatsPerChord;
  const tempoTrack = makeTempoTrack(bpm);
  const tracks = [makeTrack(makeEventStream(chordNotes(prog, tpc, beatsPerChord)))];

  if (bassPat) {
    const n = bassNotes(prog, tpc, bassPat);
    if (n.length) tracks.push(makeTrack(makeEventStream(n)));
  }
  if (melPat) {
    const n = melodyNotes(prog, tpc, melPat);
    if (n.length) tracks.push(makeTrack(makeEventStream(n)));
  }
  if (drumPat) {
    const n = drumNotes(prog, tpc, drumPat);
    if (n.length) tracks.push(makeTrack(makeEventStream(n)));
  }
  if (arpPat) {
    const n = arpNotes(prog, tpc, arpPat);
    if (n.length) tracks.push(makeTrack(makeEventStream(n)));
  }

  const bytes = assembleFile(tempoTrack, tracks, tpb);
  const blob = new Blob([bytes], { type: "audio/midi" });
  downloadBlob(blob, "harmonic_workbench.mid");
}
