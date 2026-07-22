import type { ReactNode } from "react";
import type { Mode } from "../theme";

export function Card({ title, tooltip, children, className = "" }: {
  title?: string; tooltip?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <h3>
          {title}
          {tooltip && <InfoTip text={tooltip} />}
        </h3>
      )}
      {children}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info" tabIndex={0}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 16.5v-5M12 7.8h.01" />
      </svg>
      <span className="tip">{text}</span>
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}

export function StatCard({ label, value, foot, footColor, accent, progress, tooltip }: {
  label: string;
  value: string;
  foot?: ReactNode;
  footColor?: string;
  accent?: boolean;
  progress?: number;
  tooltip?: string;
}) {
  return (
    <div className={`card stat ${accent ? "accent" : ""}`}>
      <div className="label">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      <div className="value tnum">{value}</div>
      {typeof progress === "number" && (
        <div className="prog"><span style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      )}
      {foot && (
        <div className="foot">
          {footColor && <span className="dot" style={{ background: footColor }} />}
          {foot}
        </div>
      )}
    </div>
  );
}

export interface BarItem { label: string; value: number; display: string }

export function BarList({ items, color = "var(--accent)", empty = "Sem dados no período" }: {
  items: BarItem[];
  color?: string | ((i: number) => string);
  empty?: string;
}) {
  if (!items.length) return <div className="empty">{empty}</div>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="barlist">
      {items.map((it, i) => (
        <div className="barrow" key={it.label + i}>
          <div className="k" title={it.label}>{it.label}</div>
          <div className="bartrack">
            <div className="barfill" style={{
              width: `${(it.value / max) * 100}%`,
              background: typeof color === "function" ? color(i) : color,
            }} />
          </div>
          <div className="v tnum">{it.display}</div>
        </div>
      ))}
    </div>
  );
}

export function ThemeToggle({ mode, onToggle }: { mode: Mode; onToggle: () => void }) {
  return (
    <button className="btn icon" onClick={onToggle}
      title={mode === "dark" ? "Modo claro" : "Modo escuro"} aria-label="Alternar tema">
      {mode === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
