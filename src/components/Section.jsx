import { ChevronDown, ChevronRight } from "lucide-react";

// Collapsible numbered panel used throughout the UI.
export default function Section({ num, title, color, open, toggle, badge, children }) {
  return (
    <div className={`hw-s ${open ? "" : "hw-s-cl"}`} style={color ? { "--sc": color } : {}}>
      <button className="hw-sh" onClick={toggle}>
        <span className="hw-sn" style={{ color: color || "var(--ac)" }}>{num}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        {badge && <span className="hw-sb" style={{ background: color || "var(--ac)" }}>{badge}</span>}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="hw-sc">{children}</div>}
    </div>
  );
}
