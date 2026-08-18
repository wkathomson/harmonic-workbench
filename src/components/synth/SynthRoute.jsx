// Standalone synthesiser route (#/synth).
//
// This is the regression harness for the extracted engine: it must sound
// identical to reference/web-synth-v11.html. It stays in the tree permanently
// — every later change to src/audio/ gets checked here before it reaches the
// Workbench UI.
//
// Controls write to the engine imperatively; only their own displayed value
// lives in React state.

import { useCallback, useRef, useState } from "react";
import { useSynth } from "./useSynth.js";
import SynthKeyboard from "./SynthKeyboard.jsx";
import { DEFAULTS } from "../../audio/synth/constants.js";
import { FACTORY, applyPresetToEngine, randomPreset } from "../../audio/synth/presets.js";
import "./synth.css";

// Minimal control set: enough to A/B the engine against the reference.
// The full panel port lands on top of this.
const SLIDERS = [
  { path: "filter.cutoff",      label: "Cutoff",     min: 20,   max: 12000, step: 1,    curve: "exp" },
  { path: "filter.resonance",   label: "Reso",       min: 0,    max: 20,    step: 0.1 },
  { path: "filter.envAmount",   label: "Env Amt",    min: -100, max: 100,   step: 1 },
  { path: "filter.drive",       label: "Drive",      min: 0,    max: 1,     step: 0.01 },
  { path: "ampEnv.attack",      label: "Amp A",      min: 0.001, max: 4,    step: 0.001, curve: "exp" },
  { path: "ampEnv.decay",       label: "Amp D",      min: 0.005, max: 4,    step: 0.001, curve: "exp" },
  { path: "ampEnv.sustain",     label: "Amp S",      min: 0,    max: 1,     step: 0.01 },
  { path: "ampEnv.release",     label: "Amp R",      min: 0.005, max: 6,    step: 0.001, curve: "exp" },
  { path: "filterEnv.attack",   label: "Flt A",      min: 0.001, max: 4,    step: 0.001, curve: "exp" },
  { path: "filterEnv.decay",    label: "Flt D",      min: 0.005, max: 4,    step: 0.001, curve: "exp" },
  { path: "filterEnv.sustain",  label: "Flt S",      min: 0,    max: 1,     step: 0.01 },
  { path: "filterEnv.release",  label: "Flt R",      min: 0.005, max: 6,    step: 0.001, curve: "exp" },
  { path: "osc2.coarse",        label: "Osc2 Semi",  min: -24,  max: 24,    step: 1 },
  { path: "osc2.level",         label: "Osc2 Lvl",   min: 0,    max: 1,     step: 0.01 },
  { path: "fx.delaySend",       label: "Delay",      min: 0,    max: 1,     step: 0.01 },
  { path: "fx.verbSend",        label: "Reverb",     min: 0,    max: 1,     step: 0.01 },
  { path: "fx.crushMix",        label: "Crush",      min: 0,    max: 1,     step: 0.01 },
  { path: "master.level",       label: "Master",     min: 0,    max: 1,     step: 0.01 },
];

const WAVES = ["sine", "triangle", "sawtooth", "square", "pulse", "wave"];
const FILTERS = ["lowpass", "highpass", "bandpass", "notch"];
const MODES = ["poly", "mono", "unison"];

const flatDefault = (path) => {
  const [mod, key] = path.split(".");
  return DEFAULTS[mod][key];
};

export default function SynthRoute() {
  const { engineRef, start } = useSynth();
  const [running, setRunning] = useState(false);
  const [values, setValues] = useState(() => {
    const v = {};
    for (const [mod, group] of Object.entries(DEFAULTS))
      for (const [key, val] of Object.entries(group)) v[`${mod}.${key}`] = val;
    return v;
  });
  const [presetName, setPresetName] = useState("Init");
  const pending = useRef({});

  // Params touched before the context exists are replayed once it does.
  const write = useCallback((path, value) => {
    setValues((v) => ({ ...v, [path]: value }));
    const [mod, key] = path.split(".");
    const engine = engineRef.current;
    if (engine) engine.setParam(mod, key, value);
    else pending.current[path] = value;
  }, [engineRef]);

  const power = useCallback(async () => {
    const engine = await start();
    for (const [path, value] of Object.entries(pending.current)) {
      const [mod, key] = path.split(".");
      engine.setParam(mod, key, value);
    }
    pending.current = {};
    setRunning(true);
    return engine;
  }, [start]);

  const loadPreset = useCallback(async (preset, name) => {
    const engine = await power();
    const resolved = applyPresetToEngine(engine, preset);
    setValues(resolved.params);
    setPresetName(name);
  }, [power]);

  const noteOn = useCallback(async (note, velocity) => {
    const engine = engineRef.current ?? (await power());
    engine.noteOn(note, velocity);
  }, [engineRef, power]);

  const noteOff = useCallback((note) => {
    engineRef.current?.noteOff(note);
  }, [engineRef]);

  return (
    <div className="sy">
      <header className="sy-hdr">
        <div>
          <h1>Workbench <i>Voice</i></h1>
          <div className="sy-sub">engine regression harness · #/synth</div>
        </div>
        <div className="sy-hc">
          <button className={running ? "on" : ""} onClick={power}>
            {running ? "running" : "power"}
          </button>
          <button onClick={() => engineRef.current?.panic()}>panic</button>
          <a href="#/" className="sy-back">← workbench</a>
        </div>
      </header>

      <div className="sy-row">
        <label>
          preset
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "init") loadPreset({}, "Init");
              else if (FACTORY[v]) loadPreset(FACTORY[v], v);
            }}
          >
            <option value="">— {presetName} —</option>
            <option value="init">Init</option>
            {Object.keys(FACTORY).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button onClick={() => loadPreset(randomPreset(), "Random")}>randomise</button>

        <label>
          osc1
          <select value={values["osc1.waveform"]} onChange={(e) => write("osc1.waveform", e.target.value)}>
            {WAVES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label>
          osc2
          <select value={values["osc2.waveform"]} onChange={(e) => write("osc2.waveform", e.target.value)}>
            {WAVES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label>
          filter
          <select value={values["filter.type"]} onChange={(e) => write("filter.type", e.target.value)}>
            {FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label>
          mode
          <select value={values["perf.mode"]} onChange={(e) => write("perf.mode", e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      <div className="sy-grid">
        {SLIDERS.map((s) => {
          const value = values[s.path] ?? flatDefault(s.path);
          return (
            <label key={s.path} className="sy-slider">
              <span className="sy-lbl">{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={value}
                onChange={(e) => write(s.path, Number(e.target.value))}
              />
              <span className="sy-val">
                {typeof value === "number" ? (value >= 100 ? Math.round(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")) : value}
              </span>
            </label>
          );
        })}
      </div>

      <SynthKeyboard onNoteOn={noteOn} onNoteOff={noteOff} />
    </div>
  );
}
