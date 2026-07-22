import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Fixa o fuso horário do processo de teste em America/Sao_Paulo (UTC-3, sem
// horário de verão hoje em dia). Os testes de dateRanges.ts fixam o "agora"
// perto da virada do dia (ex.: 23:30) especificamente para expor bugs de
// cálculo em UTC vs. horário local do operador — isso só é determinístico
// (independente de rodar em CI, máquina local, container, etc.) se o TZ do
// processo Node for fixo. Sem isso, o mesmo teste passaria ou falharia
// dependendo do fuso da máquina que roda `vitest`.
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  root,
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
