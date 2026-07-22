import { BarList } from "./ui";
import { int } from "../lib/format";

export function LossReasons({ data }: { data: { motivo: string; count: number }[] }) {
  const items = data.map((r) => ({ label: r.motivo, value: r.count, display: int(r.count) }));
  return <BarList items={items} color="var(--crit)" empty="Nenhuma perda no período" />;
}
