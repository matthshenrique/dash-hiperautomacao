import { describe, it, expect, vi } from "vitest";
import { withRetry, HttpError } from "../../src/lib/retry";

describe("withRetry", () => {
  it("sucesso na 1ª tentativa não chama de novo", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { delaysMs: [0, 0, 0] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("sucesso após falhas transitórias (5xx)", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new HttpError(503, "Service temporarily unavailable"))
      .mockRejectedValueOnce(new HttpError(429, "Too Many Requests"))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { delaysMs: [0, 0, 0] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("desiste após esgotar as tentativas", async () => {
    const err = new HttpError(500, "Internal Server Error");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { delaysMs: [0, 0, 0] })).rejects.toBe(err);
    // 1 tentativa inicial + 3 retries = 4 chamadas
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("não tenta de novo em erro não-transitório (401)", async () => {
    const err = new HttpError(401, "Unauthorized");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { delaysMs: [0, 0, 0] })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("erro de rede (sem status) é tratado como transitório", async () => {
    const netErr = new TypeError("fetch failed");
    const fn = vi.fn()
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { delaysMs: [0, 0, 0] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
