import { int } from "../lib/format";

export interface FunnelStage { etapa: string; valor: number; color: string }

export function Funnel({ data }: { data: FunnelStage[] }) {
  const max = Math.max(...data.map((d) => d.valor), 1);
  return (
    <div className="funnel">
      {data.map((s) => (
        <div className="fstage" key={s.etapa}>
          <div className="fk">{s.etapa}</div>
          <div className="fbar tnum" style={{
            width: `${Math.max((s.valor / max) * 100, 6)}%`, background: s.color,
          }}>
            {int(s.valor)}
          </div>
        </div>
      ))}
    </div>
  );
}
