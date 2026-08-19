/* Port of the Matrix module (reference/web-synth-v11.html lines 604–611)
   and the mod-matrix slot wiring (lines 2617–2665: MOD_SOURCES, MOD_DESTS,
   makeSelect, the four uiSlots.forEach rows and their refreshOff rule).

   The option lists are ported verbatim. STATIC_SOURCES/STATIC_OK_DESTS
   (reference lines 2620–2621) are declared there too but never consulted
   by anything in the UI layer — the destination <select> always offers
   the full MOD_DESTS list regardless of the chosen source — so this skips
   them rather than inventing a filtering rule the reference doesn't have.

   Greying rule (reference's `refreshOff`): a slot is dimmed
   (`data-off="true"`, `.mslot[data-off="true"]{opacity:.55}` in panel.css)
   when its source OR its destination is "off".

   Fixed contract: <Matrix values write slots onSlotChange /> */

import Knob from '../Knob.jsx';

const MOD_SOURCES = [
  ['off', '—'], ['lfo1', 'LFO 1'], ['lfo2', 'LFO 2'], ['aux', 'Aux env'],
  ['wheel', 'Mod wheel'], ['velocity', 'Velocity'], ['keytrack', 'Keytrack'],
];
const MOD_DESTS = [
  ['off', '—'], ['pitch', 'Pitch (both)'], ['pitchf', 'Pitch fine ±50ct'],
  ['pitch1', 'Pitch 1'], ['pitch2', 'Pitch 2'],
  ['pw', 'Pulse width'], ['fm', 'FM depth'], ['cutoff', 'Cutoff'], ['res', 'Resonance'],
  ['trem', 'Tremolo'], ['mix2', 'Osc 2 level'], ['noise', 'Noise level'],
  ['lfo1rate', 'LFO 1 rate'],
  ['fenv', 'F.env amount ·note-on'], ['adec', 'Amp decay ·note-on'], ['asus', 'Amp sustain ·note-on'],
];

function Select({ options, value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {options.map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}

export default function Matrix({ values, write, slots, onSlotChange }) {
  return (
    <section className="module m-mod" id="modMatrix">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Matrix</h2>
        <span className="module-index">4 slots · source → destination · bipolar</span>
      </div>
      <div className="matrix" id="matrix">
        {slots.map((slot, i) => {
          const off = slot.source === 'off' || slot.destination === 'off';
          const path = `slot${i}.amount`;
          return (
            <div className="mslot" key={i} data-off={off ? 'true' : undefined}>
              <Select
                options={MOD_SOURCES}
                value={slot.source}
                onChange={v => onSlotChange(i, 'source', v)}
              />
              <span className="arrow">→</span>
              <Select
                options={MOD_DESTS}
                value={slot.destination}
                onChange={v => onSlotChange(i, 'destination', v)}
              />
              <Knob path={path} value={values[path]} onChange={v => write(path, v)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
