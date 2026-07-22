import { CLIENT } from "../../config/client";

interface RLead {
  status_id: number | null;
  price: number;
  produto: string | null;
  utm_source: string | null;
}
const won = (l: RLead) => l.status_id === CLIENT.status.won;

const STATUS_LABEL: Record<number, string> = {
  [CLIENT.status.followUp]: "Follow up",
  [CLIENT.status.agendado]: "Agendado",
  [CLIENT.status.noShow]: "No-show",
  [CLIENT.status.cancelado]: "Cancelado",
  [CLIENT.status.won]: "Ganho",
  [CLIENT.status.lost]: "Perdido",
};
// Prioridade do rótulo: override do config → nome vindo do Kommo → "Status {id}".
const statusLabel = (id: number, names?: Map<number, string>) =>
  STATUS_LABEL[id] ?? names?.get(id) ?? `Status ${id}`;

export function revenueByStatus(leads: RLead[], names?: Map<number, string>) {
  const m = new Map<number, number>();
  for (const l of leads) {
    if (!l.price) continue;
    m.set(l.status_id ?? 0, (m.get(l.status_id ?? 0) ?? 0) + l.price);
  }
  return [...m.entries()]
    .map(([status_id, receita]) => ({ status_id, label: statusLabel(status_id, names), receita }))
    .sort((a, b) => b.receita - a.receita);
}

export function revenueByOrigin(leads: RLead[]) {
  const m = new Map<string, number>();
  for (const l of leads) {
    if (!won(l)) continue;
    const k = l.utm_source ?? "(sem origem)";
    m.set(k, (m.get(k) ?? 0) + l.price);
  }
  return [...m.entries()]
    .map(([origem, receita]) => ({ origem, receita }))
    .sort((a, b) => b.receita - a.receita);
}

export function productStats(leads: RLead[]) {
  const m = new Map<string, { vendidos: number; receita: number }>();
  for (const l of leads) {
    if (!won(l) || !l.produto) continue;
    const cur = m.get(l.produto) ?? { vendidos: 0, receita: 0 };
    cur.vendidos++; cur.receita += l.price;
    m.set(l.produto, cur);
  }
  return [...m.entries()]
    .map(([produto, v]) => ({
      produto, vendidos: v.vendidos, receita: v.receita,
      ticketMedio: v.vendidos ? v.receita / v.vendidos : 0,
    }))
    .sort((a, b) => b.receita - a.receita);
}
