import { Card, BarList } from "./ui";
import { brl } from "../lib/format";

export function RevenuePanel({ data }: {
  data: {
    byStatus: { status_id: number; label: string; receita: number }[];
    byOrigin: { origem: string; receita: number }[];
    products: { produto: string; vendidos: number; receita: number; ticketMedio: number }[];
  };
}) {
  const origin = data.byOrigin.map((o) => ({
    label: o.origem, value: o.receita, display: brl(o.receita),
  }));
  const status = (data.byStatus ?? []).map((s) => ({
    label: s.label, value: s.receita, display: brl(s.receita),
  }));
  return (
    <>
    <Card title="Receita por status do CRM" className="fullw"
      tooltip="Soma do valor dos leads por etapa, entre os fechados (ganho/perdido) no período.">
      <BarList items={status} color="var(--accent)" empty="Sem receita no período" />
    </Card>
    <div className="grid cols-2" style={{ marginTop: 14 }}>
      <Card title="Receita por origem"
        tooltip="Receita dos leads ganhos agrupada por utm_source. Lead sem UTM cai em '(sem origem)'.">
        <BarList items={origin} color="var(--blue)" />
      </Card>
      <Card title="Produtos vendidos"
        tooltip="Vendas (leads ganhos) agrupadas pelo campo Produto do Kommo — quantidade, receita e ticket médio por produto.">
        {data.products.length === 0 ? (
          <div className="empty">Sem vendas no período</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>Produto</th><th>Qtd</th><th>Receita</th><th>Ticket</th></tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.produto}>
                    <td>{p.produto}</td>
                    <td className="tnum">{p.vendidos}</td>
                    <td className="tnum">{brl(p.receita)}</td>
                    <td className="tnum">{brl(p.ticketMedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
    </>
  );
}
