# Pesquisa B: PicPay, Iugu e PagHiper como gateway de "cobrança pelo chat"

Data da pesquisa: 23/10/2026. `[?]` = não confirmado na doc oficial.
Nada no repositório foi alterado.

## Como li as fontes (e o que não deu)
- **Iugu**: `https://dev.iugu.com/llms.txt` e as páginas `.md` do mesmo domínio (readme.io). Fonte oficial completa. O Cloudflare bloqueia rajada (429); com User-Agent e 4s entre chamadas passa.
- **PagHiper**: `https://dev.paghiper.com/llms.txt` e `.md`. O índice oficial só lista a resposta Pix e a notificação Pix. **A página de "criar Pix" não está no índice nem em URL que eu adivinhasse.** Os endpoints de criar, status e cancelar Pix saem do **SDK embutido no plugin oficial** `github.com/paghiper/woocommerce-paghiper` (pasta `includes/paghiper-php-sdk/build/src/Transaction.php`). Fonte oficial, mas é código, não doc.
- **PicPay**: `https://developers-business.picpay.com/` (Docusaurus, renderizado por JS; WebFetch devolve só o título). Li com Chromium headless (playwright-core do repo, fora do projeto) as páginas `payment-link`, `pix` e `checkout`. O objeto `details` das respostas vem colapsado e não consegui expandir: formato de status do GET do link fica `[?]`.
- Taxas: **nenhuma tabela oficial lida**. Só terceiros (iDinheiro, Nuvemshop, quasa.io). Tudo de taxa está marcado `[?]`.

---

## 1. PicPay (PicPay Negócios / Link de pagamento / API Pix / Checkout)

Produtos oficiais hoje (`https://developers-business.picpay.com/`): Gateway/Checkout, Carteira PicPay, **API Pix**, **Link de pagamento**, Emissão de boletos (BaaS). Ativo em 2026 (docs com exemplos de 2025, sandbox próprio). Os produtos antigos (API `appws.picpay.com/ecommerce/public/payments` com `x-picpay-token`) não aparecem mais no portal; **não use**.

Há três APIs diferentes, com hosts e credenciais diferentes:

| API | Host produção | Credencial |
|---|---|---|
| Link de pagamento | `https://ecommerce-api.svc.picpay.com` | botão "Gerar Token" do card "Link de pagamento" |
| API Pix e Checkout | `https://ecommerce-api.svcp.picpay.com` (sandbox `svcp.ppay.me`) | card "Checkout" |

Fonte: `/payment-link/docs/authentication`, `/pix/docs/authentication`, `/checkout/docs/authentication`.

### 1.1 Conexão da conta do dono
- **Sem OAuth de parceiro.** É `client_id` + `client_secret` gerados pelo dono no **Painel Lojista > Integrações > Gerar Token** (`/payment-link/docs/authentication`). O `client_secret` aparece **uma vez só**. Gerar de novo revoga a anterior após 7 dias.
- Troca por token: `POST {host}/oauth2/token`, JSON `{grant_type:"client_credentials", client_id, client_secret}`. **Token vale 5 minutos**: precisa cache + renovação (a doc fala em controle de concorrência).
- Nosso `AcessoAoGateway` guarda um `token` só: teríamos de guardar `client_id:client_secret` (cifrado) e trocar a cada chamada/cache de 4 min. Diferente de todos os outros gateways atuais.
- Aprovação/prazo: **`[?]`** a doc não diz que o dono precisa de conta PJ ou aprovação para ver "Integrações". A doc da API Pix/Checkout exige **PCI DSS** ("Qualquer estabelecimento... que deseje se integrar à API de Checkout do PicPay precisa ter a Certificação PCI DSS", `/pix/docs/security`). Na API Pix cai em `paymentSource: GATEWAY`; não sei se a exigência vale para Pix puro `[?]`. Isso é bloqueio para pequeno negócio.
- Sandbox exige credencial separada gerada no mesmo painel ("Credenciais Sandbox").

### 1.2 Criar cobrança Pix
Dois caminhos:

