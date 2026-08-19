/* Port of the LFO 1 / LFO 2 module markup (reference/web-synth-v11.html
   lines 573–602) — two separate `.module` sections, each with its own
   shape switch, <LfoWindow> preview and knob bank.

   No extra disable rule here: unlike the delay-time knob (see Effects.jsx),
   the reference never greys `lfo{n}.rate` when `lfo{n}.sync` is active —
   P['lfo1.sync']/P['lfo2.sync'].fmt (params.js) already reads the sync
   division off SYNC_DIVS_UI for the knob's own readout, which is all the
   reference does for sync.

   Fixed contract: <Lfos values write /> */

import Switch from '../Switch.jsx';
import Knob from '../Knob.jsx';
import LfoWindow from '../scopes/LfoWindow.jsx';
import { BANKS, LFO_SHAPES } from '../params.js';

function Bank({ id, values, write }) {
  return (
    <div className="bank" id={id}>
      {BANKS[id].map(path => (
        <Knob key={path} path={path} value={values[path]} onChange={v => write(path, v)} />
      ))}
    </div>
  );
}

function LfoModule({ n, values, write }) {
  const key = `lfo${n}`;
  return (
    <section className="module m-mod" id={`modLfo${n}`}>
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>LFO {n}</h2>
        <span className="module-index">global</span>
      </div>
      <div className="selector">
        <Switch
          options={LFO_SHAPES}
          value={values[`${key}.shape`]}
          onChange={v => write(`${key}.shape`, v)}
          label={`LFO ${n} shape`}
        />
      </div>
      <LfoWindow which={n} shape={values[`${key}.shape`]} />
      <Bank id={`bankLfo${n}`} values={values} write={write} />
    </section>
  );
}

export default function Lfos({ values, write }) {
  return (
    <>
      <LfoModule n={1} values={values} write={write} />
      <LfoModule n={2} values={values} write={write} />
    </>
  );
}
