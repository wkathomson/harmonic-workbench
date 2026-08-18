// Note names and musical data constants

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Scale intervals and diatonic chord qualities per degree
// `par` = parallel mode used to derive borrowed chords
export const SCALES = {
  major:         { name: "Major (Ionian)", iv: [0, 2, 4, 5, 7, 9, 11],  cq: ["maj","min","min","maj","maj","min","dim"], par: "minor" },
  minor:         { name: "Natural Minor",   iv: [0, 2, 3, 5, 7, 8, 10],  cq: ["min","dim","maj","min","min","maj","maj"], par: "major" },
  dorian:        { name: "Dorian",          iv: [0, 2, 3, 5, 7, 9, 10],  cq: ["min","min","maj","maj","min","dim","maj"], par: "mixolydian" },
  phrygian:      { name: "Phrygian",        iv: [0, 1, 3, 5, 7, 8, 10],  cq: ["min","maj","maj","min","dim","maj","min"], par: "lydian" },
  lydian:        { name: "Lydian",          iv: [0, 2, 4, 6, 7, 9, 11],  cq: ["maj","maj","min","dim","maj","min","min"], par: "phrygian" },
  mixolydian:    { name: "Mixolydian",      iv: [0, 2, 4, 5, 7, 9, 10],  cq: ["maj","min","dim","maj","min","min","maj"], par: "dorian" },
  harmonicMinor: { name: "Harmonic Minor",  iv: [0, 2, 3, 5, 7, 8, 11],  cq: ["min","dim","aug","min","maj","maj","dim"], par: "major" },
  melodicMinor:  { name: "Melodic Minor",   iv: [0, 2, 3, 5, 7, 9, 11],  cq: ["min","min","aug","maj","maj","dim","dim"], par: "major" },
};

// Pentatonic scale intervals
export const PENTA = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
};

// Chord formulas by extension type and quality
export const CHORD_FORMULAS = {
  triad:   { maj: [0, 4, 7],    min: [0, 3, 7],    dim: [0, 3, 6],    aug: [0, 4, 8] },
  seventh: { maj: [0, 4, 7, 11], min: [0, 3, 7, 10], dim: [0, 3, 6, 9],  aug: [0, 4, 8, 11] },
  ninth:   { maj: [0, 4, 7, 11, 14], min: [0, 3, 7, 10, 14], dim: [0, 3, 6, 9, 13], aug: [0, 4, 8, 11, 14] },
};

// Chord symbol suffixes
export const CHORD_SUFFIX = {
  triad:   { maj: "",   min: "m",  dim: "°",  aug: "+" },
  seventh: { maj: "M7", min: "m7", dim: "°7", aug: "+M7" },
  ninth:   { maj: "M9", min: "m9", dim: "°9", aug: "+9" },
};

// Built-in progression suggestions per scale
export const PROGRESSIONS = {
  major:         [{ n: "Pop I–V–vi–IV", d: [0, 4, 5, 3] }, { n: "Jazz ii–V–I", d: [1, 4, 0] }, { n: "Cinematic I–iii–IV–vi", d: [0, 2, 3, 5] }],
  minor:         [{ n: "Andalusian i–VII–VI–V", d: [0, 6, 5, 4] }, { n: "House i–VI–VII–i", d: [0, 5, 6, 0] }, { n: "Epic i–VII–VI–VII", d: [0, 6, 5, 6] }],
  dorian:        [{ n: "Dorian vamp i–IV", d: [0, 3] }],
  phrygian:      [{ n: "Spanish i–♭II–♭III–i", d: [0, 1, 2, 0] }],
  lydian:        [{ n: "Lydian float I–II", d: [0, 1] }],
  mixolydian:    [{ n: "Rock I–♭VII–IV", d: [0, 6, 3] }],
  harmonicMinor: [{ n: "Classical i–iv–V–i", d: [0, 3, 4, 0] }],
  melodicMinor:  [{ n: "Jazz minor i–ii–V", d: [0, 1, 4] }],
};
