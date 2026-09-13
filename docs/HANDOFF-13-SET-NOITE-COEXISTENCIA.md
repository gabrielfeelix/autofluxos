# Handoff — 13/set/2026, noite: nada entra pelo canal coexistente

> **Leia com desconfiança, inclusive deste documento.** Quem escreveu errou o
> diagnóstico quatro vezes hoje, com confiança, e em duas delas o dono estava
> certo contra a análise. Cada afirmação abaixo vem com **como foi verificada**,
> justamente para você poder refazer em vez de acreditar.

## O problema, em uma linha

O primeiro cliente conectado por **coexistência** (WhatsApp Business no celular
+ Cloud API) não recebe mensagem nenhuma no Inbox. Ninguém que escreve para ele
aparece no painel.

## O fato que mais importa, e que só apareceu no fim

**Nenhuma mensagem jamais entrou por um canal coexistente.** Nunca. Nem uma.

```sql
-- 4 canais; só o do cliente novo tem is_on_biz_app = true
select ch.phone_number_id, ch.is_on_biz_app, ch.waba_id, cl.nome
from public.channels ch left join public.clients cl on cl.id = ch.client_id
order by ch.criado_em desc;

-- 185 mensagens do MGM Pilates, 1 do Instagram, 1 do Cliente 00.
-- Zero do canal coexistente.
select cl.nome, count(*) , max(m.ts)
from public.messages m
  join public.contacts ct on ct.id = m.contact_id
  join public.clients cl on cl.id = ct.client_id
group by 1 order by 3 desc;
```

O dono disse "no nosso número funcionava na hora". É verdade — e é armadilha:
**aqueles canais são Cloud API pura**. O caminho de coexistência nunca foi
exercitado em produção. Não procure regressão: procure integração que nunca
funcionou.

## O canal em questão

| | |
|---|---|
| Cliente | `4YU` (`f175bf85-7ce6-4cc4-a19a-e910df70a53e`) — o cadastro é "4YU", mas o número é do Eduardo |
| Canal | `77491253-a4c4-4d80-9b82-862cee4dc754` |
| `phone_number_id` | `110549275215531` |
| WABA | `2042524849790437` |
| Portfólio da WABA | `1629792983847355` ("Portfólio EXTRA") |
| Número | `+55 11 91100-1414` — "Eduardo Yamamoto \| Gestor de Growth" |
| Conectou em | 13/set 21:04 UTC |

Token do canal: está no Vault. `select decrypted_secret from
vault.decrypted_secrets where id = '<token_ref do canal>'`.

## O que está PROVADO funcionando (não refaça sem motivo)

Cada linha foi verificada hoje, com o comando ao lado.

| Fato | Como foi provado |
|---|---|
| O webhook aceita e grava | `POST` assinado com payload real → `200` + linha em `messages` |
| A Meta **alcança** nosso endpoint | `devtools_webhook_test` (MCP) → alerta apareceu no banco |
| O proxy não bloqueia mais | `curl -X POST` responde `assinatura inválida` (da rota), não `sessão expirada` (do proxy) |
| A conta **envia** | `POST /110549275215531/messages` → devolveu `wamid` |
| App inscrito na WABA | `GET /2042524849790437/subscribed_apps` → `["AutoFluxos"]` |
| Número saudável | `status: CONNECTED`, `is_on_biz_app: true`, `platform_type: CLOUD_API` |
| Callback do app | `https://autofluxos.4yu.com.br/api/webhook/whatsapp`, `active: true`, com `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes` |

**Há um diário de bordo ATIVO** em `src/app/api/webhook/whatsapp/route.ts`: ele
alerta a cada chamada recebida, com 900 bytes do corpo, **antes de qualquer
filtro**. Foi provado ativo (chamada falsa apareceu na hora, depois apagada).

Com ele ligado, **nenhuma das mensagens reais gerou alerta**. Leitura honesta:
ou a Meta não chamou, ou chamou em outro endereço.

## Erros de diagnóstico cometidos hoje — não repita

1. **`health_status: BLOCKED` mente.** Fica em cache e não recalcula. A mesma
   WABA dizia `BLOCKED` enquanto **aceitava envio**. Custou o cliente cadastrar
   cartão e fuso à toa. Teste honesto: mandar mensagem e ver se volta `wamid`.
2. **"Tudo certo do nosso lado" foi afirmado três vezes, e uma vez era mentira.**
   `tratarEcos` lia `valor.messages` onde a Meta manda `message_echoes` — 200 na
   resposta, zero alerta, echo descartado em silêncio. Corrigido em `0f18eca`.
3. **O teste que deveria pegar isso era cúmplice:** ele montava o payload em
   `messages`, formato que *nós* inventamos. Passava verde com o bug presente.
   **Teste escrito a partir do nosso próprio formato não prova integração.**
   Copie o payload literal da doc da Meta.
4. **Teoria dos "7 dias de uso da conta"**: invenção de blog, não existe na doc
   da Meta. Os requisitos reais são só: app 2.24.17+, país suportado, ser
   Solution Partner/Tech Provider, webhook, e session logging.

