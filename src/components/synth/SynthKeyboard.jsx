// Two-octave playable keyboard for the synth route.
//
// Pointer position within a key sets velocity (top = soft, bottom = hard),
// matching the reference build. QWERTY rows play from the base octave;
// z / x shift it. Held notes are tracked in a ref so a re-render never
// re-triggers a sounding note.

import { useCallback, useEffect, useRef, useState } from "react";

const QWERTY = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17,
};

const SEMIS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlack = (n) => SEMIS[n % 12].includes("#");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function SynthKeyboard({ onNoteOn, onNoteOff, octaves = 2 }) {
  const [baseOctave, setBaseOctave] = useState(3);
  const [latch, setLatch] = useState(false);
  const [sounding, setSounding] = useState(() => new Set());
  const soundingRef = useRef(sounding);
  const latchRef = useRef(latch);
  const baseRef = useRef(baseOctave);
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
    const blur = () => releaseAll();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [press, release, releaseAll, shiftOctave]);

  const pointerNote = useRef(null);
  const endPointer = () => {
    if (pointerNote.current === null) return;
    release(pointerNote.current);
    pointerNote.current = null;
  };

  const velocityFrom = (e, el) => {
    const r = el.getBoundingClientRect();
    return clamp(0.25 + clamp((e.clientY - r.top) / r.height, 0, 1) * 0.75, 0.25, 1);
  };

  const low = (baseOctave + 1) * 12;
  const notes = [];
  for (let i = 0; i <= octaves * 12; i++) notes.push(low + i);

  return (
    <div className="sy-kbwrap">
      <div className="sy-kbctl">
        <button onClick={() => shiftOctave(-1)}>oct −</button>
        <span className="sy-kboct">C{baseOctave}</span>
        <button onClick={() => shiftOctave(1)}>oct +</button>
        <button
          className={latch ? "on" : ""}
          onClick={() => {
            const next = !latch;
            setLatch(next);
            latchRef.current = next;
            if (!next) releaseAll();
          }}
        >
          latch
        </button>
      </div>
      <div
        className="sy-keys"
        onPointerDown={(e) => {
          const k = e.target.closest(".sy-key");
          if (!k) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointerNote.current = Number(k.dataset.note);
          press(pointerNote.current, velocityFrom(e, k));
          e.preventDefault();
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {notes.map((n) => (
          <div
            key={n}
            data-note={n}
            className={`sy-key ${isBlack(n) ? "blk" : "wht"}`}
            data-on={sounding.has(n) ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
