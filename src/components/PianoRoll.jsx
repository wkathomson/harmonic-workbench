import { NOTE_NAMES } from "../theory/constants.js";

// Two-octave visual roll (C → C two octaves up) with tri-tier colouring:
//   chord tones > scale tones > out-of-scale.
// Two octaves so 7th and 9th chord voicings — which routinely span more than
// 12 semitones — are fully visible.
// Props:
//   scaleNotes — pitch-class array of current scale
//   chord       — currently-selected chord object (with .pitchClasses, .source, .isPreview, .inScale)
//   octShift    — integer shift applied to the base octave (C3 + octShift)
//   onClick     — (midi) => void, plays a preview of the clicked note
export default function PianoRoll({ scaleNotes, chord, octShift, onClick }) {
  const baseOct = 3 + octShift;
  const startMidi = 12 * (baseOct + 1);
  // 25 = two octaves of 12 semitones plus the closing C.
  const numKeys = 25;
  const whitePattern = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];

  // Index of white keys in the 13-key span → used to position evenly.
  const whiteIdx = [];
  for (let i = 0; i < numKeys; i++) {
    if (whitePattern[(startMidi + i) % 12]) whiteIdx.push(i);
  }
  const ww = 100 / whiteIdx.length;
  const bw = ww * 0.62;

  // Match the chord's ACTUAL midi notes (not pitch classes) so a chord that
  // sits in one octave doesn't ghost-highlight the same letters in the other
  // octave. The visible range still covers two octaves so 7th / 9th voicings
  // can spill upward without falling off the top.
  const chordMidis = new Set(chord ? chord.midiNotes : []);
  const isBorrowed = chord?.source === "borrowed";
  const isPreview = chord?.isPreview;
  const previewInScale = chord?.inScale;

  // Classify a midi key → css classes.
  const keyClass = (m) => {
    const pc = m % 12;
    const isWhite = whitePattern[pc];
    let c = "hw-pk " + (isWhite ? "wh" : "bl");
    if (chord && chordMidis.has(m)) {
      c += " ct";
      if (isPreview) c += previewInScale ? " pi" : " po";
      else if (isBorrowed) c += " bw";
    } else if (scaleNotes.includes(pc)) {
      c += " is";
    }
    return c;
  };

  // Layout: whites first (absolute-positioned by index), then blacks on top.
  const whites = [];
  const blacks = [];
  let wi = 0;
  for (let i = 0; i < numKeys; i++) {
    const m = startMidi + i;
    const pc = m % 12;
    if (whitePattern[pc]) {
      whites.push(
        <div
          key={"w" + m}
          className={keyClass(m)}
          style={{ left: wi * ww + "%", width: ww + "%" }}
          onClick={() => onClick(m)}
        >
          {NOTE_NAMES[pc]}<span className="hw-pk-oct">{pc === 0 ? Math.floor(m / 12) - 1 : ""}</span>
        </div>
      );
      wi++;
    }
  }
  let w2 = 0;
  for (let i = 0; i < numKeys; i++) {
    const m = startMidi + i;
    const pc = m % 12;
    if (whitePattern[pc]) { w2++; continue; }
    blacks.push(
      <div
        key={"b" + m}
        className={keyClass(m)}
        style={{ left: (w2 * ww - bw / 2) + "%", width: bw + "%" }}
        onClick={() => onClick(m)}
      >
        {NOTE_NAMES[pc]}
      </div>
    );
  }

  return <div className="hw-pi">{whites}{blacks}</div>;
}
