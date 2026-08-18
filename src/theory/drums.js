// Drum kit definitions + preset patterns.
//
// Patterns are NOT a fixed length — they're a flat array sized to the
// current `drumSteps` setting (16, 32, or 64). Each cell stores either:
//   • false / 0   — silent
//   • true        — hit at default velocity (legacy presets)
//   • 0.1 – 1.0   — hit at that velocity (per-step velocity edits)
//
// The pattern repeats every chord. With 16 steps that's one bar of
// sixteenths; with 32 it's two bars (so you can write a longer pattern
// with a fill on bar 2); with 64 it's four bars (bar-line fills, etc.).
//
// Adding a new preset is just data — the kit `pattern` callback receives
// the chosen step count and returns a fully-populated row map. Most kits
// build the base groove for one bar (16 steps) and then layer fills onto
// the longer step counts so the second / fourth bars feel alive.

export const DRUMS = [
  { key: "kick",       label: "Kick",   short: "K"  },
  { key: "snare",      label: "Snare",  short: "S"  },
  { key: "clap",       label: "Clap",   short: "C"  },
  { key: "hatClosed",  label: "Hat",    short: "H"  },
  { key: "hatOpen",    label: "OpenHat",short: "OH" },
];

// Step-count options. 16 = one bar of sixteenths, 32 = two bars, 64 = four.
export const DRUM_STEP_LIST = [
  { v: 16, l: "16"  },
  { v: 32, l: "32"  },
  { v: 64, l: "64"  },
];
// Default step count when the app boots / kit changes.
export const DRUM_STEPS = 16;

const empty = (steps) => Array(steps).fill(false);

const blankRows = (steps) => ({
  kick: empty(steps), snare: empty(steps), clap: empty(steps),
  hatClosed: empty(steps), hatOpen: empty(steps),
});

// Place hits at given indices. Out-of-range indices are silently dropped
// so kit definitions can describe "always at step 28" without worrying
// whether the user picked a 16-step grid (where 28 doesn't exist).
const hits = (steps, ...idx) => {
  const a = empty(steps);
  idx.forEach(i => { if (i >= 0 && i < steps) a[i] = true; });
  return a;
};

// ---- Fills helpers ------------------------------------------------------
// `fill(steps, builderFn)` walks each 16-step bar and lets the builder
// decide whether/what to add. `bar` is 0-indexed (0 = first bar).

function withFills(baseRow, steps, builder) {
  const out = [...baseRow];
  const bars = Math.floor(steps / 16);
  for (let b = 0; b < bars; b++) {
    const offset = b * 16;
    builder(out, b, offset);
  }
  return out;
}

// Common fill: snare roll across the last 4 sixteenths of a given bar.
const lastBarSnareRoll = (row, bar, off, every = 1) => {
  for (let i = 12; i < 16; i += every) row[off + i] = true;
};
const lastBarKickPickup = (row, bar, off) => {
  row[off + 14] = true; row[off + 15] = true;
};
const lastBarHatOpen = (row, bar, off) => {
  row[off + 14] = true;
};

// ---- Kits ---------------------------------------------------------------
// Each kit is a function (steps) → { kick, snare, clap, hatClosed, hatOpen }.
// All kits anchor a 16-step base and lay extra material onto bars 2/4 if
// the user opted for a longer grid.

