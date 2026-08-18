import { Zap, RotateCcw } from "lucide-react";
import { midiToLabel } from "../theory/stepEdit.js";
import { ARP_RHYTHM_LIST } from "../theory/rhythm.js";
import Seg from "./Seg.jsx";
import Knob from "./Knob.jsx";
import { makeClickHandler } from "../utils/clickHandler.js";

// Arpeggiator — up/down/up-down/random over current chord tones, with
// optional rhythm patterns (straight / gallop / dotted / sparse / triplet).
export default function ArpSequencer({
  arpOn, setArpOn, arpMode, setArpMode,
  arpRhythm, setArpRhythm,
  arpSteps, setArpSteps, arpPat, setArpPat,
  prog, regenArp, editArpStep, transposeArpRow,
  selection, onSelect, insertOrRemove,
}) {
  const onStepWheel = (ci, si, midi) => (e) => {
    if (midi == null) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? "up" : "down";
    const action = e.shiftKey ? (dir === "up" ? "oct-up" : "oct-down") : dir;
    editArpStep(ci, si, action);
  };

  return (
    <>
      <div className="hw-seq-ctrl" style={{ "--sc": "var(--arp)" }}>
        <Seg options={[{ v: false, l: "Off" }, { v: true, l: "On" }]} value={arpOn} onChange={setArpOn} color="var(--arp)" />
        {arpOn && (
          <>
            <Seg
              options={[
                { v: "up", l: "Up" }, { v: "down", l: "Down" },
                { v: "updown", l: "Up-Dn" }, { v: "random", l: "Rand" },
              ]}
              value={arpMode}
              onChange={setArpMode}
              color="var(--arp)"
            />
            <Seg
              options={ARP_RHYTHM_LIST}
              value={arpRhythm}
              onChange={setArpRhythm}
              color="var(--arp)"
            />
            <Seg
              options={[{ v: 8, l: "8" }, { v: 16, l: "16" }, { v: 32, l: "32" }]}
              value={arpSteps}
              onChange={v => { setArpSteps(v); setArpPat({}); }}
              color="var(--arp)"
            />
            <button
              className="hw-btn"
              onClick={regenArp}
              disabled={!prog.length}
              style={{ background: "var(--arp)", borderColor: "var(--arp)", color: "var(--bg)", fontWeight: 700 }}
            >
              <Zap size={10} /> Gen
            </button>
            <button className="hw-btn" onClick={() => setArpPat({})}>
              <RotateCcw size={10} /> Clear
            </button>
          </>
        )}
      </div>

      {arpOn && prog.length > 0 && (
        <div className="hw-seq" style={{ "--sc": "var(--arp)" }}>
          {prog.map((ch, ci) => {
            // Always render a row, even if there's no generated pattern,
            // so the user can punch in notes by double-clicking.
            const ap = arpPat[ci] || Array(arpSteps).fill(null);
            return (
              <div key={ch.id} className="hw-seq-row">
                <div className="hw-seq-lbl">
                  <span className="cn" style={{ color: "var(--arp)" }}>{ch.symbol}</span>
                  <Knob
                    label="Pitch"
                    color="var(--arp)"
                    onTranspose={(d) => transposeArpRow(ci, d)}
                    title="Drag up/down to rotate this row's notes through the chord tones"
                  />
                </div>
                <div className="hw-seq-steps">
                  {ap.map((midi, si) => {
                    const on = midi != null;
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
                          (si > 0 && si % 4 === 0 ? "beat" : "")
                        }
                        onClick={onClick}
                        onWheel={on ? onStepWheel(ci, si, midi) : undefined}
                        title={on ? "Click: select · Double-click: remove · Wheel: pitch ±" : "Double-click to add a chord-tone"}
                      >
                        {on && <span className="pch">{midiToLabel(midi)}</span>}
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
