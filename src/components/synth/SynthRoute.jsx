// Standalone synthesiser route (#/synth).
//
// The regression harness for the extracted engine: it must sound identical to
// reference/web-synth-v11.html. It stays in the tree permanently — every later
// change to src/audio/ gets checked here before it reaches the Workbench UI.
//
// This route owns the displayed control values and routes every write to the
// right place: effect settings and master level to the shared mixer, everything
// else to the part. That routing is the whole point of the Phase 2 split, and
// it is what will let each Workbench part (bass, chords, melody) hold its own
// patch while sharing one set of effects.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSynth } from "./useSynth.js";
import SynthPanel from "./SynthPanel.jsx";
import SynthKeyboard from "./SynthKeyboard.jsx";
import { getAudioContext } from "../../audio/context.js";
import { DEFAULTS, DEFAULT_SLOTS, MIXER_PARAMS } from "../../audio/synth/constants.js";
import {
  FACTORY, randomPreset, splitPreset, applyPresetToPart, partState,
} from "../../audio/synth/presets.js";
import "./panel.css";
import "./synth.css";

const flatten = (defaults) => {
  const out = {};
  for (const [mod, group] of Object.entries(defaults))
    for (const [key, val] of Object.entries(group)) out[`${mod}.${key}`] = val;
  return out;
};

const initialValues = () => {
  const v = flatten(DEFAULTS);
  v["part.level"] = 1;
  v["part.pan"] = 0;
  v["arp.enabled"] = false;
  DEFAULT_SLOTS.forEach((s, i) => { v[`slot${i}.amount`] = s.amount; });
  return v;
};

