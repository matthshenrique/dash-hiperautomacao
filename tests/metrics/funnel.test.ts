import { describe, it, expect } from "vitest";
import { computeFunnel, computeLossReasons } from "../../src/metrics/funnel";

describe("computeFunnel", () => {
  it("etapas abertas contam por criados no período; ganhos/perdidos por fechados no período", () => {
    const openLeads = [
      { status_id: 4 }, { status_id: 4 }, // followUp (genérico, = client.example)
      // ganho/perdido criados no período mas que não vieram do cohort de fechados
      // (ex.: ainda não fecharam nesse range) não devem contar aqui
      { status_id: 142 },
    ];
    const closedLeads = [
      { status_id: 142 }, { status_id: 143 },
    ];
    const f = computeFunnel(openLeads as any, closedLeads as any);
    expect(f.followUp).toBe(2);
    expect(f.ganhos).toBe(1);
    expect(f.perdidos).toBe(1);
  });
});

describe("computeLossReasons", () => {
  it("agrupa perdidos por motivo", () => {
    const leads = [
      { status_id: 143, loss_reason: "Sem dinheiro" },
      { status_id: 143, loss_reason: "Sem dinheiro" },
      { status_id: 143, loss_reason: "ICP Errado" },
      { status_id: 142, loss_reason: null },
    ];
    expect(computeLossReasons(leads as any)).toEqual([
      { motivo: "Sem dinheiro", count: 2 },
      { motivo: "ICP Errado", count: 1 },
    ]);
  });
});
