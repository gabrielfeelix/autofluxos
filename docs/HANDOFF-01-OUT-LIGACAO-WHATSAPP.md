# Handoff 01/out/2026: ligação de voz pelo WhatsApp no Inbox

Para o próximo agente. Leia inteiro antes de mexer. Valem as regras do repo
(`AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`) e o jeito de trabalhar das
memórias: resposta curta, decisão tomada e implementada (o Gabriel não é dev),
publicar na hora, print em 1440 e 390 antes de entregar tela, sem travessão em
arquivo nenhum, `tsconfig.json`/`next-env.d.ts` do `next dev` não se commitam.

## Andamento da fase 0 (01/out/2026, fim do dia): leia isto primeiro

**Pronto e publicado:**

- `5a7ce51`: o webhook (`src/app/api/webhook/whatsapp/route.ts`) chama
  `guardarEventoDeLigacao` (`src/server/sonda-ligacao.ts`) **antes** de tudo no
  `after()`. Grava cada evento do campo `calls` em `alertas` com
  `titulo = 'sonda: ligação do WhatsApp'` e `visto_em` preenchido (não polui
  `/admin/alertas`). Sem migration. Sai quando a fase 1 estender `chamadas`.
- `scripts/sonda-ligacao/`: página local de prova (`servidor.mjs` + `pagina.html`,
  sem `next dev`). Uso no cabeçalho do `servidor.mjs`: `SONDA_TOKEN` e
  `SONDA_PHONE_ID` no ambiente, abre `http://localhost:4747`, libera o microfone,
  e atende sozinho: lê a oferta, gera a resposta SDP no navegador, chama
  `pre_accept` e `accept`, e loga ICE, conexão e bytes de áudio recebidos.
  Tem também "Ligar (empresa liga)". **Nunca rodou com ligação real.**
- `f8db5f7`: achado dos 2.000 registrado em `docs/PESQUISA-LIGACAO-WHATSAPP.md` §1.1.

**Já conferido na Meta (não refaça):**

- O app `1063817842847269` já assina o campo `calls` (`GET /<app>/subscriptions`).
- `WHATSAPP_TOKEN` (`.env`, system user) alcança a demo e o número de teste.
- **Demo** `+55 44 7400-7438`, `1301107846409860`, WABA `2245936116250161`,
  portfólio `1494483661926723` (verificado). Cloud API pura, sem coexistência.
  Ligar o Calling volta **`138015`** (limite abaixo de 2.000): portfólio em
  `TIER_250`.
- Motivo, pelo `health_status` do número: *"Your display name has not been
  approved yet. Your message limit will increase after the display name is
  approved."* O Gabriel editou o nome para "4YU" no WhatsApp Manager; a Meta
  devolveu `new_name_status: AVAILABLE_WITHOUT_REVIEW` de novo, **sem revisão**.
  Editar o nome não destrava. Sobra: chamado no suporte da Meta (assunto
  "WABiz: Account & WABA", tipo "Messaging Limits",
  `business.facebook.com/direct-support/?business_id=1494483661926723`).
  Ainda não aberto; ofereça escrever o texto.
- Mesmo diagnóstico: WABA da demo com **erro de pagamento `141006`**, bloqueia
  iniciativa da empresa (inclui ligação que a empresa faz).
- **Número de teste** `+1 555-197-7747`, `1171822376025244`: isento dos 2.000.
  Calling em `NOT_SET`. **É o caminho da fase 0.**

**Próximo passo, nesta ordem:**

1. O Gabriel autoriza ligar o Calling no número de teste. O modo automático
   barrou o `POST /1171822376025244/settings` sem autorização explícita; peça
   a frase "pode ligar no número de teste". Corpo:
   `{"calling":{"status":"ENABLED","call_icon_visibility":"DEFAULT","callback_permission_status":"DISABLED"}}`.
2. O Gabriel cadastra o WhatsApp dele como destinatário do número de teste em
   `developers.facebook.com/apps/1063817842847269/whatsapp-business/wa-dev-console/`
   (número de teste só fala com até 5 cadastrados; botões desse painel já
   falharam calados antes, ver `docs/ESTADO.md` "O que custou caro descobrir").