export default function SynthRoute() {
  const { mixerRef, partRef, start } = useSynth();
  const [running, setRunning] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [slots, setSlots] = useState(() => DEFAULT_SLOTS.map((s) => ({ ...s })));
  const [presetName, setPresetName] = useState("Init");
  const [recording, setRecording] = useState(false);
  const [sampleRate, setSampleRate] = useState(null);

  // Values touched before the context exists are replayed once it does, so a
  // knob moved before power-on is not silently lost.
  const pending = useRef({});
  const pendingSlots = useRef(false);
  const abSlot = useRef({ slot: "A", other: null });
  const recorder = useRef(null);
  const fileInput = useRef(null);

  const power = useCallback(async () => {
    const { part, mixer } = await start();
    for (const [path, value] of Object.entries(pending.current)) {
      const [mod, key] = path.split(".");
      (MIXER_PARAMS.has(path) ? mixer : part).setParam(mod, key, value);
    }
    pending.current = {};
    if (pendingSlots.current) {
      slots.forEach((s, i) => part.setModSlot(i, s));
      pendingSlots.current = false;
    }
    setRunning(true);
    setSampleRate(getAudioContext()?.sampleRate ?? null);
    return { part, mixer };
  }, [start, slots]);

  // The one setter every control funnels through. Effect settings and master
  // level belong to the mix and go to the mixer; everything else — including
  // the send amounts — belongs to the patch and goes to the part.
  const write = useCallback((path, value) => {
    setValues((v) => ({ ...v, [path]: value }));

    if (path === "arp.enabled") {
      partRef.current?.setArpEnabled(value);
      return;
    }
    const [mod, key] = path.split(".");
    const target = MIXER_PARAMS.has(path) ? mixerRef.current : partRef.current;
    if (target) target.setParam(mod, key, value);
    else pending.current[path] = value;
  }, [mixerRef, partRef]);

  const onSlotChange = useCallback((i, field, value) => {
    setSlots((prev) => {
      const next = prev.map((s, j) => (j === i ? { ...s, [field]: value } : s));
      if (partRef.current) partRef.current.setModSlot(i, next[i]);
      else pendingSlots.current = true;
      return next;
    });
    if (field === "amount") setValues((v) => ({ ...v, [`slot${i}.amount`]: value }));
  }, [partRef]);

  const loadPreset = useCallback(async (preset, name) => {
    const { part, mixer } = await power();
    applyPresetToPart(part, mixer, preset);

    // Mirror the engine's resolved state back into the displayed values, so a
    // sparse preset file still leaves every control showing the truth.
    const split = splitPreset(preset);
    setValues((v) => {
      const next = { ...v, ...split.part.params, ...split.mixer.params };
      split.part.modSlots.forEach((s, i) => { next[`slot${i}.amount`] = s.amount; });
      return next;
    });
    setSlots(split.part.modSlots.map((s) => ({ ...s })));
    setPresetName(name);
  }, [power]);

  const savePatch = useCallback(() => {
    const patch = partRef.current
      ? partState(partRef.current, mixerRef.current, presetName)
      : { name: presetName, version: 2, params: values, modSlots: slots };
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${presetName.replace(/[^\w-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [partRef, mixerRef, presetName, values, slots]);

  const loadFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const preset = JSON.parse(await file.text());
      loadPreset(preset, preset.name || file.name.replace(/\.json$/i, ""));
    } catch {
      setPresetName("could not read that file");
    }
  }, [loadPreset]);

  // A/B: hold the other slot's patch and swap the two.
  const swapAB = useCallback(async () => {
    const { part, mixer } = await power();
    const current = partState(part, mixer, presetName);
    const incoming = abSlot.current.other ?? current;
    abSlot.current = {
      slot: abSlot.current.slot === "A" ? "B" : "A",
      other: current,
    };
    loadPreset(incoming, `${abSlot.current.slot}: ${incoming.name || "patch"}`);
  }, [power, presetName, loadPreset]);

  const copyAB = useCallback(async () => {
    const { part, mixer } = await power();
    abSlot.current.other = partState(part, mixer, presetName);
  }, [power, presetName]);

  const toggleRecord = useCallback(async () => {
    const { mixer } = await power();
    if (recorder.current) {
      recorder.current.stop();
      return;
    }
    const rec = new MediaRecorder(mixer.recStream);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `workbench-voice-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      recorder.current = null;
      setRecording(false);
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  }, [power]);

  useEffect(() => () => { recorder.current?.stop(); }, []);

  const noteOn = useCallback(async (note, velocity) => {
    const part = partRef.current ?? (await power()).part;
    part.noteOn(note, velocity);
  }, [partRef, power]);

  const noteOff = useCallback((note) => partRef.current?.noteOff(note), [partRef]);

  return (
    <div className="sy">
      <div className="instrument">
        <header className="masthead">
          <h1 className="wordmark">Workbench Voice</h1>
          <p className="subtitle">engine regression harness · #/synth</p>
          <button className="power" aria-pressed={running} onClick={power}>
            <span className="led" aria-hidden="true" />
            <span>{running ? "Running" : "Power on"}</span>
          </button>
        </header>

        <div className="preset-bar">
          <span className="preset-legend">Preset</span>
          <select
            className="preset-select"
            aria-label="Preset"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "init") loadPreset({}, "Init");
              else if (FACTORY[v]) loadPreset(FACTORY[v], v);
            }}
          >
            <option value="">—</option>
            <option value="init">Init</option>
            {Object.keys(FACTORY).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="pbtn" onClick={() => loadPreset({}, "Init")}>Init</button>
          <button className="pbtn" onClick={() => loadPreset(randomPreset(), "Random")}>Random</button>
          <button className="pbtn" onClick={savePatch}>Save file</button>
          <button className="pbtn" onClick={() => fileInput.current?.click()}>Load file</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button className="pbtn" onClick={copyAB} title="Copy current patch into the other slot">A→B</button>
          <button className="pbtn" onClick={swapAB}>A / B</button>
          <button className="pbtn" aria-pressed={recording} onClick={toggleRecord}>
            {recording ? "Stop" : "Record"}
          </button>
          <span className="preset-name">now: <b>{presetName}</b></span>
          <button className="pbtn" onClick={() => partRef.current?.panic()}>Panic</button>
          <a href="#/" className="sy-back">← workbench</a>
        </div>

        <SynthPanel
          values={values}
          write={write}
          slots={slots}
          onSlotChange={onSlotChange}
          getResponse={running ? partRef.current?.getFilterResponse : null}
          getVoiceStates={running ? partRef.current?.getVoiceStates : null}
          getScope={running ? mixerRef.current?.getScope : null}
          getSpectrum={running ? mixerRef.current?.getSpectrum : null}
          onPanic={() => partRef.current?.panic()}
          crusherActive={running ? partRef.current?.crusherActive : undefined}
          sampleRate={sampleRate}
          running={running}
        />

        <SynthKeyboard
          onNoteOn={noteOn}
          onNoteOff={noteOff}
          onModWheel={(v) => partRef.current?.setModWheel(v)}
        />
      </div>
    </div>
  );
}
