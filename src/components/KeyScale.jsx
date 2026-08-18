import { NOTE_NAMES, SCALES } from "../theory/constants.js";

// Root note picker + scale/mode selector + quick summary card.
export default function KeyScale({ rootNote, setRootNote, scaleKey, setScaleKey, onScaleChange, scaleNotes }) {
  return (
    <>
      <div className="hw-lbl">Root Note</div>
      <div className="hw-ng">
        {NOTE_NAMES.map((n, i) => (
          <button
            key={i}
            className={"hw-nb " + (rootNote === i ? "on" : "")}
            onClick={() => setRootNote(i)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="hw-lbl" style={{ marginTop: 12 }}>Scale / Mode</div>
      <select
        className="hw-ss"
        value={scaleKey}
        onChange={e => { setScaleKey(e.target.value); onScaleChange && onScaleChange(); }}
      >
        {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
      </select>
      <div className="hw-ck">
        <div className="v">{NOTE_NAMES[rootNote]} {SCALES[scaleKey].name}</div>
        <div className="n">{scaleNotes.map(n => NOTE_NAMES[n]).join(" · ")}</div>
      </div>
    </>
  );
}
