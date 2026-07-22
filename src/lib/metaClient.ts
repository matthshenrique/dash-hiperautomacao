import { CLIENT } from "../../config/client";
import { withRetry, HttpError } from "./retry";

const GRAPH = "https://graph.facebook.com/v21.0";

// Puxa insights nível anúncio, 1 linha por dia, entre since/until (YYYY-MM-DD).
export async function fetchInsights(
  token: string,
  since: string,
  until: string,
): Promise<any[]> {
  const fields =
    "ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions";
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields,
    limit: "500",
    access_token: token,
  });
  let url = `${GRAPH}/${CLIENT.metaAdAccount}/insights?${params}`;
  const out: any[] = [];
  for (;;) {
    // Retry com backoff só em falha transitória (rede, 429, 5xx) — ver src/lib/retry.ts.
    // Cobre o erro real já visto em produção: "Service temporarily unavailable" (code 2).
    const res = await withRetry(async () => {
      const r = await fetch(url);
      if (!r.ok) throw new HttpError(r.status, `Meta ${r.status}: ${await r.text()}`);
      return r;
    });
    const data: any = await res.json();
    out.push(...(data.data ?? []));
    if (!data.paging?.next) break;
    url = data.paging.next;
  }
  return out;
}
