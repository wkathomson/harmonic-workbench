// Segmented button group (tab-style single-value selector).
export default function Seg({ options, value, onChange, color }) {
  return (
    <div className="hw-sg">
      {options.map(o => (
        <button
          key={String(o.v)}
          className={value === o.v ? "on" : ""}
          style={value === o.v && color ? { background: color } : {}}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
