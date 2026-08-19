import { VOICE_LIST, VOICE_PRESETS } from "../audio/presets.js";
import { synthSlotForVoice } from "../audio/engine.js";

// One row per voice. Each row groups:
//   - Preset chips (starting sound)
//   - Envelope: Attack / Decay / Release
//   - Tone (filter cutoff)
//   - Sends: Reverb / Delay
function VoiceRow({ voiceKey, label, color, state, onPreset, onMacro, onSynth }) {
  const presets = VOICE_PRESETS[voiceKey];
  const presetKeys = Object.keys(presets);

  // A track handed to the synth engine has its own oscillators, envelopes and
  // sends. None of these macros reach it, so the row says so rather than
  // offering controls that quietly do nothing.
  return (
    <div className={"hw-vc-row" + (onSynth ? " hw-vc-onsynth" : "")}>
      {onSynth && (
        <div className="hw-vc-synthnote">
          On the synth engine — shape this sound in the <strong>Synth</strong> panel.
        </div>
      )}
      <div className="hw-vc-head">
        <div className="hw-vc-lbl" style={{ color }}>{label}</div>
        <div className="hw-vc-presets">
          {presetKeys.map(pk => (
            <button
              key={pk}
              className={"hw-vc-preset " + (state.preset === pk ? "act" : "")}
              onClick={() => onPreset(voiceKey, pk)}
            >
              {presets[pk].label}
            </button>
          ))}
        </div>
      </div>

      <div className="hw-vc-group">
        <div className="hw-vc-group-lbl">Envelope (A · D · S · R)</div>
        <Macro label="A" value={state.attack}  onChange={v => onMacro(voiceKey, "attack",  v)} />
        <Macro label="D" value={state.decay}   onChange={v => onMacro(voiceKey, "decay",   v)} />
        <Macro label="S" value={state.sustain} onChange={v => onMacro(voiceKey, "sustain", v)} />
        <Macro label="R" value={state.release} onChange={v => onMacro(voiceKey, "release", v)} />
      </div>

      <div className="hw-vc-group">
        <div className="hw-vc-group-lbl">Filter</div>
        <Macro label="Tone" value={state.tone} onChange={v => onMacro(voiceKey, "tone", v)} wide />
      </div>

      <div className="hw-vc-group">
        <div className="hw-vc-group-lbl">FX Send</div>
        <Macro label="Rev" value={state.reverb} onChange={v => onMacro(voiceKey, "reverb", v)} />
        <Macro label="Dly" value={state.delay}  onChange={v => onMacro(voiceKey, "delay",  v)} />
      </div>
    </div>
  );
}

function Macro({ label, value, onChange, wide }) {
  return (
    <div className={"hw-vc-macro " + (wide ? "wide" : "")}>
      <div className="hw-vc-macro-lbl">{label}</div>
      <input
        type="range" min="0" max="1" step="0.01"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div className="hw-vc-macro-val">{Math.round(value * 100)}</div>
    </div>
  );
}

export default function Voices({ voiceState, onPreset, onMacro, synthSlots = {} }) {
  return (
    <div className="hw-vc">
      <div className="hw-vc-help">
        Pick a starting sound, then shape it with <strong>A/D/S/R</strong> envelope —
        Sustain at 0 makes notes <em>run out</em> (stab), high keeps them ringing.
        Then set <strong>Tone</strong> + <strong>Reverb / Delay</strong> sends.
      </div>
      {VOICE_LIST.map(v => (
        <VoiceRow
          key={v.key}
          voiceKey={v.key}
          onSynth={!!synthSlots[synthSlotForVoice(v.key)]?.on}
          label={v.label}
          color={v.color}
          state={voiceState[v.key]}
          onPreset={onPreset}
          onMacro={onMacro}
        />
      ))}
    </div>
  );
}
