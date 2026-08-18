// Panel layout: the racks and modules of the reference instrument.
//
// Purely presentational. Every control reports through `write(path, value)`;
// the route decides whether that lands on the part or the shared mixer.

import Source from "./panel/Source.jsx";
import Lfos from "./panel/Lfos.jsx";
import Matrix from "./panel/Matrix.jsx";
import Arp from "./panel/Arp.jsx";
import Filter from "./panel/Filter.jsx";
import Contour from "./panel/Contour.jsx";
import Voicing from "./panel/Voicing.jsx";
import Effects from "./panel/Effects.jsx";

export default function SynthPanel({
  values, write, slots, onSlotChange,
  getResponse, getVoiceStates, running,
}) {
  return (
    <>
      <div className="rack rack-upper">
        <Source values={values} write={write} />
      </div>

      <div className="rack rack-mod">
        <Lfos values={values} write={write} />
        <Matrix values={values} write={write} slots={slots} onSlotChange={onSlotChange} />
      </div>

      <div className="rack rack-fx">
        <Arp values={values} write={write} />
      </div>

      <div className="rack rack-lower">
        <Filter values={values} write={write} getResponse={getResponse} running={running} />
        <Contour values={values} write={write} />
        <Voicing values={values} write={write} getVoiceStates={getVoiceStates} running={running} />
      </div>

      <div className="rack rack-fx">
        <Effects values={values} write={write} />
      </div>
    </>
  );
}
