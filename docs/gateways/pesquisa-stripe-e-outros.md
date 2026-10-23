# Pesquisa E: Stripe e outros gateways para a cobrança pelo chat

Data da pesquisa: 23/10/2026. Fontes: documentação oficial, URL em cada bloco. `[?]` = não confirmado na doc oficial (ou só em fonte de terceiro).
Contexto: interface `GatewayDePagamento` em `src/channels/pagamento.ts` (criarCobranca, lerPagamento, cancelarPagamento, recorrência opcional). Regra: webhook só entrega o id, o pagamento é relido na API com o acesso do dono.

## Resumo executivo

| Gateway | Serve? | Esforço vs Asaas (Asaas = P) | Em uma linha |
|---|---|---|---|
| Stripe Brasil | Sim, como gateway de nicho (digital/SaaS) | M a G | OAuth Connect Standard funciona, webhook único da plataforma, Pix só pontual, boleto e cartão no Checkout. Exige conta Stripe aprovada do dono com Pix habilitado. |
| Vindi | Talvez, só dono que já é cliente Vindi | M | Chave colada (Basic), mas webhook é cadastrado só no painel (não por API) e sem assinatura. Pix avulso mal documentado. |
| Appmax | Não recomendado | G | Modelo de loja virtual (cliente, pedido, pagamento), app precisa ser instalado por loja, dev precisa de CNPJ. Webhook sem assinatura. |
| Zoop | Não | G | Modelo marketplace/seller com KYC, split, D+1 pela conta Zoop. Não é "conectar a conta do dono". |
| EBANX | Não | n/a | Termos de pay-in são para vendedor que vende de fora do país do pagador. Pix existe, mas o público é comerciante internacional. |
| SumUp Brasil | Não por enquanto | n/a | API tem OAuth e checkout hospedado, mas Pix não aparece como `payment_type` na API online. `[?]` |
| Ton/Stone | Não | n/a | Sem API pública de link/Pix para terceiro achada. Stone Openbank existe, mas só via parceria comercial. |
| Nubank PJ | Não | n/a | Sem API pública. Cobrança Pix só dentro do app. |

---

## 1. Stripe (Brasil)

