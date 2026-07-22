export interface WaMsg { chat: string | null; from_me: number; ts: number }

// Tempo até a 1ª resposta do time por "onda" de mensagens do lead.
// Para cada bloco de mensagens recebidas seguido de uma resposta nossa,
// registra o gap (recebida mais antiga do bloco → 1ª resposta). Ignora gaps
// acima de `capSeconds` (não são resposta real, ex. lead sumiu e voltou).
export function avgResponseTime(msgs: WaMsg[], capSeconds = 12 * 3600) {
  const byChat = new Map<string, WaMsg[]>();
  for (const m of msgs) {
    if (!m.chat) continue;
    const arr = byChat.get(m.chat) ?? [];
    arr.push(m);
    byChat.set(m.chat, arr);
  }
  const gaps: number[] = [];
  for (const arr of byChat.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    let pending: number | null = null;
    for (const m of arr) {
      if (m.from_me === 0) {
        if (pending === null) pending = m.ts; // início de uma onda
      } else if (pending !== null) {
        const gap = m.ts - pending;
        if (gap >= 0 && gap <= capSeconds) gaps.push(gap);
        pending = null;
      }
    }
  }
  if (gaps.length === 0) return { avgSeconds: 0, medianSeconds: 0, count: 0 };
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return { avgSeconds: avg, medianSeconds: median, count: gaps.length };
}
