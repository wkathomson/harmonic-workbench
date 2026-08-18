import { ChevronDown, ChevronRight, Plus, Check } from "lucide-react";
import { NOTE_NAMES, SCALES, CHORD_FORMULAS } from "../theory/constants.js";
import { chordSymbol, makeChord, transposeInfo } from "../theory/chords.js";

// Full chord surface: diatonic palette, borrowed chords, inversions, detail + transpose explorer.
//
// Props:
//   diatonic, borrowed — chord objects for each row
//   ext, inv, baseMidi, rom — current extension/inversion/base octave + roman labels
//   selChord: { i, src } selection pointer | null
//   selObj: the materialised chord object for the current selection (already includes inv + ext)
//   scaleKey, scaleNotes — for labelling + transpose scale-membership
//   prevSemi — current transpose preview (null or signed int)
//   showBor, setShowBor — toggle for borrowed row
//   callbacks: onClickChord(i, src), onChangeInv(i), onClickTranspose(semi),
//              onAddProg(chord, roman, source), onAddTransP(semi)
export default function ChordPalette({
  diatonic, borrowed, ext, inv, baseMidi, rom,
  selChord, selObj, scaleKey, scaleNotes, prevSemi,
  showBor, setShowBor,
  onClickChord, onChangeInv, onClickTranspose, onAddProg, onAddTransP,
}) {
  return (
    <>
      <div className="hw-cg">
        {diatonic.map((ch, i) => (
          <button
            key={i}
            className={"hw-cb " + (selChord?.src === "diatonic" && selChord.i === i ? "sel" : "")}
            onClick={() => onClickChord(i, "diatonic")}
          >
            <span className="rm">{rom[i]}</span>
            <span className="sy">{chordSymbol(NOTE_NAMES[ch.root], ch.quality, ext)}</span>
            <span className="qu">{ch.quality}</span>
            <span
              className="hw-ab"
              onClick={e => {
                e.stopPropagation();
                onAddProg(makeChord(ch.root, ch.quality, ext, 0, baseMidi), rom[i], "diatonic");
              }}
            >
              <Plus size={10} />
            </span>
          </button>
        ))}
      </div>

      {borrowed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            className="hw-btn"
            onClick={() => setShowBor(!showBor)}
            style={showBor ? { borderColor: "var(--bw)", color: "var(--bw)" } : {}}
          >
            {showBor ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {showBor ? "Hide" : "Show"} borrowed chords
          </button>
          {showBor && (
            <div>
              <div className="hw-sub-t">
                <span className="dot" /> Borrowed from {SCALES[SCALES[scaleKey].par].name}
              </div>
              <div className="hw-cg">
                {borrowed.map((ch, i) => (
                  <button
                    key={i}
                    className={"hw-cb bw " + (selChord?.src === "borrowed" && selChord.i === i ? "sel" : "")}
                    onClick={() => onClickChord(i, "borrowed")}
                  >
                    <span className="rm">{ch.roman}</span>
                    <span className="sy">{chordSymbol(NOTE_NAMES[ch.root], ch.quality, ext)}</span>
                    <span className="qu">{ch.quality}</span>
                    <span
                      className="hw-ab"
                      onClick={e => {
                        e.stopPropagation();
                        onAddProg(makeChord(ch.root, ch.quality, ext, 0, baseMidi), ch.roman, "borrowed");
                      }}
                    >
                      <Plus size={10} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selObj && (
        <div>
          <div className={"hw-cd " + (selObj.source === "borrowed" ? "bw" : "")}>
            <strong>{selObj.symbol}</strong> — Notes: {selObj.midiNotes.map(m => NOTE_NAMES[m % 12]).join("–")}
          </div>
          <div className={"hw-inv " + (selObj.source === "borrowed" ? "bw" : "")}>
            <span className="hw-lbl" style={{ margin: 0 }}>Inv</span>
            <div style={{ display: "flex", gap: 3 }}>
              {[-2, -1, 0, 1, 2, 3]
                .filter(i => i >= -2 && i <= Math.min((CHORD_FORMULAS[ext][selObj.quality] || CHORD_FORMULAS.triad[selObj.quality]).length, 4) - 1)
                .map(i => (
                  <button
                    key={i}
                    className={"hw-iv " + (inv === i ? "on" : "")}
                    onClick={() => onChangeInv(i)}
                  >
                    {i < 0 ? Math.abs(i) + "↓" : i === 0 ? "Root" : i + (i === 1 ? "st" : i === 2 ? "nd" : "rd")}
                  </button>
                ))}
            </div>
            <button
              className="hw-add-sel"
              onClick={() => onAddProg(selObj, selObj.roman, selObj.source)}
            >
              <Plus size={10} /> Add
            </button>
          </div>

          {/* Transpose explorer */}
          <div className="hw-tr-p">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              <span className="hw-lbl" style={{ margin: 0 }}>Transpose</span>
              <span style={{ fontSize: ".6rem", color: "var(--txf)", fontStyle: "italic" }}>
                green = in scale · yellow = chromatic
              </span>
            </div>
            <div className="hw-tr-lbl">Down</div>
            <div className="hw-tr-r">
              {[-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1].map(s => {
                const info = transposeInfo(selObj, s, scaleNotes);
                return (
                  <div
                    key={s}
                    className={"hw-tr-b " + (info.inScale ? "in" : "out") + " " + (prevSemi === s ? "pre" : "")}
                    onClick={() => onClickTranspose(s)}
                  >
                    <span className="sh">{s}</span>
                    <span className="ts">{info.symbol}</span>
                    <span className="tf">
                      {info.inScale ? <span><Check size={8} /> in</span> : "out"}
                    </span>
                    <div className="hw-tr-ab" onClick={e => { e.stopPropagation(); onAddTransP(s); }}>
                      <Plus size={8} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", margin: "4px 0" }}>
              <div
                className={"hw-tr-b cur " + (prevSemi === null ? "pre" : "")}
                onClick={() => onClickTranspose(0)}
                style={{ maxWidth: 100, margin: "0 auto", display: "inline-flex" }}
              >
                <span className="sh">0</span>
                <span className="ts">{selObj.symbol}</span>
                <span className="tf" style={{ color: "var(--ac)" }}>current</span>
              </div>
            </div>
            <div className="hw-tr-lbl">Up</div>
            <div className="hw-tr-r">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(s => {
                const info = transposeInfo(selObj, s, scaleNotes);
                return (
                  <div
                    key={s}
                    className={"hw-tr-b " + (info.inScale ? "in" : "out") + " " + (prevSemi === s ? "pre" : "")}
                    onClick={() => onClickTranspose(s)}
                  >
                    <span className="sh">+{s}</span>
                    <span className="ts">{info.symbol}</span>
                    <span className="tf">
                      {info.inScale ? <span><Check size={8} /> in</span> : "out"}
                    </span>
                    <div className="hw-tr-ab" onClick={e => { e.stopPropagation(); onAddTransP(s); }}>
                      <Plus size={8} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
