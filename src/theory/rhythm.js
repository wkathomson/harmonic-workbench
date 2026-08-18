// Rhythm generators and pattern utilities (acid bass, arp, euclidean, random).

// Classic Bjorklund-style euclidean rhythm spreading `hits` evenly across `steps`.
export function euclidean(hits, steps) {
  if (hits >= steps) return Array(steps).fill(true);
  if (hits <= 0) return Array(steps).fill(false);
  const p = [];
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += hits;
    if (bucket >= steps) { bucket -= steps; p.push(true); }
    else p.push(false);
  }
  return p;
}

export function randomRhythm(steps, density) {
  return Array(steps).fill(0).map(() => Math.random() < density);
}

// Note: the 303-style acid bass generator that used to live here moved to
// `./bass.js` so all bass patterns share one home.

// Rhythm masks for the arpeggiator. Each mask is a function that, given a
// step count, returns a boolean[steps] of which positions actually play.
// The arpeggiate() function then advances its note pointer ONLY on active
// steps so the line stays musical regardless of the rhythm.
//
// Patterns assume a 4-beat bar with `stepsPerBeat = steps / 4`.
const ARP_RHYTHMS = {
  // Every step plays — classic 16th-note arp.
  straight: (steps) => Array(steps).fill(true),

  // Long-short-short gallop. Step 1 of each beat plus &-of-each-beat.
  // ▮ . ▮ ▮  — anchor + two skipped + recovery. Driving feel.
  gallop: (steps) => {
    const sb = steps / 4;
    return Array.from({ length: steps }, (_, i) => {
      const inBeat = i % sb;
      // hits on positions 0, sb*0.5, sb*0.75 within each beat
      return inBeat < 0.5 || (inBeat >= sb * 0.5 - 0.5 && inBeat < sb * 0.5 + 0.5)
          || (inBeat >= sb * 0.75 - 0.5 && inBeat < sb * 0.75 + 0.5);
    });
  },

  // Dotted feel: long-short, repeating. Skip every fourth step so it lands
  // syncopated. ▮ . . ▮  ▮ . . ▮
  dotted: (steps) => {
    const sb = steps / 4;
    return Array.from({ length: steps }, (_, i) => {
      const inBeat = i % sb;
      return inBeat < 0.5 || inBeat >= sb * 0.75 - 0.5;
    });
  },

  // Sparse: every other step. Spacious, clear arp.
  sparse: (steps) => Array.from({ length: steps }, (_, i) => i % 2 === 0),

  // Triplet feel over a 4-beat bar — fits 3 hits where 4 would land. Works
  // best with 12-friendly step counts (12, 24); for 8/16/32 it approximates.
  triplet: (steps) => {
    const sb = steps / 4;
    return Array.from({ length: steps }, (_, i) => {
      const inBeat = i % sb;
      const t = inBeat / sb; // 0..1 within a beat
      // Three hits per beat at 0, 1/3, 2/3.
      return Math.min(
        Math.abs(t - 0),
        Math.abs(t - 1/3),
        Math.abs(t - 2/3),
      ) < 0.5 / sb;
    });
  },
};

export const ARP_RHYTHM_LIST = [
  { v: "straight", l: "Straight" },
  { v: "gallop",   l: "Gallop"   },
  { v: "dotted",   l: "Dotted"   },
  { v: "sparse",   l: "Sparse"   },
  { v: "triplet",  l: "Triplet"  },
];

// Arpeggiator — up, down, up-down, random — with optional rhythmic mask.
// `rhythm` defaults to "straight" (every step plays).
//
// The note pointer only advances on active steps so the resulting melodic
// shape is the same as a plain arp; only the timing changes.
export function arpeggiate(midiNotes, steps, mode = "up", rhythm = "straight") {
  const notes = [...midiNotes].sort((a, b) => a - b);
  if (!notes.length) return Array(steps).fill(null);

  const mask = (ARP_RHYTHMS[rhythm] || ARP_RHYTHMS.straight)(steps);

  // Build the underlying note sequence in arp order.
  const sourceLen = mode === "updown" ? Math.max(1, notes.length * 2 - 2) : notes.length;
  const sourceAt = (k) => {
    if (mode === "down") {
      return notes[notes.length - 1 - (k % notes.length)];
    }
    if (mode === "updown") {
      const ud = [...notes, ...[...notes].reverse().slice(1, -1)];
      return ud[k % ud.length];
    }
    if (mode === "random") {
      return notes[Math.floor(Math.random() * notes.length)];
    }
    return notes[k % notes.length]; // "up"
  };

  const seq = [];
  let p = 0;
  for (let i = 0; i < steps; i++) {
    if (!mask[i]) { seq.push(null); continue; }
    seq.push(sourceAt(p));
    p = (p + 1) % sourceLen;
  }
  return seq;
}
