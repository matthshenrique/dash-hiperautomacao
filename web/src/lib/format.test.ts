import { describe, expect, it } from "vitest";
import { brl, dateBR, duration, int, monthLabel, pct } from "./format";

describe("brl", () => {
  it("formata valores positivos como moeda BRL", () => {
    expect(brl(1234.5)).toBe((1234.5).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  });

  it("trata undefined/0 como zero", () => {
    // @ts-expect-error propositalmente passando undefined, como o código de produção permite via `n ?? 0`
    expect(brl(undefined)).toBe(brl(0));
  });
});

describe("int", () => {
  it("formata inteiros com separador de milhar pt-BR", () => {
    expect(int(1234567)).toBe((1234567).toLocaleString("pt-BR"));
  });

  it("trata undefined como zero", () => {
    // @ts-expect-error propositalmente
    expect(int(undefined)).toBe(int(0));
  });
});

describe("pct", () => {
  it("formata fração como porcentagem com até 1 casa decimal", () => {
    expect(pct(0.4567)).toBe(`${(45.67).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
  });

  it("trata undefined como zero", () => {
    // @ts-expect-error propositalmente
    expect(pct(undefined)).toBe("0%");
  });
});

describe("dateBR", () => {
  it("converte 'YYYY-MM-DD' para 'DD/MM/YYYY'", () => {
    expect(dateBR("2024-06-15")).toBe("15/06/2024");
  });
});

describe("monthLabel", () => {
  it("converte 'YYYY-MM' para 'mmm/YYYY' em português", () => {
    expect(monthLabel("2024-06")).toBe("jun/2024");
    expect(monthLabel("2024-01")).toBe("jan/2024");
    expect(monthLabel("2024-12")).toBe("dez/2024");
  });
});

describe("duration", () => {
  it("retorna '—' para 0/undefined", () => {
    expect(duration(0)).toBe("—");
    // @ts-expect-error propositalmente
    expect(duration(undefined)).toBe("—");
  });

  it("segundos (< 60s) -> 'Xs'", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(1)).toBe("1s");
  });

  it("minutos (< 3600s) -> 'X min'", () => {
    expect(duration(125)).toBe("2 min"); // 125s = 2.08min -> arredonda para 2
    expect(duration(59 * 60)).toBe("59 min");
  });

  it("horas (< 86400s) -> 'Xh Ymin' quando há minutos", () => {
    expect(duration(8100)).toBe("2h 15min"); // 2h15min
  });

  it("horas (< 86400s) -> 'Xh' quando os minutos arredondam para 0", () => {
    expect(duration(7200)).toBe("2h"); // exatamente 2h, sem minutos
  });

  it("dias (>= 86400s) -> 'Xd Yh Zmin' incluindo dias", () => {
    // Caso relatado: 961h36min não pode continuar em horas, tem que virar dias.
    // 961h36min = 961*3600 + 36*60 = 3.461.760s
    expect(duration(3461760)).toBe("40d 1h 36min");
  });

  it("dias exatos, sem horas nem minutos residuais -> só 'Xd'", () => {
    expect(duration(2 * 86400)).toBe("2d"); // exatamente 2 dias
  });

  it("dias com minutos residuais mas sem horas -> 'Xd Ymin' (omite '0h')", () => {
    expect(duration(86400 + 30 * 60)).toBe("1d 30min"); // 1 dia + 30min
  });
});
