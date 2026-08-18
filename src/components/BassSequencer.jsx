import { Shuffle, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { midiToLabel } from "../theory/stepEdit.js";
import { BASS_MODES } from "../theory/bass.js";
import Seg from "./Seg.jsx";
import Knob from "./Knob.jsx";
import { makeClickHandler } from "../utils/clickHandler.js";

// Bassline sequencer.
// Patterns are chord-aware and live in src/theory/bass.js. The UI here just
// picks a mode + step count + octave, and renders the resulting per-chord
// step grid (with accent ! and slide ~ markers, matching the prototype).
export default function BassSequencer({
  bassOn, setBassOn,
  bassMode, setBassMode,
  bassSteps, setBassSteps,
  bassOct, setBassOct,
  bassPat, setBassPat,
  prog, regenBass, editBassStep, transposeBassRow,
  selection, onSelect, insertOrRemove,
}) {
  const onStepWheel = (ci, si, step) => (e) => {
    if (!step || step.midi == null) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? "up" : "down";
    const action = e.shiftKey ? (dir === "up" ? "oct-up" : "oct-down") : dir;
    editBassStep(ci, si, action);
  };

  return (
    <>
      <div className="hw-seq-ctrl" style={{ "--sc": "var(--bass)" }}>
        <Seg
          options={[{ v: false, l: "Off" }, { v: true, l: "On" }]}
          value={bassOn} onChange={setBassOn} color="var(--bass)"
        />

        {bassOn && (
          <>
            <Seg options={BASS_MODES} value={bassMode} onChange={setBassMode} color="var(--bass)" />

            <Seg
              options={[{ v: 8, l: "8" }, { v: 16, l: "16" }, { v: 32, l: "32" }]}
              value={bassSteps}
              onChange={setBassSteps}
              color="var(--bass)"
            />

            {/* Bass-octave stepper. C1 is the deep sub register, C3 is closer
                to the chord. Most patterns sit happily at C2. */}
            <div className="hw-oct">
              Oct
              <button onClick={() => setBassOct(Math.max(bassOct - 1, 1))} disabled={bassOct <= 1}>
                <ArrowDown size={12} />
              </button>
              <span style={{ minWidth: 30, textAlign: "center", color: "var(--tx)", fontWeight: 700 }}>
                C{bassOct}
              </span>
              <button onClick={() => setBassOct(Math.min(bassOct + 1, 3))} disabled={bassOct >= 3}>
                <ArrowUp size={12} />
              </button>
            </div>

            <button
              className="hw-btn"
              onClick={regenBass}
              disabled={!prog.length}
              style={{ background: "var(--bass)", borderColor: "var(--bass)", color: "var(--bg)", fontWeight: 700 }}
            >
              <Shuffle size={10} /> {bassMode === "acid" ? "Gen" : "Apply"}
            </button>

            <button className="hw-btn" onClick={() => setBassPat({})}>
              <RotateCcw size={10} /> Clear
            </button>
          </>
        )}
      </div>

      {bassOn && prog.length > 0 && (
        <div className="hw-seq" style={{ "--sc": "var(--bass)" }}>
          {prog.map((ch, ci) => {
            // Empty row when there's no pattern yet — gives the user a
            // place to start punching notes in by hand.
            const bp = bassPat[ci] || Array(bassSteps).fill(null);
            const sb = bp.length / 4;
            return (
              <div key={ch.id} className="hw-seq-row">
                <div className="hw-seq-lbl">
                  <span className="cn" style={{ color: "var(--bass)" }}>{ch.symbol}</span>
                  <Knob
                    label="Pitch"
                    color="var(--bass)"
                    onTranspose={(d) => transposeBassRow(ci, d)}
                    title="Drag up/down to rotate this row's notes through R / 3 / 5 / 8"
                  />
                </div>
                <div className="hw-seq-steps">
                  {bp.map((step, si) => {
                    const on = step && step.midi !== null;
                    const sel = on && selection?.has(`${ci}-${si}`);
                    const onClick = makeClickHandler(
                      () => onSelect(ci, si, on),
                      () => insertOrRemove(ci, si),
                    );
                    return (
                      <div
                        key={si}
                        className={
                          "hw-seq-step " +
                          (on ? "on " : "") +
                          (sel ? "sel " : "") +
                          (on && step.accent ? "accent " : "") +
                          (on && step.slide ? "slide " : "") +
                          (si > 0 && si % sb === 0 ? "beat" : "")
                        }
                        onClick={onClick}
                        onWheel={on ? onStepWheel(ci, si, step) : undefined}
                        title={on ? "Click: select · Double-click: remove · Wheel: pitch ±" : "Double-click to add a root-note"}
                      >
                        {on && (
                          <span className="pch">
                            {midiToLabel(step.midi)}{step.accent ? "!" : ""}{step.slide ? "~" : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bassOn && prog.length > 0 && Object.keys(bassPat).length === 0 && (
        <div className="hw-seq-empty">
          Hit <strong>{bassMode === "acid" ? "Gen" : "Apply"}</strong> to build a pattern, or
          double-click any cell below to add notes by hand.
        </div>
      )}
    </>
  );
}
