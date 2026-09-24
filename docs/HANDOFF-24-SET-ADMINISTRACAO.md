# Handoff: plano da administração (24/set/2026)

Plano: `docs/PLANO-ADMINISTRACAO-2026-09-24.md` (fases A1 a A7). Execução
parada a pedido do Gabriel por custo de contexto. Tudo abaixo está commitado,
na `main` e publicado (Vercel READY em `f190147`).

## O que está pronto

| Fase | Commit | Principais arquivos |
|---|---|---|
| A1 casca única | `518bc66` | `app/admin/layout.tsx`, `components/design/secoes-da-administracao.tsx`, `barra-lateral.tsx` (prop `area`), `barra-do-celular.tsx` (props `embaixo`, `voltarRotulo`, `rotuloDaNavegacao`), `app/admin/(visao)/page.tsx`, `/painel` e `/admin/contas` redirecionam |
| A2 organizações | `afcae57` | `app/admin/organizacoes/(lista)`, `organizacoes/[id]/*` (Resumo, Dados, Plano, Pessoas, Auditoria, Zona de perigo), `server/repos/organizacoes.ts`, `server/acoes-admin.ts`, `core/funcoes.ts` + teste, `server/pessoas.ts` |
| A3 usuários | `cf8b496` | `app/admin/usuarios`, `components/admin/tabela-de-usuarios.tsx`, `server/repos/usuarios-da-plataforma.ts` |
| A4 consumo/alertas/auditoria | `36c8aa5` | `app/admin/{consumo,alertas,auditoria}`, `components/admin/tabela-de-{alertas,auditoria}.tsx` |
| A5 plano | `af34014` | `app/admin/pedidos`, `organizacoes/[id]/plano`, `server/repos/pedidos-de-plano.ts` (pedidos lidos da auditoria) |
| A6 planos editáveis | `712e0fc` | `supabase/migrations/0099_planos_editaveis.sql`, `server/repos/planos.ts` (reserva em `core/planos.ts`), `app/admin/planos` |
| A7 funções | `f190147` | `supabase/migrations/0100_funcoes.sql`, `server/repos/funcoes.ts`, `server/acoes-pessoas.ts`, `app/admin/funcoes`, `ajustes/equipe/page.tsx` (Pessoas com hierarquia), `ajustes/equipe/funcoes` |

Peças comuns: `components/admin/partes.tsx` (tela, número, tabela, esqueleto),
`components/admin/tabela-de-pessoas.tsx` (admin e organização).

## O que falta (para o próximo agente)

1. **Prints de A7** (1440 e 390): `/admin/funcoes`, `/clientes/<id>/ajustes/equipe`
   logado como `revisao@local.test` (owner) e como `atende.a2@local.test`.
   Script: `.ux-local/admin.mjs <saida> nome=/caminho` (`EMAIL=` troca o login;
   senha local `senha-local-123456`, a do `suporte.a2@local.test` foi igualada
   no banco local). Olhar e corrigir o que estiver feio.
2. **Teste de ponta a ponta da hierarquia** no navegador: gestor não vê
   administrador, gestor promove atendente a gestor, administrador não passa a
   posse. A regra pura já está testada em `src/core/funcoes.test.ts`.
3. **Resumo final no plano**: preencher a seção "Execução" do plano com o
   quadro acima (a seção "Decisões da execução" já está lá).
4. Avisos de lint (0 erros, 7 avisos) em `server/acoes.ts`: sobras de
   `SO_QUEM_ADMINISTRA`/`podeAdministrarConta` depois de sair a troca de papel.

## Migrations: só no local, produção pendente de autorização

`0099` e `0100` aplicadas só no Docker `supabase_db_autofluxos`. O código
funciona sem elas (planos caem em `core/planos.ts`, funções nos papéis de hoje,
`suspensa_em`/`funcao_id` lidos por `to_jsonb`). A `0100` foi provada sem
mudança de acesso no local (168 capacidades iguais antes e depois). Para
produção, **só com autorização explícita**, pela Management API, em ordem:

```bash
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
for m in 0099_planos_editaveis 0100_funcoes; do
  jq -Rs '{query: .}' < supabase/migrations/$m.sql | curl -sf -X POST \
    "https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    --data-binary @- && echo " ok $m"
done
```

Antes: ensaio `begin; <sql>; rollback;` pela mesma API e releitura objeto a
objeto depois (regras em `docs/BANCO-COMPARTILHADO.md`). Nunca `db push`.

## Atenção: outra sessão na mesma árvore

Uma sessão paralela (plano de navegação, `docs/PLANO-NAVEGACAO-E-CRM-2026-09-24.md`)
tem mudanças não commitadas em `secoes-do-cliente.tsx`, `barra-lateral.tsx`,
`barra-do-celular.tsx`, `ajustes/page.tsx`, `server/acoes.ts` e outros.
Commitar só por caminho, nunca `git add -A`. Ela combinou manter o contrato da
admin na BarraLateral (`area="administracao"`) e sugeriu passar
`recolhidaInicial={await barraRecolhida()}` no `app/admin/layout.tsx` quando o
código dela entrar.
