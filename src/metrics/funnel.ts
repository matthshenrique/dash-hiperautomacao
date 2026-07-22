import { CLIENT } from "../../config/client";

// openLeads: leads criados no período (etapas em aberto do funil).
// closedLeads: leads fechados no período por closed_at (ganho/perdido).
export function computeFunnel(
  openLeads: { status_id: number | null }[],
  closedLeads: { status_id: number | null }[],
) {
  const countIn = (arr: { status_id: number | null }[], s: number) =>
    arr.filter((l) => l.status_id === s).length;
  return {
    followUp: countIn(openLeads, CLIENT.status.followUp),
    agendado: countIn(openLeads, CLIENT.status.agendado),
    noShow: countIn(openLeads, CLIENT.status.noShow),
    cancelado: countIn(openLeads, CLIENT.status.cancelado),
    ganhos: countIn(closedLeads, CLIENT.status.won),
    perdidos: countIn(closedLeads, CLIENT.status.lost),
  };
}

export function computeLossReasons(
  leads: { status_id: number | null; loss_reason: string | null }[],
) {
  const m = new Map<string, number>();
  for (const l of leads) {
    if (l.status_id !== CLIENT.status.lost || !l.loss_reason) continue;
    m.set(l.loss_reason, (m.get(l.loss_reason) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count);
}
