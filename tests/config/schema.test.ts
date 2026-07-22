import { describe, it, expect } from "vitest";
import { buildClientConfig } from "../../config/schema";

const base: Record<string, string> = {
  DASH_NAME: "Minha Op",
  KOMMO_SUBDOMAIN: "minhaop",
  KOMMO_PIPELINES: "111,222",
  STATUS_AGENDADO: "1", STATUS_NOSHOW: "2", STATUS_CANCELADO: "3",
  STATUS_FOLLOWUP: "4", STATUS_WON: "142", STATUS_LOST: "143",
  FIELD_UTM_SOURCE: "10", FIELD_UTM_CAMPAIGN: "11",
  FIELD_UTM_CONTENT: "12", FIELD_PRODUTO: "13",
  META_AD_ACCOUNT: "act_999",
  META_RESULT_ACTIONS: "lead,offsite_conversion.fb_pixel_lead",
  DASH_COLOR: "#6d28d9",
  EVOLUTION_INSTANCE: "", EVOLUTION_URL: "",
};

describe("buildClientConfig", () => {
  it("monta o objeto CLIENT a partir de env válido", () => {
    const { config, errors } = buildClientConfig(base);
    expect(errors).toEqual([]);
    expect(config!.nome).toBe("Minha Op");
    expect(config!.pipelinesComerciais).toEqual([111, 222]);
    expect(config!.status.won).toBe(142);
    expect(config!.metaResultActions).toEqual(["lead", "offsite_conversion.fb_pixel_lead"]);
    expect(config!.tema.corPrimaria).toBe("#6d28d9");
  });

  it("acumula erros de campos faltando/ inválidos com o nome da chave", () => {
    const bad = { ...base, DASH_NAME: "", KOMMO_PIPELINES: "", STATUS_WON: "abc", DASH_COLOR: "roxo" };
    const { config, errors } = buildClientConfig(bad);
    expect(config).toBeNull();
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("DASH_NAME"),
      expect.stringContaining("KOMMO_PIPELINES"),
      expect.stringContaining("STATUS_WON"),
      expect.stringContaining("DASH_COLOR"),
    ]));
  });
});
