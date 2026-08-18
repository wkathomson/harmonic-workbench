import { Trash2 } from "lucide-react";
import { DRUMS, DRUM_KIT_LIST, DRUM_STEP_LIST } from "../theory/drums.js";
import Seg from "./Seg.jsx";
import Knob from "./Knob.jsx";
import { makeClickHandler } from "../utils/clickHandler.js";

// Drum machine.
//
// Step grid is 16 / 32 / 64 cells per drum. With 16 it's a one-bar pattern
// that repeats every chord; with 32/64 it spans 2/4 chord bars so kits can
// place fills at the bar-2 / bar-4 boundary. Beat lines are drawn every
// 4 cells; bar lines (heavier) are drawn every 16.
//
// Each cell stores either:
//   • false / 0     — silent
//   • true          — hit at default velocity (legacy preset support)
//   • 0.1 – 1.0     — hit at that velocity (per-step velocity edits)
//
// Click toggles a cell on/off; the per-row velocity dial scales every
// active cell in the row up/down by 5% per notch.

const DEFAULT_VEL = 0.85;

function cellVel(cell) {
  if (cell === true)            return DEFAULT_VEL;
  if (typeof cell === "number") return cell > 0 ? cell : 0;
  return 0;
}

export default function DrumMachine({
  drumOn, setDrumOn,
  drumKit, setDrumKit,
  drumSteps,
  drumPat, setDrumPat,
  onLoadKit, onClear, onAuditionDrum,
  onStepsChange, onAdjustVel,
  selection, onSelect,
}) {
  const toggleStep = (drum, si) => {
    setDrumPat(p => {
      const next = { ...p };
      const row = [...(next[drum] || Array(drumSteps).fill(0))];
      row[si] = cellVel(row[si]) > 0 ? 0 : DEFAULT_VEL;
      next[drum] = row;
      return next;
    });
  };

  return (
    <>
      <div className="hw-seq-ctrl" style={{ "--sc": "var(--arp)" }}>
        <Seg
          options={[{ v: false, l: "Off" }, { v: true, l: "On" }]}
          value={drumOn} onChange={setDrumOn} color="var(--arp)"
        />

        {drumOn && (
          <>
            <Seg
              options={DRUM_KIT_LIST}
              value={drumKit}
              onChange={(k) => { setDrumKit(k); onLoadKit(k); }}
              color="var(--arp)"
            />
            <Seg
              options={DRUM_STEP_LIST}
              value={drumSteps}
              onChange={(s) => onStepsChange(s)}
              color="var(--arp)"
            />
            <button className="hw-btn" onClick={onClear}>
              <Trash2 size={10} /> Clear
            </button>
            <span className="hw-seq-hint">
              Click: on/off · Knob: velocity ± · {drumSteps === 16 ? "1 bar" : drumSteps === 32 ? "2-bar pattern (fill on bar 2)" : "4-bar pattern (fill on bar 4)"}
            </span>
          </>
        )}
      </div>

      {drumOn && (
        <div className="hw-seq" style={{ "--sc": "var(--arp)" }}>
          {DRUMS.map(d => {
            const row = drumPat[d.key] || Array(drumSteps).fill(0);
            return (
              <div key={d.key} className="hw-seq-row">
                <button
                  className="hw-seq-lbl hw-dr-lbl"
                  onClick={() => onAuditionDrum(d.key)}
                  title={"Audition " + d.label}
                >
                  <span className="cn" style={{ color: "var(--arp)" }}>{d.short}</span>
                  <span style={{ fontSize: ".55rem", color: "var(--txf)" }}>{d.label}</span>
                </button>
                <Knob
                  label="Vel"
                  color="var(--arp)"
                  onTranspose={(dir) => onAdjustVel(d.key, dir)}
                  title="Drag up/down to scale every active hit's velocity"
                />
                <div className="hw-seq-steps">
                  {row.map((cell, si) => {
                    const v = cellVel(cell);
                    const on = v > 0;
                    const sel = on && selection?.has(`${d.key}-${si}`);
                    // Beat = every 4; Bar = every 16 (heavier divider).
                    const isBeat = si > 0 && si % 4 === 0;
                    const isBar  = si > 0 && si % 16 === 0;
                    // Single click → select / clear-row; double click → on/off.
                    const onClick = makeClickHandler(
                      () => onSelect(d.key, si, on),
                      () => toggleStep(d.key, si),
                    );
                    return (
                      <div
                        key={si}
                        className={
                          "hw-seq-step " +
                          (on ? "on " : "") +
                          (sel ? "sel " : "") +
                          (isBar ? "bar " : isBeat ? "beat " : "")
                        }
                        onClick={onClick}
                        title={on ? `Click: select · Double-click: off · Vel ${Math.round(v * 100)}` : "Double-click to add a hit"}
                      >
                        {on && (
                          <span
                            className="hw-dr-vel"
                            style={{ opacity: 0.4 + 0.6 * v }}
                          />
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
    </>
  );
}
