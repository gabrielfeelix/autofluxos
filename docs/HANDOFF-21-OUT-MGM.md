# Handoff: 21/out/2026, MGM Pilates (AutoFluxos + Verandi)

Para o agente que vai atuar na MGM nos dois produtos. Escrito a partir do banco
de produção e dos repositórios em 21/out/2026, 08:15. Se este arquivo contradiz
o código ou os commits, o código vence.

## Leia antes de qualquer coisa

1. `4yu-apps/CLAUDE.md`: segredos, IDs, e o **banco compartilhado** (AutoFluxos em
   `public`, Verandi em `app_verandi`, projeto `xxxynoshwirupkdzwxbj`). Nunca
   `supabase db push`/`db reset` em produção. Nada em produção sem autorização
   explícita do Gabriel.
2. `autofluxos/docs/BANCO-COMPARTILHADO.md` e `verandi/docs/BANCO-COMPARTILHADO.md`.
3. Verandi: `verandi/docs/HANDOFF-13-OUT.md` (o mais recente; continua o
   `HANDOFF-09-OUT.md`, que tem "como trabalhar com o Gabriel" e como ler os
   pedidos da MGM). **`verandi/docs/ESTADO.md` e `HANDOFF.md` estão
   desatualizados** (última revisão 19/ago); há commits até 20/out
   (`c19103e`, contratos). Leia `git log` antes de confiar nos dois.

## Quem é o cliente

- MGM Pilates, **pagante desde 18/set/2026**. Decide: **Daniel Mutti**
  (administrador, não dá aula). Contato técnico do dia a dia: **Eduardo
  Yamamoto** (tráfego), que repassa o que o Daniel decide.
- Empresa no nome da Márcia: `MARCIA GRAMANI MUTTI ESCOLA DE ATIVIDADES FISICAS
  S/S LTDA.` Sala única, Av. Paulista, 352. Professoras: Márcia (coordenadora),
  Nathália, Thalya, Carolina.
- **Verandi** é o sistema administrativo (conta `mgm-pilates`, `app_verandi`,
  `https://verandi.4yu.com.br`). **AutoFluxos** é o bot de WhatsApp, que consulta
  a Verandi pela API v1.
- A conta `mgm-pilates` da Verandi foi zerada em 18/set para o recibo começar do
  1: **nunca crie dado de teste nela**. Telefone com DDD 44 em dado de cliente é
  teste do Gabriel, nunca aluno real.

## AutoFluxos da MGM, em números (21/out)

- Cliente `5de5a891-790f-4c14-b60b-ce0a573fe1c7`.
- Número ativo: **+55 11 93213-9312**, `phone_number_id` `1367755576419725`,
  token próprio (Embedded Signup, `token_ref`). Há um segundo canal `pausado`
  sem número; ignore.
- Fluxo principal: **Fluxo - Atendimento** (sem IA). Outros publicados e ativos:
  Agendamento, Reagendamento, Não Comparecimento, Licença, e **Atendente de IA**
  (único com IA ligada).
- Outubro até agora: 289 mensagens enviadas pela API, 0 falhas; 54 contatos.

## ALERTA: a conta de WhatsApp da MGM está bloqueada na Meta

Consulta de `health_status` do número em 21/out, 08:12:

- **WABA BLOCKED, erro 141006**: "There is an error with the payment method.
  This will block business initiated conversations." Ou seja: respostas dentro
  da janela de 24h ainda saem (por isso 0 falhas), mas **toda mensagem que o
  estúdio inicia** (modelo de lembrete, reagendamento, não comparecimento,
  transmissão) **não sai**. E quando o mês passar de 1.000 mensagens de serviço,
  **tudo** para, como aconteceu com a PCYES em 19/out às 16:55.
- **BUSINESS LIMITED, erro 141010**: a empresa não passou na verificação de
  empresa da Meta.
- Número `TIER_250`, qualidade GREEN, nome de exibição ainda não aprovado.