**A) Link de pagamento (recomendado se for PicPay)**: `POST https://ecommerce-api.svc.picpay.com/v1/paymentlink/create` (`/payment-link/docs/api/create-charge`).
Corpo de exemplo oficial:
```
{ "charge": { "name", "description", "order_number", "redirect_url",
    "payment": { "methods": ["BRCODE","CREDIT_CARD"], "brcode_arrangements": ["PICPAY","PIX"] },
    "amounts": { "product": 3000, "delivery": 500 } },
  "options": { "allow_create_pix_key": true, "card_max_installment_number": 3, "expired_at": "2025-12-12" } }
```
- Valores em **centavos inteiros**. Sem campo de pagador (sem CPF, sem e-mail): bom para nós.
- `expired_at` aparece como **data** (`AAAA-MM-DD`), não data-hora. Granularidade de dia `[?]`: não consigo expirar em 30 minutos.
- Resposta 201 traz `brcode` (copia e cola Pix, campo exato `brcode`), `link` (`https://link.picpay.com/p/<id>`), `deeplink`, `txid`, `pixKey`, `status` (ex.: `active`), `expirationDate`, `maxPaymentQuantity` (exemplo 10), `amount`.
- **Pegadinha**: o link é reutilizável (`maxPaymentQuantity`). Nada na doc diz como fixar em 1 pagamento `[?]`; precisaríamos inativar após o primeiro pagamento.
- O `order_number` é nosso `referencia`, mas **o webhook não devolve `order_number`** (só `paymentLinkId`, `checkoutLink`). Então guardamos o `paymentLinkId` no nosso lado e casamos por ele.
- O id que o GET e o inactive usam é o `paymentLinkId`; o que o refund usa é o `transaction.id`.

**B) API Pix pura**: `POST .../v1/charge/pix` com `paymentSource: "GATEWAY"`, `merchantChargeId` (6 a 36 chars, `[a-zA-Z0-9-]`, nosso id), `customer{name,email,documentType,document,phone}`, `transactions:[{amount, pix:{expiration: <segundos>}}]`, `deviceInformation`. Expiração em segundos (default 10 min). Resposta traz `chargeStatus` e `transactions[].pix.qrCode` (copia e cola, nome em `webhook`: `pix.qrCode`; no create `[?]`). Pede PCI/certificados e dados de device. **Pesado para o nosso caso.**

### 1.3 Link com cartão e boleto
- Link de pagamento aceita `CREDIT_CARD` e `BRCODE` (Pix/Carteira PicPay) por API. **Boleto: não** no Link (só existe produto separado "Emissão de boletos" BaaS, outra credencial `[?]`).
- Parcelamento: `card_max_installment_number`.

### 1.4 Ler pagamento
- Link: `GET /v1/paymentlink/{payment_link_id}` (dados do link) e `GET /v1/paymentlink/{payment_link_id}/transactions` (página existe, `[?]` formato do corpo não lido). `details` do GET colapsado: **status e valores pagos `[?]`**.
- Status vistos oficialmente: webhook de Link `PAYED`, `REFUNDED`, `PARTREFUNDED`; Pix/charge `CANCELED, DENIED, ERROR, PAID, PARTIAL, PRE_AUTHORIZED, REFUNDED, CHARGEBACK`.
- Mapa proposto: PAYED/PAID -> paga; REFUNDED/PARTREFUNDED/CHARGEBACK -> estornada; CANCELED/DENIED/ERROR/inativo -> cancelada; senão pendente.
- Data de pagamento: `transaction.updatedAt` (webhook). Valor: `transaction.amount` (centavos; no refund parcial é o valor devolvido, nota da doc).
- Para a regra "só o id sai do webhook": id = `data.charge.paymentLinkId`, reler com `GET paymentLink/{id}/transactions` `[?]`.

### 1.5 Cancelar
- Link: `POST /v1/paymentlink/{id}/inactive` (200 "Link de pagamento inativado"). Se já houver pagamento, retorna 422/404 `[?]`.
- Estorno: `POST /v1/paymentlink/transaction/{transaction_id}/refund` com `{amount}` em centavos.

