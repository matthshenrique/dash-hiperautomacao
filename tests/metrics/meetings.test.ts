import { describe, it, expect } from "vitest";
import { computeMeetings } from "../../src/metrics/meetings";

// IDs de status genéricos (batem com config/client.example.ts):
// agendado=1, noShow=2, cancelado=3, followUp=4; 90 = etapa anterior ("conversando").
describe("computeMeetings", () => {
  it("classifica realizadas/canceladas/remarcadas via eventos", () => {
    const events = [
      { lead_id: 1, status_before: 90, status_after: 1 },
      { lead_id: 1, status_before: 1, status_after: 4 },
      { lead_id: 2, status_before: 90, status_after: 1 },
      { lead_id: 2, status_before: 1, status_after: 3 },
      { lead_id: 3, status_before: 90, status_after: 1 },
      { lead_id: 3, status_before: 2, status_after: 1 },
    ];
    const r = computeMeetings(events as any);
    expect(r.realizadas).toBe(1);
    expect(r.canceladas).toBe(1);
    expect(r.remarcadas).toBe(1);
  });
});
