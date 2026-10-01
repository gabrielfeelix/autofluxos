# Ligação de voz pelo WhatsApp no Inbox: o que a Meta exige, como a mídia funciona, quanto custa

> Pesquisa de **1/out/2026**. Complementa e **corrige** a
> [PESQUISA-VOZ-E-CHAMADA.md](PESQUISA-VOZ-E-CHAMADA.md) (15/set/2026).
>
> Convenção: **[OFICIAL]** = lido em página de developers.facebook.com nesta
> sessão. **[TERCEIRO]** = blog, BSP ou repositório, não é a Meta. **[INFERÊNCIA]**
> = conclusão minha a partir dos fatos, a validar com teste real.

---

## Resposta curta

| Pergunta | Resposta | Confiança |
|---|---|---|
| O muro dos "2.000 destinatários/dia" mudou? | **O número não mudou (continua 2.000), mas o caminho até ele ficou fácil.** Desde 8/out/2025 o limite é **por portfólio empresarial** e o primeiro degrau acima de 250 é **2.000**, alcançável **só com a verificação da empresa (CNPJ)**. Ou seja, o muro virou "o cliente precisa ter verificado o negócio na Meta". A conclusão da pesquisa anterior ("não, só com volume") **está desatualizada**. | OFICIAL |
| Brasil está liberado? | **Sim.** Ligação iniciada pela empresa é bloqueada apenas em EUA, Canadá, Egito, Vietnã e Nigéria. Ligação iniciada pelo cliente vale onde a Cloud API opera. | OFICIAL |
| Número em coexistência (app WhatsApp Business + API) pode ligar? | **Não.** A página de limitações da coexistência diz "Voice/Video Calls: Not supported". Número precisa estar só na Cloud API. | OFICIAL |
| Precisa de servidor de mídia (LiveKit, Janus etc.)? | **Não para 1 atendente por chamada.** A Meta é um peer WebRTC normal: o navegador do atendente pode ser o outro lado, com **uma única RTCPeerConnection**, sem media server. Servidor de mídia só entra se quiser gravar, transcrever, IA de voz, IVR, ou ponte com telefonia. | OFICIAL (modelo) + TERCEIRO (demo funcional) + INFERÊNCIA (produção) |
| Precisa de TURN? | **Sim, na prática.** STUN do Google serve para demo. Para atendente atrás de firewall corporativo/4G, TURN. Cloudflare TURN: US$ 0,05/GB com 1.000 GB/mês grátis. Voz Opus gasta cerca de 0,2 a 0,5 GB por 1.000 minutos, então fica dentro do grátis. | OFICIAL (preço) + INFERÊNCIA (volume) |
| Dá para fazer só com Vercel + Supabase? | **O caminho de sinalização, sim**: webhook `calls` numa rota da Vercel, Supabase Realtime (Broadcast) até o navegador, rota da Vercel chama `/calls` da Meta. **A mídia não passa pela Vercel**, então o limite de conexão longa não pega. Servidor próprio só para gravação/IA. | INFERÊNCIA bem ancorada |
| Custo da Meta, Brasil | **Cliente liga para a empresa: grátis.** **Empresa liga para o cliente: cobrado por pulso de 6 s, só se atendida.** BRL entrou em 1/jul/2026. Tabela BR (terceiro, não confirmei na página da Meta): R$ 0,0556/min até 50 mil min/mês. Pedido de permissão de ligação é mensagem e paga como mensagem. | OFICIAL (regra) + TERCEIRO (valor BR) |
| Limites por cliente final | Pedido de permissão: **1 por 24 h, 2 por 7 dias**. Ligações da empresa: **100 conectadas por 24 h por par** empresa/usuário. Iniciar chamadas: **10.000 por 24 h por número**. 4 não atendidas seguidas revogam a permissão. | OFICIAL |
| Gravação/transcrição | A Meta **não oferece** API de gravação nem transcrição. Quem gravar precisa captar o áudio do próprio lado, e na LGPD exige **aviso e base legal**, não necessariamente consentimento. | TERCEIRO + INFERÊNCIA |
| Fases | 0: pré-requisitos por cliente. 1: receber ligação (MVP). 2: ligar (permissão). 3: endurecer (TURN, horário, perdidas). 4: gravar/transcrever (exige servidor). | INFERÊNCIA |

**Conclusão:** a decisão "não fazer" da pesquisa anterior se baseava num muro que
é, na verdade, a verificação do negócio. Para um cliente como a MGM Pilates, que
tem CNPJ, o muro deixa de existir. O que decide agora é custo de engenharia e
**número em coexistência**, não volume.