### 1.6 Webhook
- **Não é por API.** O dono configura no **Painel Lojista > Configurações > Meu checkout > URL de notificação**: HTTPS, **sem query string**, sem IPv4 (`/payment-link/docs/webhook`). Ao salvar, o painel gera uma **API Key** que o PicPay manda no header `authorization` de cada POST. O dono teria de colar URL e depois a chave de volta no AutoFluxos (2 passos manuais, num painel que não controlamos).
- Uma URL por conta lojista. Como não há query, o segredo/identificação do cliente tem que ir no **caminho** (`/api/webhooks/picpay/<token-do-cliente>`).
- Cabeçalho `event-type: TransactionPaymentMessage` (Link) / `TransactionUpdateMessage` (Pix). **Sem assinatura HMAC**: só a chave estática no `authorization`. Comparar em tempo constante.
- Reenvio/retentativas: **`[?]` não documentado**.
- Corpo (Link): `data.transaction{id, status, amount, paymentType(WALLET|PIX|CREDIT_CARD), originalTransactionId, createdAt, updatedAt}`, `data.charge{paymentLinkId, checkoutLink, qrCode, amount, expiresAt}`, `type` (PAYMENT|REFUND), `eventDate`.

### 1.7 Recorrência
- Cartão: planos/assinaturas só na **API Checkout** (`/checkout/docs/api/create-plan`, `/create-checkout`, `/subscription`, `/features/recurrency`): Mastercard, Visa, Elo, Amex, Hiper. Exige PCI. Retentativas automáticas.
- Pix Automático: **não encontrei** na doc `[?]`.

### 1.8 Sandbox
- Existe, com credenciais próprias. **Sandbox do Link**: host `https://api.ms.qa.limbo.work`, rotas `/sandbox/v1/paymentlink/...` e `/oauth2/token` (`/payment-link/docs/sandbox/setting_up`). Links e transações expiram em pouco tempo.

### 1.9 Idempotência e limites
- Link: sem chave de idempotência documentada `[?]`. API Pix: `merchantChargeId` único ("a reutilização..." é rejeitada, texto truncado na página). Limites de taxa: `[?]`.

### 1.10 Taxas e porte
- Taxas `[?]` (terceiro, iDinheiro, sem data): Pix 0,99%; crédito à vista 3,19%; 2x a 6x 4,80%; 7x a 12x 5,10%. Outra página do mesmo site cita 4,29% por transação. Divergem. Sem tabela oficial lida.
- Porte: PicPay é gigante em pessoa física, e o Negócios tem base grande em MEI/varejo. Mas a API de lojista é desenhada para e-commerce com PCI. Produto mudou várias vezes (API antiga `x-picpay-token` aposentada em favor do portal novo).

### 1.11 Riscos
1. Webhook manual no painel + chave estática copiada pelo dono (fricção e erro humano).
2. Token de 5 min e `client_secret` mostrado uma vez.
3. Link reutilizável, sem pagador, data de expiração em dia, status do GET não confirmado.
4. PCI DSS exigido na API Checkout/Pix; sem Pix Automático encontrado.
5. Documentação em portal JS; produtos já mudaram de nome/host (`svc` vs `svcp`).

### 1.12 Veredito
Serve **parcialmente**, pior que Asaas: Pix + link por API do Link de pagamento funcionam, mas a conexão é de 3 passos manuais (gerar credencial, colar URL, copiar API Key de volta) e a leitura/estado exige confirmação em sandbox. **Esforço: G** (credenciais de par client_id/secret, cache de token, webhook por caminho, 3 incógnitas de status). Recomendo **não priorizar**.

---

## 2. Iugu

Ativo em 2026 (changelog de 22/10/2026, 17/09/2026, 01/09/2026 com Pix Automático Jornada 2). Foco B2B/SaaS/marketplace, não varejo pequeno. Fonte: `https://dev.iugu.com/llms.txt`.

