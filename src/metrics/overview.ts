import { CLIENT } from "../../config/client";

export interface LeadLite {
  status_id: number | null;
  price: number;
  created_at: number | null;
  closed_at: number | null;
}
export interface Goal { goal_revenue: number; goal_leads: number }

const div = (a: number, b: number) => (b === 0 ? 0 : a / b);

// totalLeadsGerados: leads CRIADOS no período (independe de terem fechado).
// closedLeads: leads FECHADOS (ganho/perdido) no período, filtrados por closed_at —
// é o que o Kommo mostra no filtro "Fechado" e pode incluir leads criados fora do período.
export function computeOverview(
  totalLeadsGerados: number, closedLeads: LeadLite[], investido: number, goal: Goal | null,
) {
  const total = totalLeadsGerados;
  const ganhosArr = closedLeads.filter((l) => l.status_id === CLIENT.status.won);
  const perdidos = closedLeads.filter((l) => l.status_id === CLIENT.status.lost).length;
  const ganhos = ganhosArr.length;
  const receita = ganhosArr.reduce((s, l) => s + (l.price ?? 0), 0);
  const convTimes = ganhosArr
    .filter((l) => l.created_at && l.closed_at)
    .map((l) => (l.closed_at as number) - (l.created_at as number));
  return {
    leadsGerados: total,
    ganhos,
    perdidos,
    investido,
    receita,
    ticketMedio: div(receita, ganhos),
    cac: div(investido, ganhos),
    cpl: div(investido, total),
    taxaFechamento: div(ganhos, ganhos + perdidos),
    taxaPerda: div(perdidos, total),
    taxaConversao: div(ganhos, total),
    tempoMedioConversaoSeg: div(
      convTimes.reduce((s, t) => s + t, 0), convTimes.length,
    ),
    progressoMeta: goal ? div(receita, goal.goal_revenue) : 0,
    metaReceita: goal?.goal_revenue ?? 0,
    metaLeads: goal?.goal_leads ?? 0,
  };
}
