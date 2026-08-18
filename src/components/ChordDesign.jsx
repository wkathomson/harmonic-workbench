import Seg from "./Seg.jsx";

// Global chord-design controls. These shape *how* every chord plays —
// applied to both live audition (clicking palette chords) and scheduled
// playback (the progression). Independent of which voice/preset.
//
//   Strum     — fan notes out over a short window (block chord ↔ rolled)
//   Direction — up (low→high, default piano feel) or down (high→low, harp)
//   Spread    — adds an octave-low root for fatness
//   Humanise  — small per-note timing/velocity randomness (un-robots it)
export default function ChordDesign({ design, onChange }) {
  const { strum, strumDir, spread, humanise } = design;

  return (
    <div className="hw-cd-p">
      <div className="hw-cd-help">
        Shape every chord's character — <strong>strum</strong> fans the notes
        out, <strong>spread</strong> adds an octave-low root,
        <strong> humanise</strong> kills the robotic feel.
      </div>

      <div className="hw-cd-row">
        <div className="hw-cd-lbl">Strum</div>
        <input
          type="range" min="0" max="1" step="0.01"
          value={strum}
          onChange={e => onChange("strum", parseFloat(e.target.value))}
        />
        <div className="hw-cd-val">{Math.round(strum * 100)}</div>
      </div>

      <div className="hw-cd-row">
        <div className="hw-cd-lbl">Direction</div>
        <Seg
          options={[{ v: "up", l: "↑ Up" }, { v: "down", l: "↓ Down" }]}
          value={strumDir}
          onChange={v => onChange("strumDir", v)}
        />
      </div>

      <div className="hw-cd-row">
        <div className="hw-cd-lbl">Spread</div>
        <Seg
          options={[{ v: false, l: "Off" }, { v: true, l: "+Oct Bass" }]}
          value={spread}
          onChange={v => onChange("spread", v)}
        />
      </div>

      <div className="hw-cd-row">
        <div className="hw-cd-lbl">Humanise</div>
        <input
          type="range" min="0" max="1" step="0.01"
          value={humanise}
          onChange={e => onChange("humanise", parseFloat(e.target.value))}
        />
        <div className="hw-cd-val">{Math.round(humanise * 100)}</div>
      </div>
    </div>
  );
}
