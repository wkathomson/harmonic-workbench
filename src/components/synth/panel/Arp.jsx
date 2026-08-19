/* Port of the Arpeggiator module (reference/web-synth-v11.html lines
   614–638) plus the arp-toggle button behaviour (lines 3716–3725):
   aria-pressed and the button text both track whether the arp is on.

   The reference keeps arpEnabled as a bare runtime flag, not a `state`/
   `shadow` param — this fixed contract folds it into `values['arp.enabled']`
   like every other control, written through the same `write()`.

   Fixed contract: <Arp values write /> */

import Switch from '../Switch.jsx';
import Knob from '../Knob.jsx';
import { BANKS, ARP_MODES } from '../params.js';

function Bank({ id, values, write }) {
  return (
    <div className="bank" id={id}>
      {BANKS[id].map(path => (
        <Knob key={path} path={path} value={values[path]} onChange={v => write(path, v)} />
      ))}
    </div>
  );
}

export default function Arp({ values, write }) {
  const enabled = !!values['arp.enabled'];
  return (
    <section className="module m-mod" id="modArp">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Arpeggiator</h2>
        <span className="module-index">lookahead scheduler · follows tempo · pairs with Latch</span>
      </div>
      <div className="fx-grid">
        <div className="subpanel">
          <h3>Engage</h3>
          <div className="selector">
            <Switch
              options={ARP_MODES}
              value={values['arp.mode']}
              onChange={v => write('arp.mode', v)}
              label="Arp mode"
            />
          </div>
          <div className="selector">
            <button
              className="pbtn"
              type="button"
              id="arpBtn"
              aria-pressed={enabled}
              onClick={() => write('arp.enabled', !enabled)}
            >
              {enabled ? 'Arp on' : 'Arp off'}
            </button>
          </div>
        </div>
        <div className="subpanel">
          <h3>Timing</h3>
          <Bank id="bankArp" values={values} write={write} />
        </div>
        <div className="subpanel">
          <h3>Stereo</h3>
          <Bank id="bankSpread" values={values} write={write} />
        </div>
      </div>
    </section>
  );
}
