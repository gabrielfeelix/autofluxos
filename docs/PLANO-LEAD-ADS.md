# Puxar o lead do anúncio: Lead Ads, CTWA e o vínculo com a campanha

> Levantado em 14/set/2026, com a doc oficial da Meta e o estado real do
> código apurados no mesmo dia. Os caminhos de arquivo citados existem; as
> afirmações sobre a Meta trazem a URL da fonte. Onde a doc não confirma, está
> escrito **[NÃO CONFIRMADO]** — e isso é informação, não lacuna a preencher
> com palpite.

## O que se quer

Um lead que veio de anúncio cai no Kanban **sabendo de onde veio**, e o
atendente vê o nome da campanha — não um número de 16 dígitos.

Isso são **dois caminhos diferentes** que a conversa costuma misturar:

| | **CTWA** (clique-pra-WhatsApp) | **Lead Ads** (formulário nativo) |
|---|---|---|
| O que a pessoa faz | clica no anúncio e **manda mensagem** | preenche **formulário dentro do Facebook** |
| Como o dado chega | dentro do webhook `messages` que já recebemos | webhook `leadgen` novo + busca na Graph API |
| Traz telefone? | sim, é o remetente | **só se o formulário pedir** |
| Permissão nova | **nenhuma** | seis, uma delas com App Review |
| Estado no AutoFluxos | **já implementado** | não existe |

A diferença de custo entre as duas colunas é a decisão inteira deste documento.

## Parte 1 — CTWA: já está pronto, falta aparecer

### O que já existe

`src/server/receber-mensagem.ts:73` valida o objeto `referral` com todos os
campos que a Meta manda. `atribuirOrigem()` (linha 330) grava no contato:

```
origem:         'Anúncio' | 'Direto'
origem_anuncio: referral.source_id     (é o ad_id — ver Parte 3)
origem_titulo:  referral.headline
```

Tem teste cobrindo, inclusive o caso sutil: quem chegou direto e depois clicou
num anúncio **continua "Direto"** (`receber-mensagem.test.ts:189` e `:214`).
Isso é atribuição correta — primeira origem ganha.

Como `contacts.campos` é `jsonb` e a lista de leads deriva coluna de cada chave
(`leads/page.tsx:138`, `colunasDosCampos`), a origem **já aparece** na tela de
leads e **já sai no CSV**. Sem código novo.

### O que falta

1. **Destaque no Inbox.** Hoje a origem cai no despejo genérico "O que o fluxo
   coletou" (`inbox/page.tsx:703`), junto do que o bot perguntou. O componente
   `src/components/lead/quem-e.tsx` já reservou o lugar — o comentário nas
   linhas 29-32 diz, com estas palavras, *"quando houver origem de verdade
   (anúncio, link, importação), ela entra aqui"*. É passar três campos e
   filtrá-los do despejo. **Pequeno.**
2. **Guardar o resto do referral.** O schema valida `body`, `source_url`,
   `media_type` e `ctwa_clid`, e o código descarta. Sem migration: é `jsonb`.
   O `ctwa_clid` só interessa se um dia houver Conversions API — mas guardar
   agora é de graça e não guardar é irrecuperável. **Pequeno.**
3. **Filtro "veio de anúncio".** Os rails filtram em memória sobre as 200
   conversas carregadas (`src/components/inbox/fila-local.tsx`). Para esse
   recorte, funciona sem tocar no banco. Filtro sobre a base inteira exigiria
   coluna indexada — outra conversa. **Médio.**

### Armadilha documentada

`ctwa_clid` **é omitido inteiro** quando o anúncio é de WhatsApp Status
([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text)).
Quem usar `ctwa_clid` como teste de "veio de anúncio" vai classificar Status
como orgânico. O teste certo é a presença do `referral`.

## Parte 2 — Lead Ads: o que realmente é preciso

### O desenho, em três camadas

**(a) Assinar o webhook.** Objeto `page`, campo `leadgen`. São três coisas
separadas, e faltar qualquer uma dá silêncio total:

1. o app assina `page`/`leadgen` no painel;
2. o endpoint passa o handshake (`hub.challenge`);
3. **a Página instala o app**: `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`,
   com token de alguém que tenha a tarefa `ADVERTISE` na Página.

