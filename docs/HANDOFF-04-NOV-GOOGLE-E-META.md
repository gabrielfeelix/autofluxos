# Handoff 04/nov/2026: login Google, Google Agenda, Messenger, comentário de página

Gabriel quer as quatro frentes no ar **hoje**, para gravar os vídeos de revisão
(Meta e Google). Executar a lista inteira, nesta ordem, commitando e publicando
cada frente quando ficar pronta. Print em 1440 e 390 de toda tela nova.

## O que já está pronto (não refazer)

- Resposta a comentário do **Instagram**: Automações → Gatilhos → Comentários.
  Commits `56cf1642` e `34ba1a50`; migrations `0160` e `0161` (aplicadas).
  Código: `src/server/receber-comentario-do-instagram.ts`,
  `src/server/instagram/comentarios.ts`, `src/server/repos/respostas-a-comentarios.ts`,
  `src/core/comentarios.ts`, `src/components/gatilhos/comentarios.tsx`.
  A regra pode abrir um fluxo próprio (`escolherAbertura` em
  `src/server/receber-mensagem.ts`, item 2.5). Nunca testado com comentário real.
- Painel da Meta: webhook `comments` do Instagram assinado e
  `instagram_business_manage_comments` adicionada. A conta de teste ainda está
  inscrita só em `messages` (precisa reconectar; está em PENDENCIAS).
- Não existe hoje: login com Google, Google Agenda, Messenger, comentário de
  página do Facebook. Conferido no código em 04/nov.

## 1. Login com Google (menor, primeiro)

- Auth é Better Auth em `src/server/auth.ts` (só e-mail e senha hoje). Ligar
  `socialProviders.google`, com vínculo pela conta de mesmo e-mail.
- Botão "Entrar com Google" em `/entrar` e no cadastro, com o logo oficial
  (regra: marca de terceiro só com logo oficial).
- Escopos só `openid email profile`: não exigem verificação do Google, só a
  tela de consentimento com marca.
- **Humano:** criar o cliente OAuth (Web) e mandar ID e segredo para o cofre e
  a Vercel (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Retorno:
  `https://dialogon.com.br/api/auth/callback/google`.
  https://console.cloud.google.com/apis/credentials?project=yu-automation
- Auth é **global** no Supabase (ver `docs/BANCO-COMPARTILHADO.md`): conferir
  que as tabelas do Better Auth são as `af_*` do AutoFluxos e que nada da
  Verandi muda.

## 2. Messenger no Inbox

- Canal novo `messenger` em `src/core/canais.ts` (`CANAIS`, `DEFINICAO_DO_CANAL`),
  adaptador irmão de `channels/instagram.ts`, conexão por Facebook Login com
  token de página no cofre, como o Instagram (`src/server/instagram/conexao.ts`,
  `src/app/api/instagram/retorno/route.ts`).
- **Armadilha:** a assinatura de app do objeto `page` tem **uma** URL de
  retorno, e hoje é `https://dialogon.com.br/api/webhook/leadgen` (campo
  `leadgen`). Messenger (`messages`) e comentário (`feed`) chegam no mesmo
  objeto. Fazer o `leadgen/route.ts` despachar por campo (ou trocar para uma
  rota única de página que despacha), sem quebrar o Lead Ads. Conferir a
  assinatura atual com `GET /1063817842847269/subscriptions` usando
  `1063817842847269|$META_APP_SECRET` (`.env`).
- Inscrever a página: `POST /{page-id}/subscribed_apps?subscribed_fields=messages,feed,leadgen`.
- Permissões para a revisão: `pages_messaging`, `pages_manage_metadata`,
  `pages_show_list`, `pages_read_engagement`.
- Como o token de página do Lead Ads é obtido hoje: `docs/LIGAR-LEAD-ADS-PASSO-A-PASSO.md`.

## 3. Comentário de página do Facebook

- Reaproveitar `respostas_a_comentarios` (a regra já tem `channel_id`): a regra
  passa a valer para o canal Messenger também; a tela ganha a escolha da conta
  (Instagram ou página), com selo do canal.
- Webhook `feed` com `item: comment`, `verb: add`. Ignorar comentário da
  própria página (laço da resposta pública).
- Direct: `POST /{page-id}/messages` com `recipient.comment_id`. Pública:
  `POST /{comment-id}/comments`. Permissão extra: `pages_manage_engagement`.
- Abrir fluxo próprio funciona igual (`comentarioEsperandoResposta`), trocar o
  filtro `canalSalvo.provider === 'instagram'` para incluir `messenger`.

## 4. Google Agenda (maior, por último)

- Entra como mais uma agenda em `AGENDAS_COM_CONECTOR`
  (`src/core/sistemas-dos-ramos.ts`), com `src/server/repos/agendas.ts` e
  `src/server/acoes-agendas.ts`. Ler como Feegow/Trinks se ligam antes de
  desenhar; o bloco `agendar` do fluxo e a tela do CRM têm que enxergar.
- OAuth próprio com `https://www.googleapis.com/auth/calendar.events`
  (sensível: até 100 usuários de teste sem verificação). Token de
  atualização no cofre (`connections`).
- Mínimo para o vídeo do Google: conectar, autorizar, horário livre lido da
  agenda, agendamento criando evento.
- **Humano:** mesmo cliente OAuth do item 1, com o escopo na tela de
  consentimento e o vídeo enviado. Já está em `PENDENCIAS-DO-GABRIEL.md`.

## Antes da revisão da Meta

Contas que gravam o vídeo precisam ter papel no app: @usedialogon como
testadora do Instagram e a página da Dialogon com admin do app.
https://developers.facebook.com/apps/1063817842847269/roles/roles/
