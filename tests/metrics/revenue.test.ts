import { describe, it, expect } from "vitest";
import {
  revenueByStatus, revenueByOrigin, productStats,
} from "../../src/metrics/revenue";

const leads = [
  { status_id: 142, price: 1000, produto: "FHP", utm_source: "ig" },
  { status_id: 142, price: 3000, produto: "FHP", utm_source: "fb" },
  { status_id: 142, price: 2000, produto: "HL",  utm_source: "ig" },
  { status_id: 143, price: 0,    produto: null,  utm_source: "ig" },
];

describe("revenue metrics", () => {
  it("receita por status", () => {
    expect(revenueByStatus(leads as any)).toEqual([
      { status_id: 142, label: "Ganho", receita: 6000 },
    ]);
  });
  it("receita por origem (só ganhos)", () => {
    expect(revenueByOrigin(leads as any)).toEqual([
      { origem: "ig", receita: 3000 },
      { origem: "fb", receita: 3000 },
    ]);
  });
  it("produtos vendidos + ticket por produto (só ganhos)", () => {
    expect(productStats(leads as any)).toEqual([
      { produto: "FHP", vendidos: 2, receita: 4000, ticketMedio: 2000 },
      { produto: "HL",  vendidos: 1, receita: 2000, ticketMedio: 2000 },
    ]);
  });
});
