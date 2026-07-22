import { StatCard } from "./ui";
import { int } from "../lib/format";

export function MeetingsPanel(
  { data }: { data: { realizadas: number; canceladas: number; remarcadas: number } },
) {
  return (
    <div className="grid cols-3">
      <StatCard label="Realizadas" value={int(data.realizadas)}
        foot="Reuniões concluídas" footColor="var(--good)"
        tooltip="Lead saiu da etapa Agendado direto para uma etapa seguinte (não No-show/Cancelado) — sinal de que a reunião aconteceu." />
      <StatCard label="Canceladas" value={int(data.canceladas)}
        foot="No-show / canceladas" footColor="var(--crit)"
        tooltip="Lead movido para a etapa No-show ou Cancelado no período." />
      <StatCard label="Remarcadas" value={int(data.remarcadas)}
        foot="Reagendadas" footColor="var(--warn)"
        tooltip="Lead entrou na etapa Agendado 2 ou mais vezes no período (foi reagendado)." />
    </div>
  );
}