---

## 1. Elegibilidade

### 1.1 Os 2.000 e a mudança de 2025 [OFICIAL]

Página [Cloud API Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
(lida em 1/out/2026), pré-requisito 5, literal:

> "The business must have a daily messaging limit of at least 2,000 unique recipients"

Contas de teste/sandbox ficam isentas.

O que mudou, no
[changelog do WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog),
entrada de **8/out/2025**:

> "Messaging limits are now business portfolio-based instead of business phone
> number-based, and the initial increase via scaling path is now 2,000 instead of 1,000."

Na página de [messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits):

- Degraus: **250** (padrão de portfólio novo), **2.000**, **10.000**, **100.000**, ilimitado.
- Para chegar a **2.000**, **uma** das três: (a) verificar a empresa, (b) verificação por parceiro, (c) enviar 2.000 mensagens entregues fora da janela de 24 h, a destinatários únicos, em 30 dias, com template de alta qualidade.
- O limite é **do portfólio**, dividido entre todos os números dele.

**Consequência [INFERÊNCIA]:** verificação do negócio (documento do CNPJ no
Business Manager do cliente) leva o portfólio a 2.000 e satisfaz o pré-requisito
do Calling. A pesquisa de set/2026 tratou o 2.000 como volume acumulado; era só
uma das três rotas, e a mais barata é a verificação.

**Ressalva sobre fonte [TERCEIRO]:** o blog Sanuker diz que a Meta vai remover os
degraus de 2K e 10K e dar 100K direto após verificação (Q1 a Q2/2026). Não achei
isso na página oficial de messaging limits, que ainda lista 2K e 10K. Se for
verdade, ajuda ainda mais; não conte com isso.

**Pegadinha de arquitetura [INFERÊNCIA]:** como o limite é do portfólio do
cliente, é o **portfólio do cliente** (criado no Embedded Signup) que precisa
estar verificado. Se o AutoFluxos usa um portfólio nosso para todos, um cliente
não verificado herda a regra do nosso. Conferir como o onboarding atual cria o
portfólio.

Outras fontes de terceiros ainda dizem "1.000" ou "2.000 conversas"; são
textos antigos ou imprecisos. A Meta diz 2.000 destinatários únicos.

### 1.2 Países [OFICIAL]

- **Iniciada pelo usuário:** onde a Cloud API opera.
- **Iniciada pela empresa:** indisponível em **EUA, Canadá, Egito, Vietnã, Nigéria**. "The business phone number's country code must be in this supported list." Brasil não está na lista.
- A Infobip lista mais países bloqueados (Cuba, Irã, Coreia do Norte, Síria, Turquia, partes da Ucrânia) [TERCEIRO]; nenhum é relevante.

O que vale é o **código do país do número da empresa** (o nosso é +55).

### 1.3 Tipo de número, coexistência, verificação

- Número na **Cloud API**, não no app WhatsApp Business [OFICIAL].
- App assinado no campo de webhook `calls`, assinado na WABA, com `whatsapp_business_messaging` (já temos; sem App Review novo, segundo a pesquisa anterior) [OFICIAL].
- **Coexistência:** em
  [Onboarding business app users](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users),
  a lista de recursos indisponíveis inclui "Voice/Video Calls: Not supported". Wati e 360dialog repetem [TERCEIRO]. **Se o cliente usa o número no celular com coexistência, não há ligação pela API.** Para ligar, o número sai do app e fica só na Cloud API. Isso precisa ser perguntado a cada cliente; é o bloqueio comercial real.
- Sem exigência de verificação própria do Calling além do limite acima [OFICIAL, por omissão].

---

## 2. Fluxos

### 2.1 Iniciada pelo cliente (user-initiated) [OFICIAL]

1. Cliente toca no ícone de ligar do perfil da empresa (ou num botão de ligar).
2. Webhook `calls`, evento **`connect`**, com `direction: "USER_INITIATED"` e **SDP offer** do cliente WhatsApp.
3. A empresa responde `pre_accept` (recomendado) e depois `accept`, ambos com **SDP answer**.
4. Janela: **cerca de 30 a 60 segundos** depois do webhook `connect`. Sem resposta, o cliente vê "não atendida".
5. Fim: webhook **`terminate`** com `status` (`Completed`/`Failed`), `start_time`, `end_time`, `duration`.

Atender uma ligação do cliente concede à empresa **permissão temporária** de ligar de volta [TERCEIRO: CM.com, Wati].

### 2.2 Iniciada pela empresa (business-initiated) [OFICIAL]

1. Empresa precisa de **permissão** do cliente (2.3).
2. `POST /<PHONE_NUMBER_ID>/calls` com `action: "connect"` e **SDP offer gerado por nós**.
3. A Meta devolve o `call_id` na resposta e depois manda webhook `connect` com o **SDP answer** do cliente (`direction: "BUSINESS_INITIATED"`).
4. Webhooks de **status** no mesmo campo `calls`: `RINGING`, `ACCEPTED`, `REJECTED`. O `ACCEPTED` chega depois de a chamada estabelecida, para auditoria.
5. Fim: webhook `terminate` com `COMPLETED|FAILED`, duração.
6. Erro **138006** = sem permissão de ligação para esse cliente.

### 2.3 Permissão de ligação [OFICIAL]

Fonte: [user call permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions).

- **Mensagem interativa** (dentro da janela de 24 h): `type: "interactive"`, `interactive.type: "call_permission_request"`, `action.name: "call_permission_request"`, com `body.text`.
- **Template** (fora da janela): componente `{"type": "call_permission_request"}`, categoria MARKETING ou UTILITY.
- **Resposta do cliente**: mensagem de entrada com `interactive.type: "call_permission_reply"`, campos `response` (`accept`/`reject`), `is_permanent`, `expiration_timestamp`, `response_source`.
- **Temporária**: 7 dias corridos (168 h). **Permanente**: não expira (o cliente escolhe "Permitir ligações"), mesmo teto de ligações conectadas.
- **Consulta de estado**: `GET` de call permissions devolve `permission.status` (`temporary`/`permanent`), `expiration_time`, e a lista `actions` com `can_perform_action` e `limits` (`PT24H`, `P7D`, `current_usage`). Serve para decidir se o ícone de telefone liga direto ou pede permissão.
- **Revogação**: o cliente revoga quando quiser nas configurações; 4 ligações seguidas não atendidas revogam sozinhas; com 2 seguidas a Meta manda uma mensagem de "reconsiderar".
- Atenção ao `callback_permission_status` nas call settings: "prompts users for callback authorization after connected or missed calls" (a Meta pergunta ao cliente se aceita retorno), útil para colher permissão de graça.

### 2.4 Limites [OFICIAL, página de calling]

| Limite | Produção | Sandbox |
|---|---|---|
| Pedidos de permissão por par | 1 por dia, 2 por semana | 25 por dia, 100 por semana |
| Ligações conectadas da empresa por par | 100 por dia | n/d |
| Não atendidas seguidas (reconsideração / revogação) | 2 / 4 | 5 / 10 |
| Novas ligações por número | 10.000 por 24 h | n/d |

Observações: ainda circulam "5 por dia" (Gupshup) e "10" em textos de terceiros. O
wuseller registra o aumento de 10 para 100 em dez/2025 [TERCEIRO]. Os contadores
de pedido de permissão zeram quando uma chamada se conecta [TERCEIRO: respond.io].
"1.000 chamadas simultâneas de entrada e 1.000 de saída por número" é dado de
terceiros (Wati); a página oficial não especifica concorrência.

### 2.5 Botão de ligar e deeplink [OFICIAL]

Fonte: [call button messages and deep links](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-button-messages-deep-links).

- **Mensagem interativa**: `interactive.type: "voice_call"`, `action.name: "voice_call"`, `parameters`: `display_text` (máx. 20 caracteres), `ttl_minutes` (1 a 43.200), `payload` (máx. 512). O toque inicia ligação do **cliente para a empresa** (user-initiated, grátis).
- **Template**: botão `voice_call`, `ttl_minutes` entre 1.440 e 43.200.
- **Deeplink**: `https://wa.me/call/<NUMERO_DA_EMPRESA>`, opcional `?biz_payload=...`. **Só funciona em mobile**, não no desktop.
- No webhook `connect` o payload volta em `deeplink_payload` / `cta_payload`.

Útil: **o botão de ligar em template/mensagem gera chamada grátis** (do cliente
para nós), em vez de nós ligarmos e pagarmos. Para o negócio, "me ligue" sai mais
barato que "vamos ligar".

---

## 3. Endpoints e webhooks [OFICIAL]

Todos em `POST https://graph.facebook.com/<versão>/<PHONE_NUMBER_ID>/calls`,
`messaging_product: "whatsapp"`:

| Ação | Corpo essencial | Resposta |
|---|---|---|
| Iniciar (empresa) | `to` (ou `recipient`), `action: "connect"`, `session: {sdp_type: "offer", sdp}`, `biz_opaque_callback_data` opcional | `{"calls":[{"id":"wacid...."}]}` |
| Pré-aceitar | `call_id`, `action: "pre_accept"`, `session: {sdp_type: "answer", sdp}` | `{"success": true}` |
| Aceitar | `call_id`, `action: "accept"`, `session` (answer), `biz_opaque_callback_data` opcional | `{"success": true}` |
| Rejeitar | `call_id`, `action: "reject"` | `{"success": true}` |
| Encerrar | `call_id`, `action: "terminate"` | `{"success": true}` |

Regras de SDP [OFICIAL]:

- SDP em conformidade com **RFC 8866**.
- O SDP answer do `accept` **tem que ser igual** ao do `pre_accept` da mesma chamada, senão erro.
- Só faça o áudio fluir depois do **200 OK** do endpoint.
- `pre_accept` evita "audio clipping" e acelera a conexão.
- Guarde o `call_id` do webhook `connect`.
- DTMF só com clock rate **8000**.

Webhook: campo **`calls`** no app (assinatura na WABA). Forma:
`entry[].changes[].value.calls[]` com `id`, `to`, `from`, `event`
(`connect`/`terminate`), `direction`, `timestamp`, `session` (no connect),
`status`/`start_time`/`end_time`/`duration` (no terminate), `deeplink_payload`,
`cta_payload`, `biz_opaque_callback_data`. Status de ligação da empresa vêm em
`value.statuses[]` com `type: "call"`. Há campos de BSUID (`user_id`,
`parent_user_id`, `from_user_id`) ao lado do telefone: **o payload já prevê
usuário sem telefone visível**, cuidar disso no mapeamento ao contato.

**Call settings** [OFICIAL], [call settings](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-settings):
`POST /<PHONE_NUMBER_ID>/settings` com `calling`:

- `status`: `ENABLED`/`DISABLED` (DISABLED esconde o ícone de ligar).
- `call_icon_visibility`: `DEFAULT` ou `DISABLE_ALL` (botões em mensagem/template seguem funcionando).
- `call_icons.restrict_to_user_countries`: lista de países (ex.: `["BR"]`).
- `call_hours`: `status`, `timezone_id` (ex.: `America/Sao_Paulo`), `weekly_operating_hours` (`day_of_week`, `open_time`, `close_time` em `HHMM`), `holiday_schedule` (até 20). Restringe ligações **de entrada** ao horário; cada POST **substitui** o anterior.
- `callback_permission_status`: `ENABLED`/`DISABLED`.
- `sip`: `status` e `servers`. **Ativando SIP você perde os endpoints de calling da Graph e os webhooks de calling** (ficam desligados por padrão).

---

## 4. Mídia

### 4.1 Como é a mídia [OFICIAL]

Três modos de sinalização/mídia, todos com **Opus**:

1. **Padrão (Graph API + webhooks)**: sinalização HTTPS, mídia **WebRTC (ICE + DTLS + SRTP)**.
2. SIP com WebRTC: sinalização TLS, mídia WebRTC.
3. SIP com SDES: sinalização TLS, mídia SRTP com chave no SDP.

Codecs: **Opus** (principal), **PCMA, PCMU**. SIP: Meta é `wa.meta.vc`, TLS
obrigatório, **sem mTLS**, autenticação digest com senha por número+app obtida
em call settings, uma só SIP server por número.

### 4.2 Quem gera a oferta [OFICIAL]

| Sentido | Offer | Answer |
|---|---|---|
| Cliente liga para a empresa | **Meta**, no webhook `connect` | **Nós**, em `pre_accept`/`accept` |
| Empresa liga para o cliente | **Nós**, em `action: "connect"` | **Meta**, no webhook `connect` |

### 4.3 O navegador fala direto com a Meta? [OFICIAL no modelo, TERCEIRO na prova]

O modelo oficial: a Meta entrega um SDP e espera outro. **Quem produz o SDP não
importa para ela.** Logo, um `RTCPeerConnection` no navegador do atendente pode
ser o peer da Meta.

Prova de que funciona sem media server:

- [webrtc.ventures, nov/2025](https://webrtc.ventures/2025/11/how-to-integrate-the-whatsapp-business-calling-api-with-webrtc-to-enable-customer-voice-calls/)
  e o repositório [WebRTCventures/whatsapp-webrtc-application](https://github.com/WebRTCventures/whatsapp-webrtc-application):
  servidor Node recebe o webhook, repassa o offer por WebSocket ao navegador, o
  navegador faz `createAnswer()` e o servidor posta o answer na Meta. **Uma só
  RTCPeerConnection, entre o navegador e a Meta**. O próprio artigo lista TURN e
  produção como lacunas.
- [arslan1317/whatsapp-calling](https://github.com/arslan1317/whatsapp-calling)
  faz o oposto: servidor com `wrtc` (peer no servidor) e ponte de áudio para o
  navegador. Dá para gravar/tratar áudio, ao custo de um processo contínuo.

**O que isso muda [INFERÊNCIA]:** para "atender e falar no navegador", **não
precisa de LiveKit, Janus, mediasoup, FreeSWITCH nem Asterisk**. Ponto de atenção
a validar na prática: a oferta da Meta traz os candidatos ICE; o answer do
navegador deve sair **com os candidatos já dentro** (esperar `iceGatheringState ===
"complete"` antes de postar), porque a doc não descreve trickle ICE. A página não
fala de `ice-lite` nem de `a=setup`; só um teste real confirma.

### 4.3.1 Quando o servidor de mídia passa a ser necessário [INFERÊNCIA]

| Necessidade | Precisa de servidor? |
|---|---|
| Atendente no navegador, 1 a 1 | Não |
| Gravar a chamada | **Sim** (ou gravar só no navegador, frágil e sem controle) |
| Transcrição/IA em tempo real | **Sim** |
| IVR / fila / URA / transferência entre atendentes | **Sim** (ponte, ou SIP) |
| Ligar para PBX existente | SIP (Asterisk/FreeSWITCH) |
| Conferência com 3 pessoas | Sim (SFU como LiveKit) |

Transferência de uma chamada entre atendentes com peer no navegador exige renegociar
SDP com a Meta, o que a doc não descreve; trate como fora de escopo.

### 4.4 TURN [OFICIAL para preço, INFERÊNCIA para volume]

Precisa-se de TURN do lado do **navegador do atendente** (a Meta tem IP público).
Sem TURN, atendente em rede corporativa restritiva fica sem áudio.

| Provedor | Preço | Observação |
|---|---|---|
| [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/faq/) | **US$ 0,05/GB** de saída, **1.000 GB/mês grátis**; entrada grátis | Credenciais de curta duração (até 48 h) por API; só IPv4 de relay; sem relay TCP |
| [Twilio Network Traversal](https://www.twilio.com/en-us/stun-turn/pricing) | US$ 0,40/GB (EUA/Europa), 0,60 (Ásia), **0,80 (São Paulo/Austrália)** | STUN grátis; mais caro |
| [Metered](https://www.metered.ca/pricing) | Grátis 500 MB; US$ 99/mês (150 GB), 199 (500 GB), 499 (2 TB) | Plano fixo |
| coturn próprio | custo de VM | Exige servidor |

Volume estimado [INFERÊNCIA]: Opus de voz fica em 24 a 40 kbps por sentido, algo
como 0,2 a 0,5 GB por 1.000 minutos **se** todo o tráfego passar pelo relay (só uma
parte passa). **Cloudflare cobre o uso inteiro dentro do plano grátis** por muito
tempo. Recomendação: Cloudflare TURN.

---

## 5. Preço

Fonte oficial: [Calling API pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/pricing).

[OFICIAL]:

- "All user-initiated calls are free."
- Ligação da empresa: cobrada por **duração**, **país do número chamado** e **faixa de volume**, em **pulsos de 6 segundos** (56 s = 10 pulsos, arredonda para cima). Parece cobrar só as atendidas; a regra "só se atendida" vem de terceiros.
- Faixas por volume mensal acumulado, no mesmo modelo das mensagens; chamada que cruza faixa é cobrada pela mais barata.
- **Moedas**: BRL entrou em **1/jul/2026** (a tabela de moedas lista BRL "Yes, July 1, 2026"). A cobrança segue o código do país de **quem recebe**.
- "Call permission request messages are subject to per-messaging pricing": o pedido de permissão custa como mensagem.
- Atualizações de tarifa em 1/jan, 1/abr, 1/jul, 1/out. **Hoje é 1/out/2026: a tabela pode ter mudado hoje**; reconferir.

[TERCEIRO] ([nicochat](https://nicochat.com/blog/custo-ligacoes-whatsapp-business), ago/2026, valores em BRL vigentes desde 1/jul/2026; **não consegui ver a tabela na página da Meta**, que só tem links para os PDFs/tabelas por moeda):

| Minutos/mês para o Brasil | R$/min |
|---|---|
| até 50.000 | 0,0556 |
| 50.001 a 250.000 | 0,0350 |
| 250.001 a 1.000.000 | 0,0227 |
| acima | 0,0175 e menos |

Para um estúdio, 1.000 minutos de saída por mês custam em torno de **R$ 55,60**
na faixa base. Entrada é grátis. Mais o pedido de permissão (mensagem utility),
que na tabela de jul/2026 [TERCEIRO: payperwa/outros] ficou em torno de R$ 0,035
por mensagem; confirmar na Meta.

Custos adicionais: nada oficial além disso. Terceiros citam taxas do BSP e
armazenamento de gravação (Wati: US$ 0,01/min acima de 1.000 min grátis), que
são deles. **Para o AutoFluxos, que fala direto com a Cloud API, a conta é a da
Meta + TURN + eventual servidor.**

---

## 6. Implementações de referência

[OFICIAL] só documentação; **não achei repositório de exemplo oficial da Meta** para
calling (a busca só devolveu repositórios de terceiros).

| Referência | O que é | Mídia |
|---|---|---|
| [WebRTCventures/whatsapp-webrtc-application](https://github.com/WebRTCventures/whatsapp-webrtc-application) | Webhook Node + WebSocket + navegador; 5 commits, sem TURN | **Navegador direto com a Meta** |
| [arslan1317/whatsapp-calling](https://github.com/arslan1317/whatsapp-calling) | Express, Socket.IO, `wrtc`; 6 commits | Servidor faz ponte |
| [yasiru2003/buildstart-calling-agent](https://github.com/yasiru2003/buildstart-calling-agent) | Go, entrada e saída | Não verificado |
| [Twilio](https://www.twilio.com/docs/voice/whatsapp-business-calling) | GA no fim de 2025: `<Dial><WhatsApp>`, caller ID `whatsapp:{sender}`, número com Voice ativado, integra gravação, Flex, IVR, STT | Mídia na Twilio |
| [Infobip](https://www.infobip.com/docs/whatsapp/whatsapp-business-calling/business-initiated-calling) | Rotas de voz WhatsApp; SIP/WebRTC | Mídia na Infobip |
| [CM.com](https://knowledgecenter.cm.com/knowledge-center/communications-platform/voice/whatsapp-business-calling) | Via SIP trunk no PBX; PBX com Opus obrigatório | Mídia no PBX |
| [Gupshup](https://partner-docs.gupshup.io/docs/permanent-call-permissions-for-whatsapp-voice) | Permissão de ligação (CPR) pela Partner API | n/d |
| Zenvia, Blip, 360dialog | **Não achei página de Calling**; 360dialog só documenta que coexistência não liga | n/d |

**Padrão dos BSPs [INFERÊNCIA]:** quase todos entregam por **SIP**, porque o
público deles é call center com PBX. O AutoFluxos, com atendente no navegador, fica
no modo padrão (Graph + webhooks), que é o mais simples.

### Limitação da Vercel [TERCEIRO]

- Função serverless tem **duração máxima** (Hobby 10 s, Pro 300 s nos textos
  encontrados; conferir o plano atual). Não segura socket aberto como processo.
- WebSocket em Vercel Functions existe em beta; a conexão fecha no teto de
  duração e o cliente precisa reconectar ([Ably](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them),
  [fórum Vercel](https://community.vercel.com/t/does-vercel-support-websockets-now-that-we-have-fluid-compute/27205.md)).
- **Não importa para a arquitetura abaixo** porque a mídia não passa pela Vercel:
  as rotas só fazem POST/ webhook curtos.

---

## 7. Gravação, transcrição e LGPD

**Da Meta [TERCEIRO, citando a doc; não achei a frase na página oficial]:** "The
Calling API does not provide any API to access call recordings or transcriptions"
(Wati, respond.io). Tecnicamente a mídia é do peer WebRTC, então **gravar é captar
o áudio do nosso lado** (navegador ou servidor). Não achei proibição explícita da
Meta a gravar; **trate como não confirmado** e releia as Business Messaging Policy
antes de lançar.

**LGPD [TERCEIRO, não é parecer jurídico]:**

- Gravar exige **base legal** (art. 7º), não só consentimento. Consentimento é uma
  de dez; execução de contrato (V) e legítimo interesse (IX) são usuais em atendimento.
- **Avisar é obrigatório** em qualquer caso: aviso no início da chamada
  ("esta ligação pode ser gravada") e política de privacidade do cliente.
- **Voz é dado biométrico, sensível**, se usada para identificar ou autenticar a
  pessoa; transcrição para texto de atendimento comum é outra coisa, mas a linha
  é tênue. Evitar modelo de voz.
- O titular pode pedir a gravação dele; precisa de retenção definida e acesso
  restrito.
- **Papel do AutoFluxos [INFERÊNCIA]:** o cliente (ex.: MGM) é o controlador, nós
  somos operadores. A função de gravar deve vir **desligada por padrão**, com
  aviso configurável e prazo de retenção por cliente. **Recomendo não gravar na
  primeira versão.**

---

## 8. Proposta de arquitetura para o AutoFluxos

### 8.1 Sem servidor próprio (Vercel + Supabase) [INFERÊNCIA]

```
Cliente WhatsApp <== mídia WebRTC (Opus/SRTP) ==> navegador do atendente
        |                                               ^
   Meta Cloud API                                       | Supabase Realtime (Broadcast)
        | webhook `calls`                               |   offer, status, terminate
        v                                               |
  /api/webhooks/whatsapp (Vercel)  ---------------------+
        ^
        |  POST pre_accept / accept / connect / terminate (com SDP)
  /api/calls/* (Vercel, autenticado, valida tenant)  <--- navegador (fetch)
```

**Atender (entrada):**

1. Webhook `calls` `connect` chega na rota existente de webhook. Valida assinatura, acha o tenant pelo `phone_number_id`, grava `chamadas` (Postgres, RLS) com `call_id`, `direction`, estado `ringing`.
2. Publica no canal Realtime do tenant (Broadcast, e Presence para saber quem está online). O navegador toca o toque e mostra "Fulano ligando".
3. Atendente clica em Atender: navegador pede o microfone, cria `RTCPeerConnection` com o servidor TURN, `setRemoteDescription(offer)`, `createAnswer`, espera ICE completar.
4. Navegador faz `POST /api/calls/pre-accept` com o answer; a rota chama a Meta; ao receber 200, o navegador segue para `POST /api/calls/accept` com o **mesmo** SDP.
5. O áudio flui. `terminate` do webhook fecha a tela e grava duração.

**Ligar (saída):**

1. Ícone de telefone na conversa. Chama `GET` de permissão (ou lê do cache da tabela do webhook `call_permission_reply`).
2. Sem permissão: botão "Pedir permissão" envia mensagem interativa (ou template fora da janela de 24 h), respeitando 1 por dia, 2 por semana.
3. Com permissão: navegador cria `RTCPeerConnection`, gera offer (com ICE completo), `POST /api/calls/start` chama `connect` na Meta, recebe `call_id`.
4. Webhook `connect` com o answer vai pelo Realtime ao navegador, que faz `setRemoteDescription`. Status `RINGING` e `ACCEPTED` atualizam a tela.

**TURN:** rota `GET /api/calls/ice` gera credenciais efêmeras na Cloudflare (até 48 h de validade) e devolve `iceServers`.

**O que isso NÃO exige:** servidor de mídia, WebSocket na Vercel, processo contínuo.

**Riscos de latência [INFERÊNCIA]:** a janela para atender é de 30 a 60 s; webhook
na Vercel, Realtime e navegador somam poucos centenas de ms. Cold start da função
pode somar 1 a 2 s; aceitável. O `pre_accept` rápido evita corte no início do áudio.

### 8.2 O que exige servidor [INFERÊNCIA]

- Gravação confiável, transcrição, IA de voz, URA/IVR, fila de ligações com
  distribuição, transferência entre atendentes, 3+ pessoas: exigem **peer
  WebRTC no servidor** (`werift`/`wrtc`/LiveKit) rodando em processo contínuo
  (Fly.io, Railway, VM), **não na Vercel**. Passa a ser outra peça a operar.
- Se o atendente fecha a aba durante a chamada, **a chamada cai** (o peer é o
  navegador). Aceitável no MVP; um peer no servidor resolveria.

### 8.3 Fases [INFERÊNCIA]

| Fase | Entrega | Depende de |
|---|---|---|
| **0. Pré-requisitos (por cliente)** | Verificação do negócio na Meta; número **fora** de coexistência; Calling ativado no número; app assinado no campo `calls`; testar em **sandbox/número de teste** (isento dos 2.000) | Humano + painel |
| **1. Receber ligações** | Rota de webhook `calls`; tabela `chamadas`; Realtime; tela de atender; `pre_accept`/`accept`; encerrar; registro de perdida/duração; TURN Cloudflare | Fase 0 |
| **2. Ligar** | Ícone na conversa; permissão (request, reply, GET); `connect` de saída; estados `RINGING/ACCEPTED/REJECTED`; limites na UI | Fase 1 |
| **3. Endurecer** | `call_hours` (horário de atendimento), `callback_permission_status`, perdida vira conversa/tarefa, botão `voice_call` em template ("me ligue", grátis), reconexão, métricas de qualidade | Fase 2 |
| **4. Gravar/transcrever** | Servidor de mídia próprio, aviso de gravação, base legal, retenção | Fase 3 + decisão jurídica |

**Primeira ação barata:** testar o ciclo completo no **sandbox** (sem exigir os 2.000)
antes de qualquer tela, para confirmar ICE/SDP do navegador direto com a Meta.

### 8.4 Pontos abertos para validar com teste real

1. O answer do navegador, com candidatos embutidos, é aceito pela Meta (ICE e `a=setup`)?
2. Desempenho do `pre_accept` mais `accept` a partir de função serverless.
3. Tabela de preço BR oficial em 1/out/2026 (confirmar R$ 0,0556).
4. A Meta permite gravar? Reler a política.
5. Como o onboarding atual cria o portfólio, e se o cliente consegue verificar o negócio.
6. Nenhum cliente em coexistência pode usar. Quantos hoje estão?

---

## Fontes

### Meta (oficial)

- [Cloud API Calling (visão geral, pré-requisitos, países, limites)](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
- [Cloud API Calling, versão /docs](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/)
- [Ligações iniciadas pelo usuário](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-initiated-calls)
- [Ligações iniciadas pela empresa](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/business-initiated-calls)
- [Permissões de ligação do usuário](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions)
- [Botão de ligar e deeplinks](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-button-messages-deep-links)
- [Call settings](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/call-settings)
- [SIP](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/sip)
- [Preços do Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/pricing)
- [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- [Changelog do WhatsApp (calling em 15/jul/2025; limites por portfólio em 8/out/2025)](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- [Coexistência: limitações](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users)

### Terceiros

- [webrtc.ventures: integração Calling com WebRTC, nov/2025](https://webrtc.ventures/2025/11/how-to-integrate-the-whatsapp-business-calling-api-with-webrtc-to-enable-customer-voice-calls/)
- [WebRTCventures/whatsapp-webrtc-application](https://github.com/WebRTCventures/whatsapp-webrtc-application)
- [arslan1317/whatsapp-calling](https://github.com/arslan1317/whatsapp-calling)
- [Twilio: WhatsApp Business Calling](https://www.twilio.com/docs/voice/whatsapp-business-calling)
- [Infobip: chamadas iniciadas pela empresa](https://www.infobip.com/docs/whatsapp/whatsapp-business-calling/business-initiated-calling)
- [CM.com: WhatsApp Business Calling](https://knowledgecenter.cm.com/knowledge-center/communications-platform/voice/whatsapp-business-calling)
- [Gupshup: permissões permanentes](https://partner-docs.gupshup.io/docs/permanent-call-permissions-for-whatsapp-voice)
- [Wati: restrições do Calling](https://support.wati.io/en/articles/12546668-understanding-whatsapp-calling-restrictions-and-guidelines)
- [Wati: preço do Calling](https://www.wati.io/en/blog/whatsapp-business-calling-pricing/)
- [wuseller: Calling, SIP e limites](https://www.wuseller.com/whatsapp-business-knowledge-hub/whatsapp-business-calling-api-integration-sip-limits-2026/)
- [nicochat: custo das ligações, tabela BRL](https://nicochat.com/blog/custo-ligacoes-whatsapp-business)
- [Sanuker: mudanças de 2026 nos limites](https://sanuker.com/whatsapp-api-2026_updates-pacing-limits-usernames/)
- [360dialog: coexistência](https://docs.360dialog.com/docs/resources/phone-numbers/coexistence)
- [Cloudflare Realtime TURN: FAQ e preço](https://developers.cloudflare.com/realtime/turn/faq/)
- [Twilio Network Traversal: preço](https://www.twilio.com/en-us/stun-turn/pricing)
- [Metered: preço](https://www.metered.ca/pricing)
- [Supabase Realtime: limites](https://supabase.com/docs/guides/realtime/limits)
- [Ably: WebSockets na Vercel](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them)
- [Fórum Vercel: WebSocket e Fluid compute](https://community.vercel.com/t/does-vercel-support-websockets-now-that-we-have-fluid-compute/27205.md)
- [Khomp: gravação de chamadas e LGPD](https://communications.khomp.com/blog-eventos/gravacao-chamadas-lgpd/)
- [Briggs: consentimento para gravar ligação](https://usebriggs.com.br/blog/186-precisa-de-consentimento-para-gravar-uma-ligacao)
