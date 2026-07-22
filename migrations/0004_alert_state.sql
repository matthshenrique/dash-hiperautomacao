-- Último estado de saúde de sync notificado por fonte (evita spam de alertas:
-- só dispara webhook quando o health MUDA, ex. ok->crit ou crit->ok).
CREATE TABLE IF NOT EXISTS alert_state (
  source      TEXT PRIMARY KEY,   -- kommo | meta | evolution
  health      TEXT NOT NULL,      -- ok | warn | crit (último notificado)
  notified_at INTEGER NOT NULL    -- unix (segundos) da última notificação
);
