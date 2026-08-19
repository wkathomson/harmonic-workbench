/* Port of the Voicing module (reference/web-synth-v11.html lines 679–704)
   plus updateModeUI() (ref ~2674): which voice/glide/unison knobs apply
   depends on perf.mode —

     voice.count    enabled only in poly   (a mono/unison patch has one
                                             voice-count-worth of oscillators
                                             stacked, not a pool to size)
     perf.glide     enabled outside poly   (glide is meaningless with
                                             overlapping poly voices)
     perf.uniVoices enabled only in unison
     perf.uniDetune enabled only in unison

   The "All notes off" panic button is part of the reference markup this
   module ports (line 701) and is reproduced for structural/CSS fidelity,
   but this fixed contract has no callback for it — Voicing only receives
   `values`/`write`/`getVoiceStates`/`running`, plus an onPanic callback
   supplied by the route, since panic needs direct
   engine access that a presentational component under this contract
   can't have (see the audio-architecture rules: no `src/audio/` access
   from here). It renders inert; the container wiring these modules to
   the engine needs to give it a real handler.

   Fixed contract: <Voicing values write getVoiceStates running /> */

import Switch from '../Switch.jsx';
import Knob from '../Knob.jsx';
import VoiceLeds from '../scopes/VoiceLeds.jsx';
import { BANKS, MODES, CURVES } from '../params.js';

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

export default function Voicing({ values, write, getVoiceStates, running, onPanic }) {
  const mode = values['perf.mode'];

  return (
    <section className="module m-output">
      <div className="module-head">
        <span className="stripe" aria-hidden="true" />
        <h2>Voicing</h2>
        <span className="module-index">pool of 8</span>
      </div>

      <div className="selector">
        <span className="selector-legend">Mode</span>
        <Switch
          options={MODES}
          value={mode}
          onChange={v => write('perf.mode', v)}
          label="Voice mode"
        />
      </div>

      <Bank
        id="bankVoice"
        values={values}
        write={write}
        disabledMap={{ 'voice.count': mode !== 'poly', 'perf.glide': mode === 'poly' }}
      />
      <Bank
        id="bankUnison"
        values={values}
        write={write}
        disabledMap={{
          'perf.uniVoices': mode !== 'unison',
          'perf.uniDetune': mode !== 'unison',
        }}
      />

      <VoiceLeds getVoiceStates={getVoiceStates} running={running} />

      <div className="selector">
        <span className="selector-legend">Envelope curve</span>
        <Switch
          options={CURVES}
          value={values['master.curve']}
          onChange={v => write('master.curve', v)}
          label="Envelope curve"
        />
      </div>
      <Bank id="bankOutput" values={values} write={write} />
      <button className="panic" type="button" onClick={onPanic}>All notes off</button>
    </section>
  );
}
