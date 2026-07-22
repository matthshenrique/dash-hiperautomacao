import { describe, it, expect } from "vitest";
import { parseStatusEvent } from "../../src/sync/kommo";

// IDs genéricos: 90 = etapa anterior, 1 = agendado, pipeline 111111 (= client.example).
describe("parseStatusEvent", () => {
  it("extrai lead_id, status antes/depois", () => {
    const raw = {
      id: "evt1", entity_id: 42, created_at: 1700000000,
      value_before: [{ lead_status: { id: 90, pipeline_id: 111111 } }],
      value_after:  [{ lead_status: { id: 1, pipeline_id: 111111 } }],
    };
    expect(parseStatusEvent(raw)).toEqual({
      id: "evt1", lead_id: 42, created_at: 1700000000,
      status_before: 90, status_after: 1,
    });
  });
});
