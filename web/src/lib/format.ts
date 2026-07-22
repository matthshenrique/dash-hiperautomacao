export const brl = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const brlShort = (n: number) => {
  const v = n ?? 0;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return brl(v);
};

export const int = (n: number) => (n ?? 0).toLocaleString("pt-BR");

export const pct = (n: number) => `${((n ?? 0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const dateBR = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

export const duration = (seconds: number) => {
  const s = Math.round(seconds ?? 0);
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  const totalMin = Math.round(s / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [`${d}d`];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}min`);
  return parts.join(" ");
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]}/${y}`;
};
