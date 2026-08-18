// Two-octave playable keyboard, using the reference build's keybed markup so
// the ported stylesheet dresses it without change.
//
// Pointer position within a key sets velocity (top = soft, bottom = hard).
// QWERTY rows play from the base octave; z / x shift it. Held notes live in a
// ref as well as state, so a re-render never re-triggers a sounding note.

import { useCallback, useEffect, useRef, useState } from "react";

const QWERTY = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17,
};

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function SynthKeyboard({ onNoteOn, onNoteOff, onModWheel }) {
  const [baseOctave, setBaseOctave] = useState(3);
  const [latch, setLatch] = useState(false);
  const [sounding, setSounding] = useState(() => new Set());
  const soundingRef = useRef(sounding);
  const latchRef = useRef(latch);
  const baseRef = useRef(baseOctave);
  const pointerNote = useRef(null);
  soundingRef.current = sounding;
  latchRef.current = latch;
  baseRef.current = baseOctave;

  const release = useCallback((note, force = false) => {
    if (latchRef.current && !force) return;
    if (!soundingRef.current.has(note)) return;
    const next = new Set(soundingRef.current);
    next.delete(note);
    soundingRef.current = next;
    setSounding(next);
    onNoteOff(note);
  }, [onNoteOff]);

  const press = useCallback((note, velocity = 0.85) => {
    if (latchRef.current && soundingRef.current.has(note)) {
      release(note, true);
      return;
    }
    if (soundingRef.current.has(note)) return;
    const next = new Set(soundingRef.current);
    next.add(note);
    soundingRef.current = next;
    setSounding(next);
    onNoteOn(note, velocity);
  }, [onNoteOn, release]);

  const releaseAll = useCallback(() => {
    [...soundingRef.current].forEach((n) => release(n, true));
  }, [release]);

  const shiftOctave = useCallback((delta) => {
    releaseAll();
    setBaseOctave((o) => clamp(o + delta, 0, 7));
  }, [releaseAll]);

  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "z") return shiftOctave(-1);
      if (k === "x") return shiftOctave(1);
      if (k in QWERTY) {
        e.preventDefault();
        press((baseRef.current + 1) * 12 + QWERTY[k]);
      }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k in QWERTY) release((baseRef.current + 1) * 12 + QWERTY[k]);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
    };
  }, [press, release, releaseAll, shiftOctave]);

  const velocityFrom = (e, el) => {
    const r = el.getBoundingClientRect();
    return clamp(0.25 + clamp((e.clientY - r.top) / r.height, 0, 1) * 0.75, 0.25, 1);
  };

  const endPointer = () => {
    if (pointerNote.current === null) return;
    release(pointerNote.current);
    pointerNote.current = null;
  };

  // Whites first, then blacks positioned over them — same geometry as the
  // reference, where a black key sits at 31% back from the next white's edge.
  const base = (baseOctave + 1) * 12;
  const whites = [];
  const blacks = [];
  for (let oct = 0; oct < 2; oct++) {
    for (let wi = 0; wi < 7; wi++) whites.push({ note: base + oct * 12 + WHITE[wi], showName: WHITE[wi] === 0 });
    for (const [wi, semi] of Object.entries(BLACK_AFTER)) {
      blacks.push({ note: base + oct * 12 + semi, whiteIndex: oct * 7 + Number(wi) });
    }
  }

  const keyProps = (note) => ({
    "data-note": note,
    "data-on": sounding.has(note) ? "true" : undefined,
  });

  return (
    <div className="keybed">
      <div className="keybed-bar">
        <div className="oct">
          <span>Octave</span>
          <button onClick={() => shiftOctave(-1)} aria-label="Octave down">−</button>
          <span className="oct-read">C{baseOctave}</span>
          <button onClick={() => shiftOctave(1)} aria-label="Octave up">+</button>
        </div>
        <button
          className="pbtn"
          type="button"
          aria-pressed={latch}
          onClick={() => {
            const next = !latch;
            setLatch(next);
            latchRef.current = next;
            if (!next) releaseAll();
          }}
        >
          Latch
        </button>
        <div className="wheel-group">
          <span>Mod wheel</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0"
            aria-label="Mod wheel"
            onChange={(e) => onModWheel?.(Number(e.target.value))}
          />
        </div>
        <span className="hint">click a key for velocity by height · a–j plays · z / x shifts octave</span>
      </div>

      <div
        className="keys"
        onPointerDown={(e) => {
          const k = e.target.closest(".key");
          if (!k) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pointerNote.current = Number(k.dataset.note);
          press(pointerNote.current, velocityFrom(e, k));
          e.preventDefault();
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {whites.map(({ note, showName }) => (
          <div key={note} {...keyProps(note)} className="key white">
            {showName && <span className="key-name">{noteName(note)}</span>}
          </div>
        ))}
        {blacks.map(({ note, whiteIndex }) => (
          <div
            key={note}
            {...keyProps(note)}
            className="key black"
            style={{ left: `calc((100% / 14) * ${whiteIndex + 1} - (100% / 14 * 0.31))` }}
          />
        ))}
      </div>
    </div>
  );
}
