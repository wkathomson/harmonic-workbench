// The Workbench's synth parts: one patch per track.
//
// A slot ("chord", "bass", "melody", "arp") can be handed over to the synth
// engine. When it is, the engine routes that track's notes to a createPart
// instead of its Tone voice — see engine._trigger. Switching a slot off hands
// it straight back, so the two engines can be mixed freely while a project is
// being built.
//
// Live control values live in a ref, not in state. A knob drag fires ~60
// pointermove events a second and this hook sits near the top of the app; if
// each one re-rendered the Workbench the reconciler would be competing with
// the audio thread. Writes go to the engine imperatively, and React only
// re-renders when something structural changes — a slot toggled, a patch
// loaded.
//
// Only one mixer is ever built, no matter how many slots are in use: delay,
// chorus, reverb and the limiter are shared, and each part carries how much
// it sends to them. That is what lets bass, chords and melody sound like
// three different instruments in one room.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ensureAudio } from "../../audio/context.js";
import { getAudioEngine, SYNTH_SLOTS } from "../../audio/engine.js";
import { createMixer } from "../../audio/synth/mixer.js";
import { createPart } from "../../audio/synth/part.js";
import { DEFAULTS, DEFAULT_SLOTS, MIXER_PARAMS } from "../../audio/synth/constants.js";
import { splitPreset, applyPresetToPart, partState } from "../../audio/synth/presets.js";

// Sized to the job rather than uniformly maximal: oscillator count multiplies
// out as parts × voices × 2 units × 2 oscillators.
const POOL_SIZE_FOR = { chord: 6, bass: 2, melody: 2, arp: 4 };

const flatDefaults = () => {
  const v = {};
  for (const [mod, group] of Object.entries(DEFAULTS))
    for (const [key, val] of Object.entries(group)) v[`${mod}.${key}`] = val;
  v["part.level"] = 1;
  v["part.pan"] = 0;
  v["arp.enabled"] = false;
  DEFAULT_SLOTS.forEach((s, i) => { v[`slot${i}.amount`] = s.amount; });
  return v;
};

const emptySlots = () =>
  Object.fromEntries(SYNTH_SLOTS.map((s) => [s, { on: false, name: "Init" }]));

