import { useEffect, useState } from "react";
import { Plug, AlertTriangle } from "lucide-react";
import {
  isMidiSupported, requestMidiAccess, getOutputs, getOutputPort, onOutputsChange,
} from "../audio/midiOutput.js";
import Seg from "./Seg.jsx";

// Live MIDI output panel.
//
// Lifecycle:
//   • On mount, check if Web MIDI is available. If yes, do NOT auto-prompt
//     the user — wait for them to click Connect (per the design principle
//     that permissions should always be a deliberate action).
//   • Once connected, the device list refreshes automatically on hot-plug
//     via MIDIAccess.statechange.
//   • Selecting a device sets the live port on the audio engine. Every
//     subsequent scheduled note will fan out to MIDI in addition to (or
//     instead of) the local synths, depending on the Monitor toggle.
//
// macOS hint: route to Ableton via the IAC Driver. Open Audio MIDI Setup,
// double-click "IAC Driver", set "Device is online", add a port. Then
// arm a MIDI track in Ableton listening to that bus.

const PARTS = [
  { key: "chord",  label: "Chords" },
  { key: "bass",   label: "Bass"   },
  { key: "melody", label: "Melody" },
  { key: "arp",    label: "Arp"    },
  { key: "drums",  label: "Drums"  },
];

export default function MidiOut({
  enabled, setEnabled,
  monitor, setMonitor,
  clock, setClock,
  channels, setChannels,
  deviceId, setDeviceId,
  deviceName,    // remembered display name (in case device isn't present yet)
}) {
  const supported = isMidiSupported();
  const [outputs, setOutputs] = useState([]);
  const [permission, setPermission] = useState("idle"); // idle | requesting | ok | error
  const [error, setError] = useState(null);

  // If the user has already granted access in this tab (e.g. after a
  // page reload with autosave), get the cached MIDIAccess and surface
  // the device list so the picker isn't stuck on "Connect".
  useEffect(() => {
    if (!supported) return;
    // Check if there's already an existing access (idempotent call).
    // Wrapped in a flag so we don't show the "Connect" button if perm is granted.
    let mounted = true;
    (async () => {
      try {
        // We don't auto-request — but if it's already been granted in this
        // session, requestMIDIAccess returns instantly without a prompt.
        // We can detect that by checking permissions.query first.
        if (navigator.permissions?.query) {
          try {
            const status = await navigator.permissions.query({ name: "midi" });
            if (status.state === "granted") {
              await requestMidiAccess();
              if (mounted) {
                setOutputs(getOutputs());
                setPermission("ok");
              }
            }
          } catch { /* permissions API may not support midi name on all browsers */ }
        }
      } catch (e) {
        if (mounted) { setError(e.message); setPermission("error"); }
      }
    })();
    const unsub = onOutputsChange((list) => mounted && setOutputs(list));
    return () => { mounted = false; unsub(); };
  }, [supported]);

  // If connected and the saved device id is in the new list, expose its
  // live port to the engine. If the saved device went away, leave the
  // selection alone — user gets a "device not found" hint.
  useEffect(() => {
    if (!deviceId) return;
    const port = getOutputPort(deviceId);
    if (port) setDeviceId(deviceId, port);
  }, [outputs, deviceId, setDeviceId]);

  const onConnect = async () => {
    setPermission("requesting"); setError(null);
    try {
      await requestMidiAccess();
      setOutputs(getOutputs());
      setPermission("ok");
    } catch (e) {
      setError(e.message || String(e));
      setPermission("error");
    }
  };

  const onPickDevice = (id) => {
    if (!id) { setDeviceId(null, null); return; }
    const port = getOutputPort(id);
    setDeviceId(id, port);
  };

  const onChannelChange = (key, value) => {
    // 1-indexed input → 0-indexed internal. Clamp to 1..16.
    const n = Math.max(1, Math.min(16, parseInt(value) || 1));
    setChannels({ [key]: n - 1 });
  };

  // ---- Render branches ----

  if (!supported) {
    return (
      <div className="hw-midi">
        <div className="hw-midi-help warn">
          <AlertTriangle size={11} /> Web MIDI is not supported in this
          browser. Try Chrome, Edge, Brave, or Arc to enable live MIDI output.
        </div>
      </div>
    );
  }

  return (
    <div className="hw-midi">
      <div className="hw-midi-help">
        Stream notes to a connected synth, hardware tracker, or Ableton via
        the macOS <strong>IAC Driver</strong>. Tempo, Stop/Start, and an
        optional 24 PPQN clock keep external gear locked to the workbench.
      </div>

      {/* Connect button (or "Connected" status) */}
      <div className="hw-midi-row">
        <Seg
          options={[{ v: false, l: "Off" }, { v: true, l: "On" }]}
          value={enabled} onChange={setEnabled} color="var(--grn)"
          disabled={permission !== "ok" || !deviceId}
        />
        {permission !== "ok" ? (
          <button className="hw-btn pri" onClick={onConnect} disabled={permission === "requesting"}>
            <Plug size={11} /> {permission === "requesting" ? "Requesting…" : "Connect"}
          </button>
        ) : (
          <div className="hw-midi-status">
            <span className="hw-midi-dot" /> Connected
          </div>
        )}
      </div>

      {error && (
        <div className="hw-midi-help warn">
          <AlertTriangle size={11} /> {error}
        </div>
      )}

      {/* Device picker — only shown once permission is granted */}
      {permission === "ok" && (
        <div className="hw-midi-row">
          <div className="hw-midi-lbl">Device</div>
          <select
            className="hw-midi-sel"
            value={deviceId || ""}
            onChange={e => onPickDevice(e.target.value || null)}
          >
            <option value="">— Pick an output —</option>
            {outputs.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}{o.manufacturer ? ` (${o.manufacturer})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Saved device-name reminder when the live port can't be found */}
      {permission === "ok" && deviceId && !outputs.some(o => o.id === deviceId) && (
        <div className="hw-midi-help warn">
          <AlertTriangle size={11} /> Saved device {deviceName ? `"${deviceName}"` : ""} isn't connected.
          Plug it in or pick a different output.
        </div>
      )}

      {/* Monitor + clock toggles */}
      {permission === "ok" && (
        <div className="hw-midi-row">
          <div className="hw-midi-lbl">Monitor</div>
          <Seg
            options={[{ v: true, l: "Local + MIDI" }, { v: false, l: "MIDI only" }]}
            value={monitor} onChange={setMonitor} color="var(--grn)"
          />
        </div>
      )}
      {permission === "ok" && (
        <div className="hw-midi-row">
          <div className="hw-midi-lbl">Clock</div>
          <Seg
            options={[{ v: false, l: "Off" }, { v: true, l: "Send Clock + Start/Stop" }]}
            value={clock} onChange={setClock} color="var(--grn)"
          />
        </div>
      )}

      {/* Per-part channel mapping */}
      {permission === "ok" && (
        <div className="hw-midi-channels">
          <div className="hw-midi-channels-lbl">MIDI channels (1–16)</div>
          <div className="hw-midi-channels-grid">
            {PARTS.map(p => (
              <div key={p.key} className="hw-midi-ch">
                <div className="hw-midi-ch-lbl">{p.label}</div>
                <input
                  type="number"
                  min="1" max="16" step="1"
                  value={(channels[p.key] ?? 0) + 1}
                  onChange={e => onChannelChange(p.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
