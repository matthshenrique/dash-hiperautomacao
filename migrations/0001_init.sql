-- Espelho de leads do Kommo (só campos usados pelas métricas)
CREATE TABLE IF NOT EXISTS leads (
  id             INTEGER PRIMARY KEY,
  pipeline_id    INTEGER,
  status_id      INTEGER,
  price          INTEGER DEFAULT 0,
  created_at     INTEGER,            -- unix
  closed_at      INTEGER,            -- unix, null se aberto
  updated_at     INTEGER,
  loss_reason_id INTEGER,
  loss_reason    TEXT,
  produto        TEXT,
  utm_source     TEXT,
  utm_campaign   TEXT,
  utm_content    TEXT,
  responsible_user_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_pipe    ON leads(pipeline_id);

-- Mudanças de status (para reuniões realizadas/remarcadas)
CREATE TABLE IF NOT EXISTS lead_events (
  id           TEXT PRIMARY KEY,     -- id do evento Kommo (string)
  lead_id      INTEGER,
  created_at   INTEGER,
  status_before INTEGER,
  status_after  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_lead ON lead_events(lead_id);

-- Insights Meta por dia x anúncio
CREATE TABLE IF NOT EXISTS ad_insights (
  date          TEXT,               -- YYYY-MM-DD
  ad_id         TEXT,
  ad_name       TEXT,
  campaign_id   TEXT,
  campaign_name TEXT,
  spend         REAL DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  clicks        INTEGER DEFAULT 0,
  leads         INTEGER DEFAULT 0,
  PRIMARY KEY (date, ad_id)
);
CREATE INDEX IF NOT EXISTS idx_insights_date ON ad_insights(date);

-- Meta do mês (manual)
CREATE TABLE IF NOT EXISTS meta_goals (
  month         TEXT PRIMARY KEY,   -- YYYY-MM
  goal_revenue  INTEGER DEFAULT 0,
  goal_leads    INTEGER DEFAULT 0
);

-- Log de sync
CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT,
  started_at  INTEGER,
  finished_at INTEGER,
  status      TEXT,
  rows        INTEGER,
  error       TEXT
);

-- Cursor incremental (último updated_at sincronizado por fonte)
CREATE TABLE IF NOT EXISTS sync_state (
  source        TEXT PRIMARY KEY,   -- 'kommo' | 'meta'
  last_synced_at INTEGER DEFAULT 0
);