export function useWorkbenchSynth() {
  const mixerRef = useRef(null);
  const partsRef = useRef({});
  const valuesRef = useRef(Object.fromEntries(SYNTH_SLOTS.map((s) => [s, flatDefaults()])));
  const modSlotsRef = useRef(
    Object.fromEntries(SYNTH_SLOTS.map((s) => [s, DEFAULT_SLOTS.map((x) => ({ ...x }))])),
  );
  const [slots, setSlots] = useState(emptySlots);

  // Knob edits land in refs, so nothing about them re-renders — which also
  // means nothing tells the project autosave that the patch changed. This
  // revision counter is that signal, bumped on a trailing debounce: one
  // re-render per pause in editing rather than one per pointermove.
  const [revision, bump] = useReducer((n) => n + 1, 0);
  const touchTimer = useRef(null);
  const touch = useCallback(() => {
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(bump, 1200);
  }, []);
  useEffect(() => () => clearTimeout(touchTimer.current), []);

  const ensureMixer = useCallback(async () => {
    if (!mixerRef.current) {
      const { ctx } = await ensureAudio();
      mixerRef.current = createMixer(ctx);
    }
    return mixerRef.current;
  }, []);

  // Build a slot's part on demand and hand the track over to it.
  const ensurePart = useCallback(async (slot) => {
    if (partsRef.current[slot]) return partsRef.current[slot];
    const mixer = await ensureMixer();
    const { ctx, crusherReady } = await ensureAudio();
    const part = createPart(ctx, mixer, {
      poolSize: POOL_SIZE_FOR[slot] ?? 4,
      crusherReady,
    });
    // Replay whatever the panel has already been showing for this slot, so a
    // patch edited before the part existed is not silently lost.
    for (const [path, value] of Object.entries(valuesRef.current[slot])) {
      if (path === "arp.enabled" || path.startsWith("slot")) continue;
      if (MIXER_PARAMS.has(path)) continue;
      const [mod, key] = path.split(".");
      part.setParam(mod, key, value);
    }
    modSlotsRef.current[slot].forEach((s, i) => part.setModSlot(i, s));
    partsRef.current[slot] = part;
    return part;
  }, [ensureMixer]);

  const setSlotEnabled = useCallback(async (slot, on) => {
    if (on) {
      const part = await ensurePart(slot);
      getAudioEngine().setSynthPart(slot, part);
    } else {
      partsRef.current[slot]?.panic();
      getAudioEngine().setSynthPart(slot, null);
    }
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], on } }));
  }, [ensurePart]);

  // The single setter every control goes through. Effect settings and master
  // level belong to the mix and are shared; everything else belongs to this
  // slot's patch.
  const write = useCallback((slot, path, value) => {
    valuesRef.current[slot][path] = value;

    if (path === "arp.enabled") {
      partsRef.current[slot]?.setArpEnabled(value);
      bump();
      return;
    }
    touch();
    const [mod, key] = path.split(".");
    if (MIXER_PARAMS.has(path)) {
      // One mix, so a change here applies to every slot's view of it.
      for (const s of SYNTH_SLOTS) valuesRef.current[s][path] = value;
      mixerRef.current?.setParam(mod, key, value);
    } else {
      partsRef.current[slot]?.setParam(mod, key, value);
    }
  }, []);

  const setModSlot = useCallback((slot, i, field, value) => {
    const next = modSlotsRef.current[slot].map((s, j) => (j === i ? { ...s, [field]: value } : s));
    modSlotsRef.current[slot] = next;
    partsRef.current[slot]?.setModSlot(i, next[i]);
    if (field === "amount") valuesRef.current[slot][`slot${i}.amount`] = value;
    bump();
  }, []);

  const loadPatch = useCallback(async (slot, preset, name) => {
    const mixer = await ensureMixer();
    const part = await ensurePart(slot);
    applyPresetToPart(part, mixer, preset);

    const split = splitPreset(preset);
    valuesRef.current[slot] = {
      ...valuesRef.current[slot],
      ...split.part.params,
      ...split.mixer.params,
    };
    split.part.modSlots.forEach((s, i) => {
      valuesRef.current[slot][`slot${i}.amount`] = s.amount;
    });
    modSlotsRef.current[slot] = split.part.modSlots.map((s) => ({ ...s }));
    // Mixer settings are shared, so every slot's view of them moves together.
    for (const s of SYNTH_SLOTS) {
      Object.assign(valuesRef.current[s], split.mixer.params);
    }
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], name } }));
  }, [ensureMixer, ensurePart]);

  const valuesFor = useCallback((slot) => valuesRef.current[slot], []);
  const modSlotsFor = useCallback((slot) => modSlotsRef.current[slot], []);
  const partFor = useCallback((slot) => partsRef.current[slot] ?? null, []);

  // ---- project persistence ------------------------------------------------

  // Patches travel in the project file: one per slot, plus the shared mix.
  const collect = useCallback(() => ({
    slots: Object.fromEntries(SYNTH_SLOTS.map((slot) => {
      const part = partsRef.current[slot];
      const patch = part
        ? partState(part, mixerRef.current, slots[slot]?.name ?? "Init")
        : {
            name: slots[slot]?.name ?? "Init",
            version: 2,
            params: { ...valuesRef.current[slot] },
            modSlots: modSlotsRef.current[slot].map((s) => ({ ...s })),
          };
      return [slot, { on: !!slots[slot]?.on, patch }];
    })),
  }), [slots]);

  const apply = useCallback(async (state) => {
    if (!state?.slots) return;
    for (const slot of SYNTH_SLOTS) {
      const saved = state.slots[slot];
      if (!saved) continue;
      if (saved.patch) {
        // A saved patch may predate the part it belongs to; loading builds it.
        if (saved.on || partsRef.current[slot]) {
          await loadPatch(slot, saved.patch, saved.patch.name ?? "Init");
        } else {
          const split = splitPreset(saved.patch);
          valuesRef.current[slot] = { ...valuesRef.current[slot], ...split.part.params };
          modSlotsRef.current[slot] = split.part.modSlots.map((s) => ({ ...s }));
          setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], name: saved.patch.name ?? "Init" } }));
        }
      }
      await setSlotEnabled(slot, !!saved.on);
    }
  }, [loadPatch, setSlotEnabled]);

  return {
    slots, revision, setSlotEnabled,
    write, setModSlot, loadPatch,
    valuesFor, modSlotsFor, partFor,
    mixerRef,
    collect, apply,
  };
}
