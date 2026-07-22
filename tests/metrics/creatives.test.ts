import { describe, it, expect } from "vitest";
import {
  creativesGeneration, creativesConversion, campaignsUnified,
} from "../../src/metrics/creatives";

describe("creativesGeneration", () => {
  it("soma spend da Meta por anúncio e conta leads do Kommo casados por utm_content (normalizado)", () => {
    const insights = [
      { ad_id: "1", ad_name: "A", spend: 100 },
      { ad_id: "1", ad_name: "A", spend: 50 },
      { ad_id: "2", ad_name: "B", spend: 200 },
    ];
    const leads = [
      { utm_content: "A" }, { utm_content: "A" }, { utm_content: "a" },
      { utm_content: "B" },
      { utm_content: "C" },   // anúncio não encontrado nos insights → ignorado
      { utm_content: null }, // sem utm → ignorado
    ];
    expect(creativesGeneration(insights as any, leads as any)).toEqual([
      { ad_id: "1", ad_name: "A", spend: 150, leads: 3, cpl: 50 },
      { ad_id: "2", ad_name: "B", spend: 200, leads: 1, cpl: 200 },
    ]);
  });
});

describe("creativesConversion", () => {
  it("conta ganhos e receita por utm_content", () => {
    const wonLeads = [
      { utm_content: "A", price: 1000 },
      { utm_content: "A", price: 2000 },
      { utm_content: "B", price: 500 },
    ];
    expect(creativesConversion(wonLeads as any)).toEqual([
      { criativo: "A", ganhos: 2, receita: 3000 },
      { criativo: "B", ganhos: 1, receita: 500 },
    ]);
  });
});

describe("campaignsUnified", () => {
  it("cruza spend (Meta) + leads gerados (Kommo, todos) + ganhos/receita (Kommo, fechados)", () => {
    const insights = [
      { campaign_name: "Campanha X", spend: 100 },
      { campaign_name: "Campanha X", spend: 50 },
      { campaign_name: "Campanha Y", spend: 200 },
    ];
    const leads = [
      { utm_campaign: "Campanha X" }, { utm_campaign: "campanha x" }, { utm_campaign: "Campanha X" },
      { utm_campaign: "Campanha Y" },
    ];
    const wonLeads = [
      { utm_campaign: "Campanha X", price: 1000 },
    ];
    const r = campaignsUnified(insights as any, leads as any, wonLeads as any);
    expect(r).toEqual([
      {
        campanha: "Campanha X", leads: 3, spend: 150, ganhos: 1, receita: 1000,
        cac: 150, roas: 1000 / 150, taxaConversao: 1 / 3,
      },
      {
        campanha: "Campanha Y", leads: 1, spend: 200, ganhos: 0, receita: 0,
        cac: 0, roas: 0, taxaConversao: 0,
      },
    ]);
  });
});