### 2.1 Conexão da conta do dono
- **Chave colada.** Token de API (`live_token` ou `test_token`) criado pelo dono em **alia.iugu.com > Configurações > Integração via API > Novo** (`/docs/tokens-de-autenticacao`).
- **Atrito alto**: na criação, a **Autenticação RSA é obrigatória** ("Obrigatório: Durante a criação, utiliza-se a tecnologia de Autenticação RSA") e os **administradores da conta precisam aprovar** o token; enquanto não aprovado, 401. Token fica visível **apenas 1h**, depois mascarado. IP fixo é opcional.
- Uso: HTTP Basic (recomendado, usuário = token, senha vazia), Bearer, ou `?api_token=`. Base `https://api.iugu.com/v1`.
- A assinatura RSA no corpo só é exigida em endpoints sensíveis (transferências, saque, criar subconta, API tokens). **Criar fatura e Pix não exigem.**
- Conta precisa estar **verificada** para Pix (`/docs/realizar-cobrança-com-pix-por-api`). Pix Automático em assinaturas exige **PJ com CNPJ**.
- Sem OAuth/parceiro para o caso "conta do dono". Subconta/marketplace existe mas tem custo de manutenção por subconta e é o modelo de split, que não queremos.

### 2.2 Criar cobrança Pix
Ativar Pix: painel (Configurações > Pix) ou `POST /v1/payments/pix` com `enable:true`.
`POST /v1/invoices` (`/reference/criar-fatura`). Obrigatórios: `email`, `due_date` (AAAA-MM-DD), `items[]` (`description`, `quantity`, `price_cents`; **mínimo 100 centavos**). Valor em **centavos**.
- Para Pix: `"payable_with": ["pix"]` e `payer{cpf_cnpj, name, email,...}` ("Dados obrigatórios para emissão de boletos e Pix"). **CPF/CNPJ do pagador é praticamente obrigatório** (nome obrigatório se `cpf_cnpj` informado). Mesmo ponto do Asaas.
- Expiração do QR: `pix_qr_code_expires_at` (ISO 8601, data-hora com segundos); `expires_in` (0 a 120 dias após o vencimento).
- Resposta: `id` (32 hex), `status`, `secure_url`/link da fatura `[?]` nome do campo não lido, e objeto `pix`: `qrcode` (URL da imagem) e **`qrcode_text`** (copia e cola). Fonte: `/docs/realizar-cobrança-com-pix-por-api`.
- Campos úteis para nós: `external_reference` (até 60 chars; guardamos o `referencia`), `order_id`, `notification_url` (URL por fatura).

### 2.3 Link, cartão, boleto
- A própria fatura **é** o link (página `faturas.iugu.com`): `payable_with: ["all"]` ou `credit_card`, `bank_slip`, `pix`. Endpoint do link na resposta: campo `secure_url` `[?]`.
- Boleto exige `payer.name` e `cpf_cnpj`.

### 2.4 Ler pagamento
`GET /v1/invoices/{id}` (`/reference/buscar-fatura`). Resposta traz `status`, `total_cents`, `total_paid_cents`/`paid_cents`, `paid_at`, `external_reference`, `pix{...}`.
Status (`/reference/status`): `pending, paid, canceled, in_analysis, draft, partially_paid, refunded, expired, in_protest, chargeback, externally_paid`.
Mapa: `paid`/`externally_paid` -> paga; `refunded`/`chargeback`/`in_protest` -> estornada; `canceled`/`expired` -> cancelada (expired pode virar paid depois, nota da doc); `pending`/`partially_paid`/`in_analysis`/`draft` -> pendente.
Pegadinha: `canceled -> paid` e `expired -> paid` são transições permitidas pela doc (pagamento tardio).

### 2.5 Cancelar
`PUT /v1/invoices/{id}/cancel` (`/reference/cancelar`): cancela fatura em análise, pendente ou expirada. Estorno: `POST /v1/invoices/{id}/refund`.

### 2.6 Webhook (Gatilhos)
- **Por API**: `POST /v1/web_hooks` com `{event, url, authorization?}` (`/reference/criar-gatilho`). Limite de **20 gatilhos** por conta. Evento que nos serve: **`invoice.status_changed`** (payload: `event`, `data[id]`, `data[status]`, `data[payment_method]`, `data[paid_at]`, `data[paid_cents]`, `data[external_reference]`, `data[pix_end_to_end_id]`...). Também existe `invoice.refund`.
- Cadastro único por conta ao conectar (parecido com Asaas/MP). Dá para criar via API com o próprio token do dono.
- Envio: `Content-Type: application/x-www-form-urlencoded` (campos `data[id]` etc.), **não JSON**. IP de saída `98.82.243.132`.
- Autenticação: o campo `authorization` do gatilho é uma chave para "Basic Authentication" na validação do recebimento. **Sem HMAC.** Algoritmo exato de como é enviada: `[?]` (a doc só diz Basic). Fallback: segredo no caminho da URL. Como relemos de qualquer jeito (`GET /invoices/{id}`), isso basta.
- Reenvio: há `Reenviar Gatilho (por período)` e `Listar Logs` / `Disparar Log Novamente` na API; política automática de retentativa `[?]`.
- Limite de URL `[?]`.

