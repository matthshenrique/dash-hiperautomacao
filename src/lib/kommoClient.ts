import { CLIENT } from "../../config/client";
import { withRetry, HttpError } from "./retry";

const BASE = `https://${CLIENT.kommoSubdomain}.kommo.com/api/v4`;

async function get(token: string, path: string): Promise<any> {
  // Retry com backoff só em falha transitória (rede, 429, 5xx) — ver src/lib/retry.ts.
  const res = await withRetry(async () => {
    const r = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok && r.status !== 204) throw new HttpError(r.status, `Kommo ${r.status} em ${path}`);
    return r;
  });
  if (res.status === 204) return null;
  return res.json();
}

// Itera todas as páginas de leads (com loss_reason embutido).
// updatedSince>0 → só leads alterados depois desse unix (incremental).
export async function* iterLeads(
  token: string,
  updatedSince = 0,
): AsyncGenerator<any> {
  let page = 1;
  for (;;) {
    let path = `/leads?limit=250&page=${page}&with=loss_reason&order[updated_at]=asc`;
    if (updatedSince > 0) path += `&filter[updated_at][from]=${updatedSince}`;
    const data = await get(token, path);
    const leads = data?._embedded?.leads ?? [];
    for (const l of leads) yield l;
    if (leads.length < 250) break;
    page++;
  }
}

// Etapas (status) de todos os pipelines: {id, name}. Usado p/ rotular a
// receita por status sem hardcode. Poucos registros → 1 chamada, sem paginar.
export async function fetchStatuses(
  token: string,
): Promise<{ id: number; name: string }[]> {
  const data = await get(token, "/leads/pipelines");
  const pipelines = data?._embedded?.pipelines ?? [];
  const out: { id: number; name: string }[] = [];
  for (const p of pipelines) {
    for (const s of p?._embedded?.statuses ?? []) {
      if (s?.id != null) out.push({ id: Number(s.id), name: String(s.name ?? "") });
    }
  }
  return out;
}

// IDs de leads EXCLUÍDOS no Kommo desde `since` (unix). O Kommo não remove
// da listagem com aviso; a exclusão só aparece aqui, no feed de eventos.
export async function* iterDeletedLeadIds(
  token: string,
  since = 0,
): AsyncGenerator<number> {
  let page = 1;
  for (;;) {
    let path = `/events?limit=100&page=${page}` +
      `&filter[type]=lead_deleted&filter[entity]=lead`;
    if (since > 0) path += `&filter[created_at][from]=${since}`;
    const data = await get(token, path);
    const events = data?._embedded?.events ?? [];
    for (const e of events) if (e.entity_id != null) yield Number(e.entity_id);
    if (events.length < 100) break;
    page++;
  }
}

// Eventos de mudança de status de lead, desde `since` (unix).
export async function* iterStatusEvents(
  token: string,
  since = 0,
): AsyncGenerator<any> {
  let page = 1;
  for (;;) {
    let path = `/events?limit=100&page=${page}` +
      `&filter[type]=lead_status_changed&filter[entity]=lead`;
    if (since > 0) path += `&filter[created_at][from]=${since}`;
    const data = await get(token, path);
    const events = data?._embedded?.events ?? [];
    for (const e of events) yield e;
    if (events.length < 100) break;
    page++;
  }
}
