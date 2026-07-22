// scripts/autoconfig.mjs
// Preenche o .env automaticamente. Pré-requisito: KOMMO_SUBDOMAIN + KOMMO_TOKEN
// já preenchidos no .env. Descobre pipelines/status/campos no Kommo e escreve os
// IDs de volta no .env por heurística de nome. O que não mapear com confiança,
// deixa como está e avisa para você preencher manualmente.
//
// Uso (na VPS, sem buildar):
//   docker run --rm -w /app -v "$PWD":/app node:20-slim node scripts/autoconfig.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function parseDotenv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if (v[0] === '"' || v[0] === "'") {
      const end = v.indexOf(v[0], 1);
      v = end === -1 ? v.slice(1) : v.slice(1, end);
    } else {
      const h = v.search(/\s#/);
      if (h !== -1) v = v.slice(0, h).trim();
    }
    env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

// Substitui (ou adiciona) KEY=value no texto do .env, preservando o resto.
function setEnv(text, key, value) {
  const re = new RegExp(`^(\\s*${key}\\s*=).*$`, "m");
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return text.replace(/\s*$/, "") + `\n${key}=${value}\n`;
}

const envPath = process.env.ENV_FILE ?? ".env";
if (!existsSync(envPath)) { console.error(`✗ ${envPath} não existe. Copie .env.example para .env primeiro.`); process.exit(1); }
let text = readFileSync(envPath, "utf8");
const env = { ...parseDotenv(text), ...process.env };

const sub = env.KOMMO_SUBDOMAIN, tok = env.KOMMO_TOKEN;
if (!sub || !tok) { console.error("✗ preencha KOMMO_SUBDOMAIN e KOMMO_TOKEN no .env antes de rodar."); process.exit(1); }

const base = `https://${sub}.kommo.com/api/v4`;
const headers = { authorization: `Bearer ${tok}` };
const pending = [];

function set(key, id, label) {
  if (id != null && id !== "") {
    text = setEnv(text, key, String(id));
    console.log(`  ✓ ${key} = ${id}  (${label})`);
  } else {
    pending.push(key);
    console.log(`  • ${key} — não identificado; preencha manualmente (${label})`);
  }
}

try {
  // --- pipelines ---
  const pj = await fetch(`${base}/leads/pipelines`, { headers }).then((r) => r.json());
  const pipes = pj?._embedded?.pipelines ?? [];
  if (!pipes.length) { console.error("✗ nenhum pipeline retornado — token/subdomínio corretos?"); process.exit(1); }

  let comerciais = pipes.filter((p) => /comerc|vendas|sdr|comercial/i.test(p.name || ""));
  if (!comerciais.length) comerciais = pipes.length === 1 ? pipes : [];
  if (comerciais.length) {
    const ids = comerciais.map((p) => p.id).join(",");
    text = setEnv(text, "KOMMO_PIPELINES", ids);
    console.log(`  ✓ KOMMO_PIPELINES = ${ids}  (${comerciais.map((p) => p.name).join(", ")})`);
  } else {
    pending.push("KOMMO_PIPELINES");
    console.log(`  • KOMMO_PIPELINES — vários pipelines e nenhum casou "comercial/vendas"; escolha manualmente entre:`);
    for (const p of pipes) console.log(`       ${p.id}  "${p.name}"`);
  }

  // --- status (dos pipelines comerciais, ou de todos se não identificou) ---
  const statuses = (comerciais.length ? comerciais : pipes).flatMap((p) => p._embedded?.statuses ?? []);
  const findStatus = (re) => statuses.find((s) => re.test(s.name || ""))?.id;
  set("STATUS_AGENDADO", findStatus(/agendad|marcad/i), "agendado");
  set("STATUS_NOSHOW", findStatus(/no.?show|não compareceu|nao compareceu|faltou/i), "no-show");
  set("STATUS_CANCELADO", findStatus(/cancelad/i), "cancelado");
  set("STATUS_FOLLOWUP", findStatus(/follow.?up|acompanha|retorno/i), "follow-up");
  // won/lost: IDs globais padrão do Kommo (presentes em todo pipeline)
  text = setEnv(text, "STATUS_WON", "142");
  text = setEnv(text, "STATUS_LOST", "143");
  console.log("  ✓ STATUS_WON = 142 / STATUS_LOST = 143  (padrões do Kommo)");

  // --- campos custom ---
  const fj = await fetch(`${base}/leads/custom_fields`, { headers }).then((r) => r.json());
  const fields = fj?._embedded?.custom_fields ?? [];
  const findField = (re) => fields.find((f) => re.test(f.name || ""))?.id;
  set("FIELD_UTM_SOURCE", findField(/utm.?source|origem/i), "utm_source");
  set("FIELD_UTM_CAMPAIGN", findField(/utm.?campaign|campanha/i), "utm_campaign");
  set("FIELD_UTM_CONTENT", findField(/utm.?content|conteúdo|conteudo|an[úu]ncio/i), "utm_content");
  set("FIELD_PRODUTO", findField(/produto|product/i), "produto");

  writeFileSync(envPath, text, "utf8");
  console.log(`\n✓ .env atualizado.`);
  if (pending.length) {
    console.log(`⚠ revise no .env (não mapeados automaticamente): ${pending.join(", ")}`);
    console.log(`  rode 'node scripts/discover.mjs' para ver a lista completa de IDs.`);
  } else {
    console.log(`  tudo mapeado. Confira o .env e rode o deploy.`);
  }
} catch (e) {
  console.error("✗ erro:", e.message);
  process.exit(1);
}