### 2.7 Recorrência
- **Cartão**: Planos (`/v1/plans`), Clientes, Formas de pagamento, Assinaturas (`/v1/subscriptions`). Maduro. Requer cartão tokenizado (iugu.js / PCI-aware) ou o link da fatura.
- **Pix Automático**: sim, em assinatura via objeto `automatic_pix` (`/docs/cobranças-recorrentes-por-api-pix-automático`, changelog 16/07/2026 e 01/09/2026 "Jornada 2"). **Só PJ com CNPJ.** Pix comum em assinatura não é automático.

### 2.8 Sandbox
Existe: `test_token` criado no mesmo painel. **Limites**: 50 req/min (429), 1000 faturas de teste por dia.

### 2.9 Idempotência e limites
`Idempotency-Key` no header, vale 24h, aceita em Criar fatura, assinatura, cliente. Segunda chamada igual simultânea dá 409; `resource_id:"processing"` significa "em andamento, não reenvie". Limite de taxa em produção: `[?]`.

### 2.10 Taxas e porte
`[?]` (quasa.io, consulta de 16/10/2026, plano Essencial): Pix 0,99%; boleto R$ 2,19; cartão 3,34%; + R$ 0,40 de processamento em boleto/cartão. Mensalidade "consulte". O Asaas aparece no mesmo texto a R$ 1,99 por Pix. Porte: forte em SaaS e marketplace, **pouco conhecido do pequeno comércio**; conta exige verificação.

### 2.11 Riscos
1. Criação de token com RSA obrigatória + aprovação de admin + visível 1h: dono pequeno trava aqui.
2. Webhook é form-urlencoded, sem HMAC (Basic opcional), só 20 gatilhos por conta.
3. Valor mínimo 100 centavos, e conta precisa estar verificada; Pix Automático só PJ.
4. `canceled`/`expired` podem virar `paid` (tardio): nunca "fechar" definitivamente uma cobrança só por ter expirado.

### 2.12 Veredito
Serve tecnicamente: modelo "conta do dono, chave colada, fatura por API, gatilho por API, releitura por id" encaixa quase 1:1 no Asaas. **Esforço: M** (o mesmo que Asaas, mais o parser de form-urlencoded; pouco mais que Asaas por causa do onboarding do token com RSA). Boa opção para **donos PJ/SaaS**, fraca para MEI.

---

## 3. PagHiper

Ativo em 2026 (docs atualizadas em 23/09/2026; plugin oficial WooCommerce, Magento, WHMCS, app Nuvemshop). Foco: boleto e Pix para e-commerce brasileiro, muito presente em lojas pequenas e WordPress/WooCommerce.

### 3.1 Conexão da conta do dono
- **Chave colada com 2 valores**: `apiKey` (começa com `apk_`) e `token`, ambos em `https://www.paghiper.com/painel/credenciais/` (`/reference/notificacoes-automatica-de-status-retorno-automatico-pix`). Sem OAuth, sem aprovação de parceiro.
- Sem distinção sandbox/produção na credencial: `[?]` não encontrei sandbox (ver 3.8).
- No nosso `AcessoAoGateway` o campo `token` único não basta: guardar `apiKey` + `token` (cifrado, por exemplo `apiKey:token`).

