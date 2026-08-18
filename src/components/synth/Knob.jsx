/* Port of makeKnob (reference/web-synth-v11.html lines 2357–2510).
   Fixed contract: <Knob path value onChange disabled />
   The knob owns its displayed value in local state while dragging; onChange
   fires on every change and the parent is expected to write it straight to
   the audio engine without feeding a new `value` prop back per pointermove.
   When `value` does change from outside (preset load, randomise, etc.) an
   effect resyncs local state to it. */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { P, toNorm, fromNorm } from './params.js';
import { clamp } from '../../audio/synth/util.js';
import { DEFAULTS } from '../../audio/synth/constants.js';

const ARC = { r: 19, cx: 24, cy: 24, start: -135, end: 135 };

function polar(deg, r = ARC.r) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: ARC.cx + r * Math.cos(rad), y: ARC.cy + r * Math.sin(rad) };
}
function arcPath(fromDeg, toDeg) {
  if (Math.abs(toDeg - fromDeg) < 0.01) return '';
  const a = polar(fromDeg), b = polar(toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ARC.r} ${ARC.r} 0 ${large} ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/* static across all instances: the 11-tick ring and the fixed track arc */
const TICKS = Array.from({ length: 11 }, (_, i) => {
  const deg = ARC.start + (i / 10) * (ARC.end - ARC.start);
  const a = polar(deg, 21.5);
  const b = polar(deg, i % 5 === 0 ? 25 : 23.5);
  return {
    key: i,
    major: i % 5 === 0,
    x1: a.x.toFixed(2), y1: a.y.toFixed(2),
    x2: b.x.toFixed(2), y2: b.y.toFixed(2)
  };
});
const TRACK_PATH = arcPath(ARC.start, ARC.end);

export default function Knob({ path, value, onChange, disabled }) {
  const d = P[path];
  const gradId = useId();

  const [local, setLocal] = useState(value);
  const [active, setActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const draggingRef = useRef(false);
  const lastYRef = useRef(0);
  const inputRef = useRef(null);

  /* resync to external changes (preset load, randomise) — not fed per pointermove */
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const applyValue = useCallback(v => {
    setLocal(v);
    onChange(v);
  }, [onChange]);

  const nudge = useCallback(delta => {
    setLocal(prev => {
      const next = fromNorm(toNorm(prev, d) + delta, d);
      onChange(next);
      return next;
    });
  }, [d, onChange]);

  const handlePointerDown = e => {
    if (disabled || editing) return;
    draggingRef.current = true;
    lastYRef.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setActive(true);
  };
  const handlePointerMove = e => {
    if (!draggingRef.current) return;
    nudge((lastYRef.current - e.clientY) * (e.shiftKey ? 0.0012 : 0.005));
    lastYRef.current = e.clientY;
  };
  const stopDrag = e => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setActive(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    let def;
    if (path.startsWith('slot')) def = 0;
    else {
      const [mod, key] = path.split('.');
      def = DEFAULTS[mod]?.[key];
    }
    if (def !== undefined) applyValue(def);
  };

  const handleWheel = e => {
    if (disabled) return;
    e.preventDefault();
    nudge((e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? 0.004 : 0.02));
  };

  const handleKeyDown = e => {
    if (disabled) return;
    const step = e.shiftKey ? 0.002 : 0.02;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { nudge(step); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { nudge(-step); e.preventDefault(); }
    else if (e.key === 'Home') { applyValue(d.min); e.preventDefault(); }
    else if (e.key === 'End') { applyValue(d.max); e.preventDefault(); }
  };

  /* click the value readout to type a number directly */
  const startEdit = e => {
    e.stopPropagation();
    if (disabled) return;
    setInputVal(String(Number(local.toFixed(4))));
    setEditing(true);
  };
  const finishEdit = commit => {
    if (commit) {
      let v = parseFloat(inputVal.replace(',', '.'));
      if (Number.isFinite(v)) {
        /* typing "35" into a 0–1 knob almost certainly means 35% */
        if (d.max <= 1 && d.min >= 0 && v > d.max && v <= 100) v = v / 100;
        v = clamp(v, d.min, d.max);
        if (d.step) v = Math.round(v / d.step) * d.step;
        applyValue(v);
      }
    }
    setEditing(false);
  };

  const n = toNorm(local, d);
  const deg = ARC.start + n * (ARC.end - ARC.start);
  const origin = d.bipolar ? (ARC.start + ARC.end) / 2 : ARC.start;
  const fillPath = arcPath(origin, deg);
  const p = polar(deg, 11);
  const displayText = d.fmt(local);

  return (
    <div
      className="knob"
      tabIndex={0}
      role="slider"
      aria-label={d.label}
      aria-valuenow={Number(local.toFixed(4))}
      aria-valuetext={displayText}
      aria-disabled={disabled || undefined}
      data-active={active ? 'true' : undefined}
      data-inactive={disabled ? 'true' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    >
      <svg viewBox="0 0 48 52" aria-hidden="true">
        <defs>
          <radialGradient id={gradId} cx="38%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#5E5A54" />
            <stop offset="62%" stopColor="#3A3733" />
            <stop offset="100%" stopColor="#22201D" />
          </radialGradient>
        </defs>
        {TICKS.map(t => (
          <line
            key={t.key}
            className={`knob-tick${t.major ? ' major' : ''}`}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          />
        ))}
        <path className="knob-track" d={TRACK_PATH} />
        <path className="knob-fill" d={fillPath} />
        <circle className="knob-cap-edge" cx="24" cy="24" r="14.4" />
        <circle className="knob-cap" cx="24" cy="24" r="13.2" style={{ fill: `url("#${gradId}")` }} />
        <line className="knob-pointer" x1="24" y1="24" x2={p.x.toFixed(2)} y2={p.y.toFixed(2)} />
      </svg>
      <span className="knob-label">{d.label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="knob-input"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') finishEdit(true);
            else if (e.key === 'Escape') finishEdit(false);
          }}
          onBlur={() => finishEdit(true)}
          onPointerDown={e => e.stopPropagation()}
        />
      ) : (
        <span
          className="knob-value"
          title="Click to type a value"
          onPointerDown={e => e.stopPropagation()}
          onClick={startEdit}
        >
          {displayText}
        </span>
      )}
    </div>
  );
}
