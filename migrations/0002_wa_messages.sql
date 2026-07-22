-- Metadados de mensagens do WhatsApp (Evolution) p/ tempo de resposta.
-- Só metadados (sem conteúdo): chat, direção e timestamp.
CREATE TABLE IF NOT EXISTS wa_messages (
  id       TEXT PRIMARY KEY,   -- id da mensagem na Evolution
  chat     TEXT,               -- remoteJid da conversa
  from_me  INTEGER,            -- 1 = enviada pelo time, 0 = recebida do lead
  ts       INTEGER             -- unix (segundos)
);
CREATE INDEX IF NOT EXISTS idx_wa_ts ON wa_messages(ts);
CREATE INDEX IF NOT EXISTS idx_wa_chat ON wa_messages(chat, ts);
