import { RotateCcw } from "lucide-react";

// Channel definitions for the mixer panel — order = display order.
const CHANNELS = [
  { key: "piano",  label: "Piano",  color: "var(--ac)"   },
  { key: "pad",    label: "Pad",    color: "var(--ac)"   },
  { key: "bass",   label: "Bass",   color: "var(--bass)" },
  { key: "acid",   label: "Acid",   color: "var(--bass)" },
  { key: "melody", label: "Melody", color: "var(--mel)"  },
  { key: "arp",    label: "Arp",    color: "var(--arp)"  },
  { key: "drums",  label: "Drums",  color: "var(--arp)"  },
];

// Single vertical fader. Implemented as a horizontal range input rotated
// -90deg so 0 is always at the bottom and 100 at the top — the natural
// mixing-desk orientation. Behaves consistently across browsers.
function Fader({ label, color, value, onChange, defaultValue }) {
  return (
    <div className="hw-mx-ch">
      <div className="hw-mx-val">{Math.round(value * 100)}</div>
      <div className="hw-mx-fader-wrap">
        <input
          className="hw-mx-fader"
          type="range" min="0" max="1" step="0.01"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onDoubleClick={() => onChange(defaultValue)}
          style={{ accentColor: color }}
          title="Double-click to reset"
        />
      </div>
      <div className="hw-mx-lbl" style={{ color }}>{label}</div>
    </div>
  );
}

// Mixer with per-voice channel faders + master.
//
// Reverb/Delay returns aren't in this UI any more — they live as per-voice
// sends in the Voices panel and as global FX controls in the FX panel.
export default function Mixer({ levels, defaults, onChange, onReset }) {
  return (
    <>
      <div className="hw-mx">
        {CHANNELS.map(ch => (
          <Fader
            key={ch.key}
            label={ch.label}
            color={ch.color}
            value={levels[ch.key]}
            defaultValue={defaults[ch.key]}
            onChange={v => onChange(ch.key, v)}
          />
        ))}

        <div className="hw-mx-divider" />

        <Fader
          label="Master"
          color="var(--ac)"
          value={levels.master}
          defaultValue={defaults.master}
          onChange={v => onChange("master", v)}
        />
      </div>

      <div style={{ display: "flex", marginTop: 10 }}>
        <button className="hw-btn" onClick={onReset}>
          <RotateCcw size={10} /> Reset
        </button>
        <span style={{ marginLeft: 12, fontSize: ".6rem", color: "var(--txf)", alignSelf: "center", fontStyle: "italic" }}>
          Double-click any fader to reset that channel
        </span>
      </div>
    </>
  );
}
