// scripts/discover.mjs
// Lista IDs pra preencher o .env. Uso: node scripts/discover.mjs
// Requer KOMMO_TOKEN + KOMMO_SUBDOMAIN (Kommo) e/ou META_TOKEN (Meta) no .env/env.
import { readFileSync, existsSync } from "node:fs";

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
const envPath = process.env.ENV_FILE ?? ".env";
const env = { ...(existsSync(envPath) ? parseDotenv(readFileSync(envPath, "utf8")) : {}), ...process.env };

async function kommo() {
  const sub = env.KOMMO_SUBDOMAIN, tok = env.KOMMO_TOKEN;
  if (!sub || !tok) { console.log("• Kommo: defina KOMMO_SUBDOMAIN e KOMMO_TOKEN no .env pra listar\n"); return; }
  const base = `https://${sub}.kommo.com/api/v4`;
  const h = { authorization: `Bearer ${tok}` };
  try {
    const pipes = await fetch(`${base}/leads/pipelines`, { headers: h }).then((r) => r.json());
    console.log("=== PIPELINES / STATUS (Kommo) ===");
    for (const p of pipes?._embedded?.pipelines ?? []) {
      console.log(`\npipeline ${p.id}  "${p.name}"   → KOMMO_PIPELINES`);
      for (const s of p?._embedded?.statuses ?? []) console.log(`   status ${s.id}  "${s.name}"`);
    }
    const fields = await fetch(`${base}/leads/custom_fields`, { headers: h }).then((r) => r.json());
    console.log("\n=== CAMPOS CUSTOM (Kommo) → FIELD_* ===");
    for (const f of fields?._embedded?.custom_fields ?? []) console.log(`   field ${f.id}  "${f.name}"`);
  } catch (e) { console.error("✗ erro no Kommo:", e.message); }
}

async function meta() {
  const tok = env.META_TOKEN;
  if (!tok) { console.log("\n• Meta: defina META_TOKEN no .env pra listar contas\n"); return; }
  try {
    const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name&access_token=${encodeURIComponent(tok)}`;
    const r = await fetch(url).then((x) => x.json());
    console.log("\n=== CONTAS META (act_...) → META_AD_ACCOUNT ===");
    for (const a of r?.data ?? []) console.log(`   act_${a.account_id}  "${a.name}"`);
  } catch (e) { console.error("✗ erro na Meta:", e.message); }
}

await kommo();
await meta();
console.log("\nCopie os IDs desejados para o .env e rode a instalação de novo.");
