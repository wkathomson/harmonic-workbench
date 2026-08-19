import Seg from "./Seg.jsx";

// Global FX controls.
//
// Per-voice sends live in the Voices panel; this is the *return* side — what
// the reverb and delay buses actually do once a voice sends signal into them.
//
// Delay time options are subdivisions, not seconds — they re-sync to the
// current BPM whenever it changes (handled in the engine).
const DELAY_TIMES = [
  { v: "16n", l: "1/16" },
  { v: "8n",  l: "1/8"  },
  { v: "8n.", l: "1/8d" },
  { v: "4n",  l: "1/4"  },
  { v: "4n.", l: "1/4d" },
  { v: "2n",  l: "1/2"  },
];

function Slider({ label, value, min, max, step, fmt, onChange }) {
  return (
    <div className="hw-fx-slider">
      <div className="hw-fx-lbl">{label}</div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div className="hw-fx-val">{fmt ? fmt(value) : value}</div>
    </div>
  );
}

export default function FX({ fx, onChange, synthSlots = {} }) {
  // These effects belong to the Tone voices and the drums. A track on the
  // synth engine sends to the synth's own delay/chorus/reverb instead, set
  // per patch — so say so rather than let the panel look global when it
  // isn't.
  const onSynth = Object.entries(synthSlots).filter(([, v]) => v?.on).map(([k]) => k);
  return (
    <div className="hw-fx">
      <div className="hw-fx-section">
        <div className="hw-fx-title" style={{ color: "var(--bw)" }}>Delay</div>
        <div className="hw-fx-row">
          <div className="hw-fx-lbl">Time</div>
          <Seg
            options={DELAY_TIMES}
            value={fx.delayTime}
            onChange={v => onChange("delayTime", v)}
          />
        </div>
        <Slider
          label="Feedback"
          value={fx.delayFeedback} min={0} max={0.85} step={0.01}
          fmt={v => Math.round(v * 100)}
          onChange={v => onChange("delayFeedback", v)}
        />
        <div className="hw-fx-row">
          <div className="hw-fx-lbl">Type</div>
          <Seg
            options={[{ v: false, l: "Mono" }, { v: true, l: "Ping-Pong" }]}
            value={fx.delayPingPong}
            onChange={v => onChange("delayPingPong", v)}
          />
        </div>
      </div>

      <div className="hw-fx-section">
        <div className="hw-fx-title" style={{ color: "var(--grn)" }}>Reverb</div>
        <Slider
          label="Size"
          value={fx.reverbSize} min={0.5} max={6} step={0.1}
          fmt={v => v.toFixed(1) + "s"}
          onChange={v => onChange("reverbSize", v)}
        />
      </div>

      <div className="hw-fx-help">
        Per-voice <strong>Rev</strong> / <strong>Dly</strong> sends are in the Voices panel.
        {onSynth.length > 0 && (
          <>
            {" "}These effects don't reach {onSynth.join(", ")} — {onSynth.length > 1 ? "those tracks are" : "that track is"} on
            the synth engine, which has its own delay, chorus and reverb in the <strong>Synth</strong> panel.
          </>
        )}
      </div>
    </div>
  );
}
