// scripts/gen-config.mjs
// Lê .env, valida via config/schema.ts e escreve config/client.ts.
// Uso: node scripts/gen-config.mjs [--check]  (--check só valida, não escreve)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tsImport } from "tsx/esm/api";

// permite importar TypeScript (config/schema.ts) via tsx, sem precisar de --import na CLI
const { buildClientConfig } = await tsImport("../config/schema.ts", import.meta.url);

function parseDotenv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v[0] === '"' || v[0] === "'") {
      // valor entre aspas: pega o conteúdo até a aspa de fechamento, ignora o resto (comentário)
      const end = v.indexOf(v[0], 1);
      v = end === -1 ? v.slice(1) : v.slice(1, end);
    } else {
      // valor sem aspas: corta comentário inline (espaço + #)
      const h = v.search(/\s#/);
      if (h !== -1) v = v.slice(0, h).trim();
    }
    env[k] = v;
  }
  return env;
}

const checkOnly = process.argv.includes("--check");
const envPath = process.env.ENV_FILE ?? ".env";

if (!existsSync(envPath)) {
  console.error(`✗ ${envPath} não encontrado. Copie .env.example para .env e preencha.`);
  process.exit(1);
}

const env = { ...parseDotenv(readFileSync(envPath, "utf8")), ...process.env };
const { config, errors } = buildClientConfig(env);

if (errors.length) {
  console.error("✗ config inválida — corrija o .env:\n");
  for (const e of errors) console.error("  • " + e);
  process.exit(1);
}

if (checkOnly) {
  console.log("✓ .env válido");
  process.exit(0);
}

const out = `// GERADO por scripts/gen-config.mjs a partir do .env. NÃO editar à mão.
import type { ClientConfig } from "./schema";

export const CLIENT: ClientConfig = ${JSON.stringify(config, null, 2)};

export type { ClientConfig };
`;
writeFileSync("config/client.ts", out, "utf8");
console.log("✓ config/client.ts gerado");
