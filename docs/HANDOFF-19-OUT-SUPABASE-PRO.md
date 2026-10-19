# Handoff 19/out/2026: Supabase Pro, endurecer e aproveitar

Para o próximo agente. Foco: banco e Supabase dos dois produtos. Gabriel não é
dev; quer decisão tomada e implementada, resposta curta em pt-BR.

## Leia antes, nesta ordem

1. `4yu-apps/CLAUDE.md` (contrato entre os apps, seção do Supabase).
2. `autofluxos/AGENTS.md` e `autofluxos/docs/BANCO-COMPARTILHADO.md` (regras
   1 a 9 e o checklist do fim; o miolo é histórico de migrations, leia por
   busca).
3. `verandi/docs/BANCO-COMPARTILHADO.md` e o aplicador
   `verandi/scripts/aplica-em-producao.mjs`.
4. `autofluxos/docs/DECISIONS.md`, entrada de 19/out (egress).

## O projeto

- Ref `xxxynoshwirupkdzwxbj`, org `jvuutzbrkqqdrencqcbf`, `sa-east-1`,
  Postgres 17, status `ACTIVE_HEALTHY`. Plano **Pro desde 19/out ~08:20**.
- Dois produtos no mesmo banco: AutoFluxos em `public` (acessa só pelo
  servidor com a chave secreta, RLS ligada e sem políticas, login próprio
  Better Auth em `af_*`) e Verandi em `app_verandi` (Supabase Auth, RLS por
  `conta_id` e papel).
- `radar-ofertas` e `Otimiza Gestor` estão **pausados** na mesma org. Não
  reative dentro da org Pro: passa a cobrar.
- O aviso "Service restrictions are active" do painel é do bloqueio de
  17/out (cota de egress). Já não vale: REST e Auth respondem 200.

## Acesso

- Management API com `SUPABASE_ACCESS_TOKEN` de `4yu-apps/.secrets/4yu.env`.
  Leitura: `POST /v1/projects/<ref>/database/query/read-only`. Escrita:
  `POST .../database/query`, **só com autorização explícita do Gabriel** para
  a ação específica.
- Avisos do painel por API: `GET /v1/projects/<ref>/advisors/security` e
  `.../advisors/performance`.
- Logs: `GET .../analytics/endpoints/logs` (ClickHouse, tabela única `logs`,
  campos em `log_attributes['...']`, no máximo ~1 dia por consulta, throttle
  agressivo). O `logs.all` foi removido em 23/set.
- `pg_stat_statements` mora em `extensions.` (zerado em 11/ago).
- **Nunca `supabase db push` nem `db reset`.** Migration do AutoFluxos:
  arquivo em `supabase/migrations/` (número pelo `ls | tail -1`) e aplicação
  pela Management API. Verandi: o aplicador dela.
- O classificador de permissão do Claude Code barra escrita em produção mesmo
  com o "autorizo" no chat. Peça ao Gabriel para aprovar o aviso quando
  aparecer.

## Os avisos de hoje (medidos em 19/out)

Segurança, 71:

| Aviso | Qtde | Onde | Leitura |
|---|---|---|---|
| `rls_enabled_no_policy` | 59 | 53 `public`, 6 `app_verandi` | Em `public` é a decisão (só servidor acessa, `anon`/`authenticated` sem `GRANT` desde a `0041`). Não crie política "para calar o aviso": política em `public` é exposição pública. Confira as 6 da Verandi uma a uma. |
| função `security definer` executável por `anon`/`authenticated` | 11 | 9 `app_verandi`, **2 `public`** | `public.contato_nasce_com_responsavel` (função de gatilho da `0134`) está executável por `anon` e `authenticated`. Contradiz a regra 6 do runbook (objeto novo nasce fechado). Corrigir: `revoke all on function ... from public, anon, authenticated`. As da Verandi (`tem_papel`, `contas_do_usuario`, `proximo_numero_recibo` para `anon`...) avaliar no repositório dela; `anon` executar `proximo_numero_recibo` parece errado. |
| `auth_leaked_password_protection` | 1 | Auth (global) | `password_hibp_enabled = false`. É do Pro; ligar afeta login dos dois produtos (só a Verandi usa Supabase Auth). |

Desempenho, 249:

| Aviso | Qtde | Onde |
|---|---|---|
| `multiple_permissive_policies` | 126 | todas `app_verandi` (juntar políticas por papel e ação) |
| `unindexed_foreign_keys` | 90 | 50 `public`, 40 `app_verandi` |
| `unused_index` | 26 | 20 `public`, 6 `app_verandi` (não apague sem olhar: o stats pode ser recente) |
| `auth_rls_initplan` | 6 | `app_verandi` (`auth.uid()` sem `(select ...)`) |
| `auth_db_connections_absolute` | 1 | Auth |

## O que o Pro dá e ainda não está em uso

- **Backup**: 8 backups diários (`walg`), **PITR desligado** (add-on pago). Com
  cliente pagante (MGM) nos dois produtos, decidir com o Gabriel se liga PITR.
  Testar restauração ao menos uma vez (restaura em projeto novo, não por cima).
- **Spend cap**: está ligado. Saber o que acontece ao bater (serviço para?).
- **Proteção de senha vazada (HIBP)**, **SSL enforcement**, **restrição de
  rede** do banco, **Smart CDN** do Storage (cache de mídia), **retenção de
  log de 7 dias**, **read replica** e **custom domain**. Cada um é global:
  avaliar os dois produtos antes.
- Projeto separado por produto continua sendo a saída certa quando houver
  verba (runbook, "Quando separar os projetos"); quem sai primeiro é a
  Verandi.

## Prioridade sugerida

1. ~~Fechar as funções expostas~~ **feito em 19/out**: `0136` e `0078_vr`.
   `anon` não executa mais nenhuma `security definer`; as 6 de
   `authenticated` são de propósito. Registro nos dois `BANCO-COMPARTILHADO.md`.
2. ~~Índices das FKs~~ **feito em 19/out**: `0137` (`messages.session_id`) e
   `0079_vr` (`participacao`, `sessao`). `sessions` e `contacts` ficaram sem,
   de propósito: abaixo de 1 ms com poucas centenas de linhas.
3. ~~Juntar as políticas permissivas da Verandi~~ **feito em 19/out**:
   `0080_vr`. Avisos de desempenho que sobram: só FK sem índice em tabela
   pequena (de propósito), `unused_index` e `auth_db_connections_absolute`.
4. Backup: testar restauração; levar ao Gabriel a decisão do PITR.
5. Ligar HIBP e decidir SSL enforcement/restrição de rede.
6. Cada mudança: migration revisada, ensaio em transação com `rollback`
   contra produção antes de aplicar, registro no `BANCO-COMPARTILHADO.md`.

## Feito em 19/out (contexto)

- Egress estourado: causa e correções em `DECISIONS.md` (mídia com endereço
  estável, leituras mais magras, `validateSchema` do Better Auth desligado em
  produção).
- `0135` aplicada: `public.sessions.fluxo_de_volta`.
- Webhook do WhatsApp devolve 503 com o banco fora do ar (a Meta reenvia).
- Login dos dois produtos diz "serviço indisponível" quando o banco cai.
- Assinatura de webhook `instagram` recriada no app da Meta.

## Pendente fora do banco

- Decisões de fluxo da MGM: `docs/VARREDURA-19-OUT-MGM-4YU.md`, seção "Para
  decidir". Gabriel ainda não respondeu.
- Docker Desktop sem integração com a WSL: sem ele não há Supabase local nem
  print das telas da Verandi.
