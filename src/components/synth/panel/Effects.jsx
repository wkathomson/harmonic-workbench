/* Port of the Effects module (reference/web-synth-v11.html lines 707–735).

   Delay-time disable rule: `fx.delaySync` (params.js, SYNC_DIVS_UI) is
   "off" only at index 0 — any other value means the delay follows tempo
   and updateDelayTime() (reference lines 1777–1782) ignores the manual
   `fx.delayTime` knob outright. The reference never actually greys that
   knob out visually (its dataset.inactive pattern is only used for the
   oscillator pw/morph pair and the voice-mode knobs), but since the knob
   would otherwise sit there doing nothing while synced, this reproduces
   the *behavioural* rule as a visual one too: disabled whenever
   `fx.delaySync !== 0`.

   The bitcrush "worklet: …" line (reference's `crushRead`, updated from
   `engine.crusherActive` once the worklet loads) has no equivalent in
   this fixed contract — Effects only gets `values`/`write`, no live
   engine status — so it stays at the reference's pre-power-on text.

   Fixed contract: <Effects values write /> */

import Knob from '../Knob.jsx';
import { BANKS } from '../params.js';

function Bank({ id, values, write, disabledMap }) {
  return (
    <div className="bank" id={id}>
      {BANKS[id].map(path => (
        <Knob
          key={path}
          path={path}
          value={values[path]}
          onChange={v => write(path, v)}
          disabled={disabledMap?.[path]}
        />
      ))}
    </div>
  );
}

export default function Effects({ values, write, crusherActive }) {
  return (
    <section className="module m-fx" id="modFx">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Effects</h2>
        <span className="module-index">bitcrush insert → delay + reverb sends → limiter</span>
      </div>
      <div className="fx-grid">
        <div className="subpanel">
          <h3>Bitcrush · insert</h3>
          <div className="sub">{crusherActive === undefined
            ? 'worklet: loads at power on'
            : crusherActive ? 'worklet: active' : 'worklet: unavailable — bypassed'}</div>
          <Bank id="bankCrush" values={values} write={write} />
        </div>
        <div className="subpanel">
          <h3>Delay · send</h3>
          <Bank
            id="bankDelay"
            values={values}
            write={write}
            disabledMap={{ 'fx.delayTime': values['fx.delaySync'] !== 0 }}
          />
        </div>
        <div className="subpanel">
          <h3>Chorus · send</h3>
          <Bank id="bankChorus" values={values} write={write} />
        </div>
        <div className="subpanel">
          <h3>Reverb · send</h3>
          <Bank id="bankVerb" values={values} write={write} />
        </div>
      </div>
    </section>
  );
}