3. Rodar a sonda com `SONDA_TOKEN=$WHATSAPP_TOKEN SONDA_PHONE_ID=1171822376025244`
   e pedir para ele ligar pelo WhatsApp para `+1 555-197-7747`. Sucesso =
   `pre_accept`/`accept` com 200, `conexão connected` e bytes de áudio subindo.
   Falhou: pare, reporte o log, não siga para a fase 1.

**Furos achados para a fase 1:**

- O webhook `account_alerts` é assinado e **descartado** pelo código. É por ali
  que a Meta explica limite negado/adiado. Tratar.
- Elegibilidade por cliente: `GET /<PHONE_NUMBER_ID>?fields=health_status,name_status,whatsapp_business_manager_messaging_limit,is_on_biz_app`
  responde tudo de uma vez. Base para a tela "falta isto para ligar".
- Leitura do banco de produção via Management API foi barrada pelo modo
  automático nesta sessão; peça autorização antes de consultar.

## O pedido

Ligação **real** pelo WhatsApp, dentro do Inbox. Não é o chat do site (esse já
existe, ver abaixo). O atendente:

1. clica num ícone de telefone na conversa de WhatsApp e liga para o cliente
   (ligação que a empresa inicia);
2. recebe a ligação que o cliente faz para o número da empresa e atende no
   navegador (ligação que o cliente inicia).

Tudo pela **WhatsApp Business Calling API** (Cloud API da Meta).

## Leitura obrigatória antes de qualquer código

- `docs/PESQUISA-LIGACAO-WHATSAPP.md`: a pesquisa completa de 01/out (fontes,
  endpoints, webhooks, preço, limites, arquitetura proposta, fases). Separa o
  que foi confirmado em fonte oficial do que é inferência.
- `docs/PESQUISA-VOZ-E-CHAMADA.md`: a pesquisa de set/2026. A conclusão dela
  ("não fazer, exige 2.000 destinatários") **está desatualizada**, ver abaixo.
- `docs/DECISIONS.md`, seção "ligação de voz no chat do site".

## O que a pesquisa achou (resumo; confira na fonte antes de construir)

- **2.000 destinatários/dia continua pré-requisito**, mas desde 8/out/2025 o
  limite é **por portfólio** de negócios e o degrau de 2.000 sai com a
  **verificação da empresa** (CNPJ) ou 2.000 templates entregues em 30 dias.
  Conferir como o nosso onboarding cria o portfólio de cada cliente.
