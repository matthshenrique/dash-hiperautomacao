export interface WaMsgRow {
  id: string;
  chat: string | null;
  from_me: number;
  ts: number;
}

export function parseMessage(raw: any): WaMsgRow | null {
  const id = raw?.id != null ? String(raw.id) : null;
  const ts = Number(raw?.messageTimestamp ?? 0);
  if (!id || !ts) return null;
  return {
    id,
    chat: raw?.key?.remoteJid ?? null,
    from_me: raw?.key?.fromMe ? 1 : 0,
    ts,
  };
}
