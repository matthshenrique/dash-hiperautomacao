import { useEffect, useMemo, useState } from "react";
import { api, AuthError, getKey, clearKey } from "./lib/api";
import { globalCss, CLIENT_NAME, initMode, applyMode, type Mode } from "./theme";
import { brl, int, pct, duration } from "./lib/format";
import { presetRange, type PresetKey, type Range } from "./lib/dateRanges";
import { StatCard, Card, ThemeToggle } from "./components/ui";
import { DateRangePicker } from "./components/DateRangePicker";
import { AboutModal } from "./components/AboutModal";
import { SyncStatusWidget } from "./components/SyncStatusWidget";
import { Login } from "./components/Login";
import { MetaCard } from "./components/MetaCard";
import { Funnel } from "./components/FunnelChart";
import { LossReasons } from "./components/LossReasons";
import { MeetingsPanel } from "./components/MeetingsPanel";
import { RevenuePanel } from "./components/RevenuePanel";
import { CreativesPanel } from "./components/CreativesPanel";

const p = new URLSearchParams(location.search);
const urlFrom = p.get("from");
const urlTo = p.get("to");
const initialRange: Range = urlFrom && urlTo ? { from: urlFrom, to: urlTo } : presetRange("mes");
const initialPreset: PresetKey = urlFrom && urlTo ? "custom" : "mes";

// Shape do retorno de GET /api/dashboard — mesmas seções que os 6 endpoints
// antigos (/api/overview, /api/funnel, etc.) devolviam separadamente.
type AllDashboardData = {
  overview: any;
  funnel: any;
  meetings: any;
  revenue: any;
  creatives: any;
  response: any;
};

