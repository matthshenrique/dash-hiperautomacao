import { describe, it, expect } from "vitest";
import { parseInsight } from "../../src/sync/meta";

describe("parseInsight", () => {
  it("mapeia campos e soma actions de lead", () => {
    const raw = {
      date_start: "2026-07-01", date_stop: "2026-07-01",
      ad_id: "111", ad_name: "Criativo A",
      campaign_id: "999", campaign_name: "Camp Julho",
      spend: "123.45", impressions: "1000", clicks: "50",
      actions: [
        { action_type: "lead", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "2" },
        { action_type: "link_click", value: "50" },
      ],
    };
    expect(parseInsight(raw)).toEqual({
      date: "2026-07-01", ad_id: "111", ad_name: "Criativo A",
      campaign_id: "999", campaign_name: "Camp Julho",
      spend: 123.45, impressions: 1000, clicks: 50, leads: 5,
    });
  });

  it("sem actions → leads 0", () => {
    const r = parseInsight({ date_start: "2026-07-02", ad_id: "1", spend: "0" });
    expect(r.leads).toBe(0);
    expect(r.spend).toBe(0);
  });
});
