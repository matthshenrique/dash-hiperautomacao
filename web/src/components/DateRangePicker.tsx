import { useState } from "react";
import {
  PRESETS, presetRange, presetLabel, type PresetKey, type Range,
} from "../lib/dateRanges";
import { dateBR } from "../lib/format";

export function DateRangePicker({ range, preset, onChange }: {
  range: Range;
  preset: PresetKey;
  onChange: (range: Range, preset: PresetKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cf, setCf] = useState(range.from);
  const [ct, setCt] = useState(range.to);

  const pick = (key: PresetKey) => {
    const r = presetRange(key);
    onChange(r, key);
    setCf(r.from); setCt(r.to);
    setOpen(false);
  };
  const applyCustom = () => {
    if (cf && ct) { onChange({ from: cf, to: ct }, "custom"); setOpen(false); }
  };

  const buttonLabel = preset === "custom"
    ? `${dateBR(range.from)} – ${dateBR(range.to)}`
    : presetLabel(preset);

  return (
    <div className="dr">
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {buttonLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: .6 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <div className="dr-menu" role="listbox">
            {PRESETS.map((p) => (
              <button key={p.key} className="dr-preset" role="option"
                aria-selected={preset === p.key} onClick={() => pick(p.key)}>
                <span>{p.label}</span>
                <span className="chk">✓</span>
              </button>
            ))}
            <div className="dr-custom">
              <div>
                <label>De</label>
                <input type="date" value={cf} max={ct} onChange={(e) => setCf(e.target.value)} />
              </div>
              <div>
                <label>Até</label>
                <input type="date" value={ct} min={cf} onChange={(e) => setCt(e.target.value)} />
              </div>
              <button className="btn primary" onClick={applyCustom}
                style={{ justifyContent: "center" }}>Aplicar período</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