// House: four-on-the-floor with a snare roll on the last bar of a 32/64.
const HOUSE = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 4, 8, 12].forEach(i => k[off + i] = true);
    [4, 12].forEach(i => c[off + i] = true);
    [2, 6, 10, 14].forEach(i => h[off + i] = true);
  }
  // Last-bar fill: snare ghosts on the &-of-3 and &-of-4
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    s[off + 10] = 0.6; s[off + 14] = 0.7;
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Techno: kick every beat, hat-open offbeats, percussive accents.
const TECHNO = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 4, 8, 12].forEach(i => k[off + i] = true);
    [2, 6, 10, 14].forEach(i => o[off + i] = true);
  }
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    [0, 2, 4, 6, 8, 10, 12, 13, 14, 15].forEach(i => h[off + i] = i >= 12 ? 1 : 0.55);
    o[off + 14] = false;
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Boom-bap: 90s hip-hop. Slightly swung feel via hat ghosts.
const BOOMBAP = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 6, 10].forEach(i => k[off + i] = true);
    [4, 12].forEach(i => s[off + i] = true);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => h[off + i] = i % 4 === 2 ? 0.5 : 0.85);
  }
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    s[off + 14] = 0.7; s[off + 15] = 0.9;
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Trap: rolling 32nd-feel hats, sparse kick. Best at ≥32 steps.
const TRAP = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 7, 10].forEach(i => k[off + i] = true);
    [4, 12].forEach(i => c[off + i] = true);
    // 32nd-style stutters on hats: every step plus extras on the last 4
    [0, 2, 4, 6, 8, 10, 12, 13, 14, 15].forEach(i => {
      h[off + i] = i >= 12 ? 1 : 0.7;
    });
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Breakbeat: amen-lite with snare ghosts.
const BREAK = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 6, 10].forEach(i => k[off + i] = true);
    [4, 12, 14].forEach(i => s[off + i] = i === 14 ? 0.7 : true);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => h[off + i] = true);
  }
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    [11, 12, 13, 14, 15].forEach(i => s[off + i] = 0.65 + (i - 11) * 0.08);
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Drum & Bass: classic 2-step (kick on 1, snare on 9) at 170-ish BPM feel.
// Typically you'd run this at much higher BPM than the rest. Best at ≥32.
const DNB = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    k[off + 0] = true; k[off + 10] = true;
    s[off + 4] = true; s[off + 12] = true;
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => h[off + i] = 0.7);
    o[off + 14] = 0.65;
  }
  // Bar-2 / bar-4 fill: snare-led break.
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    [11, 12, 13, 14, 15].forEach((i, j) => s[off + i] = 0.55 + j * 0.1);
    [11, 13, 15].forEach(i => k[off + i] = false);
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// IDM: glitchy, syncopated. Lots of small ghost notes.
const IDM = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 5, 9, 11].forEach(i => k[off + i] = i === 0 ? true : 0.7);
    [4, 7, 12, 14].forEach((i, j) => s[off + i] = j === 0 || j === 2 ? true : 0.55);
    [1, 3, 5, 7, 9, 11, 13, 15].forEach((i, j) => h[off + i] = j % 2 === 0 ? 0.55 : 0.85);
  }
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    // Stutter the last beat
    [12, 13, 14, 15].forEach((i, j) => k[off + i] = 0.5 + j * 0.15);
    o[off + 14] = 0.5;
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Latin: tumbao-inspired pattern with clave-feel snare/clap.
const LATIN = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 6, 10].forEach(i => k[off + i] = true);
    // 3-2 son clave on clap: 0, 3, 6 / 10, 12
    [0, 3, 6, 10, 12].forEach(i => c[off + i] = i === 0 ? true : 0.7);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => h[off + i] = 0.65);
    o[off + 8] = 0.6; o[off + 14] = 0.55;
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Hip-hop: modern trap-adjacent, swing-friendly.
const HIPHOP = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 7, 10].forEach(i => k[off + i] = true);
    [4, 12].forEach(i => s[off + i] = true);
    [4, 12].forEach(i => c[off + i] = 0.6);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach(i => h[off + i] = 0.85);
  }
  if (steps >= 32) {
    const off = (Math.floor(steps / 16) - 1) * 16;
    s[off + 14] = 0.7; s[off + 15] = 0.85;
    [13, 14, 15].forEach(i => h[off + i] = i === 15 ? 0.5 : 0.7);
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

// Sparse / dub: very minimal — kick on 1 + 9, light hats.
const DUB = (steps) => {
  const k = empty(steps), s = empty(steps), c = empty(steps), h = empty(steps), o = empty(steps);
  for (let b = 0; b < Math.max(1, Math.floor(steps / 16)); b++) {
    const off = b * 16;
    [0, 8].forEach(i => k[off + i] = true);
    [4, 12].forEach(i => c[off + i] = true);
    [2, 10].forEach(i => h[off + i] = 0.7);
    [6, 14].forEach(i => o[off + i] = 0.65);
  }
  return { kick: k, snare: s, clap: c, hatClosed: h, hatOpen: o };
};

export const DRUM_KITS = {
  empty:   { label: "Empty",     build: blankRows },
  house:   { label: "House",     build: HOUSE     },
  techno:  { label: "Techno",    build: TECHNO    },
  boombap: { label: "Boom-bap",  build: BOOMBAP   },
  trap:    { label: "Trap",      build: TRAP      },
  break:   { label: "Break",     build: BREAK     },
  dnb:     { label: "DnB",       build: DNB       },
  idm:     { label: "IDM",       build: IDM       },
  latin:   { label: "Latin",     build: LATIN     },
  hiphop:  { label: "Hip-Hop",   build: HIPHOP    },
  dub:     { label: "Dub",       build: DUB       },
};

export const DRUM_KIT_LIST = Object.entries(DRUM_KITS).map(([key, { label }]) => ({ v: key, l: label }));

// Build a fresh blank pattern at the given step count.
export function emptyDrumPattern(steps = DRUM_STEPS) { return blankRows(steps); }

// Clone a kit's pattern at the given step count.
export function loadKit(kitKey, steps = DRUM_STEPS) {
  const kit = DRUM_KITS[kitKey] || DRUM_KITS.empty;
  return kit.build(steps);
}

// Resize an existing pattern to a new step count. Doubles the existing row
// when growing (so a 16 → 32 keeps the original groove and adds a copy);
// truncates when shrinking. Pure data shuffle — no music logic.
export function resizeDrumPattern(pat, oldSteps, newSteps) {
  if (!pat) return emptyDrumPattern(newSteps);
  const out = {};
  for (const drum of DRUMS.map(d => d.key)) {
    const row = pat[drum] || empty(oldSteps);
    if (newSteps > oldSteps) {
      // Tile the old row up to newSteps.
      const next = empty(newSteps);
      for (let i = 0; i < newSteps; i++) next[i] = row[i % row.length];
      out[drum] = next;
    } else {
      out[drum] = row.slice(0, newSteps);
    }
  }
  return out;
}
