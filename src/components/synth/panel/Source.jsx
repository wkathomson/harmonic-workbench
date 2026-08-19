/* Port of the Source module markup (reference/web-synth-v11.html lines
   526–570) plus updateOscUI() (line 2598): the pulse-width knob only
   applies to the Pulse waveform and the morph knob only to Wave, so each
   is disabled (data-inactive, same as the reference) unless its
   oscillator's waveform matches.

   Fixed contract: <Source values write /> */

import Switch from '../Switch.jsx';
import Knob from '../Knob.jsx';
import WaveWindow from '../scopes/WaveWindow.jsx';
import NoiseWindow from '../scopes/NoiseWindow.jsx';
import { BANKS, WAVES, NOISE_TYPES } from '../params.js';

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

export default function Source({ values, write }) {
  return (
    <section className="module m-source">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Source</h2>
        <span className="module-index">osc 1 · osc 2 · noise → mix bus → drive</span>
      </div>

      <div className="source-grid">
        <div className="subpanel">
          <h3>Oscillator 1</h3>
          <div className="selector">
            <Switch
              options={WAVES}
              value={values['osc1.waveform']}
              onChange={v => write('osc1.waveform', v)}
              label="Oscillator 1 waveform"
            />
          </div>
          <WaveWindow
            which={1}
            waveform={values['osc1.waveform']}
            morph={values['osc1.morph']}
            pw={values['osc1.pw']}
          />
          <Bank
            id="bankOsc1"
            values={values}
            write={write}
            disabledMap={{
              'osc1.pw': values['osc1.waveform'] !== 'pulse',
              'osc1.morph': values['osc1.waveform'] !== 'wave',
            }}
          />
        </div>

        <div className="subpanel">
          <h3>Oscillator 2</h3>
          <div className="selector">
            <Switch
              options={WAVES}
              value={values['osc2.waveform']}
              onChange={v => write('osc2.waveform', v)}
              label="Oscillator 2 waveform"
            />
          </div>
          <WaveWindow
            which={2}
            waveform={values['osc2.waveform']}
            morph={values['osc2.morph']}
            pw={values['osc2.pw']}
          />
          <Bank
            id="bankOsc2"
            values={values}
            write={write}
            disabledMap={{
              'osc2.pw': values['osc2.waveform'] !== 'pulse',
              'osc2.morph': values['osc2.waveform'] !== 'wave',
            }}
          />
        </div>

        <div className="subpanel">
          <h3>Noise</h3>
          <div className="selector">
            <Switch
              options={NOISE_TYPES}
              value={values['noise.type']}
              onChange={v => write('noise.type', v)}
              label="Noise type"
            />
          </div>
          <NoiseWindow type={values['noise.type']} />
          <Bank id="bankNoise" values={values} write={write} />
        </div>
      </div>
    </section>
  );
}
