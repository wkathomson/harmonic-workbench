import { useRef, useState, useEffect } from "react";

// Jog-style knob — like a Polyend Tracker scale wheel.
//
// Drag vertically: ↑ = up (positive), ↓ = down (negative).
// The knob is *stateless* with respect to the underlying value — every drag
// emits a series of step deltas (`onTranspose(+1)` / `onTranspose(-1)`),
// resets visually when released, and starts fresh next drag. That keeps the
// data model simple: the parent just applies each delta to its notes and
// the knob never needs to know what value those notes are at.
//
// One drag covers `range * pxPerStep` pixels end-to-end. With defaults
// (range=12, pxPerStep=8) you get ±12 steps in ±96 pixels of travel —
// enough room to feel precise but small enough to dial without scrolling.
//
// Props:
//   onTranspose(delta) — called once per emitted step (delta is ±1)
//   onCommit?()        — called on mouseup, after the last delta
//   label              — short text under the knob ("Pitch", "Vel")
//   color              — accent colour for the indicator
//   range              — max steps from centre (used to scale visual rotation)
//   pxPerStep          — pixels of vertical drag per step emitted
//   disabled           — render dimmed and ignore clicks
//   title              — hover hint
export default function Knob({
  onTranspose, onCommit,
  label, color = "var(--ac)",
  range = 12, pxPerStep = 8,
  disabled = false, title,
}) {
  // Visual rotation offset during a drag (in steps from centre, not pixels).
  // Resets to 0 on mouseup so the dial always *looks* centred when idle.
  const [rotSteps, setRotSteps] = useState(0);
  const dragRef = useRef(null);

  useEffect(() => {
    // Cleanup any in-flight drag if the component unmounts mid-drag.
    return () => {
      if (dragRef.current) {
        document.removeEventListener("mousemove", dragRef.current.onMove);
        document.removeEventListener("mouseup", dragRef.current.onUp);
        dragRef.current = null;
      }
    };
  }, []);

  const onMouseDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    let lastEmitted = 0;

    const onMove = (ev) => {
      // ↑ drag = positive steps. Round to integer stepCount; emit one
      // delta per step crossed since the last emission so the parent
      // applies them incrementally and the visuals stay smooth.
      const dy = startY - ev.clientY;
      const stepNow = Math.round(dy / pxPerStep);
      if (stepNow !== lastEmitted) {
        const diff = stepNow - lastEmitted;
        const dir = Math.sign(diff);
        for (let i = 0; i < Math.abs(diff); i++) onTranspose(dir);
        lastEmitted = stepNow;
        // Clamp visual rotation so we don't spin past the end of the dial.
        const clamped = Math.max(-range, Math.min(range, stepNow));
        setRotSteps(clamped);
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dragRef.current = null;
      setRotSteps(0);
      if (onCommit) onCommit();
    };

    dragRef.current = { onMove, onUp };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Map step rotation onto −135°…+135° dial sweep so visual feedback is
  // proportional to drag distance (matches a hardware encoder feel).
  const norm = rotSteps / range;
  const deg = norm * 135;
  const dragging = rotSteps !== 0;

  return (
    <div
      className={"hw-knob" + (disabled ? " disabled" : "") + (dragging ? " dragging" : "")}
      onMouseDown={onMouseDown}
      title={title || (disabled ? "" : "Drag up/down")}
      style={{ "--knob-c": color }}
    >
      <div className="hw-knob-face">
        <div
          className="hw-knob-ind"
          style={{ transform: `rotate(${deg}deg)` }}
        />
        {/* Live delta — only visible during a drag. Tells the user
            "you're +3 steps from where you started" so a tiny rotation
            is not ambiguous. */}
        {dragging && (
          <div className="hw-knob-delta">
            {rotSteps > 0 ? "+" : ""}{rotSteps}
          </div>
        )}
      </div>
      {label && <div className="hw-knob-lbl">{label}</div>}
    </div>
  );
}