## Hipóteses vivas, em ordem de suspeita

### 1. Sobrescrita de callback por WABA (`override_callback_uri`)

A Meta permite que **cada WABA** tenha uma URL de callback própria, diferente da
do app. Se a WABA do Eduardo tiver uma apontando para outro lugar, **todos os
sintomas batem**: app certo, WABA inscrita, e nada chegando aqui.

Não foi possível ler: `GET /2042524849790437/subscribed_apps?fields=override_callback_uri`
e `payment_configurations` respondem `(#10) Application does not have permission`.

**Ação sugerida:** tentar **gravar** a sobrescrita apontando para a nossa URL. Se
havia uma errada, conserta; se não havia, não muda nada. Estava para ser feito
quando a sessão acabou — **peça autorização antes**, é escrita na conta de um
cliente.

```
POST /v21.0/2042524849790437/subscribed_apps
  override_callback_uri=https://autofluxos.4yu.com.br/api/webhook/whatsapp
  verify_token=<WHATSAPP_VERIFY_TOKEN>
```

### 2. O sync nunca andou — e pode ser sintoma, não causa

`contatos_sync_progresso` e `historico_sync_progresso` seguem `null` **2h+**
depois de conectar. Os dois syncs foram disparados (temos os `request_id`), e
**nenhum lote chegou**. Ou seja: não é só mensagem ao vivo que não chega —
**nada** vem daquela WABA.

Isso enfraquece a tese de "problema no roteamento de mensagem" e fortalece
"nada daquela WABA chega até nós", que é o que a hipótese 1 descreve.

Guarde os `request_id` (colunas `*_sync_request_id`): é o que o suporte da Meta
pede.

### 3. Dois portfólios na conta dele

A WABA é `CLIENT_OWNED`, e o `owner_business_info` aponta **"Portfólio -
Yamamoto Ads"** (`175926265367601`), enquanto `health_status` e a conexão vieram
pelo **"Portfólio EXTRA"** (`1629792983847355`). São dois portfólios diferentes
na mesma conta. Pode ser irrelevante, pode ser o roteamento indo para o
portfólio errado. **Não foi investigado.**

### 4. Configuração por número no painel (não inspecionável por API)

Em `developers.facebook.com` → app `1063817842847269` → WhatsApp → Configuração,
existe uma seção de webhooks **por número**. Ninguém conseguiu olhar: exige o
painel, e a WABA é do cliente.

## O que NÃO é (já descartado com evidência)

- Não é o proxy (`91b2352` corrigiu, e o teste da Meta passa).
- Não é assinatura, rota, parsing ou filtro de `field`.
- Não é conta bloqueada (envio aceito).
- Não é o cartão nem o fuso (a conta envia sem eles resolvidos).
- Não é região: Brasil suportado desde o rollout.
- Não é versão do app: 26.35.74, muito acima do mínimo 2.24.17.

## Estado do código (tudo em produção)

| Commit | O quê |
|---|---|
| `91b2352` | **proxy comia os webhooks** — `/api/webhook/` fora de `PREFIXOS_ABERTOS`, 401 antes da rota. Terceira vez desse bug. |
| `6e63937` | `code` era descartado quando faltava `phone_number_id`; agora descobre a WABA por `debug_token` |
| `ee91823` | `sessionInfoVersion: "3"` faltava no `extras` |
| `0f18eca` | **`message_echoes`** — o bug real do dia |
| `89dca03` | telefone legível na tela em vez do `phone_number_id`, e a logo |
| `356bed4` | card de pendências parou de afirmar causa; aviso de "recém-conectado" |
| `d2290f7` | diário de bordo (ATIVO — **remover ao fechar o caso**) |

Migration `0048` aplicada em produção com autorização do dono.

## Pendências de limpeza

1. **Remover o diário de bordo** de `src/app/api/webhook/whatsapp/route.ts`
   quando fechar. Alerta por chamada é barulho, e barulho faz parar de ler.
2. O alerta "o contato novo não entrou no quadro padrão" aparece de outro
   cliente: **não tem etapa no quadro padrão**. Ruído, não é deste caso.

## Regra que o cliente precisa saber

Ele tem que **abrir o WhatsApp Business no celular pelo menos uma vez a cada 13
dias**, ou a Meta derruba a coexistência.

## Como testar sem desperdiçar tentativa

O diário de bordo torna cada teste conclusivo. Com ele ligado:

- **Alerta apareceu** → a Meta chamou. O corpo cru está no `detalhe`; compare
  campo a campo com a doc. Se for nosso, acha em minutos.
- **Nenhum alerta** → não chegou. Não é filtro nem parsing; vá para a hipótese 1.

Antes de confiar num "zero alertas", **prove que o diário está vivo**: mande um
POST assinado qualquer e veja aparecer (depois apague a linha).

## O que o dono quer

Ceticismo. Ele disse, com razão, que "tem certeza que era para dar certo" — e
foi essa insistência que achou o bug do `message_echoes`, depois de três
afirmações confiantes de que o problema era da Meta. **Questione este documento
também.**
