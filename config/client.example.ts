// TEMPLATE. O arquivo real (config/client.ts) é gerado pelo instalador a partir
// do .env (npm run gen:config) e é gitignored. NÃO coloque dados reais aqui.
import type { ClientConfig } from "./schema";

export const CLIENT: ClientConfig = {
  nome: "Minha Operação",
  kommoSubdomain: "minhasubconta",
  pipelinesComerciais: [111111],
  status: { agendado: 1, noShow: 2, cancelado: 3, followUp: 4, won: 142, lost: 143 },
  campos: { utm_source: 10, utm_campaign: 11, utm_content: 12, produto: 13 },
  metaAdAccount: "act_000000000000000",
  metaResultActions: ["lead", "offsite_conversion.fb_pixel_lead"],
  evolutionInstance: "",
  evolutionUrl: "",
  tema: { logo: "/logo.svg", corPrimaria: "#6d28d9" },
};

export type { ClientConfig };
