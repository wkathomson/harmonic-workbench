/* Port of makeSwitch (reference/web-synth-v11.html lines 2515–2533).
   Fixed contract: <Switch options value onChange label />
   `options` is an array of [value, buttonText] pairs, exactly as the
   reference's makeSwitch calls pass them (see params.js). */

export default function Switch({ options, value, onChange, label }) {
  return (
    <div className="switch" role="radiogroup" aria-label={label}>
      {options.map(([optValue, optLabel]) => (
        <button
          key={optValue}
          type="button"
          role="radio"
          data-value={optValue}
          aria-checked={value === optValue}
          onClick={() => onChange(optValue)}
        >
          {optLabel}
        </button>
      ))}
    </div>
  );
}