O passo (3) é o esquecido. Texto da Meta: *"Webhook notifications will only be
sent if your Page has installed your Webhooks configured-app"*
([doc](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)).

**(b) O payload só traz IDs.** Nunca vem o dado do lead:

```json
{"object":"page","entry":[{"id":153125381133,"time":1438292065,
  "changes":[{"field":"leadgen","value":{
    "leadgen_id":123,"page_id":456,"form_id":789,
    "adgroup_id":111,"ad_id":111,"created_time":1440120384}}]}]}
```

Duas consequências de arquitetura:

- **`changes` é array.** O exemplo oficial traz *dois* leads no mesmo POST.
  Handler que lê `changes[0]` perde lead em rajada.
- **Responder 200 e buscar depois.** Buscar dentro do handler transforma
  lentidão da Graph API em falha de entrega. E a Meta **não reenvia depois de
  um 200** — 200 prematuro é lead perdido para sempre.

**(c) Buscar o lead.** `GET /{LEAD_ID}?fields=...` com **Page token
long-lived**. `field_data` é lista de `{name, values[]}` — mapear por `name`,
nunca por posição, e não assumir que todo formulário tem telefone.

### A restrição que manda no desenho

`contacts` tem `wa_id not null` e `unique (client_id, wa_id)`
(`supabase/migrations/0003_conversas.sql`), e a migration do Kanban diz, na
própria letra, **"O cartão É um contato"** (`0032_quadros.sql:99`).

**Telefone é a identidade do sistema.** Logo:

- formulário **com** telefone → encaixa no modelo atual sem mudança de schema;
- formulário **sem** telefone (só e-mail) → **não tem onde entrar**. Ou o
  formulário passa a exigir telefone (decisão comercial, e reduz volume de
  lead), ou `contacts` passa a aceitar contato sem telefone — o que toca
  dedupe, Inbox, Kanban e envio. Não é ajuste, é mudança de fundação.

A saída barata é **exigir telefone no formulário** e tratar isso como
requisito de setup do cliente, não como limitação a resolver em código.

### O que já existe e serve

| Peça | Onde | Serve para |
|---|---|---|
| `criarContato()` | `src/server/repos/leads.ts:1003` | cria lead sem conversa, com dedupe por telefone e tratamento de corrida (`23505`) |
| `aplicarImportacao()` | `leads.ts:911` | precedente de conciliação em lote: casou / novo / pendente |
| `porNoQuadroPadrao()` | `receber-mensagem.ts:239` | põe contato novo no Kanban sozinho — **mas está preso dentro do fluxo de mensagem** |
| quadro `padrao` | migration `0043` | a conta escolhe qual quadro recebe; nasce desligado |
| `X-Hub-Signature-256` | `webhook/whatsapp/route.ts:57` | mesma verificação serve ao `leadgen` |
| `/api/webhook/` aberto no proxy | `src/proxy.ts:153` | rota nova sob esse prefixo **não** cai no 401 silencioso |
| `criarEstado()` assinado | `src/server/instagram/estado.ts:54` | já compartilhado entre WhatsApp e Instagram; um terceiro OAuth reusa |
| `nome_real` | migration `0018` | onde o nome do formulário entra, com precedência sobre o perfil |

A costura que falta é pequena e clara: **extrair `porNoQuadroPadrao()` de
`receber-mensagem.ts`** para que outra origem de lead possa chamá-la. Hoje
contato criado fora de conversa não entra no quadro.

### Permissões, e o portão que mata protótipo

Seis, para webhook + leitura completa
([doc](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving)):

```
leads_retrieval        ler field_data          ← Advanced Access + Business Verification
ads_management         ad_id / campaign_id
pages_show_list
pages_read_engagement
pages_manage_metadata  webhooks
pages_manage_ads
```

**App em Development mode não lê lead nenhum.** *"You can't retrieve leads if
your app is in Development"*
([doc](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads)).
É o mesmo gênero de armadilha do `403 Release in track targeting no countries`
do Play: o console diz que está tudo certo e a API recusa por um estado que não
é permissão nem código.

