/* Port of the Contour module (reference/web-synth-v11.html lines 663–677):
   three ADSR banks (filter/amp/aux envelopes), each paired with its own
   <EnvGraph>. Module-index text ("2 × adsr") is kept verbatim even though
   three envelopes are shown — that's what the reference itself says.

   Fixed contract: <Contour values write /> */

import Knob from '../Knob.jsx';
import EnvGraph from '../scopes/EnvGraph.jsx';
import { BANKS } from '../params.js';

function TightBank({ id, values, write }) {
  return (
    <div className="bank tight" id={id}>
      {BANKS[id].map(path => (
        <Knob key={path} path={path} value={values[path]} onChange={v => write(path, v)} />
      ))}
    </div>
  );
}

function envValues(values, prefix) {
  return {
    attack: values[`${prefix}.attack`],
    decay: values[`${prefix}.decay`],
    sustain: values[`${prefix}.sustain`],
    release: values[`${prefix}.release`],
  };
}

export default function Contour({ values, write }) {
  return (
    <section className="module m-contour">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Contour</h2>
        <span className="module-index">2 × adsr</span>
      </div>

      <div className="sub">Filter envelope</div>
      <TightBank id="bankFilterEnv" values={values} write={write} />
      <EnvGraph prefix="filterEnv" values={envValues(values, 'filterEnv')} />

      <div className="sub">Amplitude envelope</div>
      <TightBank id="bankAmpEnv" values={values} write={write} />
      <EnvGraph prefix="ampEnv" values={envValues(values, 'ampEnv')} />

      <div className="sub">Aux envelope · mod source</div>
      <TightBank id="bankAuxEnv" values={values} write={write} />
      <EnvGraph prefix="auxEnv" values={envValues(values, 'auxEnv')} />
    </section>
  );
}
