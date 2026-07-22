import { useState } from "react";
import { apiPost } from "../lib/api";
import { brl, pct, monthLabel } from "../lib/format";
import { InfoTip } from "./ui";

export function MetaCard({ ov, month, onSaved }: {
  ov: { progressoMeta: number; metaReceita: number; metaLeads: number; leadsGerados: number };
  month: string; // YYYY-MM
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rev, setRev] = useState(String(ov.metaReceita || ""));
  const [leads, setLeads] = useState(String(ov.metaLeads || ""));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost("goals", {
        month,
        goal_revenue: Number(rev) || 0,
        goal_leads: Number(leads) || 0,
      });
      setEditing(false);
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="card stat accent">
      <div className="metahead">
        <div className="label">
          Meta · {monthLabel(month)}
          <InfoTip text="Meta de receita e de leads do mês, editável. Progresso = receita do mês ÷ meta de receita (e leads gerados ÷ meta de leads)." />
        </div>
        {!editing && (
          <button className="link" onClick={() => {
            setRev(String(ov.metaReceita || "")); setLeads(String(ov.metaLeads || ""));
            setEditing(true);
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
            editar
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <div className="value tnum">{pct(ov.progressoMeta)}</div>
          <div className="prog"><span style={{ width: `${Math.min(100, ov.progressoMeta * 100)}%` }} /></div>
          <div className="foot">{ov.metaReceita ? `receita: de ${brl(ov.metaReceita)}` : "sem meta definida"}</div>
          {ov.metaLeads > 0 && (
            <>
              <div className="prog">
                <span style={{ width: `${Math.min(100, (ov.leadsGerados / ov.metaLeads) * 100)}%` }} />
              </div>
              <div className="foot">leads: {ov.leadsGerados} / {ov.metaLeads}</div>
            </>
          )}
        </>
      ) : (
        <div className="metaedit">
          <div>
            <label>Meta de receita (R$)</label>
            <input className="field" type="number" min="0" value={rev}
              onChange={(e) => setRev(e.target.value)} autoFocus />
          </div>
          <div>
            <label>Meta de leads</label>
            <input className="field" type="number" min="0" value={leads}
              onChange={(e) => setLeads(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn primary" style={{ flex: 1, justifyContent: "center" }}
              onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
            <button className="btn" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
