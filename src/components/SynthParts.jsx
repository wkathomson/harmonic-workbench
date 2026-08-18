// Hands a Workbench track (chords / bass / melody / arp) over to the synth
// engine. One row per track: a Tone/Synth toggle, a patch picker, a compact
// strip of the controls that matter most, and an "Advanced" disclosure that
// mounts the full <SynthPanel/> for that track's part.
//
// Everything here reads/writes through the `synth` prop returned by
// useWorkbenchSynth() — no audio-graph code lives in this file. The panel
// must render correctly before any audio exists (partFor/mixerRef.current
// both null until a slot is first touched); every getter below is optional-
// chained so that idle state just draws a static background, per the scopes'
// own `running` contract.

import { useState } from "react";
import SynthPanel from "./synth/SynthPanel.jsx";
import Knob from "./synth/Knob.jsx";
import Switch from "./synth/Switch.jsx";
import Seg from "./Seg.jsx";
import { WAVES } from "./synth/params.js";
import { FACTORY, randomPreset } from "../audio/synth/presets.js";
import "./synth/panel.css";
import "./synthParts.css";

const SLOTS = [
  { key: "chord", label: "Chords", color: "var(--ac)" },
  { key: "bass", label: "Bass", color: "var(--bass)" },
  { key: "melody", label: "Melody", color: "var(--mel)" },
  { key: "arp", label: "Arp", color: "var(--arp)" },
];

// The controls that matter most for a fast sound-design pass. Everything
// else lives behind "Advanced". osc1.waveform is rendered separately (it's
// a Switch, not a Knob) and part.level/part.pan aren't in params.js' `P`
// table at all — see LEVEL_PAN below.
const STRIP = [
  "filter.cutoff", "filter.resonance",
  "ampEnv.attack", "ampEnv.decay", "ampEnv.sustain", "ampEnv.release",
  "fx.delaySend", "fx.choSend", "fx.verbSend",
];

// part.level/part.pan are engine-routing values (how loud, where in the
// stereo field), not synth-patch parameters, so they were never added to
// params.js' `P` table. Rather than add engine-agnostic metadata to a file
// that's the synth panel's own parameter registry, they get their own tiny
// table here and render as plain labelled range inputs styled to match.
const LEVEL_PAN = {
  "part.level": {
    label: "Level", min: 0, max: 1, step: 0.01,
    fmt: (v) => `${Math.round(v * 100)}%`,
  },
  "part.pan": {
    label: "Pan", min: -1, max: 1, step: 0.01,
    fmt: (v) => (Math.abs(v) < 0.005 ? "C" : v > 0 ? `R${Math.round(v * 100)}` : `L${Math.round(-v * 100)}`),
  },
};

function LevelPanSlider({ path, value, onChange }) {
  const d = LEVEL_PAN[path];
  return (
    <div className="hw-sp-lp">
      <div className="hw-sp-lp-lbl">{d.label}</div>
      <input
        type="range"
        min={d.min} max={d.max} step={d.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="hw-sp-lp-val">{d.fmt(value)}</div>
    </div>
  );
}

// Loading resets the select back to its placeholder (value stays "" always,
// same pattern the #/synth route uses) so the same option can be re-picked —
// most useful for Random, which should re-roll on every selection.
function PresetPicker({ slot, synth }) {
  return (
    <select
      className="hw-sp-preset"
      aria-label={`${slot} preset`}
      value=""
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        if (v === "__init") synth.loadPatch(slot, {}, "Init");
        else if (v === "__random") synth.loadPatch(slot, randomPreset(), "Random");
        else if (FACTORY[v]) synth.loadPatch(slot, FACTORY[v], v);
      }}
    >
      <option value="">Load preset…</option>
      <option value="__init">Init</option>
      {Object.keys(FACTORY).map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
      <option value="__random">Random</option>
    </select>
  );
}

function SlotRow({ meta, synth }) {
  const { key: slot, label, color } = meta;
  const [advanced, setAdvanced] = useState(false);

  const state = synth.slots[slot];
  // Live, ref-backed values — read at render time for the controls' initial
  // display. Knob/the range inputs own their own value while being dragged,
  // so this is never fed back per pointermove; it only matters again when a
  // structural change (toggle, preset load, mod-slot edit) triggers a
  // re-render.
  const values = synth.valuesFor(slot);
  const part = synth.partFor(slot);
  const mixer = synth.mixerRef.current;
  const write = (path, value) => synth.write(slot, path, value);

  return (
    <div className="hw-sp-row" style={{ "--sc": color }}>
      <div className="hw-sp-head">
        <span className="hw-sp-lbl" style={{ color }}>{label}</span>
        <Seg
          options={[{ v: false, l: "Tone voice" }, { v: true, l: "Synth" }]}
          value={state.on}
          onChange={(on) => synth.setSlotEnabled(slot, on)}
          color={color}
        />
        <PresetPicker slot={slot} synth={synth} />
        <span className="hw-sp-name">{state.name}</span>
        <button
          type="button"
          className={"hw-sp-adv" + (advanced ? " on" : "")}
          onClick={() => setAdvanced((a) => !a)}
        >
          Advanced {advanced ? "▴" : "▾"}
        </button>
      </div>

      <div className="hw-sp-strip">
        <Switch
          options={WAVES}
          value={values["osc1.waveform"]}
          onChange={(v) => write("osc1.waveform", v)}
          label="Osc 1 wave"
        />
        {STRIP.map((path) => (
          <Knob key={path} path={path} value={values[path]} onChange={(v) => write(path, v)} />
        ))}
        <LevelPanSlider path="part.level" value={values["part.level"]} onChange={(v) => write("part.level", v)} />
        <LevelPanSlider path="part.pan" value={values["part.pan"]} onChange={(v) => write("part.pan", v)} />
      </div>

      {advanced && (
        <div className="instrument hw-sp-advanced">
          <SynthPanel
            values={values}
            write={write}
            slots={synth.modSlotsFor(slot)}
            onSlotChange={(i, field, value) => synth.setModSlot(slot, i, field, value)}
            getResponse={part?.getFilterResponse ?? null}
            getVoiceStates={part?.getVoiceStates ?? null}
            getScope={mixer?.getScope ?? null}
            getSpectrum={mixer?.getSpectrum ?? null}
            onPanic={() => part?.panic()}
            crusherActive={part?.crusherActive}
            sampleRate={null}
            running={!!part}
          />
        </div>
      )}
    </div>
  );
}

export default function SynthParts({ synth }) {
  return (
    <div className="hw-sp">
      <div className="hw-sp-help">
        Switch a track to <strong>Synth</strong> to give it its own designed patch instead
        of the Workbench's built-in voice. Bass, chords and melody can each carry a
        different sound while sharing one set of effects.
      </div>
      {SLOTS.map((meta) => (
        <SlotRow key={meta.key} meta={meta} synth={synth} />
      ))}
    </div>
  );
}
