// Retry com backoff exponencial para chamadas às APIs externas (Kommo/Meta/Evolution).
// Só reage a falhas TRANSITÓRIAS: erro de rede (fetch lançou sem status) ou HTTP
// 429/5xx. Erros de auth (401/403) e demais 4xx não são retentados — retry não
// resolve credencial inválida ou request malformado.

// Erro com status HTTP anexado, para os clients sinalizarem o motivo da falha
// e o helper decidir se vale retry.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export interface RetryOptions {
  /** Delays entre tentativas, em ms. O nº de tentativas totais é delays.length + 1. */
  delaysMs?: number[];
  isRetryable?: (err: unknown) => boolean;
}

const DEFAULT_DELAYS = [500, 1500, 4000];

function isTransient(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status >= 500;
  }
  // Sem status (fetch rejeitou por erro de rede/timeout) → trata como transitório.
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Executa `fn`, tentando de novo com backoff enquanto o erro for transitório.
// Desiste (relança) assim que esgotar as tentativas ou encontrar erro não-transitório.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const delays = opts.delaysMs ?? DEFAULT_DELAYS;
  const retryable = opts.isRetryable ?? isTransient;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === delays.length || !retryable(err)) throw err;
      await sleep(delays[attempt] ?? 0);
    }
  }
  throw lastErr;
}
