import { Card, BarList } from "./ui";
import { brl, int, pct } from "../lib/format";

interface Campaign {
  campanha: string; leads: number; spend: number; ganhos: number;
  receita: number; cac: number; roas: number; taxaConversao: number;
}
interface Gen { ad_name: string | null; leads: number; cpl: number }
interface Conv { criativo: string; ganhos: number; receita: number }

export function CreativesPanel({ data }: {
  data: { campaigns: Campaign[]; generation: Gen[]; conversion: Conv[] };
}) {
  const camps = (data.campaigns ?? []).slice(0, 12);
  const gen = (data.generation ?? []).slice(0, 8).map((c) => ({
    label: c.ad_name ?? "—", value: c.leads,
    display: `${int(c.leads)} · CPL ${brl(c.cpl)}`,
  }));
  const conv = (data.conversion ?? []).slice(0, 8).map((c) => ({
    label: c.criativo, value: c.ganhos, display: `${int(c.ganhos)} vendas`,
  }));

  return (
    <>
      <Card title="Campanhas — funil completo (geração → venda)"
        tooltip="Cruza campanha da Meta (investido) com utm_campaign do Kommo (leads e vendas). Leads/conversão vêm sempre do Kommo; a Meta entra só com o investido.">
        {camps.length === 0 ? (
          <div className="empty">Sem dados de campanha no período</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campanha</th><th>Leads</th><th>Invest.</th><th>Vendas</th>
                  <th>Conversão</th><th>Receita</th><th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.campanha}>
                    <td>{c.campanha}</td>
                    <td className="tnum">{int(c.leads)}</td>
                    <td className="tnum">{brl(c.spend)}</td>
                    <td className="tnum">{int(c.ganhos)}</td>
                    <td className="tnum">{c.leads ? pct(c.taxaConversao) : "—"}</td>
                    <td className="tnum">{brl(c.receita)}</td>
                    <td className="tnum">{c.spend ? `${c.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="Criativos — geração de leads (Kommo)"
          tooltip="Anúncios da Meta (spend) casados por nome com a contagem de leads do Kommo (utm_content). CPL = spend da Meta ÷ leads do Kommo.">
          <BarList items={gen} color="var(--blue)" empty="Sem leads no período" />
        </Card>
        <Card title="Criativos — conversão em venda (Kommo)"
          tooltip="Leads ganhos agrupados por utm_content — o nome do anúncio congelado no momento do clique.">
          <BarList items={conv} color="var(--good)" empty="Sem conversões atribuídas" />
        </Card>
      </div>
    </>
  );
}