export function App() {
  const [mode, setMode] = useState<Mode>(() => initMode());
  const [authed, setAuthed] = useState<boolean>(() => !!getKey());
  const [authError, setAuthError] = useState(false);
  const [reload, setReload] = useState(0);

  const [range, setRange] = useState<Range>(initialRange);
  const [preset, setPreset] = useState<PresetKey>(initialPreset);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { applyMode(mode); }, [mode]);

  useEffect(() => {
    if (!authed) return;
    setLoading(true); setErr("");
    const q = `?from=${range.from}&to=${range.to}`;
    api<AllDashboardData>(`dashboard${q}`).then((d) =>
      setData(d),
    ).catch((e) => {
      if (e instanceof AuthError) { setAuthed(false); setAuthError(true); }
      else setErr(String(e));
    }).finally(() => setLoading(false));
  }, [range, reload, authed]);

  const funnelData = useMemo(() => data && [
    { etapa: "Follow up", valor: data.funnel.funnel.followUp, color: "var(--blue)" },
    { etapa: "Agendado", valor: data.funnel.funnel.agendado, color: "var(--accent)" },
    { etapa: "Ganhos", valor: data.funnel.funnel.ganhos, color: "var(--good)" },
    { etapa: "Perdidos", valor: data.funnel.funnel.perdidos, color: "var(--crit)" },
  ], [data]);

  if (!authed) {
    return (
      <>
        <style>{globalCss}</style>
        <Login error={authError}
          onOk={() => { setAuthError(false); setAuthed(true); setReload((r) => r + 1); }} />
      </>
    );
  }

  const ov = data?.overview;
  const monthOfRange = range.from.slice(0, 7);

  return (
    <div className="app">
      <style>{globalCss}</style>

      <div className="topbar">
        <div className="brand">
          <div className="brand-badge">{CLIENT_NAME.slice(0, 1)}</div>
          <div>
            <h1>{CLIENT_NAME}</h1>
            <div className="sub">Dashboard comercial</div>
          </div>
        </div>
        <div className="toolbar">
          <AboutModal />
          <SyncStatusWidget />
          <DateRangePicker range={range} preset={preset}
            onChange={(r, k) => { setRange(r); setPreset(k); }} />
          <ThemeToggle mode={mode} onToggle={() => setMode(mode === "dark" ? "light" : "dark")} />
          <button className="btn icon" title="Sair" aria-label="Sair"
            onClick={() => { clearKey(); setData(null); setAuthed(false); }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>

      {err && <div className="card" style={{ borderColor: "var(--crit)", color: "var(--crit)" }}>
        Erro ao carregar: {err}
      </div>}

      {!ov && !err && <div className="empty" style={{ padding: 40 }}>Carregando…</div>}

      {ov && (
        <div className={loading ? "fade" : undefined}>
          <div className="grid kpis">
            <StatCard label="Investido" value={brl(ov.investido)}
              tooltip="Soma do gasto (spend) em anúncios no Meta Ads durante o período." />
            <StatCard label="Leads gerados" value={int(ov.leadsGerados)}
              tooltip="Leads criados no CRM (Kommo) no período, pela data de criação (created_at)." />
            <StatCard label="Ganhos" value={int(ov.ganhos)} foot={`${int(ov.perdidos)} perdidos`} footColor="var(--crit)"
              tooltip="Leads fechados como venda (etapa Ganho) no período, pela data de fechamento (closed_at) — não pela data de criação." />
            <StatCard label="Receita" value={brl(ov.receita)}
              tooltip="Soma do valor dos leads ganhos fechados no período." />
            <StatCard label="Ticket médio" value={brl(ov.ticketMedio)}
              tooltip="Receita ÷ ganhos do período." />
            <StatCard label="CAC" value={brl(ov.cac)}
              tooltip="Custo de Aquisição de Cliente: investido (Meta) ÷ ganhos (Kommo)." />
            <StatCard label="CPL" value={brl(ov.cpl)}
              tooltip="Custo Por Lead: investido (Meta) ÷ leads gerados (Kommo)." />
            <StatCard label="Tempo de conversão"
              value={duration(ov.tempoMedioConversaoSeg)} foot="lead → ganho"
              tooltip="Tempo médio entre a criação do lead e o fechamento como ganho (closed_at − created_at)." />
            <StatCard label="Tempo de resposta"
              value={duration(data.response.medianSeconds)}
              foot={data.response.count ? `mediana · ${int(data.response.count)} conversas` : "sem dados"}
              tooltip="Mediana do tempo até a 1ª resposta do time a uma mensagem do lead no WhatsApp. Gaps acima de 12h são ignorados (não é resposta real)." />
            <StatCard label="Taxa de conversão" value={pct(ov.taxaConversao)} foot="Leads → ganhos"
              tooltip="Ganhos ÷ leads gerados no período." />
            <StatCard label="Taxa de fechamento" value={pct(ov.taxaFechamento)} foot="Ganhos / decididos"
              tooltip="Ganhos ÷ (ganhos + perdidos) — só entre os leads já decididos no período." />
            <StatCard label="Taxa de perda" value={pct(ov.taxaPerda)} foot="Perdidos / leads" footColor="var(--crit)"
              tooltip="Perdidos ÷ leads gerados no período." />
            <MetaCard ov={ov} month={monthOfRange} onSaved={() => setReload((r) => r + 1)} />
          </div>

          <div className="grid cols-2" style={{ marginTop: 22 }}>
            <Card title="Funil comercial"
              tooltip="Leads por etapa. Follow up/Agendado contam pela data de criação; Ganhos/Perdidos pela data de fechamento.">
              {funnelData && <Funnel data={funnelData} />}
            </Card>
            <Card title="Motivos de perda"
              tooltip="Motivo de perda registrado no Kommo, só para leads perdidos fechados no período.">
              <LossReasons data={data.funnel.lossReasons} />
            </Card>
          </div>

          <div className="section-title">Reuniões</div>
          <MeetingsPanel data={data.meetings} />

          <div className="section-title">Receita</div>
          <RevenuePanel data={data.revenue} />

          <div className="section-title">Criativos</div>
          <CreativesPanel data={data.creatives} />
        </div>
      )}
    </div>
  );
}
