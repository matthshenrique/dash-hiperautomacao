#!/usr/bin/env bash
# Falha se qualquer dado do cliente reaparecer em QUALQUER arquivo versionado.
# Escaneia o repo inteiro (código, config, scripts, docs) — os docs internos de
# planejamento com dado do cliente já foram removidos do versionamento.
set -uo pipefail

PATTERNS='13024619|100431655|100431875|100431659|100431879|100431651|921382|921380|921376|921964|310488943211423|afc00c68|cupuladigital|apiwpp|acauamedia|[Cc]úpula|[Cc]upula|[Aa]cau[aã]|InfraMatheus|matheusnery'

# ignora apenas este próprio script (contém os padrões) e o lockfile
HITS=$(git grep -nIE "$PATTERNS" -- . \
  ':!scripts/check-clean.sh' ':!package-lock.json' 2>/dev/null || true)

if [ -n "$HITS" ]; then
  echo "✗ dado do cliente encontrado em arquivos versionados:"
  echo "$HITS"
  exit 1
fi
echo "✓ repo limpo (nenhum dado do cliente na superfície shipada)"
