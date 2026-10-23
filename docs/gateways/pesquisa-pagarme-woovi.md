# Pesquisa A: Pagar.me (API v5) e Woovi (ex-OpenPix)

Data da pesquisa: 23/10/2026. Fontes: documentação oficial (docs.pagar.me, developers.woovi.com e a OpenAPI oficial da Woovi). `[?]` = não confirmado na doc oficial.

Nota de método: docs.pagar.me só entrega o markdown com User-Agent de navegador (`curl -A "Mozilla/5.0 ..."` em `https://docs.pagar.me/<caminho>.md`). O índice oficial está em https://docs.pagar.me/llms.txt. A Woovi publica https://developers.woovi.com/llms-full.txt e a OpenAPI em https://api.woovi.com/api/openapi.json.

---

# PARTE 1: PAGAR.ME v5 (Stone)

## 1. Como o dono conecta a conta dele

- **Não há OAuth nem app de parceiro documentado** para um terceiro agir na conta de um lojista. A página de autenticação (https://docs.pagar.me/reference/autenticação-2) só descreve Basic Auth com a chave secreta. A doc de chaves (https://docs.pagar.me/docs/chaves-de-acesso.md) manda o lojista pegar as chaves no Dash. Tudo o que existe de "plataforma" na doc é plugin de e-commerce (Magento, Shopify, VTEX, Woo) e Recebedores/Split (marketplace). Isso não é Connect. `[?]` se existe um programa de parceiro/OAuth fora da doc pública (ex.: Hub da Stone); não achei.
- **Modelo real: chave secreta colada.** O dono entra em id.pagar.me > Desenvolvimento > Chaves no Dash e copia a `Chave Secreta` (`sk_...`). Usada em HTTP Basic: usuário = a secret key, senha vazia.
- Formato: produção `sk_XXXXXXXXXXXXXXXX` (exemplo da doc: `sk_qrezZl4TrZFRb1Vx`) e `pk_...` (pública, só para criptografia/checkout). Teste: `sk_test_...` / `pk_test_...`. Chave de produção só sai depois do contrato assinado.
- Sandbox x produção: mesma base `https://api.pagar.me/core/v5`; quem decide é o prefixo da chave (`sk_test_`). Exceção: **links de pagamento em teste usam outra URL**, `https://sdx-api.pagar.me/core/v5/paymentlinks` com `sk_test` (https://docs.pagar.me/reference/criar-link).
- Dá para detectar ambiente pelo prefixo, como já fazemos no Asaas (`$aact_hmlg_`).
- Certificado: não se aplica.
- IP Allowlist opcional no Dash (https://docs.pagar.me/docs/ip-allowlist.md): se o dono ativar, qualquer IP fora da lista leva erro. Na Vercel (IP dinâmico) isso quebra a integração. Precisa avisar o dono para não ativar.

## 2. Criar cobrança Pix

- `POST https://api.pagar.me/core/v5/orders` (https://docs.pagar.me/reference/criar-pedido-2 e https://docs.pagar.me/reference/pix-2).
- Obrigatórios do pedido: `items[]` (cada um com `amount`, `description`, `quantity`; `code` aparece como obrigatório no schema de Criar pedido) e `payments[]`.
- **Pix exige `customer` completo.** A doc diz: "é necessário enviar o objeto `customer` contendo `name`, `email`, `document`, `phones`" (https://docs.pagar.me/reference/pix-2). Isso difere do Asaas/Mercado Pago: CPF/e-mail/telefone do pagador viram obrigatórios na prática. Nosso `pagador.documento` pode ser nulo e `email` também. Problema grave de UX (ver riscos).
- Valores: inteiro. A doc de pedido não diz "centavos" textualmente, mas os exemplos (`amount: 2990` para "Chaveiro", total 3090 com frete 100) são consistentes com centavos. `[?]` redação explícita.
- Pagamento: `payments[0] = { "payment_method": "pix", "pix": { "expires_in": <segundos>, "additional_information": [...] } }`. `expires_in` é "mandatório"; `expires_at` (UTC, `YYYY-MM-DDThh:mm:ss`) é alternativa. Máximo 10 anos.
- Retorno: `charges[0].last_transaction.qr_code` = copia e cola (string EMV); `last_transaction.qr_code_url` = PNG do QR; `last_transaction.expires_at`. Status inicial da transação `waiting_payment`, da cobrança `pending`.
- Ressalva da doc: "O meio de pagamento PIX só está disponível para contas configuradas com um gateway específico chamado Pagar.me" e o Pix exige contrato/aditivo específico (https://docs.pagar.me/docs/pix-1.md: "a chave aleatória será criada por nós assim que o contrato/aditivo específico do Pix for firmado"). Ou seja, o dono precisa ter Pix habilitado.
- Chave `metadata` existe no pedido (usada nos exemplos); dá para pôr a `referencia` nossa. Também há `code` no item/pedido.

## 3. Link de pagamento / checkout (cartão, boleto, Pix)

- Existe por API: `POST https://api.pagar.me/core/v5/paymentlinks` (https://docs.pagar.me/reference/criar-link). Obrigatórios: `type` (`order` ou `subscription`), `payment_settings`, `cart_settings`.
- `payment_settings.accepted_payment_methods` aceita cartão, boleto, Pix (`pix_settings`, `boleto_settings`, `credit_card_settings`). `expires_in` (minutos) ou `expires_at` (ISO 8601). `max_paid_sessions` (limita a 1 pagamento), `order_code` (correlação), `flow_settings.success_url`.
- Resposta traz `url` (`https://payment-link.pagar.me/pl_...`), `id` (`pl_...`), `status` (`active`).
- Para `type: subscription`: só `credit_card`; sem parcelamento nem split; boleto e Pix "ainda não são aceitos" (aviso na mesma página).
- Cancelar o link: https://docs.pagar.me/reference/cancelar-um-link-de-pagamento.md (existe; endpoint exato `[?]`, não abri a página).
- Como é um link que gera "sessões" (pedidos), a leitura do pagamento sai do pedido/cobrança gerado, não do link. Ligação link para cobrança: via `order_code` e webhook `order.paid`/`charge.paid`. `[?]` formato exato do payload ao pagar pelo link.

## 4. Ler pagamento

- `GET /core/v5/charges/{charge_id}` (https://docs.pagar.me/reference/obter-cobrança) e `GET /orders/{order_id}`. Rate limit 200/min.
- Status da cobrança (`charge.status`) vistos na doc: `pending`, `paid`, `canceled`, `failed` (exemplos de resposta) e, na página de cobrança, valores de transação como `authorized_pending_capture`, `captured`, `refunded`, `voided`, `partial_refunded`, `chargedback`, etc. (https://docs.pagar.me/docs/cobrança.md). Para Pix a transação tem: `waiting_payment`, `paid`, `pending_refund`, `refunded`, `with_error`, `failed` (https://docs.pagar.me/reference/pix-2).
- Mapeamento sugerido: `pending`/`waiting_payment` para pendente; `paid` para paga; `refunded` / `partial_refunded` para estornada; `canceled` / `failed` para cancelada. `[?]` enum completo e oficial de `charge.status` (a doc mostra exemplos, não uma tabela fechada) e se `chargedback` deve virar estornada.
- Data de pagamento: `charge.paid_at`. Valor pago: `charge.paid_amount` (centavos), e `charge.amount` é o cobrado. Há eventos `charge.underpaid`/`charge.overpaid` (https://docs.pagar.me/reference/eventos-de-webhook-1.md).
- Dados do pagador no pago: `last_transaction.payer` (nome, documento mascarado, banco) e `end_to_end_id`.

## 5. Cancelar / expirar

- `DELETE /core/v5/charges/{charge_id}` (https://docs.pagar.me/reference/cancelar-cobrança). Body opcional `{ amount, reason }`. Para Pix, a doc de Pix diz que o "estorno" de Pix pago também é esse DELETE.
- Cobrança Pix não paga: expira sozinha em `expires_in`. Cancelar Pix não pago via DELETE `[?]` (a doc de cancelar cobre sobretudo cartão e boleto; o rate limit tem regra específica "somente para PIX": após a 10ª tentativa de cancelar a mesma cobrança, 1 tentativa por 15 minutos, https://docs.pagar.me/reference/rate-limit.md, o que sugere que cancelar Pix é suportado).
- Link de pagamento: cancelável (item 3).

## 6. Webhook

- Doc: https://docs.pagar.me/docs/webhooks.md e https://docs.pagar.me/reference/visão-geral-sobre-webhooks.md. Notificação é `HTTP POST` para a URL configurada. Objeto: `id` (`hook_...`), `url`, `event`, `status` (`pending|sent|failed`), `attempts`, `last_attempt`, `response_status`, `account {id,name}`, `data`.
- **Cadastro: a doc pública só lista Reenviar, Obter e Listar webhook** (https://docs.pagar.me/llms.txt, seção Webhook). **Não encontrei endpoint de criar webhook por API.** O texto fala em "configurar vários endpoints e escolher quais eventos" e em "configuração para definir quantas vezes reenviar", mas não diz onde. Provável que seja só no Dash (Configurações > Webhooks). `[?]` confirmar. Se for só no Dash, o dono teria que cadastrar a URL à mão, o que quebra o "conecta e funciona" que fazemos com Asaas/MP.
- Eventos úteis: `charge.paid`, `charge.refunded`, `charge.payment_failed`, `charge.pending`, `charge.underpaid`, `charge.overpaid`, `order.paid`, `order.canceled`, `checkout.canceled` (link expirado), `subscription.*`, `invoice.paid`, `chargeback.received` (`charge.chargedback` sai de uso, migração até 30/09/2026). Lista: https://docs.pagar.me/reference/eventos-de-webhook-1.md.
- **Assinatura/validação: a doc oficial não descreve nenhuma.** Nada de HMAC, header de assinatura ou segredo nas páginas de webhook que li. `[?]` (circula em tutoriais um `X-Hub-Signature` HMAC-SHA1 com a secret key, mas não achei na doc oficial; não afirmo). Isso combina com nossa regra: não confiar no corpo, só pegar o id e reler `GET /charges/{id}` com a chave do dono.
- Problema para nós: como o webhook não traz a identificação do dono de forma garantida e a URL é cadastrada à mão, precisaríamos de um token na própria URL (`/api/webhooks/pagarme/<orgId>/<segredo>`) para saber de qual organização é. O corpo traz `account.id` (loja), que serve para conferir.
- Reenvio: configurável (número de tentativas) e há "Reenviar webhook" por API. Número de tentativas / intervalo `[?]`.
- Portas: só 80 (http) e 443 (https) (https://docs.pagar.me/reference/visão-geral-sobre-webhooks.md).

## 7. Recorrência

- Cartão: assinaturas (`POST /subscriptions`, https://docs.pagar.me/reference/criar-assinatura-avulsa) exigem `payment_method` (`credit_card`, `boleto`, `debit_card`) e para cartão um `card_id` ou `card_token`. O `card_token` vem de tokenização no front (chave pública), ou seja, precisaríamos de um formulário de cartão nosso ou do checkout. Alternativa que evita PCI: **link de pagamento `type: subscription`** (só cartão), que devolve uma URL. É o caminho equivalente ao "fatura onde o pagador põe o cartão" do Asaas.
- Planos: `POST /plans` (https://docs.pagar.me/reference/criar-plano-1). Ciclos/faturas: `invoice.*`, `subscription.*`. `[?]` se o plano/assinatura via link dispensa criar plano antes (a doc diz que se usar plano, ele deve existir antes).
- **Pix Automático**: não achei nada no índice oficial (llms.txt só tem Pix cobrança comum). `[?]` provavelmente não suportado.

## 8. Sandbox

- Existe. Chaves `sk_test_`/`pk_test_` no Dash em modo "test". Rate limit de teste: 10 req/s (https://docs.pagar.me/reference/rate-limit.md).
- Simulador de Pix (https://docs.pagar.me/docs/simulador-pix.md): valor até R$ 500,00 (inclusive) é pago sozinho segundos depois (`pending` para `paid`); acima de R$ 500,00 vira `failed`. Não funciona junto com Split.
- Observação: o Dash/conta de teste vem junto com a conta criada. `[?]` se o dono precisa de conta aprovada para ver as chaves de teste.

## 9. Idempotência, limites, HTTPS

- Idempotência: nada na doc que li. `[?]` header `Idempotency-Key` (não encontrado nas páginas abertas). Mitigação: `code`/`metadata` com nossa `referencia` e checar antes de recriar.
- Rate limit (https://docs.pagar.me/reference/rate-limit.md): GET /charges, /orders, /subscriptions etc. 200/min; /hooks 50/min; cancelar Pix tem trava de 15 min após 10 tentativas; sandbox 10 req/s. Limite de criação (POST /orders) não informado `[?]`.
- HTTPS obrigatório (API) e webhook em 80/443. IP Allowlist opcional do lado do dono (risco, item 1).

## 10. Taxas e porte

- Vitrine do site (https://pagar.me/): Pix 0,99%, crédito à vista 4,19%, recebimento "dia seguinte" (texto de campanha Black Friday, portanto taxa promocional ou de entrada; contrato e plano mudam o valor). `[?]` tabela oficial estável.
- Porte: marca da Stone ("mais de 4 milhões de empreendedores confiam na Stone", site oficial). Forte em e-commerce e plataformas, menos "conta que o MEI abre sozinho em 5 minutos". Popularidade entre pequenos negócios de serviço: menor que Mercado Pago/Asaas/PagBank `[?]` (impressão, sem dado oficial).

## 11. Riscos e pegadinhas

1. **Conta**: contratação com cadastro PJ/KYC e contrato; Pix exige aditivo (item 2). Dono MEI/autônomo pode não passar ou demorar. `[?]` exigência exata de CNPJ (a doc de API não diz; é regra comercial da Stone).
2. **Pix exige `customer` com name, email, document e phones** (doc de Pix). Nosso fluxo de chat muitas vezes não tem CPF nem e-mail do pagador. Teria que pedir ao cliente no chat, ou o dono preencher, ou mandar dado fictício (não recomendado, pode violar contrato/antifraude). Esse é o maior atrito.
3. **Webhook sem assinatura documentada e provavelmente cadastro manual** (item 6).
4. **IP Allowlist** do dono derruba nossa chamada.
5. `sk_` colada = chave com poder total (cria, cancela, estorna). Mesma exposição do Asaas, mas vamos guardar no cofre.
6. Link de pagamento de teste em host diferente (`sdx-api`), diferente do resto da API.
7. Cancelamento de boleto mudou em 01/10/2026 (PSP deixa de estornar; https://docs.pagar.me/reference/cancelar-cobrança). Só relevante se um dia houver boleto.
8. Enum de status misto entre charge, transaction e order: precisa de tabela de mapeamento cuidadosa.

## 12. Veredito Pagar.me

- **Serve em parte, mas é o pior encaixe do grupo.** Dá para criar Pix e link, ler e cancelar, mas: sem OAuth, sem criação de webhook por API documentada, sem assinatura de webhook documentada, Pix com `customer` completo obrigatório, e conta PJ com contrato.
- Esforço **M a G** comparado ao Asaas (Asaas: chave colada + webhook por API + `externalReference`). O pareamento é parecido com Asaas na conexão (chave colada), mas perde a automação do webhook e carrega o problema do `customer`.
- Recomendação: **não priorizar**. Só faria sentido se houver um cliente que já usa Pagar.me e exige.

---

# PARTE 2: WOOVI (ex-OpenPix)

Base produção `https://api.woovi.com`, sandbox `https://api.woovi-sandbox.com` (https://developers.woovi.com/llms.txt). Valores sempre em centavos (inteiro). Autenticação: header `Authorization: <AppID>` **sem** `Bearer` (https://developers.woovi.com/docs/apis/api-getting-started).

## 1. Como o dono conecta a conta dele

Duas vias, as duas documentadas:

**A) AppID colado.** O dono entra na plataforma Woovi, vai em `API/Plugins` > `Nova API/Plugin`, escolhe `API`, salva, confirma com segundo fator e copia o AppID (https://developers.woovi.com/docs/apis/api-getting-started). É uma string opaca (sem prefixo documentado). Dá para restringir por **escopos** (`CHARGE_GET`, `CHARGE_POST`, `CHARGE_DELETE`, `WEBHOOK_POST`, ...; lista em https://developers.woovi.com/llms-full.txt, seção "Adicionando escopos ao seu AppID"). Exige que o usuário seja ADMIN (sem permissão, o menu API/Plugins nem aparece).

**B) WooviApp (OAuth 2.0 authorization code). Existe.** Docs: "Como funciona o fluxo de autorização de um WooviApp?" e "Como criar um WooviApp?" (dentro de https://developers.woovi.com/llms-full.txt; páginas `woovi-apps-how-to-authorize` e `woovi-apps-how-to-create`).
- Nós cadastramos o app em https://store.woovi.com/create (nome, descrição, site, categoria, logo, **redirect URIs obrigatórias**, escopos obrigatórios e opcionais). Recebemos `clientId` e `clientSecret` (o secret aparece uma vez; a Woovi guarda só SHA-256).
- Não há menção a aprovação/revisão manual do app nem prazo. `[?]` se a Woovi revisa apps antes de listar na loja (a doc só descreve o formulário).
- Fluxo: redirecionar o dono para `https://store.woovi.com/authorize?client_id=...&redirect_uri=...&scope=...&company_id=...`. O dono precisa estar logado na Woovi (cookie); sem `company_id` e sem sessão aparece "nenhum contexto de empresa encontrado". Tela de consentimento mostra nome/logo/permissões. Callback: `{redirect_uri}?code=...` (ou `?error=access_denied`). O callback só traz `code`; nada de empresa.
- Troca: `POST https://api.woovi.com/api/v1/woovi-apps/application` com `{code, client_id, client_secret}` e `Authorization: <nosso appID>` **com o escopo `WOOVI_APP_APPLICATION_POST`**. Ou seja, **nós precisamos ter uma conta Woovi própria da 4YU com um AppID** para fazer a troca. O `code` vale 10 minutos e é de uso único.
- Resposta 201: `application { name, isActive, type: "API", clientId, clientSecret, appID, scopes[] }`. Importante: **o que o dono nos dá é um novo `appID` + `clientId/clientSecret` da aplicação criada na conta dele**, não um access token com refresh. Não há expiração ou refresh documentados. Guardamos o `appID` e usamos como o AppID colado. O `clientSecret` também só aparece nessa resposta.
- Revogação: o dono revoga em https://store.woovi.com/authorized-apps; invalida na hora. Se revogar, nossas chamadas passam a dar 401.
- Escopos proibidos para WooviApp (movimentação de fundos): `ACCOUNT_WITHDRAW_POST`, `PAYMENT_POST`, `TRANSFER_POST`, `APPLICATION_POST`, `SUBACCOUNT_*` etc. Os que precisamos (CHARGE_*, WEBHOOK_*) não estão na lista de bloqueados.
- Sandbox: criar conta em https://app.woovi-sandbox.com/ (cadastro separado; dados de produção não funcionam lá). `[?]` se WooviApps tem equivalente em sandbox (loja `store.woovi-sandbox.com`?), não documentado.

## 2. Criar cobrança Pix

- `POST /api/v1/charge` (https://developers.woovi.com/docs/charge/how-to-create-charge-using-api e OpenAPI).
- Obrigatórios: **`correlationID`** (nosso id, string única) e **`value`** (centavos). Nada mais. `customer` é opcional; se enviar, precisa de uma destas combinações: `name+taxID`, `name+email` ou `name+phone`. **CPF do pagador não é obrigatório para Pix** (vantagem enorme sobre Pagar.me).
- Expiração: `expiresIn` (segundos, mínimo 5 minutos) ou `expiresDate` (ISO 8601). Padrão configurável no painel (aba Ajustes de Cobranças) (https://developers.woovi.com/docs/charge/how-to-charge-expiration). Sem `type`, vira `DYNAMIC` (Pix).
- Outros: `comment` (texto para o pagador), `additionalInfo[]` (chave/valor), `ensureSameTaxID`, `fixedLocation`.
- Idempotente: query `?return_existing=true` devolve a cobrança existente se já houver uma com o mesmo `correlationID`.
- Retorno (`charge`): **`brCode`** (copia e cola, EMV), **`qrCodeImage`** (URL do PNG), **`paymentLinkUrl`** (página de pagamento da Woovi), `paymentLinkID`, `identifier`/`transactionID`, `status` (`ACTIVE`), `expiresDate`, `globalID`. A resposta de criação também repete `brCode` e `correlationID` no topo.
- Taxa no retorno em `paymentMethods.pix.fee` (centavos).

## 3. Link / checkout com cartão e boleto

- **`paymentLinkUrl` já vem em toda cobrança** (`https://woovi.com/pay/<paymentLinkID>`).
- **Cartão**: mesmo endpoint, `type: "PIX_CREDIT"` (pagador escolhe Pix ou cartão) ou `type: "CREDIT_CARD"` (só cartão). O pagador paga o cartão no `paymentLinkUrl`. Exige `customer` com nome e CPF/CNPJ válidos nesse caso. Opcional: `POST /api/v1/charge/{id}/card/smartform` devolve `checkoutUrl` para formulário de cartão. Requisitos: **cartão precisa ser habilitado por pedido ao suporte** (chat) e passar em **KYC do parceiro de cartão** (https://developers.woovi.com/llms-full.txt, "Primeiros passos com cartão de crédito"). Ou seja, não é self-service. Taxas de cartão são definidas pela Woovi por conta (tela "Suas taxas"), sem tabela pública que eu tenha achado.
- **Boleto**: `type: "BOLETO"` (cobrança "Boleto + Pix", R$ 2,99 por pagamento recebido segundo https://woovi.com/planos-e-precos/). Exige `dueDate`. Detalhes `[?]` (não abri a página de boleto).

## 4. Ler pagamento

- `GET /api/v1/charge/{id}` onde `{id}` é o id da cobrança **ou o `correlationID`** (URL-encoded). Retorna `{ charge: {...} }`.
- Status da cobrança: `ACTIVE`, `COMPLETED`, `EXPIRED` (enum do schema `Charge`). Mapeamento: `ACTIVE` para pendente; `COMPLETED` para paga; `EXPIRED` para cancelada/vencida. Cobrança deletada: o DELETE retorna `{status:"OK", id}`; estado visto pelo GET depois `[?]` (provável 404 ou `EXPIRED`).
- **Estornada não é status da cobrança.** Reembolso é um recurso separado: `POST/GET /api/v1/charge/{id}/refund` e webhooks `OPENPIX:TRANSACTION_REFUND_RECEIVED`, `PIX_TRANSACTION_REFUND_*_CONFIRMED`/`REJECTED`. Para marcar "estornada" precisamos ler `GET /charge/{id}/refund` ou tratar o evento. O `status` continua `COMPLETED`.
- Data de pagamento: no payload do webhook `OPENPIX:CHARGE_COMPLETED` existe `charge.paidAt` (https://developers.woovi.com/docs/charge/webhook/charge-webhook-example-charge-completed). No schema do `GET /charge/{id}` da OpenAPI **não há `paidAt`** (só `createdAt/updatedAt`), mas o `pix.time` / `charge.paidAt` vêm no webhook. `[?]` se o GET devolve `paidAt` (o exemplo da doc não mostra). Alternativa: usar `updatedAt` como aproximação ou ler `GET /api/v1/transaction`.
- Valor pago: `paymentMethods.pix.value` e `charge.valueWithDiscount`/`value`; no webhook `pix.value`. `[?]` pagamento a maior/menor (Pix dinâmico exige valor exato, então normalmente igual).
- Pagador: `payer {name, taxID}` no webhook.

## 5. Cancelar / expirar

- `DELETE /api/v1/charge/{id}` (id ou correlationID), resposta `{status:"OK", id}` (OpenAPI). Escopo `CHARGE_DELETE`.
- Cobrança não paga expira sozinha (`EXPIRED`, webhook `OPENPIX:CHARGE_EXPIRED`). Cobrança já paga: o DELETE falha (400 `{error}`) `[?]` mensagem exata.
- Também há `PATCH /api/v1/charge/{id}` (`CHARGE_PATCH`), por exemplo para alterar expiração (`ChargePatchPayload`; campos `[?]`).

## 6. Webhook

- **Cadastro por API, por conta (do dono):** `POST /api/v1/webhook` com `{ webhook: { name, event, url, authorization, isActive } }`. `event` padrão `OPENPIX:TRANSACTION_RECEIVED` se omitido. Outros: `GET /api/v1/webhook`, `DELETE /api/v1/webhook/{id}`, `GET /api/v1/webhook/events`. Escopos `WEBHOOK_POST/GET/GET_LIST/DELETE`. Também dá para cadastrar no painel (https://developers.woovi.com/docs/webhook/platform/webhook-platform-api).
- Ao cadastrar, a Woovi faz um POST de teste na URL; se não responder 200, **o webhook não é criado** (guia de webhooks do llms-full). Limites: **50 webhooks por empresa**; não repete o mesmo par URL + evento.
- Eventos que nos interessam: `OPENPIX:CHARGE_COMPLETED` (paga), `OPENPIX:CHARGE_EXPIRED`, `OPENPIX:CHARGE_CREATED`, `OPENPIX:CHARGE_COMPLETED_NOT_SAME_CUSTOMER_PAYER`, `OPENPIX:TRANSACTION_REFUND_RECEIVED` (estorno), `PIX_AUTOMATIC_*` (recorrência). Catálogo: enum `WebhookEventEnum` na OpenAPI.
- Payload do `CHARGE_COMPLETED`: `{ event, charge{..., correlationID, status:"COMPLETED", paidAt, value}, pix{...}, company, account }`. Nossa regra continua: pegar só `charge.correlationID`/id e reler `GET /charge/{id}` com o AppID do dono.
- **Assinatura**: dois cabeçalhos.
  - `x-webhook-signature`: **RSA-SHA256, base64**, sobre o **corpo bruto**, verificada com a **chave pública da Woovi** (a mesma para todos). A chave vem de `GET /api/v1/webhook/public-keys` (sem autenticação; lista com `is_current` para rotação; aceitar qualquer da lista). Recomendado (https://developers.woovi.com/docs/webhook/seguranca/webhook-signature-validation). Em Node: `crypto.verify('RSA-SHA256', rawBody, publicKey, Buffer.from(sig,'base64'))`.
  - `x-openpix-signature`: HMAC-SHA1 base64 com o `hmacSecretKey` do webhook (valida que veio daquela configuração).
  - Como a regra nossa é reler na API, a assinatura é camada extra barata de usar.
- Retentativa: 8 tentativas; a 1ª imediata, depois `intervalo = 10 * 2^tentativa` segundos (10, 20, 40, ..., 1280 s). Dispara retry em HTTP acima de 400, URL indisponível ou erro interno. Timeout de 100 s. Depois disso só reenvio manual no painel (https://developers.woovi.com/docs/webhook/webhook-retry e `/webhook-timeout`).
- IPs de origem: `GET /api/v1/webhook/ips` (OpenAPI) / pedir ao suporte; não dá para fixar IP de entrada em Vercel de qualquer jeito.
- Idempotência do handler: a doc manda o handler ser idempotente (reenvios são comuns).

## 7. Recorrência

- **Pix Automático** (recorrência no débito autorizado pelo pagador): suportado. `POST/GET/PUT /api/v1/subscriptions` e `/installments` (https://developers.woovi.com/docs/pix-automatic/pix-api-routes), eventos `PIX_AUTOMATIC_APPROVED`, `PIX_AUTOMATIC_COBR_CREATED`, `..._COMPLETED`, `..._REJECTED`. Também "Pix Assinatura" (recorrência com cobrança todo mês via Pix manual) e "Pix Crediário" (parcelado). Isso casa com o `criarAutorizacaoPix` da nossa interface. `[?]` campos exatos do POST /subscriptions (não abri o schema).
- **Cartão recorrente**: não achei assinatura em cartão na Woovi. Só cobrança avulsa em cartão. `[?]`. Então `criarAssinaturaNoCartao` ficaria sem implementar.
- Cancelar assinatura: `PUT /api/v1/subscriptions/{id}/cancel`; ler: `GET /api/v1/subscriptions/{id}`.

## 8. Sandbox

- Existe e é completo. Conta em https://app.woovi-sandbox.com/ (cadastro novo, separado de produção); API em `https://api.woovi-sandbox.com`; AppID próprio gerado no painel sandbox (https://developers.woovi.com/docs/intro/test-environment). Há doc de simulação de erros (`flows/sandbox-error-simulation`, em llms.txt). `[?]` como "pagar" uma cobrança no sandbox (provavelmente botão no painel/ endpoint de teste; não abri).
- Dá para detectar ambiente? O AppID não tem prefixo documentado; precisamos guardar o ambiente na conexão (como o PagBank `PAGBANK_SANDBOX`), ou trocar a base conforme o fluxo de conexão. Com WooviApp o ambiente é definido pela loja usada (`[?]` loja sandbox).

## 9. Idempotência, limites, HTTPS

- Idempotência: `correlationID` único por cobrança + `?return_existing=true` (https://developers.woovi.com/docs/concepts/idempotence e OpenAPI). Perfeito para retries.
- Rate limit: existe resposta `429` ("Limite de requisições") mas **sem números publicados** que eu tenha achado. `[?]`
- HTTPS obrigatório. Guia diz que IPs e certificados da API mudam e não devem ser fixados (sem IP allowlist de saída para nós).
- AppID pode ter escopos: usar o mínimo (`CHARGE_GET`, `CHARGE_POST`, `CHARGE_DELETE`, `WEBHOOK_POST`, `WEBHOOK_GET_LIST`, `WEBHOOK_DELETE`, `CHARGE_REFUND_GET_LIST`).

## 10. Taxas e porte

- Fonte oficial https://woovi.com/planos-e-precos/ (consultada hoje): **Plano Percentual 0,80% por Pix confirmado, mínimo R$ 0,50, máximo R$ 5,00**; **Plano Fixo R$ 0,85 por Pix confirmado**; sem mensalidade, sem adesão; conta PJ grátis; gerar QR não custa. Boleto + Pix R$ 2,99 por pagamento recebido. Saque grátis a partir de R$ 500. WhatsApp via API oficial R$ 0,49 por mensagem (opcional, não precisamos).
- **Cartão**: sem tabela pública; taxa definida por conta pelo suporte. `[?]`
- Porte: fintech regulada pelo BC e participante direto do Pix (https://developers.woovi.com/llms.txt), forte em desenvolvedores, plugins de e-commerce (Woo, Nuvemshop, VTEX, Shopify), SDKs oficiais. Menos conhecida pelo dono de pequeno negócio comum que Mercado Pago/Asaas/PagBank `[?]` (impressão).

## 11. Riscos e pegadinhas

1. **Conta é PJ.** A Woovi abre "conta PJ grátis"; o produto é para empresas (CNPJ). MEI tem CNPJ, então serve, mas dono sem CNPJ fica fora. `[?]` aceita MEI/PF (a doc de API não diz; o cadastro é regra comercial).
2. **Troca do `code` exige conta Woovi nossa** com AppID de escopo `WOOVI_APP_APPLICATION_POST` (item 1B). Nós (4YU) precisamos abrir conta, e o `clientSecret` do WooviApp fica no cofre.
3. **WooviApp devolve um AppID, não um token com refresh.** Se o dono revogar, o AppID morre; precisamos tratar 401 e pedir reconexão. Nada documentado sobre expiração.
4. **Dono precisa estar logado na Woovi** durante a autorização; para quem tem várias empresas, passar `company_id` ou ele cai na empresa da sessão (confirmar a empresa certa na UI).
5. **Cartão não é self-service** (ativação pelo suporte + KYC do parceiro). Não podemos prometer "link com cartão" por padrão; só Pix e `paymentLinkUrl` (que pode ter Pix). Mostrar cartão só se a conta estiver habilitada (a criação com `type` cartão devolve erro `FEE_NOT_CONFIGURED` e afins quando a conta não está pronta).
6. **Sem status "estornada" na cobrança** (item 4); precisa de leitura de refund ou do evento de reembolso.
7. **Webhook: 50 por empresa e handshake de criação** (a URL tem de responder 200 no ato de cadastrar; se a rota exigir token no path, ele tem de aceitar o POST de teste). O teste de handshake chega como POST; a rota deve responder 200 mesmo com corpo de teste sem `charge`.
8. Pix dinâmico exige valor exato; pagamento fora do valor `[?]` não deve ocorrer.
9. `Authorization` sem `Bearer` (erro comum).
10. Pix Out/saque não é problema nosso (escopo bloqueado para WooviApp).

## 12. Veredito Woovi

- **Serve bem**, melhor que Pagar.me e comparável ao Asaas, com **OAuth real (WooviApp)** como diferencial: o dono clica "autorizar" em vez de colar chave. Pix com campos mínimos (`correlationID` + `value`), webhook cadastrável por API com assinatura RSA, idempotência nativa por `correlationID`, `GET` por `correlationID` (casa direto com nossa `referencia`), Pix Automático para recorrência.
- Esforço:
  - Via **AppID colado**: **P a M** (menor que Asaas em alguns pontos: sem `customer` obrigatório; igual em outros). Faltas: sem cartão recorrente, "estornada" via refund separado.
  - Via **WooviApp (OAuth)**: **M** (cadastrar o app na store, conta Woovi nossa, tela de consentimento, callback, troca do code, guarda do AppID + `clientSecret`, tratamento de revogação).
- Recomendação: implementar primeiro com **AppID colado** (entrega rápida), depois adicionar o botão OAuth. Priorizar Woovi acima de Pagar.me.

---

# Comparativo rápido (contra a interface `GatewayDePagamento`)

| Item | Pagar.me v5 | Woovi |
|---|---|---|
| Conexão | `sk_` colada (sem OAuth) | AppID colado ou WooviApp (OAuth) |
| Pix: pagador obrigatório | name, email, document, phones | nenhum (customer opcional) |
| Copia e cola | `charges[0].last_transaction.qr_code` | `charge.brCode` |
| Link | `POST /paymentlinks` (`url`) / sem link no Pix puro | `charge.paymentLinkUrl` em toda cobrança |
| Ler | `GET /charges/{id}`; `paid_at`, `paid_amount` | `GET /charge/{id|correlationID}`; `paidAt` só garantido no webhook `[?]` |
| Cancelar | `DELETE /charges/{id}` | `DELETE /charge/{id}` |
| Webhook cadastro | só Dash `[?]` | `POST /api/v1/webhook` |
| Webhook assinatura | não documentada `[?]` | RSA-SHA256 `x-webhook-signature` |
| Recorrência cartão | link `subscription` (cartão) | não encontrado `[?]` |
| Pix Automático | não encontrado `[?]` | sim (`/subscriptions`) |
| Sandbox | `sk_test_` (links em `sdx-api`) | conta e API separadas |
| Taxa Pix | ~0,99% (campanha) `[?]` | 0,80% (mín R$ 0,50, máx R$ 5) ou R$ 0,85 |
| Esforço vs Asaas | M a G, pior | P a M, comparável ou melhor |

# Lista do que ficou `[?]` (resumo)

Pagar.me: existência de OAuth/programa de parceiro; criar webhook por API; assinatura/validação de webhook; Idempotency-Key; enum completo de status da charge; cancelar Pix não pago via DELETE; payload ao pagar via link; Pix Automático; tabela de taxas estável; exigência de CNPJ.
Woovi: revisão/aprovação de WooviApp; `paidAt` no GET da cobrança; estado após DELETE; rate limit numérico; cartão recorrente; taxa de cartão; WooviApp em sandbox; campos do POST /subscriptions; aceita MEI/PF.