### 1.1 Como o dono conecta
- Stripe Connect, contas Standard, OAuth. Link: `GET https://connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_...&scope=read_write&state=...` (https://docs.stripe.com/connect/oauth-standard-accounts, https://docs.stripe.com/connect/oauth-reference).
- Troca do code: `POST https://connect.stripe.com/oauth/token` com `grant_type=authorization_code`, `code`, autenticado com a **chave secreta da plataforma** (nossa). Resposta: `stripe_user_id` (acct_...), `livemode`, `scope`. O code vale 5 min e só pode ser usado uma vez; usar duas vezes revoga a conexão (https://docs.stripe.com/connect/oauth-reference).
- `access_token`, `refresh_token` e `stripe_publishable_key` na resposta estão marcados **(Obsoleto)**. O caminho atual é usar a chave secreta da plataforma + header `Stripe-Account: acct_...` em cada chamada (https://docs.stripe.com/connect/authentication). Ou seja, o "token do dono" que guardamos no cofre é só o `acct_...`; o segredo é o nosso.
- A doc diz que OAuth **não é recomendado para novas plataformas Connect**; recomenda Connect Onboarding (Account Links) para criar a conta Standard. OAuth segue documentado e é o caminho para conta já existente (https://docs.stripe.com/connect/oauth-standard-accounts, https://docs.stripe.com/connect/standard-accounts). Ambos servem; para "o dono já tem Stripe" o OAuth é o certo.
- Precisamos ter conta Stripe própria com Connect habilitado, redirect URIs cadastradas (HTTPS em produção) e `client_id` (live e test são diferentes). Aprovação especial da Stripe para ser plataforma: não achei exigência explícita na doc de OAuth; a ativação do Connect no Dashboard pode pedir perfil da plataforma `[?]`.
- Desde junho/2021 plataforma com escopo `read_write` não conecta conta Standard que já seja controlada por outra plataforma (https://docs.stripe.com/connect/oauth-standard-accounts). Dono que usa Stripe via Shopify/Wix etc. pode falhar na conexão.
- Desconectar: `POST https://connect.stripe.com/oauth/deauthorize`; o dono desconectando dispara o evento `account.application.deauthorized` (https://docs.stripe.com/connect/webhooks).

### 1.2 Criar cobrança
**Pix (copia e cola)** via PaymentIntent, header `Stripe-Account`:
- `POST /v1/payment_intents` com `amount` (centavos), `currency=brl`, e Pix habilitado no Dashboard do dono (https://docs.stripe.com/payments/pix/accept-a-payment, aba API Direct).
- O Pix exige `billing_details` com `name`, `email` e `tax_id` (CPF ou CNPJ) ao confirmar (mesma página).
- O guia mostra a confirmação pelo front (`stripe.confirmPixPayment`), que devolve `next_action.pix_display_qr_code` com `data` (string do copia e cola, "Pix EMV"), `image_url_png`, `image_url_svg`, `hosted_instructions_url` e `expires_at`. Confirmar o PaymentIntent **direto do servidor** (`confirm=true` + `payment_method_data[type]=pix` + `billing_details`) para obter o `next_action` sem browser é o esperado para nosso caso, mas **o guia fetchado só mostra o fluxo via Stripe.js** `[?]`. Teste em sandbox antes de fechar o desenho.
- Validade: `payment_method_options[pix][expires_after_seconds]` (60 a 1.209.600 s) ou `expires_at`; padrão 4 horas (14.400 s) contado da confirmação. Não se pode mandar os dois. A doc recomenda confiar no evento `payment_intent.payment_failed` para saber que expirou (mesma página).
- Limites: mínimo R$ 0,50; máximo padrão por pagamento equivalente a US$ 3.000 em BRL (https://docs.stripe.com/payments/pix).

**Link (cartão, boleto, Pix)**:
- Checkout Session hospedada: `POST /v1/checkout/sessions` com `mode=payment`, `line_items`, `success_url`, `client_reference_id`, `metadata`, `expires_at` (de 30 min a 24 h após a criação; padrão 24 h). Retorna `url` (https://docs.stripe.com/api/checkout/sessions/create). Pix, boleto e cartão aparecem conforme os métodos habilitados no Dashboard do dono (https://docs.stripe.com/payments/pix e https://docs.stripe.com/payments/boleto listam Checkout e Payment Links como suportados).
- Payment Link (`POST /v1/payment_links`) também existe, mas não tem `expires_at`; desativa-se com `active=false` `[?]` (a página de criação não mostra o campo de desativação, só `restrictions`). Para cobrança com prazo, Checkout Session é melhor.
- Boleto: PaymentIntent boleto devolve `next_action.boleto_display_details.number` e voucher hospedado; validade padrão 3 dias, configurável de 0 a 60 dias; mínimo R$ 5,00, máximo R$ 49.999,99 (https://docs.stripe.com/payments/boleto). Aceita só conta Stripe no Brasil.
- Conclusão de desenho: dois objetos por cobrança, como o Mercado Pago (`pagamentoId` = PaymentIntent do Pix; `preferenciaId` = Checkout Session do link). A Checkout Session cria o PaymentIntent próprio só quando o cliente escolhe o método, então são pagamentos distintos para a mesma cobrança. Ler os dois e cancelar o que sobrar.

### 1.3 Ler pagamento
- `GET /v1/payment_intents/{id}` com `Stripe-Account`. Status: `requires_payment_method`, `requires_confirmation`, `requires_action`, `processing`, `requires_capture`, `canceled`, `succeeded` (https://docs.stripe.com/api/payment_intents/object).
- Mapeamento proposto: `succeeded` = paga (`amount_received`); `canceled` = cancelada; demais = pendente. Pix que expira volta para `requires_payment_method` (a busca sobre o ciclo de vida diz isso; confirmar em sandbox `[?]`).
- Estornada: não há status no PaymentIntent. É preciso olhar `latest_charge` (expandir) e `amount_refunded`/`refunded`, ou o evento `charge.refunded`. Pix aceita reembolso total e parcial em até 90 dias (https://docs.stripe.com/payments/pix). Boleto **não** tem reembolso pela Stripe (https://docs.stripe.com/payments/boleto).
- Para Checkout Session: `GET /v1/checkout/sessions/{id}` traz `status` (`open`, `complete`, `expired`), `payment_status` e `payment_intent`.
- Referência: o `metadata` que pusermos no PaymentIntent (id da linha em `cobrancas`) volta na leitura; devolve como `referencia`. Em Checkout Session, `client_reference_id` e `metadata` da sessão, e `payment_intent_data[metadata]` para chegar ao PaymentIntent.
- Pix com e-mail "pessoa@dominio" em teste: ver sandbox.

### 1.4 Cancelar/expirar
- Pix: `POST /v1/payment_intents/{id}/cancel` (status cancelável: `requires_payment_method`, `requires_capture`, `requires_confirmation`, `requires_action`, e "em casos raros" `processing`). Erro se já cancelado ou fora de estado cancelável (https://docs.stripe.com/api/payment_intents/cancel). A página do Pix confirma que se cancela o Pix cancelando o PaymentIntent antes do vencimento.
- Checkout Session: `POST /v1/checkout/sessions/{id}/expire` (só em `open`) (https://docs.stripe.com/api/checkout/sessions/expire). O PaymentIntent de uma Checkout Session só se cancela direto se estiver em `requires_capture`; senão tem de expirar a sessão (página do cancel).

### 1.5 Webhook
- Modelo bom para nós: **um destino de eventos só, da plataforma**, escopo "Contas conectadas" (`connect=true` na API antiga de webhook endpoints). Cada evento traz `account` (acct_ do dono) no topo (https://docs.stripe.com/connect/webhooks). Não há cadastro por dono, ao contrário do Asaas.
- Cadastro: Dashboard/Workbench ou API v2 `POST /v2/core/event_destinations` com `events_from=["@accounts"]` (https://docs.stripe.com/webhooks). Mantemos também o endpoint v1 `webhook_endpoints` com `connect` como alternativa `[?]` (a página de Connect cita o parâmetro `connect` do endpoint v1).
- Assinatura: header `Stripe-Signature: t=<ts>,v1=<hex>`; HMAC SHA-256 de `"<t>.<corpo bruto>"` com o segredo `whsec_...` do endpoint; só `v1` vale; tolerância padrão de 5 min; comparação em tempo constante; precisa do corpo bruto (https://docs.stripe.com/webhooks).
- Formato: JSON com `id`, `type`, `account`, `livemode`, `data.object`. Entrega duplicada e fora de ordem é possível; guardar `event.id`. Reentrega por até 3 dias em produção (mesma página).
- Eventos úteis: `payment_intent.succeeded`, `payment_intent.payment_failed` (Pix expirou), `payment_intent.canceled`, `charge.refunded`, `checkout.session.completed`, `checkout.session.async_payment_succeeded` (boleto) `[?]` (nomes dos eventos de Checkout não foram abertos na doc), `account.application.deauthorized`.
- Regra nossa (só o id sai do corpo, ler de novo): fica natural. Pegamos `data.object.id` + `account` e fazemos `GET` com `Stripe-Account`.
- Um endpoint para live e outro para sandbox (segredos diferentes).

### 1.6 Recorrência
- Cartão: Checkout `mode=subscription` ou Billing/Invoices, na conta do dono. Existe e é maduro.
- Pix Automático: **não disponível para empresas domiciliadas no Brasil** (https://docs.stripe.com/payments/pix; https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil?locale=pt-BR). Só pix pontual. Logo `criarAutorizacaoPix` não se implementa.
- Boleto aceita recorrência pela Billing (`Recurring payments: Supported` na página do boleto).

### 1.7 Sandbox
- Chaves de teste/sandbox; `client_id` de teste para conectar conta de teste (https://docs.stripe.com/connect/oauth-standard-accounts).
- Pix teste: CPF/CNPJ `000.000.000-00`; e-mail controla o cenário: qualquer e-mail paga em 3 min; `succeed_immediately@...` imediato; `expire_immediately@...`; `expire_with_delay@...`; `fill_never@...` (https://docs.stripe.com/payments/pix/accept-a-payment). Nos cenários com atraso, a Stripe **ignora** os parâmetros de expiração.
- Stripe CLI: `stripe listen --forward-connect-to ...` para Connect.

### 1.8 Público
- Stripe Brasil existe e abre conta para CNPJ e para pessoa física (CNPJ opcional para sole proprietorship), representante residente no Brasil com CPF regular, conta bancária, faixa de renda mensal (https://support.stripe.com/questions/brazil-specific-information-to-open-a-stripe-account). Há regras novas de verificação em 2026 (https://support.stripe.com/questions/2026-updates-to-brazil-verification-requirements); detalhes não lidos.
- Pix **é para conta Stripe brasileira** e também para contas de vários países recebendo de pagador brasileiro (https://docs.stripe.com/payments/pix). Para conta no Brasil: BRL, liquidação em BRL, T+2.
- MCCs proibidos para Pix: farmácia, bares, loja de bebidas alcoólicas, serviços médicos, hospitais, laboratórios, equipamentos médicos, encontros, apostas, cripto, seguros (https://docs.stripe.com/payments/pix). **Clínicas e consultórios (8099, 8062, 8071) ficam de fora**, o que corta parte do nosso público.
- Pix não aceita descritor personalizado: no extrato do pagador aparece Ebanx como destinatário (a Stripe usa a Ebanx como parceira de Pix) (mesma página).
- Habilitar Pix: Dashboard > Configurações > Formas de pagamento, "se for elegível" (https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil). Uma busca trouxe "60 dias de processamento + boa situação" e outra fonte "Pix por convite", ambas de terceiros ou não reconfirmadas na página aberta `[?]`. Tratar como: nem todo dono consegue ligar Pix de imediato.
- Popularidade: mais usada por negócio digital/SaaS do que por comércio local de bairro; PMEs tradicionais ficam em Mercado Pago, PagBank, InfinitePay (mesma comparação de mercado, fonte não oficial).

### 1.9 Riscos e pegadinhas
1. Pix pode não estar habilitado na conta do dono; precisamos checar a capability após conectar (`GET /v1/accounts/{acct}` com capabilities `pix_payments`) e avisar. Para Standard com Dashboard completo, o dono ativa em suas próprias configurações (https://docs.stripe.com/payments/pix).
2. `access_token` OAuth obsoleto: usar chave da plataforma + `Stripe-Account`. A chave da plataforma é um segredo crítico nosso (vale para todas as contas conectadas).
3. OAuth não é recomendado para nova plataforma; conta já controlada por outra plataforma não conecta com `read_write`.
4. Pix tem validade e o QR "hospedado" é do PaymentIntent; Checkout Session cria PaymentIntents novos a cada escolha, então "pagamentoId" não é único por cobrança.
5. Nome na fatura do pagador diz Ebanx. Tira a confiança de alguns pagadores.
6. Estorno é por Charge, não por PaymentIntent. Boleto não estorna.
7. Eventos duplicados e fora de ordem (guardar `event.id`).
8. Chave de API de teste vs live: webhook de produção recebe também teste; checar `livemode`.
9. Comissão: a Stripe cobra do dono, nada para nós (sem `application_fee_amount`, como pede a regra de não ter split).

### 1.10 Veredito
**Serve, com ressalvas.** Esforço **M a G** vs Asaas: OAuth + troca de code + segredo de plataforma + webhook Connect único é parecido com o PagBank/Mercado Pago; o extra é lidar com dois objetos (PaymentIntent + Checkout Session), estorno via Charge e a checagem de capacidade de Pix. Entregar depois dos gateways que o público já usa; a razão para existir é o dono digital/SaaS que já tem Stripe e quer cartão internacional.

---

## 2. Vindi

### 2.1 Conexão
- Chave de API colada. Autenticação HTTP Basic: chave no usuário, senha vazia (manter os dois-pontos). Gerar em Configurações > Chaves de acesso. Base: `https://app.vindi.com.br/api/v1` (https://developers.vindi.com.br/reference/segurança-e-autenticação.md).
- Há OAuth da "Vindi Commerce": exige Consumer Key/Secret pedidos por formulário, token de 24 h; é para o produto Commerce, não está descrito para plataforma de terceiros (https://developers.vindi.com.br/reference/access_token.md). Tratar como indisponível `[?]`.

### 2.2 Criar cobrança
- Fatura avulsa Pix: `POST /v1/bills` com `customer_id`, `payment_method_code: "pix"`, `bill_items[]` com `product_id`, `amount` (https://developers.vindi.com.br/docs/fatura-avulsa-pix.md). Precisa criar cliente (`POST /v1/customers`) e produto antes.
- A doc diz que o link de pagamento com QR/chave Pix vem na resposta da criação da fatura, mas **não documenta os campos** (nem o do copia e cola, nem validade, nem a unidade de `amount`) `[?]`. Uma busca indicou o QR dentro dos campos de resposta do gateway da última transação (`last_transaction.gateway_response_fields`) em exemplos de webhook, de terceiros `[?]`.
- Pix na Vindi só via API/checkout; não disponível nos módulos Magento, Shopify, OpenCart, WooCommerce (blog Vindi, terceiro oficial; https://blog.vindi.com.br/pix-vindi-recorrencia/).
- Link de cartão/boleto: a "fatura" tem URL de pagamento da Vindi; não confirmei o campo `[?]`.

### 2.3 Ler
- `GET /v1/bills/{id}` e `GET /v1/charges/{id}` (índice em https://developers.vindi.com.br/llms.txt). Valores monetários vêm como string. Status: não li o enum `[?]`; eventos citam `bill_paid` e `charge_rejected`.

### 2.4 Cancelar
- `DELETE /v1/bills/{id}` cancela fatura; `DELETE /v1/charges/{id}` cancela cobrança; `POST /v1/charges/{id}/refund` estorna (llms.txt).

### 2.5 Webhook
- **Cadastro só no painel** (Configurações > Webhooks > Novo Webhook), não por API (https://developers.vindi.com.br/reference/webhooks-configura%C3%A7%C3%B5es). Isso significa que cada dono teria de colar nossa URL no painel dele. Mata a experiência "conectou, funciona".
- **Sem assinatura.** Autenticidade: usuário/senha na URL (Basic) ou parâmetro secreto na query, IP list, mTLS opcional (https://developers.vindi.com.br/reference/webhooks-segurança-e-testes.md). Teria de ser um segredo por dono na URL.
- Corpo JSON (POST), resposta 2xx em até 20 s, retentativa até 8 vezes em cerca de 48 h (busca com base no portal; a página antiga de `docs/webhooks` descreve outro formato de transação com retry a cada 12 h por 3 dias, parece ser da Vindi Commerce) `[?]`.
- Eventos: `bill_created`, `bill_paid`, `charge_rejected`, etc. (https://developers.vindi.com.br/reference/payload-dos-webhooks).

### 2.6 Recorrência
- É o forte da Vindi: planos, assinaturas, cartão recorrente, Pix recorrente (https://developers.vindi.com.br/docs/pix-recorrente.md, não lido a fundo `[?]`).

### 2.7 Sandbox
- Ambiente separado com login próprio `https://sandbox-app.vindi.com.br/users/sign_in` (https://developers.vindi.com.br/docs/ambiente-para-testes.md). Criação da conta de sandbox não explicada `[?]`. Limite de 120 req/min (https://developers.vindi.com.br/reference/especifica%C3%A7%C3%B5es-t%C3%A9cnicas).

### 2.8 Público
- Recorrência/assinatura para empresa média (clubes, escolas, SaaS). Para pequeno negócio de bairro é menos comum. Contratação comercial `[?]`.

### 2.9 Riscos
1. Webhook manual no painel + sem assinatura = pior ponto de atrito do lote.
2. Pix avulso mal documentado (campos de resposta, validade).
3. Obrigatório criar cliente e produto antes da fatura (3 chamadas).
4. Pix não funciona em integrações prontas, só via API.

### 2.10 Veredito
**Só para dono que já é Vindi; não priorizar.** Esforço **M** (chave colada é simples, mas webhook manual e campos Pix a descobrir).

---

## 3. Appmax

### 3.1 Conexão
- Modelo de **app da Appstore Appmax**. Desenvolvedor cria app (público = homologação da Appmax; privado = convite, sem homologação); exige **CNPJ ativo** para a conta de desenvolvedor (https://docs.appmax.com.br/guides/criar-aplicativo). O lojista instala o app (`/app/authorize`, redirecionamento e `/app/client/generate`); a Appmax chama nossa URL de validação e esperamos `200` com `external_id` UUID; a instalação emite um par client_id/client_secret **por loja** (https://docs.appmax.com.br/guides/autenticacao).
- Token: `POST https://auth.appmax.com.br/oauth2/token`, `grant_type=client_credentials`, `client_id`, `client_secret`; vale 1 h, sem refresh (mesma página). Sandbox: `https://auth.sandboxappmax.com.br` e `https://api.sandboxappmax.com.br`; produção `https://api.appmax.com.br` (https://docs.appmax.com.br/guides/ambientes).

### 3.2 Criar cobrança
- Fluxo obrigatório: criar cliente (`/v1/customers`), criar pedido (`/v1/orders`), então pagamento. Pix: `POST /v1/payments/pix` com `order_id`, `payment_data.pix.document_number`, `expiration_date` opcional (`Y-m-d H:i:s`, fuso São Paulo). Resposta `data.payment.pix_emv` (copia e cola), `pix_qrcode` (PNG base64), `pix_expiration_date` (https://docs.appmax.com.br/api-reference/payments/pix).
- Link de cartão/boleto: "API payment links" aparece como recurso opcional/beta (https://docs.appmax.com.br/guides/conceitos), sem detalhe `[?]`. Cartão normal exige o JS da Appmax no front para tokenizar.

### 3.3 a 3.4 Ler e cancelar
- Não abri os endpoints de leitura, cancelamento e estorno `[?]`. A doc lista reembolsos e eventos `order_refund`, `order_partial_refund` (https://docs.appmax.com.br/guides/webhooks).

### 3.5 Webhook
- URL cadastrada **no app** (vale para todas as lojas que instalaram), não por dono. Envelope: `event`, `event_type`, `site_id`, `app_id`, `client_key`, `external_key`, `data` (traz `order_id`). **Sem assinatura nem token** (a doc diz isso explicitamente). Responder 2xx em até 5 s; 4 tentativas (imediata, +30 min, +2 h, +4 h) e depois descarta sem aviso. Ordem não garantida (https://docs.appmax.com.br/guides/webhooks).
- Eventos Pix: `order_pix_created`, `order_paid_by_pix`, `order_pix_expired`, `order_paid`, `order_approved`.

### 3.6 Recorrência
- Recurso opcional/beta (conceitos) `[?]`.

### 3.7 Sandbox
- Pix aprova sozinho em cerca de 5 s para CPF/CNPJ válido (ex.: `19100000000`); CPF `40827365144` ou CNPJ `40827365000109` deixa pendente (docs de Pix). Como obter acesso ao sandbox: "Testar" libera homologação pela equipe Appmax (criar-aplicativo).

### 3.8 Público
- Plataforma de checkout para loja virtual e infoproduto (palavras da própria doc: lojista, pedido, carrinho, recuperação de carrinho com IA, upsell). Não é o perfil "serviço por WhatsApp".

### 3.9 Riscos
1. Precisa ser app instalado na Appstore: desenvolvedor com CNPJ, homologação se for público.
2. Sem assinatura de webhook; reler pelo `order_id` resolve (cabe na nossa regra).
3. Fluxo cliente > pedido > pagamento, três chamadas.
4. Descarte silencioso de webhook após 4 tentativas.
5. A doc se contradiz em contagem de eventos (29 em 4 categorias vs 42 em 5 tipos).

### 3.10 Veredito
**Não recomendado.** Esforço **G** (app, instalação, homologação, modelo de pedido) para um público de loja virtual.

---

## 4. Zoop

### 4.1 Conexão
- Modelo **marketplace**: `/v1/marketplaces/{marketplace-id}/sellers`, vendedor com KYC e upload de documento (https://docs.zoop.co/). Quem cobra é o marketplace (nós) e "o vendedor" é o dono. O comprador paga a uma conta gráfica Zoop e o repasse ao parceiro é D+1 (regras de payout, https://docs.zoop.co/docs/criando-transacao-pix, busca).
- Autenticação: o índice marca endpoints com **mTLS**; a página de split mostra `Authorization: Basic` (https://docs.zoop.co/docs/implementando-split-de-pagamentos). Contradição `[?]`.
- Isso **fere a regra** "dinheiro direto na conta do dono, sem passar por nós": aqui a Zoop é a pagadora e nós seríamos marketplace.

### 4.2 Pix
- `POST /v1/marketplaces/{marketplace_id}/transactions` com `payment_type: "pix"` e `reference_id` único; QR em `qr_code.emv`; validade padrão 5 min, escolha de 5, 10, 15, 30 min e 1, 3, 6, 12, 24 h; acima de 24 h (até 730 dias) só com pedido ao suporte e só operação 100% online. Status `New`, `Pending`, `Succeeded`, `Failed`, `Canceled`. Cancelamento: a página não documenta endpoint (https://docs.zoop.co/docs/criando-transacao-pix).

### 4.3 a 4.7
- Webhook por marketplace (criar, listar, remover, reenviar até 100 eventos) (índice). Assinatura: não confirmada `[?]`. Sandbox: página de sandbox descrita é de Tap to Pay; Pix sandbox `[?]`.

### 4.8 a 4.10
- Público: marketplaces e plataformas. **Veredito: não.** Esforço **G**. Só faria sentido se virássemos subadquirente/marketplace, contra a regra do produto.

---

## 5. EBANX

- Pix: `POST /ws/direct` com `payment_type_code=pix`, `currency_code`, `amount_total`, `country=br`, `merchant_payment_code`, dados do cliente e documento; `expiration_time_in_seconds` opcional (padrão 5 h do merchant); resposta com `payment.pix.qr_code_value` e `redirect_url`; status `PE`, `CO`, `CA`; EBANX notifica a cada mudança e a doc manda reconsultar o pagamento (https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/brazil/pix).
- Autenticação: **JWS**; `integration_key` legada em descontinuação (mesma página). Sandbox: `https://sandbox.ebanxpay.com/ws/direct`.
- Elegibilidade: os termos de processamento dizem que os bens/serviços devem ser fornecidos de fora do território onde o dinheiro é coletado; ativar novo meio de pagamento exige aprovação da EBANX (https://www.ebanx.com/en/legal/merchants/terms-and-conditions-for-payment-processing-services, página de 2021, pode estar desatualizada). Aprovação comercial e contrato; não há OAuth/chave-colada self-service para terceiro `[?]`.
- A Stripe usa a EBANX como parceira de Pix (https://docs.stripe.com/payments/pix).
- **Veredito: não.** Público é comerciante internacional vendendo para o Brasil. Esforço não aplicável.

---

## 6. SumUp (Brasil)

- Conexão: tem OAuth 2.0 authorization code para integrações multi-merchant (SaaS), `https://api.sumup.com/authorize` e `/token`, app registrado na conta SumUp com redirect URI e escopos; e chave de API (`sup_sk_...`) para um comerciante só (https://developer.sumup.com/tools/authorization/oauth, https://developer.sumup.com/api/authentication).
- Checkout: `POST /v0.1/checkouts` com `checkout_reference`, `amount`, `currency` (BRL suportado), `merchant_code`, e `hosted_checkout: {enabled: true}` devolve `hosted_checkout_url`. Status `PENDING`, `FAILED`, `PAID`, `EXPIRED`. Parcelamento 1 a 12 só para comerciante no Brasil (https://developer.sumup.com/api/checkouts/create).
- **Pix:** `payment_type` do "process checkout" lista `card`, `boleto`, `ideal`, `blik`, `bancontact`, `google_pay`, `apple_pay`. Pix só aparece como `entry_mode` de transação. **Não confirmei Pix online por API** `[?]`. A página comercial da SumUp diz que o Pix é vendido no app (https://www.sumup.com/pt-br/pagamentos-online/).
- Webhook, cancelamento e sandbox: não lidos `[?]`.
- **Veredito: não por enquanto**; reavaliar se a SumUp publicar Pix no checkout. Esforço **M** (OAuth) quando existir. Público: maquininha e vendedor ambulante.

---

## 7. Ton / Stone

- Ton é a marca da Stone para microempreendedor (maquininha, conta, Pix no app). Não encontrei API pública do Ton nem de link de pagamento para terceiros.
- Stone tem "Stone Openbank" (API bancária: conta, saldo, TED, Pix, QR code dinâmico) em `https://docs.openbank.stone.com.br/`. A página inicial fala só de guias, referência e "fale com o time comercial para modelos de parceria"; autenticação OAuth2 com JWT assinado por chave PEM e onboarding via time de parcerias vêm de diretório de terceiro (https://providers.apievangelist.com/providers/stone-co/) `[?]`.
- Link de pagamento da Stone é produto de painel (https://conteudo.stone.com.br/link-de-pagamento-stone/); o texto fala em Conta Stone com chave Pix.
- Pagar.me é da Stone e já está na lista de gateways cobertos.
- **Veredito: não.** O dono Ton usa o Pix do app; sem API de terceiro. Para ele, a rota é a chave Pix/QR estático ou InfinitePay-like sem API.

---

## 8. Nubank PJ

- Buscas não acharam portal de desenvolvedores nem API pública do Nubank para cobrança Pix. O que existe: QR Code de cobrança e QR fixo dentro do app da Conta PJ (https://tecnoblog.net/385939/nubank-libera-cobranca-via-pix-conta-pj/, https://tecnoblog.net/noticias/conta-pj-do-nubank-ativa-qr-code-fixo-para-vendas-feitas-pelo-pix/). Ausência de prova de inexistência `[?]`: não achei, e não há doc oficial para citar.
- **Veredito: não** (sem API). Dono Nubank PJ cai no fluxo "chave Pix manual" se um dia o produto tiver.

---

## 9. Gateways populares que faltam na lista

Cobertos já: Mercado Pago, Asaas, InfinitePay, PagBank, Pagar.me, Woovi, PicPay, Iugu, PagHiper, Cielo, Rede, Getnet, Inter, Efí, Sicoob, BB, Sicredi, Cora, C6 (e agora Stripe, Vindi, Appmax, Zoop, EBANX, SumUp, Ton/Stone, Nubank).

Sem lacuna crítica para pequeno negócio de serviço. Candidatos que apareceram, em ordem de interesse:
1. **AbacatePay**: gateway Pix para desenvolvedor, SDKs, billing com URL de pagamento, CLI com `trigger billing.paid` (https://docs.abacatepay.com/pages/cli/webhooks.md). Webhook e autenticação não lidos `[?]`. Popular entre dev e infoproduto, não entre comércio local.
2. **Transfeera**: API Pix com sandbox (https://transfeera.com/solucoes/api-de-pagamentos/), foco em pagamentos B2B/payout `[?]`.
3. **Yapay/Vindi Yapay, PagBrasil (cross-border), Celcoin, Kobana, Magalu Pay, Pagou, Kiwify/Hotmart/Eduzz (infoproduto)**: nomes que aparecem em comparativos, nenhum validado aqui.
4. **Pix direto por banco (API Pix do BCB: Itaú, Bradesco, Santander, BTG)**: padrão único, mas cada banco exige certificado mTLS e cadastro de aplicação; esforço G, só para empresa médio porte.
Comparativos de mercado citam como mais usados por PMEs: Mercado Pago, PagBank, Stripe (digital), Cielo, Pagar.me, Asaas (https://mindconsulting.com.br/2026/07/gateways-pagamento-online-brasil-comparativo-2026/, fonte não oficial). Nada de "popular e ausente" além do que já está coberto.

---

## 10. Riscos mais importantes (lote inteiro)

1. **Webhook sem assinatura ou cadastro manual** (Vindi, Appmax): só dá para confiar relendo na API, o que a nossa regra já faz; mas Vindi exige que o dono cole a URL no painel.
2. **Stripe: Pix depende da conta do dono** (elegibilidade, MCC proibido para saúde, habilitação nas configurações), não do nosso código; checar a capability e mostrar erro claro.
3. **Modelos que não são "a conta do dono"** (Zoop marketplace, EBANX cross-border, Appmax loja): quebram a regra de dinheiro direto e sem split ou exigem estrutura (CNPJ, homologação) que não compensa.
4. Segredo de plataforma da Stripe (chave secreta + `whsec_`) é crítico: vale para todos os donos conectados.

## 11. Esforço relativo ao Asaas (resumo)

Asaas = chave colada + webhook por dono + cobrança numa chamada (P).
- Stripe: M a G (OAuth, dois objetos, estorno via Charge, checagem de capability).
- Vindi: M (chave colada, mas 3 chamadas e webhook manual).
- Appmax: G.
- Zoop: G (fora do modelo).
- SumUp: M, bloqueado pela falta de Pix na API `[?]`.
- EBANX, Ton/Stone, Nubank: descartados.

## 12. Fontes principais
- Stripe: https://docs.stripe.com/payments/pix, https://docs.stripe.com/payments/pix/accept-a-payment, https://docs.stripe.com/payments/boleto, https://docs.stripe.com/connect/oauth-standard-accounts, https://docs.stripe.com/connect/oauth-reference, https://docs.stripe.com/connect/authentication, https://docs.stripe.com/connect/webhooks, https://docs.stripe.com/webhooks, https://docs.stripe.com/api/payment_intents/cancel, https://docs.stripe.com/api/checkout/sessions/create, https://docs.stripe.com/api/checkout/sessions/expire, https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil
- Vindi: https://developers.vindi.com.br/llms.txt e páginas citadas.
- Appmax: https://docs.appmax.com.br/ (guides/autenticacao, ambientes, webhooks, criar-aplicativo, conceitos, api-reference/payments/pix).
- Zoop: https://docs.zoop.co/ (criando-transacao-pix, implementando-split-de-pagamentos).
- EBANX: https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/brazil/pix.
- SumUp: https://developer.sumup.com/api/checkouts/create, https://developer.sumup.com/tools/authorization/oauth.
- Stone Openbank: https://docs.openbank.stone.com.br/.
