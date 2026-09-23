#!/bin/bash
# Sobe o painel na porta $PORTA (padrão 3100) contra o Supabase LOCAL, nunca
# contra produção. Vários agentes em paralelo: cada um com a sua PORTA.
#
# O Next também lê o `.env` (credencial de produção). Tudo que importa é
# sobrescrito aqui: banco e chaves apontam para o Docker local, e os tokens de
# WhatsApp, Meta e Gemini viram valor inválido, para nenhum clique na revisão
# visual conseguir mandar mensagem ou gastar IA de verdade.
set -e
cd "$(dirname "$0")/../.."
set -a; . ./.env.teste-local; set +a
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "recusado: SUPABASE_URL não é local" >&2; exit 1 ;;
esac
export DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:56432/postgres}
export SUPABASE_PUBLISHABLE_KEY=$(npx supabase status -o json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).PUBLISHABLE_KEY))")
export PAINEL_SENHA=senha-de-teste-local PAINEL_SEGREDO=segredo-de-teste-local-sem-valor
export BETTER_AUTH_SECRET=better-auth-de-teste-local-sem-valor-xxxxxxxx BETTER_AUTH_URL=http://localhost:${PORTA:-3100}
export WHATSAPP_TOKEN=off-local META_APP_SECRET=off-local INSTAGRAM_APP_SECRET=off-local GEMINI_API_KEY=
exec npx next dev --port "${PORTA:-3100}"
