const KEY_STORAGE = "dash_key";

export function getKey(): string {
  return localStorage.getItem(KEY_STORAGE)
    ?? new URLSearchParams(location.search).get("key")
    ?? "";
}
export function setKey(k: string) { localStorage.setItem(KEY_STORAGE, k); }
export function clearKey() { localStorage.removeItem(KEY_STORAGE); }

export class AuthError extends Error {
  constructor() { super("unauthorized"); }
}

// Erro com status + corpo (JSON) da resposta — usado quando quem chama precisa
// ler o motivo (ex.: 429 de cooldown do /api/sync, que manda { retryInSec }).
export class ApiError extends Error {
  constructor(public status: number, public body: any) { super(`API ${status}`); }
}

async function req(path: string, opts?: RequestInit): Promise<any> {
  const key = getKey();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/${path}${sep}key=${encodeURIComponent(key)}`, opts);
  if (res.status === 401) throw new AuthError();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const api = <T>(path: string): Promise<T> => req(path) as Promise<T>;

export const apiPost = <T>(path: string, body: unknown): Promise<T> =>
  req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<T>;
