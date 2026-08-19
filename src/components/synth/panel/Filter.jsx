/* Port of the Filter module (reference/web-synth-v11.html lines 643–661).

   The filter response screen is not here: as in the reference it lives in
   the `.instruments-row` at the foot of the panel, next to the scope
   (reference lines 734–741), and SynthPanel renders it there.

   Fixed contract: <Filter values write /> */

import Switch from '../Switch.jsx';
import Knob from '../Knob.jsx';
import DriveWindow from '../scopes/DriveWindow.jsx';
import { BANKS, FILTER_TYPES } from '../params.js';

function Bank({ id, values, write }) {
  return (
    <div className="bank" id={id}>
      {BANKS[id].map(path => (
        <Knob key={path} path={path} value={values[path]} onChange={v => write(path, v)} />
      ))}
    </div>
  );
}

export default function Filter({ values, write }) {
  return (
    <section className="module m-filter">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Filter</h2>
        <span className="module-index">drive → 12 dB biquad</span>
      </div>
      <div className="selector">
        <span className="selector-legend">Response</span>
        <Switch
          options={FILTER_TYPES}
          value={values['filter.type']}
          onChange={v => write('filter.type', v)}
          label="Filter type"
        />
      </div>
      <Bank id="bankFilter" values={values} write={write} />
      <div className="sub">Tracking</div>
      <Bank id="bankTracking" values={values} write={write} />
      <div className="sub">Drive · pre-filter</div>
      <Bank id="bankDrive" values={values} write={write} />
      <DriveWindow amount={values['filter.drive']} />
    </section>
  );
}
