import { describe, it, expect } from "vitest";
import { parseLead } from "../../src/sync/kommo";

// IDs genéricos (batem com config/client.example.ts):
// pipeline=111111; campos utm_source=10, utm_campaign=11, utm_content=12, produto=13.
const raw = {
  id: 42,
  pipeline_id: 111111,
  status_id: 142,
  price: 1500,
  created_at: 1700000000,
  closed_at: 1700100000,
  updated_at: 1700100000,
  responsible_user_id: 7,
  _embedded: { loss_reason: [] },
  custom_fields_values: [
    { field_id: 10, values: [{ value: "ig" }] },
    { field_id: 11, values: [{ value: "camp-x" }] },
    { field_id: 12, values: [{ value: "ad-123" }] },
    { field_id: 13, values: [{ value: "FHP" }] },
  ],
};

describe("parseLead", () => {
  it("extrai campos e custom fields (utm/produto)", () => {
    const l = parseLead(raw);
    expect(l).toMatchObject({
      id: 42, pipeline_id: 111111, status_id: 142, price: 1500,
      utm_source: "ig", utm_campaign: "camp-x", utm_content: "ad-123",
      produto: "FHP", loss_reason_id: null, loss_reason: null,
    });
  });

  it("lê loss_reason do _embedded quando presente", () => {
    const l = parseLead({ ...raw, status_id: 143,
      _embedded: { loss_reason: [{ id: 900001, name: "Sem dinheiro" }] } });
    expect(l.loss_reason_id).toBe(900001);
    expect(l.loss_reason).toBe("Sem dinheiro");
  });

  it("campos ausentes viram null/0", () => {
    const l = parseLead({ id: 1, pipeline_id: 1, status_id: 1 });
    expect(l.price).toBe(0);
    expect(l.utm_source).toBeNull();
    expect(l.produto).toBeNull();
  });
});
