-- Nomes das etapas (status) dos pipelines do Kommo, p/ rotular receita por status.
CREATE TABLE IF NOT EXISTS crm_statuses (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