### 3.2 Criar cobrança Pix
`POST https://pix.paghiper.com/invoice/create/` (SDK oficial `Transaction::CREATE_PIX_ENDPOINT`, no repo oficial `paghiper/woocommerce-paghiper`). JSON com `apiKey` e `token` no corpo (não em header). Header `Accept: application/json`.
Campos usados pelo plugin oficial (a página de doc de criar Pix não está no índice, ver topo): `order_id` (nosso `referencia`, até 64 chars), `payer_email`, `payer_name`, **`payer_cpf_cnpj`**, `payer_phone`, endereço (`payer_street`, `payer_number`, `payer_district`, `payer_city`, `payer_state`, `payer_zip_code`), `notification_url`, **`days_due_date`** (**dias**, não minutos), `items[{item_id, description, quantity, price_cents}]`, `shipping_price_cents`, `discount_cents`, `seller_description`, `partners_id`. Quais são obrigatórios exatamente: `[?]`. CPF/CNPJ do pagador praticamente obrigatório (o plugin pede e valida).
- Valores em **centavos**. Boleto tem mínimo R$ 3,00 (doc do boleto); Pix `[?]` mínimo (plugin usa 3 como mínimo).
- Resposta (`pix_create_request`): `result` (`success`/`reject`), `transaction_id` (16 chars), `status`, `order_id`, `value_cents`, `due_date`, `due_datetime`, e `pix_code`: **`emv`** (copia e cola), `qrcode_base64`, `qrcode_image_url`, `pix_url`, `bacen_url`. (Doc de resposta: `/reference/especificacoes-dos-campos-da-mensagem-de-resposta-pix`.)
- **Pegadinha**: validade só em dias inteiros. Não dá para expirar em 30 min; precisaríamos cancelar nós mesmos pelo relógio. Aviso do plugin: total acima de **R$ 9.000** exige liberação comercial.

### 3.3 Link e cartão
- **Pix e boleto apenas.** Não encontrei cartão de crédito na API PagHiper. Link: `pix_url`/`bacen_url`/`qrcode_image_url` abre o QR, não é checkout com cartão. Boleto: `POST https://api.paghiper.com/transaction/create/` (doc `gerar-boleto`).

### 3.4 Ler pagamento
- Notificação (fluxo próprio, ver 3.6) devolve o JSON completo com `status`, `value_cents`, `value_cents_paid`, `value_fee_cents`, `status_date`, `order_id`, `pix_code`.
- Status por consulta: SDK usa `POST https://api.paghiper.com/transaction/status/` com `transaction_id` (`status_request`). **`[?]` não confirmei que serve para transação Pix**, nem existe `pix.paghiper.com/invoice/status` no SDK. Caminho seguro: reler via endpoint de notificação (`pix.paghiper.com/invoice/notification/`), que exige `notification_id`, que só existe após um evento.
- Status: `pending, canceled, completed, paid, processing, refunded` (doc de resposta Pix). Mapa: `paid`/`completed` -> paga (o plugin trata `completed` como "disponível para saque"); `refunded` -> estornada; `canceled` -> cancelada; `pending`/`processing` -> pendente.
- Data do pagamento: `status_date`. Valor pago: `value_cents_paid`.

### 3.5 Cancelar
SDK: `POST https://api.paghiper.com/transaction/cancel/` com `transaction_id` e `status:"canceled"` (resposta `cancellation_request`). `[?]` não confirmei para Pix na doc.

### 3.6 Webhook
- **Por cobrança**: `notification_url` no corpo do create (igual InfinitePay). Sem cadastro prévio. Nossa regra de `clienteId` na URL (já existe em `PedidoDeCobranca.clienteId`) encaixa exatamente.
- Formato: **POST simples form** com `apiKey, transaction_id, notification_id, notification_date, source_api`. O servidor do lojista então chama `POST https://pix.paghiper.com/invoice/notification/` com JSON `{token, apiKey, transaction_id, notification_id}` e recebe o status completo. **Isso já é a nossa regra "não confiar no corpo, reler com o acesso do dono"** por desenho do gateway.
- Validação: quem prova a autenticidade é o `notification_id` ser aceito pela API com `apiKey`+`token` do dono. Sem HMAC. Notificação fica consultável por 30 dias.
- Reenvio: se a loja não responder, **retenta a cada 2 horas durante 24 horas**. Responder 2xx.
- Limite de URL: `[?]`.

### 3.7 Recorrência
**Não encontrei** assinatura em cartão nem Pix Automático na doc `[?]`. O produto é de cobrança avulsa (boleto/Pix). Sem recorrência nativa: a mensalidade seria gerada por nós todo mês.

