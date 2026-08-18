import { Shuffle, RotateCcw, Lock, Unlock } from "lucide-react";
import { midiToLabel } from "../theory/stepEdit.js";
import Seg from "./Seg.jsx";
import Knob from "./Knob.jsx";
import { makeClickHandler } from "../utils/clickHandler.js";

// Melody sequencer — pentatonic playground with transposed / free modes, random / euclidean fills,
// per-chord lockable rows and manual cell toggling.
export default function MelodySequencer({
  melOn, setMelOn,
  melPenta, setMelPenta,
  melSteps, setMelSteps,
  melMode, setMelMode,
  melFill, setMelFill,
  melDens, setMelDens,
  melEucH, setMelEucH,
  melOct, setMelOct,
  melPat, setMelPat,
  melLock, setMelLock,
  prog, regenMel, togMelStep, editMelStep, transposeMelRow,
  selection, onSelect,
  curStep, curMel,
}) {
  // Translate a wheel event on a step into one of the editStep actions.
  // Up scrolls increase pitch; shift+wheel jumps an octave.
  const onStepWheel = (ci, si, midi) => (e) => {
    if (midi == null) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? "up" : "down";
    const action = e.shiftKey ? (dir === "up" ? "oct-up" : "oct-down") : dir;
    editMelStep(ci, si, action);
  };
  return (
    <>
      <div className="hw-seq-ctrl" style={{ "--sc": "var(--mel)" }}>
        <Seg options={[{ v: false, l: "Off" }, { v: true, l: "On" }]} value={melOn} onChange={setMelOn} color="var(--mel)" />
        {melOn && (
          <>
            <Seg options={[{ v: "auto", l: "Auto" }, { v: "major", l: "Maj" }, { v: "minor", l: "Min" }]} value={melPenta} onChange={setMelPenta} color="var(--mel)" />
            <Seg
              options={[{ v: 8, l: "8" }, { v: 16, l: "16" }, { v: 32, l: "32" }]}
              value={melSteps}
              onChange={v => { setMelSteps(v); setMelPat({}); }}
              color="var(--mel)"
            />
            <Seg options={[{ v: "transposed", l: "Trans" }, { v: "free", l: "Free" }]} value={melMode} onChange={setMelMode} color="var(--mel)" />
            <Seg options={[{ v: "random", l: "Rand" }, { v: "euclidean", l: "Euclid" }]} value={melFill} onChange={setMelFill} color="var(--mel)" />
            {melFill === "random" ? (
              <div className="hw-inp">
                Den <input type="number" min="1" max="100" step="5" value={Math.round(melDens * 100)}
                  onChange={e => setMelDens(Math.max(1, Math.min(100, parseInt(e.target.value) || 40)) / 100)}
                  style={{ width: 45 }} />%
              </div>
            ) : (
              <div className="hw-inp">
                Hits <input type="number" min="1" max={melSteps} value={melEucH}
                  onChange={e => setMelEucH(Math.max(1, Math.min(melSteps, parseInt(e.target.value) || 5)))}
                  style={{ width: 45 }} />
              </div>
            )}
            <div className="hw-inp">
              Oct
              <select value={melOct} onChange={e => setMelOct(parseInt(e.target.value))} style={{ width: "auto" }}>
                <option value="4">C4</option><option value="5">C5</option><option value="6">C6</option>
              </select>
            </div>
            <button
              className="hw-btn"
              onClick={regenMel}
              disabled={!prog.length}
              style={{ background: "var(--mel)", borderColor: "var(--mel)", color: "var(--bg)", fontWeight: 700 }}
            >
              <Shuffle size={10} /> Gen
            </button>
            <button className="hw-btn" onClick={() => { setMelPat({}); setMelLock({}); }}>
              <RotateCcw size={10} /> Clear
            </button>
          </>
        )}
      </div>

      {melOn && prog.length > 0 && (
        <div className="hw-seq" style={{ "--sc": "var(--mel)" }}>
          {Object.keys(melPat).length === 0 ? (
            <div className="hw-seq-empty">Press Gen or click cells</div>
          ) : (
            prog.map((ch, ci) => {
              const mp = melPat[ci] || Array(melSteps).fill(null);
              const locked = !!melLock[ci];
              return (
                <div key={ch.id} className={"hw-seq-row " + (curStep === ci ? "current" : "")}>
                  <div className="hw-seq-lbl">
                    <span className="cn" style={{ color: "var(--mel)" }}>{ch.symbol}</span>
                    <Knob
                      label="Pitch"
                      color="var(--mel)"
                      onTranspose={(d) => transposeMelRow(ci, d)}
                      title="Drag up/down to rotate this row's notes within the pentatonic"
                    />
                    <button
                      className={"hw-lock " + (locked ? "lk" : "")}
                      onClick={() => setMelLock(p => ({ ...p, [ci]: !p[ci] }))}
                      title={locked ? "Unlock" : "Lock"}
                    >
                      {locked ? <Lock size={10} /> : <Unlock size={10} />}
                    </button>
                  </div>
                  <div className="hw-seq-steps">
                    {mp.map((midi, si) => {
                      const on = midi !== null;
                      const pl = curMel && curMel.c === ci && curMel.s === si;
                      const sel = on && selection?.has(`${ci}-${si}`);
                      // Single click: toggle selection (or clear row's
                      // selection on an empty cell). Double click: insert /
                      // remove the note.
                      const onClick = makeClickHandler(
                        () => onSelect(ci, si, on),
                        () => togMelStep(ci, si),
                      );
                      return (
                        <div
                          key={si}
                          className={
                            "hw-seq-step " +
                            (on ? "on " : "") +
                            (sel ? "sel " : "") +
                            (pl ? "playing " : "") +
                            (si > 0 && si % 4 === 0 ? "beat" : "")
                          }
                          onClick={onClick}
                          onWheel={on ? onStepWheel(ci, si, midi) : undefined}
                          title={on ? "Click: select · Double-click: remove · Wheel: pitch ±" : "Double-click to add a note"}
                        >
                          {on && <span className="pch">{midiToLabel(midi)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
