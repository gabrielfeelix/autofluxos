# Handoff 19/out/2026: egress estourado, erro de login e varredura das conversas

Para o próximo agente. Três tarefas, nesta ordem. Leia antes `AGENTS.md`,
`docs/BANCO-COMPARTILHADO.md` e o `CLAUDE.md` de `4yu-apps/`.

## O que aconteceu

- O projeto Supabase de produção `autofluxos` (ref `xxxynoshwirupkdzwxbj`,
  org `4YU Systems` = `jvuutzbrkqqdrencqcbf`) ficou **bloqueado por
  `exceed_egress_quota`** do plano gratuito. Auth e REST respondiam
  `402 {"message":"Service for this project is restricted due to the following
  violations: exceed_egress_quota..."}`; o banco seguia saudável.
- Derrubou os dois produtos que moram nele: **AutoFluxos** (`public`) e
  **Verandi** (`app_verandi`), inclusive o cliente pagante MGM Pilates.
- Última mensagem de WhatsApp recebida antes do bloqueio: **17/10 19:21**
  (America/Sao_Paulo). Gabriel subiu a org para **Pro em 19/10 ~08:20**; auth e
  REST voltaram a 200 na hora.
- Para pagar só o autofluxos, foram **pausados** `radar-ofertas`
  (`fcdkczueohekmgaaacdr`, pausado por API em 19/10) e `Otimiza Gestor`
  (`rpjviwqrgvsczwyjetrt`, já estava). Pausado não cobra compute. **Não
  reative nenhum dos dois dentro da org Pro**: passa a cobrar e não pausa mais.
  Para religar, transfira antes para uma org gratuita.
- Ainda não sabido: se a Meta reentregou as mensagens de 17/10 19:21 a 19/10
  08:20. Confira `select max(ts), count(*) from messages where direcao='entrada'
  and ts > '2026-10-17 22:22+00'`.

## Acesso

- Management API com `SUPABASE_ACCESS_TOKEN` do cofre
  (`4yu-apps/.secrets/4yu.env`) e o **ref literal**; o cofre não tem variável
  `AUTOFLUXOS_*`. SQL só leitura: `POST /v1/projects/<ref>/database/query/read-only`.
- `autofluxos/.env` tem `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (service role
  de produção) para Storage. Nunca imprima valores.
- Gabriel autorizou ler conversas em produção (14/10). **Nada de escrita em
  produção sem autorização explícita**, e nunca `supabase db push`/`reset`.

## Tarefa 1: o que consumiu o egress (e se há bug gastando)

Cota gratuita: 5 GB/mês de egress (banco + Storage + realtime + funções). No
Pro são 250 GB, com spend cap ligado. Achar a fonte e corrigir se for defeito.

Suspeitos a medir, do mais provável ao menos:
1. **Storage**: mídia do inbox (`autofluxos-recebidos`, `autofluxos-acervo`,
   `autofluxos-negocios`, `autofluxos-avatares`, `logos`) e da Verandi
   (`foto-pessoa`, `assinatura-recibo`). URL assinada de 1h reaproveitada a
   cada render e imagem sem cache baixam o arquivo inteiro de novo.
2. **Polling / realtime** do inbox (`HANDOFF-02-OUT-INBOX-TEMPO-REAL.md`):
   laço que refaz `select` grande a cada poucos segundos com aba aberta.
3. **Selects sem limite** (lista de conversas, mensagens com `payload`
   inteiro, histórico importado) e crons que varrem tabela inteira.
4. **Webhook** reprocessando ou reentrega em laço.

Como medir: logs da Management API
(`GET /v1/projects/<ref>/analytics/endpoints/logs.all?sql=...` sobre
`edge_logs`, agrupando por `request.path` e somando `response.headers.content_length`),
o relatório de uso do painel (https://supabase.com/dashboard/org/jvuutzbrkqqdrencqcbf/usage)
e `grep` no código pelos pontos acima. Registre os números medidos e o
commit da correção em `docs/DECISIONS.md`.

## Tarefa 2: erro de login vira "serviço indisponível"

Com o projeto bloqueado, o login do AutoFluxos mostrava **"muitas
tentativas"** na primeira tentativa, e a Maria (PCYES) e o Gabriel acharam que
era senha. Quando o Supabase responder 402, 5xx ou não responder, a tela deve
dizer "Serviço temporariamente indisponível. Tente novamente em alguns
minutos.", em tom de SaaS B2B. Vale para o login do AutoFluxos e para
`/entrar` da Verandi (`4yu-apps/verandi`). Rate limit de verdade (429 do
GoTrue ou `limites_de_requisicao`) continua com a mensagem própria.

## Tarefa 3: varredura das conversas de MGM e 4YU

Clientes em `clients`: **MGM Pilates** `5de5a891-790f-4c14-b60b-ce0a573fe1c7`
e **4YU** `f175bf85-7ce6-4cc4-a19a-e910df70a53e` (canal do Eduardo, +55 11
91100-1414). Ler todas as conversas (`contacts`, `sessions`, `messages`,
inclusive mídia em `autofluxos-recebidos` pelo campo `arquivo.caminho`) e
procurar:
- bugs do bot: resposta errada, repetida, fora de hora, fluxo travado,
  `messages.situacao` com falha, mensagem que a Meta recusou, IA sem resposta
  (`ia_chamadas`, `alertas`);
- falhas do sistema: atraso, handoff que não chegou ao atendente, duplicidade;
- padrões de automação que funcionam mal e melhorias concretas.

Entregue um relatório curto com evidência (contato, horário, id) e uma lista
priorizada de correções. Corrija o que for bug claro; o que for mudança de
regra ou de texto que o cliente vê, proponha antes.

## Regras da casa (memória do Gabriel)

Resposta em pt-BR, curta; Gabriel não é dev e quer decisão tomada. Sem
travessão em nenhum arquivo tocado. Placeholder de exemplo começa com
"Exemplo:". Validar com `tsc` limpo, nunca a suíte inteira. Commit e push na
hora, com `GITHUB_TOKEN` do cofre via helper inline; conferir deploy READY na
Vercel em segundo plano antes de dizer "no ar". Um processo pesado por vez na
WSL. Telefone DDD 44 em dado de cliente é teste do Gabriel.
