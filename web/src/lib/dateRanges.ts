export interface Range { from: string; to: string }
export type PresetKey =
  | "hoje" | "ontem" | "7d" | "mes" | "mesPassado" | "3meses" | "tudo" | "custom";

// Usa horário LOCAL do navegador (não UTC): perto da virada do dia, UTC já
// está no dia seguinte enquanto o operador (Brasil, UTC-3) ainda está no dia
// anterior — "Hoje"/"Ontem" tem que bater com o calendário de quem está usando.
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "mes", label: "Esse mês" },
  { key: "mesPassado", label: "Mês passado" },
  { key: "3meses", label: "Últimos 3 meses" },
  { key: "tudo", label: "Período todo" },
];

export function presetRange(key: PresetKey): Range {
  const t = today();
  const y = t.getFullYear();
  const m = t.getMonth();
  switch (key) {
    case "hoje": return { from: ymd(t), to: ymd(t) };
    case "ontem": { const d = addDays(t, -1); return { from: ymd(d), to: ymd(d) }; }
    case "7d": return { from: ymd(addDays(t, -6)), to: ymd(t) };
    case "mes": return { from: ymd(new Date(y, m, 1)), to: ymd(t) };
    case "mesPassado": return {
      from: ymd(new Date(y, m - 1, 1)),
      to: ymd(new Date(y, m, 0)),
    };
    case "3meses": return { from: ymd(new Date(y, m - 3, t.getDate())), to: ymd(t) };
    case "tudo": return { from: "2020-01-01", to: ymd(t) };
    default: return { from: ymd(new Date(y, m, 1)), to: ymd(t) };
  }
}

export function presetLabel(key: PresetKey): string {
  return PRESETS.find((p) => p.key === key)?.label ?? "Personalizado";
}
