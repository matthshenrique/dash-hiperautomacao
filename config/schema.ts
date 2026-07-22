// Fonte única dos campos do cliente: mapeia .env -> objeto CLIENT e valida.
export interface ClientConfig {
  nome: string;
  kommoSubdomain: string;
  pipelinesComerciais: number[];
  status: { agendado: number; noShow: number; cancelado: number; followUp: number; won: number; lost: number };
  campos: { utm_source: number; utm_campaign: number; utm_content: number; produto: number };
  metaAdAccount: string;
  metaResultActions: string[];
  evolutionInstance: string;
  evolutionUrl: string;
  tema: { logo: string; corPrimaria: string };
}

type Env = Record<string, string | undefined>;

export function buildClientConfig(env: Env): { config: ClientConfig | null; errors: string[] } {
  const errors: string[] = [];

  const str = (k: string, required = true): string => {
    const v = (env[k] ?? "").trim();
    if (required && !v) errors.push(`${k}: obrigatório e está vazio`);
    return v;
  };
  const int = (k: string): number => {
    const v = (env[k] ?? "").trim();
    const n = Number(v);
    if (!v || !Number.isInteger(n)) errors.push(`${k}: deve ser um número inteiro (recebido "${v}")`);
    return n;
  };
  const intList = (k: string): number[] => {
    const v = (env[k] ?? "").trim();
    if (!v) { errors.push(`${k}: obrigatório (lista de IDs separada por vírgula)`); return []; }
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isInteger(n))) errors.push(`${k}: todos os itens devem ser inteiros (recebido "${v}")`);
    return nums;
  };
  const strList = (k: string): string[] => {
    const v = (env[k] ?? "").trim();
    if (!v) { errors.push(`${k}: obrigatório (lista separada por vírgula)`); return []; }
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  };
  const color = (k: string): string => {
    const v = (env[k] ?? "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) errors.push(`${k}: cor hex inválida, use #rrggbb (recebido "${v}")`);
    return v;
  };
  const adAccount = (k: string): string => {
    const v = (env[k] ?? "").trim();
    if (!v) errors.push(`${k}: obrigatório e está vazio`);
    else if (!/^act_\d+$/.test(v)) errors.push(`${k}: deve começar com "act_" seguido do número (ex.: act_1234567890) — recebido "${v}"`);
    return v;
  };

  const config: ClientConfig = {
    nome: str("DASH_NAME"),
    kommoSubdomain: str("KOMMO_SUBDOMAIN"),
    pipelinesComerciais: intList("KOMMO_PIPELINES"),
    status: {
      agendado: int("STATUS_AGENDADO"), noShow: int("STATUS_NOSHOW"),
      cancelado: int("STATUS_CANCELADO"), followUp: int("STATUS_FOLLOWUP"),
      won: int("STATUS_WON"), lost: int("STATUS_LOST"),
    },
    campos: {
      utm_source: int("FIELD_UTM_SOURCE"), utm_campaign: int("FIELD_UTM_CAMPAIGN"),
      utm_content: int("FIELD_UTM_CONTENT"), produto: int("FIELD_PRODUTO"),
    },
    metaAdAccount: adAccount("META_AD_ACCOUNT"),
    metaResultActions: strList("META_RESULT_ACTIONS"),
    // Evolution é opcional: instância vazia desativa (ver orchestrator.syncEvolution).
    evolutionInstance: str("EVOLUTION_INSTANCE", false),
    evolutionUrl: str("EVOLUTION_URL", false),
    tema: { logo: (env.DASH_LOGO_URL ?? "/logo.svg").trim() || "/logo.svg", corPrimaria: color("DASH_COLOR") },
  };

  return errors.length ? { config: null, errors } : { config, errors };
}