- **Brasil liberado**, nos dois sentidos.
- **Número em coexistência não liga** (doc de coexistência: "Voice/Video
  Calls: Not supported"). A PCYES está em coexistência. Esse é o bloqueio
  comercial real: o número precisa estar só na Cloud API.
- **Sem servidor de mídia** para atendimento 1 a 1: a Meta troca SDP, e o
  navegador do atendente pode ser o único par WebRTC (Opus, DTLS-SRTP). É
  inferência: **o primeiro trabalho é provar isso** num teste real.
- **TURN é necessário na prática.** Cloudflare TURN: 1.000 GB/mês grátis,
  depois US$ 0,05/GB, com credencial efêmera gerada pela API deles.
- **Preço Meta:** a ligação que o cliente faz é grátis; a que a empresa faz é
  cobrada em pulsos de 6 s. Valor BR (cerca de R$ 0,0556/min) veio de
  terceiro, **não confirmado** na página da Meta.
- **Permissão para ligar:** antes de a empresa ligar, o cliente aprova um
  pedido de permissão (no máximo 1 por dia e 2 por semana por par; 4
  ligações não atendidas seguidas revogam). Botão `voice_call` em template e
  link `wa.me/call` fazem o cliente ligar, de graça.
- **Gravação:** não na v1 (exige servidor de mídia e base legal na LGPD).

## O que já existe e deve ser reaproveitado

A ligação do chat do site (commits `5235e79` e `80a16a4`) já resolveu metade
da parte do navegador:

| Peça | Onde | Reaproveitar como |
|---|---|---|
| Tabela de chamadas | `public.chamadas` (migration `0118`, **aplicada em produção**) | Estender, não criar outra: `origem` já aceita `'empresa'`; falta canal WhatsApp, `wa_call_id`, motivo de fim, duração |
| Sinalização e regras | `src/server/chamadas.ts` | Mesmo desenho: o servidor só guarda SDP e status; "o primeiro que atende leva" via `update ... where status = 'chamando'` |
| Telefone do Inbox | `src/components/inbox/telefone-do-inbox.tsx` | Toque, atender, mudo, encerrar, cronômetro, `juntarCandidatos`. Hoje o par do outro lado é o navegador do visitante; no WhatsApp o par é a Meta |
| Aviso de "está tocando" | evento `chamadas` no `/api/clientes/[clienteId]/inbox/stream`, repassado pelo `PulsoDoInbox` como `autofluxos:chamadas` | Mesmo canal. Hoje só liga em conta com ligação do site ativa (`comLigacao`); ampliar para conta com Calling habilitado |
| ICE | `servidoresIce()` lê `CHAMADA_ICE_SERVERS` | Trocar por credencial efêmera da Cloudflare TURN gerada no servidor |

**Limitação herdada que o WhatsApp torna pior:** o Inbox só toca para quem
está com ele aberto. Uma ligação de cliente que ninguém vê é ligação perdida
de verdade. Avaliar push (já existe `sw-push.js` e assinaturas de push do
handoff) para tocar com o Inbox fechado.

## Ordem sugerida

1. **Fase 0, provar o caminho (antes de qualquer tela):** número de teste da
   Meta (isento dos 2.000), assinar o webhook `calls`, habilitar Calling no
   número, receber uma ligação e responder com um SDP gerado num navegador.
   Se a Meta aceitar a resposta do navegador direto, o desenho sem servidor de
   mídia vale. Se não, parar e reportar antes de seguir.
2. **Fase 1, receber:** webhook `calls` na Vercel → linha em `chamadas` → Inbox
   toca → atender (`pre_accept`/`accept` na Graph API com a resposta SDP) →
   `terminate`. Registro da ligação na conversa (o Inbox hoje não mostra
   ligação nenhuma na linha do tempo; vale fazer junto).
3. **Fase 2, ligar:** ícone de telefone no cabeçalho da conversa de WhatsApp;
   sem permissão, o botão manda o pedido de permissão; com permissão, liga.
   Estado da permissão por contato.
4. **Fase 3, endurecer:** TURN da Cloudflare, ligação perdida, toque com Inbox
   fechado, configuração por número (horário, liga/desliga) em Ajustes ›
   WhatsApp.

## Cuidados

- **Banco:** a próxima migration sai de `ls supabase/migrations/ | tail -1`
  (a última hoje é `0118`, mas confira). Nada em produção sem autorização
  explícita do Gabriel; aplicação pela Management API com ensaio em transação
  e `rollback` antes, como a `0118` (ver o registro dela no runbook do banco).
  O cofre desta máquina: `SUPABASE_ACCESS_TOKEN` em
  `4yu-apps/.secrets/4yu.env` e o ref literal `xxxynoshwirupkdzwxbj`.
- **Meta:** o app já tem `whatsapp_business_messaging`; Calling não exige App
  Review novo segundo a doc, mas confirme. Assinar o campo `calls` no webhook
  é configuração no painel do app; mande o link exato para o Gabriel quando
  for passo dele.
- **Coexistência:** antes de vender, a tela precisa dizer com clareza que
  número em coexistência não liga, e por quê.
- **Tom de UI:** SaaS B2B, sem "humano", placeholder começando com "Exemplo:".
- **Custo:** a ligação que a empresa faz é cobrada na WABA do cliente, que já
  precisa ter forma de pagamento (pendência aberta da PCYES e da MGM).
