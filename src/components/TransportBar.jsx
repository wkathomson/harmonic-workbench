import { Play, Pause, Repeat, Download } from "lucide-react";

// Sticky global transport — Play / Stop / Loop / BPM / Beats-per-chord / MIDI export.
// Always reachable from any panel, so the user never has to scroll up to start playback.
export default function TransportBar({
  playing, looping, setLooping,
  bpm, setBpm, bpc, setBpc,
  startP, stopP, onExport,
  hasProg,
}) {
  return (
    <div className="hw-tb">
      {playing ? (
        <button className="hw-btn pri" onClick={stopP}><Pause size={11} /> Stop</button>
      ) : (
        <button className="hw-btn pri" onClick={startP} disabled={!hasProg}>
          <Play size={11} /> Play
        </button>
      )}
      <button className={"hw-btn " + (looping ? "pri" : "")} onClick={() => setLooping(!looping)}>
        <Repeat size={11} /> {looping ? "Loop On" : "Loop"}
      </button>
      <button className="hw-btn" onClick={onExport} disabled={!hasProg}>
        <Download size={11} /> MIDI
      </button>

      <div className="hw-tb-spacer" />

      <div className="hw-inp">
        BPM
        <input
          type="number" min="40" max="200" value={bpm}
          onChange={e => setBpm(parseInt(e.target.value) || 90)}
        />
      </div>
      <div className="hw-inp">
        Beats
        <select value={bpc} onChange={e => setBpc(parseInt(e.target.value))} style={{ width: "auto" }}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="4">4</option>
          <option value="8">8</option>
        </select>
      </div>
    </div>
  );
}
