import { Trash2, Sparkles, GripVertical, X, Wand2, Shuffle, Play, Check } from "lucide-react";

// Progression builder: drag-reorderable chord row, per-chord rhythm grid, suggestions,
// variation suggester, + the (now contextual) Clear button. Global transport lives
// in TransportBar at the bottom of the screen.
export default function Progression({
  prog, setProg,
  bpc,
  playing, curStep,
  dragI, dragO, onDS, onDO, onDE,
  clearP, smoothP,
  suggestions, loadSug, toggleChStep,
  onSuggestVariation, variations, onApplyVariation, onPreviewVariation, onClearVariations,
}) {
  return (
    <>
      <div className="hw-pr">
        {prog.length === 0 ? (
          <div style={{ color: "var(--txf)", fontSize: ".7rem", fontStyle: "italic", width: "100%", textAlign: "center", alignSelf: "center" }}>
            Click + on a chord or try a suggestion
          </div>
        ) : (
          prog.map((ch, i) => (
            <div
              key={ch.id}
              className={
                "hw-pc " +
                (ch.source === "borrowed" ? "bw " : "") +
                (ch.source === "chromatic" ? "chr " : "") +
                (curStep === i ? "act " : "") +
                (dragI === i ? "dg " : "") +
                (dragO === i && dragI !== i ? "dov" : "")
              }
              draggable={!playing}
              onDragStart={() => onDS(i)}
              onDragOver={e => onDO(e, i)}
              onDragEnd={onDE}
              onDrop={onDE}
            >
              <div style={{ color: "var(--txf)", display: "flex", alignItems: "center" }}>
                <GripVertical size={12} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="pc-rm">{ch.roman}</div>
                <div className="pc-sy">{ch.symbol}</div>
              </div>
              <button className="hw-pc-x" onClick={() => setProg(p => p.filter(c => c.id !== ch.id))}>
                <X size={9} />
              </button>
            </div>
          ))
        )}
      </div>

      {prog.length > 0 && (
        <div className="hw-cr">
          <div className="hw-lbl" style={{ marginTop: 10 }}>Chord Rhythm</div>
          {prog.map((ch, ci) => {
            const ts = bpc * 2;
            const rhy = ch.rhythm || Array(ts).fill(false).map((_, j) => j === 0);
            return (
              <div key={ch.id} className="hw-cr-row">
                <div className="hw-cr-lbl"><strong>{ch.symbol}</strong></div>
                <div className="hw-cr-steps">
                  {rhy.map((on, si) => (
                    <div
                      key={si}
                      className={"hw-cr-step " + (on ? "on " : "") + (si > 0 && si % 4 === 0 ? "beat" : "")}
                      onClick={() => toggleChStep(ci, si)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hw-prog-ctrl">
        <button
          className="hw-btn"
          onClick={smoothP}
          disabled={prog.length < 2}
          title="Re-voice each chord to move smoothly from the previous one"
        >
          <Wand2 size={11} /> Smooth
        </button>
        {onSuggestVariation && (
          <button
            className="hw-btn"
            onClick={onSuggestVariation}
            disabled={prog.length < 2}
            title="Suggest 3 musically-related alternatives to this progression"
          >
            <Shuffle size={11} /> Variations
          </button>
        )}
        <button className="hw-btn" onClick={clearP} disabled={!prog.length}>
          <Trash2 size={11} /> Clear
        </button>
      </div>

      {/* Variation suggestions — three alternatives, each previewable + appliable */}
      {variations && variations.length > 0 && (
        <div className="hw-var">
          <div className="hw-var-hdr">
            <span className="hw-lbl" style={{ margin: 0 }}>Try one of these</span>
            <button className="hw-var-x" onClick={onClearVariations} title="Dismiss">
              <X size={11} />
            </button>
          </div>
          {variations.map((v, i) => (
            <div key={i} className="hw-var-row">
              <div className="hw-var-meta">
                <div className="hw-var-label">{v.label}</div>
                <div className="hw-var-desc">{v.description}</div>
                <div className="hw-var-chords">
                  {v.prog.map((ch, j) => (
                    <span key={j} className="hw-var-ch">{ch.symbol}</span>
                  ))}
                </div>
              </div>
              <div className="hw-var-acts">
                <button className="hw-btn" onClick={() => onPreviewVariation(v)} title="Hear it">
                  <Play size={11} /> Hear
                </button>
                <button className="hw-btn pri" onClick={() => onApplyVariation(v)} title="Replace progression">
                  <Check size={11} /> Use
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="hw-suggs">
          {suggestions.map((s, i) => (
            <button key={i} className="hw-sugg" onClick={() => loadSug(s)}>
              <Sparkles size={10} /> {s.n}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
