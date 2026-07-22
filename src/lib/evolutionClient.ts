import type { Env } from "../env";
import { CLIENT } from "../../config/client";
import { withRetry, HttpError } from "./retry";

// Puxa mensagens da instância (paginado). Bounded por maxPages p/ não estourar
// o tempo do Worker; a dedupe por PK acumula histórico a cada run.
export async function fetchMessages(
  env: Env, instance: string, maxPages = 25,
): Promise<any[]> {
  const base = (env.EVOLUTION_URL || CLIENT.evolutionUrl || "").replace(/\/$/, "");
  if (!base || !env.EVOLUTION_KEY) return [];
  const out: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    // Retry com backoff só em falha transitória (rede, 429, 5xx) — ver src/lib/retry.ts.
    const res = await withRetry(async (): Promise<Response> => {
      const r = await fetch(`${base}/chat/findMessages/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_KEY ?? "" },
        body: JSON.stringify({ where: {}, page }),
      });
      if (!r.ok) throw new HttpError(r.status, `Evolution ${r.status}: ${await r.text()}`);
      return r;
    });
    const data: any = await res.json();
    const box = data?.messages ?? data;
    const records: any[] = box?.records ?? (Array.isArray(box) ? box : []);
    out.push(...records);
    const pages = box?.pages ?? 1;
    if (records.length === 0 || page >= pages) break;
  }
  return out;
}