O que resolve é humano, no portfólio da MGM (não da 4YU): cadastrar cartão em
Cobrança e pagamentos, vincular à conta do WhatsApp da MGM, preencher CNPJ em
"Faltam informações da empresa". O passo a passo exato, com as armadilhas
(editor financeiro, cartão precisa aparecer na aba Contas do WhatsApp Business,
moeda BRL), foi feito na PCYES em 20/out. Preço em BRL: R$ 0,035 por mensagem
de serviço acima de 1.000/mês; marketing ~R$ 0,33 a 0,35 desde a primeira.
Antes de cobrar o Gabriel, confira se algum envio de modelo da MGM está
falhando (`messages.situacao = 'falhou'`, `mensagens_agendadas`).

Como consultar a saúde do número (o token do canal mora no cofre do banco):
script com `acharCanalPorNumero('1367755576419725')` + `lerTokenDoCanal`, e
`GET graph.facebook.com/v23.0/{phone_number_id}?fields=health_status,messaging_limit_tier,quality_rating`.
Rode com jiti a partir de `autofluxos/` (`server-only` precisa de alias para um
módulo vazio) e `node --env-file=.env`.

## O que mudou no AutoFluxos em 19 a 21/out e vale para a MGM

Tudo em produção, deploy conferido READY.

- `78e901ad`: a IA lê a **conversa atual** inteira (até 40 mensagens, cortada na
  abertura da conversa pelo bot ou numa pausa de 24h), não as últimas 10.
  Retomada nasce sem as variáveis de decisão da conversa anterior (escolha de
  botão, saída de IA); fala da equipe nas últimas 2h conta como retomada.
  `src/core/conversa-atual.ts`, `src/server/receber-mensagem.ts`.
- `4c37f5a6`, `4904a125`: **Religar o bot** responde na hora se a última
  mensagem é do cliente, e libera a espera depois da fala da equipe pelo
  celular (marco `RELIGOU_O_BOT` em `eventos_do_contato`).
- `40c25fc1`: mensagem que a Meta recusa mostra "!" vermelho de "Não entregue"
  na bolha e na fila (`Tiques`, `src/components/inbox/historico.tsx`).
- `53ab7632`: o motivo da falha da Meta vai para o log da Vercel
  (`[status] falha da Meta`). Ler com `npx vercel logs --token $VERCEL_TOKEN
  --scope team_hmVHyYO1YFO9fuAtpG9Ym2hm --project autofluxos --query "falha da Meta"`;
  o MCP da Vercel dá 403 neste time.
- `7b2c65c3`: busca da Inbox filtra enquanto digita.
- `9dc5ddf2`: Cerebras e Mistral saíram da cadeia de IA. Produção só tem
  `GEMINI_API_KEY` e `GROQ_API_KEY`. **O Gemini grátis treina com os dados**
  (LGPD); IA paga estava prevista para ~2 semanas a partir de 19/out.

## Como trabalhar com o Gabriel (resumo das memórias)

- Responder em pt-BR, curto, decisão tomada e implementada. Não é dev.
- **Travessão proibido** em todo texto e arquivo.
- Commit e push na hora, juntando commits da mesma frente. Push só com o
  `GITHUB_TOKEN` do cofre via credential helper inline (403 sem ele).
- Validar com `tsc`; não rodar a suíte inteira; e2e só um spec, nunca em
  paralelo com build (derruba a WSL).
- UI: print local em 1440 e 390 antes de entregar; ações otimistas, sem
  `revalidatePath` da rota aberta; placeholder começa com "Exemplo:"; tom de
  SaaS B2B, sem gíria.
- Sempre mandar link clicável ao guiar em painel externo.
- Conferir deploy READY na Vercel antes de dizer "no ar"; a cota de deploy é
  Hobby e compartilhada com a Verandi (push da `main` da Verandi publica).
- Pendências que dependem dele vão em `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.

## Ponto de partida sugerido

1. Confirmar com o Gabriel se a MGM já sabe do bloqueio de pagamento e quem
   cadastra o cartão no portfólio deles; anotar em `PENDENCIAS-DO-GABRIEL.md`.
2. Ler `verandi/docs/HANDOFF-13-OUT.md`: item 3 (faltas justificadas) foi
   finalizado pelo Daniel (confirmado em 21/out). Item 5 (conferir logado)
   continua em aberto.