### 3.8 Sandbox
`[?]` não achei sandbox na documentação lida. Teste real provavelmente só em conta real.

### 3.9 Idempotência e limites
Sem chave de idempotência documentada `[?]`. O `order_id` é "código de referência da venda" mas não vi garantia de unicidade `[?]`. Limite de taxa `[?]`.

### 3.10 Taxas e porte
`[?]` (página do app PagHiper na Nuvemshop, não a tabela direta): Pix R$ 0,99 por pago; boleto R$ 2,39; sem mensalidade; emitido e não pago não cobra. Porte: nome conhecido por lojas WooCommerce/Nuvemshop/Magento; parceiro de plataformas, **forte em boleto**, menos usado em prestadores de serviço do que Asaas/Mercado Pago.

### 3.11 Riscos
1. Página oficial de criar Pix fora do índice: contrato inferido do SDK do plugin; mudanças não anunciadas.
2. Credencial em corpo JSON; sem sandbox; status/cancel de Pix `[?]`.
3. Expiração em dias inteiros; teto de R$ 9.000 sem liberação.
4. Sem cartão nem recorrência.

### 3.12 Veredito
Serve **só para Pix e boleto avulso**. O webhook com releitura é o mais alinhado com nossa regra de segurança. Esforço **P a M** (mais simples que Asaas: sem cliente/customer, URL por cobrança, 2 chaves coladas), mas com 4 `[?]` que só um teste em conta real resolve. Recomendado como "terceiro Pix" barato, **sem cartão e sem recorrência**.

---

## Comparativo (Asaas = referência)

| | Conexão | Webhook | Release id | Cartão | Recorrência | Esforço vs Asaas |
|---|---|---|---|---|---|---|
| Iugu | chave colada, mas RSA + aprovação de admin, visível 1h | por API, 1 por conta, form-urlencoded, Basic opcional | `GET /invoices/{id}` | sim (fatura) | cartão e Pix Automático (PJ) | M, igual |
| PagHiper | `apiKey` + `token` colados | por cobrança (`notification_url`), relê na API | via endpoint de notificação | não | não achado | P a M, mais simples |
| PicPay | `client_id`+`client_secret`, token de 5 min | manual no painel, chave estática copiada pelo dono | `[?]` formato | sim (link) | só Checkout/PCI | G |

## Os 3 riscos mais importantes (resumo)
1. **PicPay**: webhook configurado à mão pelo dono no painel (URL sem query + API Key copiada de volta) e token que expira em 5 min; status do GET do link não confirmado.
2. **Iugu**: onboarding do token (RSA obrigatória na criação, aprovação de admin, token visível 1h) vai travar dono pequeno; webhook é form-urlencoded e `canceled`/`expired` ainda podem virar `paid`.
3. **PagHiper**: contrato de Pix inferido do SDK do plugin oficial (doc de criar Pix fora do índice), sem sandbox, expiração só em dias, sem cartão/recorrência.

## Fontes principais
- Iugu: `https://dev.iugu.com/llms.txt`, `/docs/tokens-de-autenticacao`, `/docs/realizar-cobrança-com-pix-por-api`, `/reference/criar-fatura`, `/reference/status`, `/reference/cancelar`, `/reference/criar-gatilho`, `/docs/gatilhos`, `/docs/gatilhos-fatura`, `/reference/chave-de-idempotência`, `/reference/introdução-a-api`, `/docs/cobranças-recorrentes-por-api-pix-automático`.
- PagHiper: `https://dev.paghiper.com/llms.txt`, `/reference/gerar-boleto`, `/reference/especificacoes-dos-campos-da-mensagem-de-resposta-pix`, `/reference/notificacoes-automatica-de-status-retorno-automatico-pix`; GitHub oficial `https://github.com/paghiper/woocommerce-paghiper` (SDK em `includes/paghiper-php-sdk/build/src/Transaction.php`).
- PicPay: `https://developers-business.picpay.com/payment-link/docs/{introduction,authentication,webhook,api/create-charge,api/find-charge,api/inactive-charge,api/refund-charge,sandbox/*}`, `/pix/docs/{introduction,authentication,security,api/charge-pix,api/find-charge,webhook}`, `/checkout/docs/{introduction,authentication,features/recurrency}`.
