export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // secrets (wrangler secret put / dashboard)
  KOMMO_TOKEN: string;
  META_TOKEN: string;
  DASH_KEY: string;
  // opcionais — Evolution API (WhatsApp) p/ tempo de resposta
  EVOLUTION_URL?: string;
  EVOLUTION_KEY?: string;
  // opcional — webhook (Slack/Discord/n8n) p/ alerta ativo quando um sync fica crítico
  ALERT_WEBHOOK_URL?: string;
  // opcional — porta HTTP (Node entrypoint)
  PORT?: string;
}
