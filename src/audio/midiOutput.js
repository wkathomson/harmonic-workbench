// Web MIDI output wrapper.
//
// Browser support: Chromium (Chrome / Edge / Brave / Arc / Opera) supports
// Web MIDI natively. Safari and Firefox don't expose it — `isMidiSupported()`
// will return false there and the UI degrades to a "not available" notice.
//
// Routing into Ableton on macOS:
//   1. Open Audio MIDI Setup → Window → Show MIDI Studio.
//   2. Double-click "IAC Driver", check "Device is online", make sure at
//      least one port (e.g. "IAC Bus 1") exists.
//   3. In Ableton: Preferences → Link/Tempo/MIDI, enable "Track" and
//      "Remote" on the IAC input. Arm a MIDI track set to "IAC Bus 1".
//   4. Pick "IAC Bus 1" as the output here. Notes fly into Ableton.
//
// Routing to a hardware synth: just plug it in via USB. It'll appear in
// the output list automatically. Hot-plug works — the listener fires on
// connect/disconnect via MIDIAccess.statechange.
//
// Why no sysex: we don't need it (program changes / clock are on regular
// short messages), and asking for sysex triggers a more intrusive Chrome
// permission prompt. Plain MIDI access prompts once per origin and is
// remembered — friendlier UX.

let midiAccess = null;          // MIDIAccess from navigator.requestMIDIAccess
let cached = [];                // public-shape outputs list
const listeners = new Set();    // (outputs[]) => void subscribers

export function isMidiSupported() {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

// Idempotent — calling multiple times returns the same access object.
// First call shows the permission prompt; subsequent calls are silent.
export async function requestMidiAccess() {
  if (midiAccess) return midiAccess;
  if (!isMidiSupported()) throw new Error("Web MIDI is not available in this browser");
  midiAccess = await navigator.requestMIDIAccess({ sysex: false });
  midiAccess.onstatechange = () => {
    refreshOutputs();
    listeners.forEach(fn => { try { fn(getOutputs()); } catch {} });
  };
  refreshOutputs();
  return midiAccess;
}

function refreshOutputs() {
  if (!midiAccess) { cached = []; return; }
  cached = Array.from(midiAccess.outputs.values()).map(port => ({
    id: port.id,
    name: port.name || "(unnamed)",
    manufacturer: port.manufacturer || "",
    state: port.state,
    _port: port,
  }));
}

// Public-shape (no live MIDIOutput object) — for serialisation safety.
// The engine resolves an id back to the live port via `getOutputPort`.
export function getOutputs() {
  return cached.map(({ _port, ...rest }) => rest);
}

export function getOutputPort(id) {
  return cached.find(o => o.id === id)?._port || null;
}

// Subscribe to hot-plug changes. Returns an unsubscribe function.
export function onOutputsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Sending ------------------------------------------------------------
// `time` is performance.now()-relative ms (or undefined for "now").
// channel 0..15, note 0..127, velocity 0..127.

export function sendNoteOn(port, channel, note, velocity, time) {
  if (!port) return;
  try {
    port.send([0x90 | (channel & 0x0f), note & 0x7f, Math.max(1, velocity & 0x7f)], time);
  } catch { /* port disconnected mid-flight; swallow */ }
}

export function sendNoteOff(port, channel, note, time) {
  if (!port) return;
  try {
    port.send([0x80 | (channel & 0x0f), note & 0x7f, 0x40], time);
  } catch {}
}

// All-Notes-Off + All-Sound-Off across every channel. Used on stop /
// disable to prevent stuck notes on external gear.
export function panic(port) {
  if (!port) return;
  for (let ch = 0; ch < 16; ch++) {
    try {
      port.send([0xb0 | ch, 0x7b, 0]); // CC 123 — All Notes Off
      port.send([0xb0 | ch, 0x78, 0]); // CC 120 — All Sound Off
    } catch {}
  }
}

// MIDI Clock helpers (24 PPQN).
//   start: F8 ticks resume from current position
//   stop:  F8 ticks stop
// Send 0xFA (Start) → ticks → 0xFC (Stop) for sync to a slave.
export function sendClockStart(port, time) { try { port?.send([0xfa], time); } catch {} }
export function sendClockStop(port,  time) { try { port?.send([0xfc], time); } catch {} }
export function sendClockTick(port,  time) { try { port?.send([0xf8], time); } catch {} }