**O que já está vencido a nosso favor** (`docs/META-TECH-PROVIDER.md`):
verificação do negócio saiu em 02/09/2026 e o app está **Live** desde
13/09/2026. Os dois degraus lentos já foram pagos. Um review novo entra num app
verificado e publicado, não do zero.

### Talvez não precise de App Review — e dá para descobrir barato

A doc de níveis de acesso diz que **Standard Access basta se o app for usado
somente por pessoas que têm função nele**
([doc](https://developers.facebook.com/docs/graph-api/overview/access-levels/)),
e a de System Users reforça: *"If you are using the API for yourself as a
Direct Developer, you do not need Advanced access or app review"*
([doc](https://developers.facebook.com/docs/business-management-apis/system-users/)).

O arranjo candidato: o cliente adiciona a agência como **parceira** no Business
Manager dele e compartilha Página e conta de anúncios; operamos com System User
do nosso BM.

**Isso dispensa formalmente o review para `leads_retrieval`? [NÃO CONFIRMADO].**
Não há declaração oficial. É plausível pela letra "dados que você não possui
**ou gerencia**", e plausível não é documentado.

**A prova é barata**: montar o arranjo com um cliente real e chamar
`GET /{LEAD_ID}`. Se voltar `field_data`, está resolvido. Se voltar erro de
permissão, o review é necessário. Isso custa uma tarde e responde o que mais
pesquisa não responde — mesma lógica do `validate` do Play.

### O diagnóstico que evita apanhar

`GET /{page_id}?fields=has_lead_access.user_id({user_id})`
([doc](https://developers.facebook.com/docs/graph-api/reference/has-lead-access/))
devolve `app_has_leads_permission`, `user_has_leads_permission`,
`can_access_lead`, `enabled_lead_access_manager`, **`failure_reason`** e
**`failure_resolution`**.

Isso distingue "o app não tem escopo" de "o usuário não tem acesso no Leads
Access Manager" — os dois erram parecido, como o 403 de escopo vs. permissão do
GTM. Vale rodar no onboarding de cada cliente.

Mas, pela lição do `health_status`: **o health check real é tentar buscar um
lead**, não ler um campo de status.

### O que vai quebrar em produção (e não é o código)

O **Leads Access Manager** é permissivo por padrão e o cliente pode fechá-lo sem
avisar. O caveat da Meta é explícito: *"o admin da Página que concedeu as
permissões precisa continuar tendo a permissão de acesso, senão o CRM falhará"*
([Business Help](https://www.facebook.com/business/help/888814071621487)).

Causa-raiz número um de "parou e ninguém mexeu em nada": **a pessoa que
autorizou saiu da empresa.** O token continua válido; o acesso a leads, não.

Some a isso:

- **Retenção de 90 dias.** Passado esse prazo o lead não existe mais na Meta.
  Janela de queda = perda permanente.
- **Rate limit = `200 × 24 × leads_criados_nos_ultimos_90_dias`, por Página.**
  Proporcional ao volume — apertado justamente para quem está começando.
- **Latência de minutos, por contrato.** *"real-time pings occur on events with
  a delay of up to a few minutes"*. Não prometer segundos.

Daí uma conclusão que não é opcional: **webhook como caminho primário mais um
job diário de reconciliação** varrendo `/{FORM_ID}/leads` das últimas 48h.
Webhook perdido é lead perdido, e o cliente só descobre reclamando.

## Parte 3 — O vínculo com a campanha (a parte boa)

Nem o lead nem o `referral` trazem **nome** de campanha. Ambos trazem `ad_id`.
Resolver é uma chamada só, com field expansion:

```
GET /v25.0/{AD_ID}?fields=id,name,adset{name},campaign{name},account_id
```

**E o `source_id` do CTWA É o `ad_id`** — a doc rotula `<AD_ID>` explicitamente.
Ou seja: **um resolvedor serve aos dois caminhos**. O que se construir para
Lead Ads já resolve o nome da campanha do clique-pra-WhatsApp, que hoje só
guarda o número.

Regras de implementação:
- **Cachear** com TTL: o mesmo `ad_id` será resolvido milhares de vezes.
- **Guardar sempre o `ad_id` cru.** Nome muda, ID não. Cliente que renomeia
  campanha não deve reescrever o histórico.
- O token precisa vir de alguém que anuncie **na conta de anúncios E na
  Página**. Se só tiver a Página, lê-se `field_data` e **não** se lê o nome da
  campanha — falha parcial que parece bug e é topologia de permissão.

## Parte 4 — O que o mercado faz (e onde está a brecha)

| Produto | Lead Ads nativo | Mostra **nome** da campanha? |
|---|---|---|
| **PipeRun** (BR) | sim | **sim — anúncio, conjunto e campanha** |
| HubSpot | sim, até no Free | só na timeline; não vira propriedade de workflow |
| Kommo | sim | só o formulário |
| Ploomes | sim | só o formulário, explicitamente |
| SleekFlow | sim | só o Form ID |
| Wati | foco CTWA | só `source_id` — ID, não nome |
| RD Station | **não é nativo** — exige Pluga à parte | — |
| Pipedrive | sem app próprio (Outfunnel, terceiro pago) | — |
| Manychat | **não integra Lead Ads** — só Zapier | — |
| Chatwoot | não captura referral de CTWA (issue aberta) | — |
| Zenvia | sim | polling a cada 30 min |

**A brecha é nítida:** no Brasil, praticamente só o PipeRun resolve o **nome**
automaticamente. O resto entrega ID ou empurra o cliente para Zapier/Pluga por
cima do CRM — no caso do RD Station, o cliente paga os dois e ainda fica com
15 minutos de atraso.

Dores que o mercado documenta e que viram diferencial se resolvidas:

- Token de 60 dias que expira e **quebra em silêncio** — aparece como
  "resultado vazio", não como erro.
- SleekFlow, no pior caso documentado: ao reconectar, recupera **só os 30
  minutos anteriores**. Todo o período desconectado se perde.
- Latência: HubSpot documenta **até 2h**; Pluga→RD **até 15 min**.

Ou seja, **webhook real-time + nome da campanha + alerta ativo de token
expirando** é, junto, o que quase ninguém entrega.

### E nas inboxes de WhatsApp, que é o nosso vizinho direto

Olhando só os concorrentes que são caixa de entrada de WhatsApp — que é o que o
AutoFluxos é — o quadro é ainda mais vazio:

| Produto | Lead Ads nativo | O que mostra na conversa |
|---|---|---|
| Manychat | **não**, só Zapier | nem ID — o nome é digitado à mão, um fluxo por anúncio |
| SleekFlow | sim | Form ID no lead; headline/body/ID no CTWA |
| Wati | **não**, só Zapier | só `source_id` e `source_url` — descarta headline |
| Take Blip | **não** | exige colar JavaScript no bloco Início para ler o referral |
| Zenvia | sim | polling de 30 min; **só o ID**, confirmado em duas fontes |
| Chatwoot | **não** | headline/body no card; fica em `message`, não na conversa |

Dois padrões valem registro, porque são exatamente as duas coisas que
pretendemos fazer diferente:

1. **Nenhum mostra o nome da campanha na conversa.** O Take Blip é o único que
   resolve `ad_id` → nome, com um segundo OAuth de `ads_read` — mas só no
   relatório agregado, não no atendimento.
2. **Nenhum trata Lead Ads e CTWA como o mesmo lead.** Onde há Lead Ads
   (SleekFlow, Zenvia), não há dado de anúncio; onde há dado de anúncio (Blip,
   Wati), não há Lead Ads. Como `source_id` **é** o `ad_id`, unificar os dois
   num resolvedor só é barato para nós e ninguém fez.

A Zenvia merece parágrafo próprio, por ser a que foi mais longe e ainda assim
parar antes. O card de CTWA na conversa mostra *"Fonte, campaign ID, publicação,
URL, origem e data"* — **ID numérico, não nome**
([doc](https://zenvia.movidesk.com/kb/pt-br/article/449472/caixa-de-atendimento)),
e o artigo da versão anterior é explícito: *"ID é o número da campanha... cada
campanha tem um número diferente"*
([doc](https://support.zenvia.com/kb/pt-br/article/379631/visualizar-as-informacoes-dos-leads-das-campanhas-meta)).
É o `referral` cru renderizado, sem enriquecimento.

Três limites deles que valem como aviso para nós:

- **1 campanha = 1 chatbot.** O roteamento de CTWA deles inverte o problema: em
  vez de ler o `referral`, o bot aparece na lista dentro do Gerenciador de
  Anúncios e o anunciante o escolhe. Elimina condição no fluxo, mas obriga um
  bot por campanha — eles próprios recomendam "um por curso, um por país". Não
  escala para dezenas de anúncios, e está em **beta liberado a pedido**.
- **O painel de ROAS só cobre anúncio turbinado de dentro da Zenvia**, Instagram
  → WhatsApp. Campanha montada no Gerenciador não entra.
- **A origem congela no primeiro clique** — mesma regra que já implementamos em
  `atribuirOrigem()`. Bom sinal: a decisão que tomamos é a que o mercado tomou.

O caso do Chatwoot é o mais instrutivo: o referral é gravado inteiro, mas em
`message.content_attributes` em vez de na conversa — então filtro, automação e
relatório por campanha não funcionam. É o mesmo erro que cometeríamos ao deixar
a origem só dentro de `campos` sem promovê-la a algo filtrável. A PR que moveria
o dado para a conversa ([#14121](https://github.com/chatwoot/chatwoot/pull/14121))
foi fechada sem merge.

### UX: onde o lead aterrissa

A convenção mais forte do mercado BR é a do Kommo: **"Leads de entrada"** como
*triagem antes do funil*, não a primeira coluna dele — *"Leads de entrada não
são leads... pelo menos ainda não"*
([doc](https://support.kommo.com/docs/pt-br/handle-incoming-leads)).

Combina com o que já existe aqui: o quadro `padrao` da `0043` nasce desligado e
a conta escolhe qual recebe. Vale considerar coluna de entrada dedicada em vez
de despejar na primeira etapa do funil de vendas.

## Parte 5 — Decisão e esforço

### Escadinha, do mais barato ao mais caro

| # | Etapa | Depende da Meta? | Esforço |
|---|---|---|---|
| 1 | Origem em destaque no Inbox (`QuemE`) | **não** | pequeno |
| 2 | Guardar `body`/`source_url`/`ctwa_clid` | **não** | pequeno |
| 3 | Filtro "veio de anúncio" nos rails | **não** | médio |
| 4 | Extrair `porNoQuadroPadrao()` para uso fora da conversa | **não** | pequeno |
| 5 | Resolver `ad_id` → nome de campanha (serve CTWA **e** Lead Ads) | token de Ads | médio |
| 6 | Webhook `leadgen` + busca + reconciliação diária | 6 permissões, talvez review | grande |
| 7 | Conversions API com `ctwa_clid` | integração de Ads | outro projeto |

**1 a 4 não dependem da Meta para nada** e entregam a maior parte do valor
percebido: o atendente abre a conversa e vê de qual anúncio a pessoa veio.

**5 é a fronteira.** É onde "de graça" acaba e começa token de Ads — mas é
também o item que nos põe na frente de quase todo o mercado brasileiro, e ele
melhora o CTWA que já temos, independente de Lead Ads existir.

**6 é projeto.** Vale quando houver cliente com formulário nativo rodando, não
antes. E o primeiro passo dele não é código: é o teste empírico do arranjo
System User/BM, que decide se há App Review no caminho.

### Recomendação

Fazer 1, 2 e 4 agora. Medir 3 com uso real antes de escolher entre filtro local
e coluna indexada. Tratar 5 como a próxima decisão de produto — ela vale por si
só, mesmo sem Lead Ads. Só entrar em 6 com demanda concreta do BME na mesa.

Isso não é desvio de proposta: a **Fase 10** do `PLANO-MESTRE.md` já prevê
"campanhas: várias portas de entrada por número e **atribuição por anúncio**" e
"OAuth2 como novo tipo de Conexão quando uma integração real exigir".

### Riscos de banco

Nada de 1 a 5 exige migration: origem vive em `contacts.campos`, que é `jsonb`.
O item 6 provavelmente pede tabela de formulários e de leads crus. Se e quando
chegar lá, vale a regra do `AGENTS.md`: a última migration é **`0049`**,
descoberta pelo diretório, e o banco é **compartilhado com a Verandi** —
AutoFluxos em `public`, Verandi em `app_verandi`, sem tocar no que é dela e sem
aplicar nada em produção sem autorização explícita.

## Fontes

- [Webhooks for Lead Ads](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)
- [Retrieving Leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving)
- [Lead Ads (visão geral, Development mode, tokens)](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads)
- [Testing & Troubleshooting (Lead Ads Testing Tool)](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/testing-troubleshooting)
- [`leads_retrieval`](https://developers.facebook.com/docs/permissions/reference/leads_retrieval)
- [Níveis de acesso (Standard vs Advanced)](https://developers.facebook.com/docs/graph-api/overview/access-levels/)
- [System Users](https://developers.facebook.com/docs/business-management-apis/system-users/)
- [`has_lead_access`](https://developers.facebook.com/docs/graph-api/reference/has-lead-access/)
- [Nó Ad/adgroup](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup)
- [Webhook `messages` — objeto `referral` do CTWA](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/text)
- [Conversions API — `ctwa_clid`](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters)
- [Lead Access Manager — restaurar padrão](https://www.facebook.com/business/help/888814071621487)
- [Kommo — Leads de entrada](https://support.kommo.com/docs/pt-br/handle-incoming-leads)
- [PipeRun — integração nativa Lead Ads](https://ajuda.crmpiperun.com/pt-br/articles/17-integracao-com-o-facebook-lead-ads-nativa)
- [Chatwoot — PR #14681, referral do CTWA](https://github.com/chatwoot/chatwoot/pull/14681)
- [Take Blip — identificar usuário vindo de anúncio Click-to-Chat](https://help.blip.ai/hc/pt-br/articles/4474425544087)
- [SleekFlow — Meta ad performance tracking](https://help.sleekflow.io/en_US/integrations/meta-ad-performance-tracking-tools-integration)
- [Wati — identificar conversas de CTWA](http://support.wati.io/en/articles/11463601)
- [Zenvia — card de CTWA na caixa de atendimento](https://zenvia.movidesk.com/kb/pt-br/article/449472/caixa-de-atendimento)
- [Zenvia — informações dos leads das campanhas Meta](https://support.zenvia.com/kb/pt-br/article/379631/visualizar-as-informacoes-dos-leads-das-campanhas-meta)
- [Zenvia — chatbot para campanhas CTWA (beta)](https://support.zenvia.com/kb/pt-br/article/544990/configurando-chatbot-campanhas-ctwa-zcc)
- [Zenvia — integração Facebook Leads (polling de 30 min)](https://support.zenvia.com/kb/pt-br/article/502452/integracao-do-facebook-leads-com-zenvia-customer-cloud)

## Não confirmado (não vire premissa)

- Se System User + asset compartilhado **dispensa** App Review para
  `leads_retrieval`. Teste empírico resolve.
- `campaign_id`/`adset_id` no nó do lead: a doc cita, o exemplo de resposta não
  mostra. Testar com `?fields=` explícito.
- `is_organic` e `platform` como campos da Graph API no lead (só confirmados no
  export TSV).
- `leadgen_fat` e `leadgen_update`: existem no enum de `subscribed_fields`, sem
  documentação.
- `ads_read` como alternativa suficiente a `ads_management`.
- Requisitos de admissão ao programa CRM Partner (o programa existe; o
  checklist não foi confirmado). **Não é requisito** para agência: webhook +
  Graph API é caminho de primeira classe na doc.
- Política oficial de retry da Meta para RTU.
- Take Blip em profundidade: o help center responde 403 a fetch. O que consta
  veio de busca, não de leitura integral.
- Se a Zenvia envia eventos para a Conversions API com `ctwa_clid`: não há
  menção em doc pública deles. Há só o indício de criarem um "conjunto de dados
  de eventos" durante o OAuth.
