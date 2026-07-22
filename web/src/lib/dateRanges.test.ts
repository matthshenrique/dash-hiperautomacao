import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESETS, presetLabel, presetRange } from "./dateRanges";

// O bug original: presetRange() usava toISOString() (sempre UTC) para
// calcular "hoje", em vez do horário local do operador. Perto da virada do
// dia em horário de Brasília (21h-24h local, quando UTC já virou o dia
// seguinte), "Ontem" acabava calculando a data errada (ficava igual ao
// "Hoje" correto, e "Hoje" ficava um dia adiantado).
//
// Para expor esse bug de forma determinística, fixamos o "agora" em
// 2024-06-15 23:30 no horário LOCAL do processo de teste. O
// web/vitest.config.ts fixa process.env.TZ = "America/Sao_Paulo" (UTC-3),
// então "agora" local = 2024-06-15 23:30, mas o instante UTC correspondente
// já é 2024-06-16 02:30. Uma implementação baseada em toISOString().slice(0,10)
// leria "hoje" (UTC) como "2024-06-16" e "ontem" como "2024-06-15" — que é,
// na verdade, o "hoje" correto do operador. Os asserts abaixo checam os
// valores locais corretos e teriam falhado contra essa implementação antiga.
const FIXED_NOW_LOCAL = new Date(2024, 5, 15, 23, 30, 0); // 2024-06-15 23:30 local

describe("presetRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW_LOCAL);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hoje: usa a data local do operador, não a data UTC", () => {
    expect(presetRange("hoje")).toEqual({ from: "2024-06-15", to: "2024-06-15" });
  });

  it("ontem: é o dia local anterior ao 'hoje' local (regressão do bug UTC)", () => {
    expect(presetRange("ontem")).toEqual({ from: "2024-06-14", to: "2024-06-14" });
  });

  it("7d: últimos 7 dias incluindo hoje", () => {
    expect(presetRange("7d")).toEqual({ from: "2024-06-09", to: "2024-06-15" });
  });

  it("mes: do dia 1 do mês corrente até hoje", () => {
    expect(presetRange("mes")).toEqual({ from: "2024-06-01", to: "2024-06-15" });
  });

  it("mesPassado: mês anterior inteiro (do dia 1 ao último dia)", () => {
    expect(presetRange("mesPassado")).toEqual({ from: "2024-05-01", to: "2024-05-31" });
  });

  it("3meses: mesmo dia, 3 meses atrás, até hoje", () => {
    expect(presetRange("3meses")).toEqual({ from: "2024-03-15", to: "2024-06-15" });
  });

  it("tudo: desde uma data fixa de início até hoje", () => {
    expect(presetRange("tudo")).toEqual({ from: "2020-01-01", to: "2024-06-15" });
  });

  it("mesPassado: lida corretamente com a virada de ano (janeiro -> dezembro do ano anterior)", () => {
    vi.setSystemTime(new Date(2024, 0, 10, 23, 30, 0)); // 2024-01-10 local
    expect(presetRange("mesPassado")).toEqual({ from: "2023-12-01", to: "2023-12-31" });
  });
});

describe("presetLabel", () => {
  it("retorna o label correspondente para cada preset conhecido", () => {
    for (const p of PRESETS) {
      expect(presetLabel(p.key)).toBe(p.label);
    }
  });

  it("retorna 'Personalizado' para a chave 'custom'", () => {
    expect(presetLabel("custom")).toBe("Personalizado");
  });
});
