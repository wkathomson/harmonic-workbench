import { useRef } from "react";
import { Download, Music } from "lucide-react";
import { buildTrackBytes, buildTrackBlob, bytesToMidiDataUrl, downloadBlob } from "../utils/midiExport.js";

// Per-track MIDI export with native drag-out support.
//
// Each row exposes a Track:
//   • Drag the row → DAW (Ableton, Logic, Live Lite, etc.) imports the .mid
//     directly as a MIDI clip on a fresh track.
//   • Click Download → standard browser file download.
//
// The drag-out trick uses dataTransfer.setData("DownloadURL", ...) with a
// base64 data URL. We use a data URL (not a blob URL) for two reasons:
//   1. Reliability — the destination app may resolve the URL at drop-time,
//      and blob URLs can be invalidated before that resolves, especially
//      across app boundaries on macOS.
//   2. Compatibility — Brave's Shields and other privacy layers interfere
//      with blob URLs in DownloadURL but consistently allow data URLs.
//
// macOS caveat: even with this trick, drag-into-Ableton can fail because
// Ableton uses a custom drop target that doesn't always honour the
// browser-promised file. If drag doesn't work, click Download and drag
// the file from Finder — that path always works.

const TRACKS = [
  { kind: "chords", label: "Chords", color: "var(--ac)"  },
  { kind: "bass",   label: "Bass",   color: "var(--bass)" },
  { kind: "melody", label: "Melody", color: "var(--mel)"  },
  { kind: "arp",    label: "Arp",    color: "var(--arp)"  },
  { kind: "drums",  label: "Drums",  color: "var(--grn)"  },
];

export default function TrackExports({
  prog, bpm, bpc,
  bassPat, melPat, arpPat, drumPat,
  bassOn,  melOn,  arpOn,  drumOn,
}) {
  const hasProg = !!prog?.length;

  // Pick the right pattern data for each track-kind.
  const dataFor = (kind) => {
    switch (kind) {
      case "bass":   return bassOn ? bassPat : null;
      case "melody": return melOn  ? melPat  : null;
      case "arp":    return arpOn  ? arpPat  : null;
      case "drums":  return drumOn ? drumPat : null;
      default:       return null;   // chords don't need data
    }
  };

  // True if this track will produce any notes when exported.
  const isAvailable = (kind) => {
    if (!hasProg) return false;
    if (kind === "chords") return true;
    const data = dataFor(kind);
    if (!data) return false;
    return Object.values(data).some(row =>
      Array.isArray(row) && row.some(v => v != null && v !== false && (typeof v !== "object" || v?.midi != null))
    );
  };

  return (
    <div className="hw-tx">
      <div className="hw-tx-help">
        <strong>Drag</strong> a row into Ableton (or your DAW) for an instant
        MIDI clip — or use <strong>Download</strong> for a file. Tempo is
        baked in. If drag-out doesn't drop on Ableton, download instead and
        drag from Finder — that always works.
      </div>
      <ul className="hw-tx-list">
        {TRACKS.map(t => (
          <TrackRow
            key={t.kind}
            kind={t.kind}
            label={t.label}
            color={t.color}
            enabled={isAvailable(t.kind)}
            args={{
              kind:          t.kind,
              prog,
              bpm,
              beatsPerChord: bpc,
              data:          dataFor(t.kind),
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function TrackRow({ kind, label, color, enabled, args }) {
  const objectUrlRef = useRef(null);

  const onDragStart = (e) => {
    if (!enabled) { e.preventDefault(); return; }
    const bytes = buildTrackBytes(args);
    if (!bytes) { e.preventDefault(); return; }
    const filename = `harmonic_${kind}.mid`;

    // Primary: data URL (synchronous, self-contained, broadest compat).
    const dataUrl = bytesToMidiDataUrl(bytes);
    if (dataUrl) {
      e.dataTransfer.setData("DownloadURL", `audio/midi:${filename}:${dataUrl}`);
    }

    // Belt-and-braces: also stash a blob URL on text/uri-list so a drop
    // target that doesn't honour DownloadURL but accepts URIs can still
    // pick something up. Track the URL so we can revoke after drop.
    try {
      const blob = new Blob([bytes], { type: "audio/midi" });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      e.dataTransfer.setData("text/uri-list", url);
      e.dataTransfer.setData("text/plain", url);
    } catch {
      /* not critical — DownloadURL is the primary path */
    }

    e.dataTransfer.effectAllowed = "copy";
  };

  const onDragEnd = () => {
    if (objectUrlRef.current) {
      const u = objectUrlRef.current;
      objectUrlRef.current = null;
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    }
  };

  const onDownload = () => {
    if (!enabled) return;
    const blob = buildTrackBlob(args);
    if (!blob) return;
    downloadBlob(blob, `harmonic_${kind}.mid`);
  };

  return (
    <li
      className={"hw-tx-row " + (enabled ? "" : "off")}
      draggable={enabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={enabled ? "Drag into your DAW, or click Download" : "Nothing to export yet — turn this part on and add notes"}
    >
      <Music size={11} color={color} />
      <div className="hw-tx-lbl" style={{ color }}>{label}</div>
      <div className="hw-tx-hint">{enabled ? "drag or" : "—"}</div>
      <button
        className="hw-btn"
        disabled={!enabled}
        onClick={onDownload}
        title="Download .mid"
      >
        <Download size={11} /> Download
      </button>
    </li>
  );
}
