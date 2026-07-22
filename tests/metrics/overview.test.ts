import { describe, it, expect } from "vitest";
import { computeOverview } from "../../src/metrics/overview";

// leads FECHADOS no período (won/lost) — closed_at é o filtro, não created_at
const closedLeads = [
  { status_id: 142, price: 1000, created_at: 1, closed_at: 5 },   // ganho
  { status_id: 142, price: 3000, created_at: 2, closed_at: 8 },   // ganho
  { status_id: 143, price: 0,    created_at: 3, closed_at: 4 },   // perdido
];
// total de leads CRIADOS no período (independe de estarem fechados) — inclui 1 aberto
const totalLeadsGerados = 4;

describe("computeOverview", () => {
  it("calcula KPIs a partir de total criado + leads fechados + spend + goal", () => {
    const r = computeOverview(totalLeadsGerados, closedLeads as any, /*spend*/ 2000, {
      goal_revenue: 10000, goal_leads: 10,
    });
    expect(r.leadsGerados).toBe(4);
    expect(r.ganhos).toBe(2);
    expect(r.perdidos).toBe(1);
    expect(r.investido).toBe(2000);
    expect(r.receita).toBe(4000);
    expect(r.ticketMedio).toBe(2000);
    expect(r.cac).toBe(1000);
    expect(r.cpl).toBe(500);
    expect(r.taxaFechamento).toBeCloseTo(2 / 3);
    expect(r.taxaPerda).toBeCloseTo(1 / 4);
    expect(r.taxaConversao).toBeCloseTo(2 / 4);
    expect(r.tempoMedioConversaoSeg).toBe(5); // média (5-1, 8-2) = média(4,6) = 5
    expect(r.progressoMeta).toBeCloseTo(0.4);
  });

  it("sem ganhos não divide por zero", () => {
    const r = computeOverview(1, [{ status_id: 143, price: 0 }] as any, 500, null);
    expect(r.ticketMedio).toBe(0);
    expect(r.cac).toBe(0);
    expect(r.progressoMeta).toBe(0);
  });

  it("ganho fechado no período mas criado antes do período ainda conta em ganhos/receita", () => {
    // reproduz o bug do filtro Kommo: lead criado fora do range, fechado dentro — deve contar
    const r = computeOverview(0, [
      { status_id: 142, price: 5000, created_at: -1000, closed_at: 100 },
    ] as any, 0, null);
    expect(r.ganhos).toBe(1);
    expect(r.receita).toBe(5000);
  });
});
