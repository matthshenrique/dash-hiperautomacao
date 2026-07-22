import { describe, it, expect } from "vitest";
import { ymd, monthKey, daysAgo } from "../../src/lib/date";

describe("date helpers", () => {
  it("ymd formata unix → YYYY-MM-DD (UTC)", () => {
    expect(ymd(1751328000)).toBe("2025-07-01");
  });
  it("monthKey → YYYY-MM", () => {
    expect(monthKey(1751328000)).toBe("2025-07");
  });
  it("daysAgo devolve YYYY-MM-DD N dias atrás", () => {
    const base = new Date("2026-07-10T00:00:00Z");
    expect(daysAgo(90, base)).toBe("2026-04-11");
  });
});
