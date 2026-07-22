import { CLIENT } from "../../config/client";

export interface EventLite {
  lead_id: number;
  status_before: number | null;
  status_after: number | null;
}

export function computeMeetings(events: EventLite[]) {
  const { agendado, noShow, cancelado } = CLIENT.status;
  const naoRealizado = new Set<number>([agendado, noShow, cancelado]);

  let realizadas = 0;
  let canceladas = 0;
  const agendamentosPorLead = new Map<number, number>();

  for (const e of events) {
    if (e.status_after === agendado) {
      agendamentosPorLead.set(
        e.lead_id, (agendamentosPorLead.get(e.lead_id) ?? 0) + 1,
      );
    }
    if (e.status_after === noShow || e.status_after === cancelado) canceladas++;
    if (e.status_before === agendado && !naoRealizado.has(e.status_after ?? -1)) {
      realizadas++;
    }
  }
  let remarcadas = 0;
  for (const n of agendamentosPorLead.values()) if (n >= 2) remarcadas++;

  return { realizadas, canceladas, remarcadas };
}
