# Pesquisa C: Cielo, Rede e Getnet como gateway de "cobrança pelo chat"

Data: 2026-10-23. `[?]` = não confirmado na doc oficial. Nenhum arquivo do repositório foi alterado.

## Resumo executivo

| | Cielo | Rede | Getnet |
|---|---|---|---|
| Dono gera credencial sozinho? | Sim (E-commerce 3.0: MerchantId/Key no Site Cielo; Link: client_id/secret). Mas só depois de contratar a API E-commerce (até 5 dias úteis, Cielo pode recusar) | Sim para e.Rede (PV + chave de integração no portal). Link de Pagamento por API: produção pedida por e-mail ao time da Rede | Não achei caminho self-service na doc oficial. Credenciais "enviadas pela Getnet" no contrato da Plataforma Digital [?] |
| Pix por API | Sim (Provider Cielo2), sem sandbox | Sim, **só para correntista Itaú** | Sim, mas QR expira em no máx. 30 min |
| Link por API | Sim, com `Pix` como meio | Sim (cartão + Pix), sem webhook | Sim (GetPay), com Pix |
| Webhook | Por conta, cadastrado no Site Cielo, sem assinatura (só headers fixos custom) | Pix: por CNPJ, **só por telefone**; Link: não existe | Por conta, cadastrado no credenciamento, mudança só pelo suporte, GET com query string |
| Esforço vs Asaas | M | G | G |
| Veredito | Viável, o melhor dos três | Só para nicho (Itaú) | Não recomendado agora |

Resposta à pergunta central: **Cielo sim (com ressalvas), Rede só em parte, Getnet não de forma comprovada.** Nenhum dos três tem OAuth de parceiro/plataforma para o dono "conectar a conta" como Mercado Pago/PagBank. Todos funcionam como chave colada (modelo Asaas), exceto Pix API da Cielo (o produto separado `pix-can-cbk`) que exige mTLS e parceria formal.

---

## 1. CIELO

### 1.1 Credenciais, contrato, prazo, parceria

- API E-commerce 3.0 exige contratar o produto. Loja habilitada "até 5 dias úteis", Cielo pode aprovar ou recusar. Sem mensalidade. Recebe o número EC por e-mail. Sem homologação formal: o sandbox é opcional. Fonte: https://docs.cielo.com.br/ecommerce-cielo/docs/onbording-api-ecommerce.md
- MerchantId/MerchantKey: Site Cielo > E-commerce > Gestão API E-commerce > Credenciais > "Gerar nova Merchant Key". Só perfil **Administrador ou Analista**; exige autenticação no app **Cielo Gestão**. Na primeira vez é obrigatório gerar uma nova chave. Pode definir quando a antiga expira (imediato, 1h, 24h, 3 dias). Fonte: https://docs.cielo.com.br/ecommerce-cielo/docs/revogar-e-criar-credenciais-no-site-cielo.md
- Autenticação E-commerce 3.0: headers `MerchantId` + `MerchantKey` em toda chamada. Sem OAuth, sem expiração de token. Fonte: https://docs.cielo.com.br/ecommerce-cielo/reference/gerenciamento-de-credenciais.md
- Link de Pagamento API: precisa de EC habilitado para Link de Pagamento ou Checkout; ClientId/ClientSecret em Site Cielo > E-commerce > Link de Pagamento > Configurações > Credenciais de API > "Gerar novas credenciais" (Administrador/Analista + token do app Cielo Gestão). **Para alguns cadastros o botão não aparece** ("motivos de regras de negócio"), e o dono precisa falar com o suporte. Gerar nova credencial invalida a antiga na hora. Fontes: https://docs.cielo.com.br/link/reference/gerar-credenciais.md e https://docs.cielo.com.br/link/docs/como-começar-api-link-de-pagamento.md
- Pix: precisa habilitar Pix no Site Cielo (Configurações do perfil > Autorizações > Pix > Iniciar habilitação > Pix Cielo > aceitar Termo de Adesão). Alternativa: Pix via Banco do Brasil ou Bradesco, negociado direto com o banco (e a nova integração Cielo2 **não é compatível** com BB e Bradesco). Prazo não informado. Só uma modalidade Pix ativa por vez, vale para todos os ECs do CNPJ. Fonte: https://docs.cielo.com.br/ecommerce-cielo/docs/como-habilitar-pix.md e https://docs.cielo.com.br/ecommerce-cielo/docs/pix-cielo.md
- Modelo de parceiro/OAuth: **não existe** para o E-commerce 3.0 (credencial é do lojista). Existe o produto à parte "API Pix" (`docs.cielo.com.br/pix-can-cbk`) que é por parceria: sandbox pedido por e-mail a apipix.suporte@cielo.com.br, homologação assistida, OAuth2 (client id/secret), chave Pix aleatória, **mTLS obrigatório em produção**; credencial de produção criada pelo lojista em "Minha Conta" selecionando o parceiro (Meu Cadastro > Autorizações > Pix > Novo acesso > Criar credencial; segredo some em 3 minutos). Fonte: https://docs.cielo.com.br/pix-can-cbk/docs/primeiros-passos.md e https://docs.cielo.com.br/pix-can-cbk/reference/credenciais-e-autenticacao.md. Seria o único caminho "estilo OAuth de plataforma", mas exige virar parceiro e tem mTLS: descartar para nosso caso.
- Afiliação a "facilitador/subcredenciador" existe em docs (https://docs.cielo.com.br/ecommerce-cielo/docs/facilitadores.md) mas é outro negócio, não lido a fundo [?].

### 1.2 Criar cobrança Pix (nova integração, Provider Cielo2)

- `POST https://api.cieloecommerce.cielo.com.br/1/sales` (somente produção; a nova integração **não tem sandbox**). Fonte: https://docs.cielo.com.br/ecommerce-cielo/v3.0-en/reference/create-pix-cielo2 (páginas pt: `.../reference/cielo2-gerar-qr-code-pix.md`).
- Headers: `MerchantId` (GUID), `MerchantKey` (40), `RequestId` opcional.
- Body: `MerchantOrderId` (25, sem caracteres especiais), `Customer.Name`, `Customer.Identity` (CPF/CNPJ), `Customer.IdentityType`, `Payment.Type="Pix"`, `Payment.Provider="Cielo2"`, `Payment.Amount` em **centavos**, `Payment.QrCode.Expiration` em **segundos** (padrão e máximo 86400 = 24h). A doc só marca `Payment.Type` como obrigatório explicitamente [?] para os demais.
- Resposta: `Payment.QrCodeString` = **copia e cola**; `Payment.QrCodeBase64Image`; `Payment.SentOrderId` = txid; `Payment.PaymentId` = id para consulta; `Payment.Status` 12 (Pending).
- Observação: quirk de nome. Na nova integração o `txid` volta como `SentOrderId` na criação e como `AcquirerOrderId` na consulta; `EndToEndId` aparece quando pago.

### 1.3 Link de pagamento por API (Super Link / Link de Pagamento)

- Token: `POST https://cieloecommerce.cielo.com.br/api/public/v2/token`, `Authorization: Basic base64(ClientId:ClientSecret)`, `Content-Type: application/x-www-form-urlencoded`. Resposta `access_token`, `token_type: bearer`, `expires_in` (~1199 s, "20 minutos"). Fonte: https://docs.cielo.com.br/link/reference/gerar-token-de-acesso.md
- Criar: `POST https://cieloecommerce.cielo.com.br/api/public/v1/products/` com `Authorization: Bearer`. Obrigatórios: `type` (`Asset|Digital|Service|Recurrent`), `name` (128), `price` (inteiro em **centavos**, limite informado 1000000). Opcionais: `OrderNumber` (até 20, alfanumérico, não repetir em 24h), `description`, `expirationDate`, `maxNumberOfInstallments`, `quantity` (transações restantes), `shipping.type`, `customLinkConfiguration.paymentTypes[]` com `Pix`, `CreditCard`, `Boleto`, etc. Resposta 201 com `id` (UUID) e `shortUrl`. Fonte: https://docs.cielo.com.br/link/reference/criar-link.md
- Nota: o Link é um **produto/link reutilizável** (tem `quantity`), não uma cobrança única; e a doc admite inconsistências (price string vs número, formato de `expirationDate`).
- Atualizar/consultar/excluir: `PUT`/`GET`/`DELETE` em `.../products/{id}` (via `links` da resposta; paths em https://docs.cielo.com.br/llms.txt, não abri um a um [?]).

### 1.4 Consultar pagamento por id

- Pix (Cielo2): `GET https://apiquery.cieloecommerce.cielo.com.br/1/sales/{PaymentId}` (headers MerchantId/Key). Retorna `Payment.Status` numérico, `EndToEndId`, `AcquirerOrderId`. Fonte: https://docs.cielo.com.br/ecommerce-cielo/reference/consulta-cielo2.md
- Tabela de status Pix: 0 NotFinished, 1 Authorized, **2 PaymentConfirmed (pago)**, **11 Refunded**, **12 Pending**, 13 Aborted. Fonte: https://docs.cielo.com.br/ecommerce-cielo/reference/lista-de-status-da-transação-pix.md
- Mapeamento sugerido: 12 -> pendente; 2 -> paga; 11 -> estornada; 13/0 -> cancelada (e o "Voided" depois de remover o QR; ver 1.5). Atenção: status 2 também aparece quando houve devolução **parcial** (a doc diz "paid, refund requested, or partial refund"), então ler `Amount`/devoluções para não marcar errado.
- Link: `GET https://cieloecommerce.cielo.com.br/api/public/v1/products/{id}/payments` retorna `orders[].payment.status` (string; doc só mostra `Denied`, lista completa [?]). Os valores numéricos 1 Pending, 2 Paid, 3 Denied, 4 Expired, 5 Voided, 6 NotFinalized, 7 Authorized, 10 AuthorizedIdPayPending vêm do payload de notificação do link: https://docs.cielo.com.br/link/reference/conteúdo-das-notificações.md. A página de consulta por link não fecha o enum [?].

### 1.5 Cancelar / expirar não pago

- Pix: `PUT https://api.cieloecommerce.cielo.com.br/1/sales/{PaymentId}/void` (remove QR não pago; se já foi pago, usar devolução). Resposta de exemplo `Status 2` com `ReasonMessage "Scheduled"` e `ReturnMessage "QRCode Pix removido com sucesso"` (a doc não define o status final de forma clara [?]). Importante: a doc diz que, **sem pagar, a transação fica "12 Pending" mesmo depois do QR expirar**, então a expiração não vira status sozinha; nós precisaríamos usar o relógio (já é a nossa regra: vencer é decisão nossa). Fonte: https://docs.cielo.com.br/ecommerce-cielo/reference/cielo2-remover-um-qr-code-pix.md
- Link: `DELETE .../products/{id}` [?].

### 1.6 Webhook

- E-commerce 3.0 "Post de Notificação": URL **por loja (EC)**, cadastrada no **Site Cielo** (E-commerce > Gestão API E-commerce > Configurações > URL de notificações), sem precisar de suporte; ao salvar a Cielo testa a URL e pede autenticação no app Cielo Gestão. Só HTTPS porta 443, até 255 caracteres. Eventos selecionáveis. Fonte: https://docs.cielo.com.br/ecommerce-cielo/docs/url-de-notificacoes.md e https://docs.cielo.com.br/ecommerce-cielo/docs/webhook.md
- Corpo: `{"PaymentId":"...","ChangeType":1}` (só id + tipo; 1 = status mudou -> consultar). Isto casa perfeitamente com a nossa regra "só o id sai do webhook".
- Autenticação: sem assinatura. Até **3 headers customizados** (chave 256, valor 1500) enviados em cada POST: usar um token secreto por organização no header.
- Reentrega: despacho a cada 30 min, 3 tentativas extras; precisa responder 200.
- **Problema:** a URL é por EC e fica na conta do dono, cadastrada manualmente por ele (com 2FA no app). Não dá para o nosso sistema cadastrar por API [?]. Será um passo manual guiado (como a InfinitePay não tem, mas aqui o dono precisa ir ao portal).
- Não achei confirmação explícita de que Pix Cielo2 dispara `ChangeType 1` pelo mesmo Post de Notificação [?]. A doc "Pix Cielo" diz não ter seção de notificação. Risco real: pode exigir polling.
- Link de Pagamento: notificação **separada**, configurada em "Configurações da Loja" do Link; formato `x-www-form-urlencoded` (conflito com "JSON" na doc), sem autenticação, entrega até 3 min, 3 retentativas de 1 em 1 h; payload com `payment_status` 1..10, `order_number`, `product_id`, `payment_end_to_end_id`. Fonte: https://docs.cielo.com.br/link/reference/notificações-da-transação.md

### 1.7 Recorrência

- Recorrência programada Cielo: **só cartão de crédito**; própria: crédito e débito; precisa ser ativada com o suporte E-commerce. Pix recorrente / Pix Automático **não aparece** na API E-commerce 3.0. Fonte: https://docs.cielo.com.br/ecommerce-cielo/docs/recorrencia.md
- Pix Automático existe só no produto API Pix (mTLS, parceria): https://docs.cielo.com.br/pix-can-cbk/docs/pix-automatico.md (não detalhado aqui).
- Link Recorrente: `type: Recurrent` + `recurrent.interval` (Monthly, Bimonthly, Quarterly, SemiAnnual, Annual) no criar link. É cartão.

### 1.8 Sandbox

- E-commerce 3.0 tem sandbox (`apisandbox.cieloecommerce.cielo.com.br` e `apiquerysandbox...`), credenciais por cadastro gratuito, sem afiliação. **Pix Cielo2 não tem sandbox**; o Pix antigo no sandbox fica sempre "pendente", sem testar pagamento. Fonte: https://docs.cielo.com.br/ecommerce-cielo/reference/como-usar-o-sandbox.md
- Link/Checkout: **sem sandbox**; "Modo Teste" na produção (não cobra de verdade), Pix nele [?]. Fonte: https://docs.cielo.com.br/link/docs/modo-teste.md
- Consequência: não dá para testar o ciclo Pix pago de ponta a ponta sem dinheiro real (centavos).

### 1.9 Exigências técnicas

- E-commerce 3.0: sem OAuth, sem IP allow-list e sem mTLS documentados. Link: OAuth2 com Basic, token de ~20 min.
- Para a nova integração Pix, limite do QR de 24 h é bom para chat.

### 1.10 Popularidade e disponibilidade

- Cielo é a maior base de maquininhas; mas "ter maquininha" não significa ter **E-commerce contratado**. São produtos/EC distintos (a doc diz que cada solução tem um EC próprio). Dono que só tem maquininha precisa contratar o E-commerce e esperar até 5 dias úteis. Pix Cielo é opt-in com termo. Taxa/mensalidade do Pix: não levantado [?].

### 1.11 Riscos

1. Dependência de contrato E-commerce + aprovação da Cielo (pode recusar) + botão de credencial de Link some "para alguns cadastros".
2. Webhook por EC cadastrado só pelo dono no portal com 2FA; sem assinatura; Pix Cielo2 sem confirmação de notificação [?]. Provável necessidade de polling.
3. Sem sandbox para Pix Cielo2: testes só em produção.
4. Chave `MerchantKey` rotacionada pelo dono derruba a integração em silêncio (janela de expiração configurável).
5. Status 2 ambíguo (pago x devolução parcial); QR expirado continua "Pending".
6. Pix BB/Bradesco incompatível com Cielo2; a modalidade ativa vale para o CNPJ inteiro.

### 1.12 Veredito Cielo

Serve, usando **apenas E-commerce 3.0 (Pix Cielo2) para o QR e Link API opcional**, no modelo "chave colada" (MerchantId + MerchantKey, e opcionalmente ClientId/Secret). Esforço **M** (maior que Asaas por: duas credenciais, webhook manual, sem sandbox Pix, polling de reserva). Recomendação: fazer só o Pix Cielo2 + polling + webhook opcional; não fazer Link na primeira versão.

---

## 2. REDE (e.Rede, Itaú)

Observação de fonte: o portal developer.userede.com.br é uma SPA Angular que não renderiza para ferramentas simples. Li os markdowns oficiais que o próprio portal carrega (`https://developer.userede.com.br/files/documentacoes/e-rede/erede-documentacao.md`, `.../autenticacao/autenticacao.md`, `.../payment-link/*.md`). As URLs de "página" são `https://developer.userede.com.br/e-rede`.

### 2.1 Credenciais, contrato, parceria

- e.Rede: credenciais = **PV** (vira `clientId`) + **Chave de Integração** (vira `clientSecret`), geradas no portal userede.com.br (menu e-commerce > chave de integração > "Gerar chave de integração"), exige usuário **administrador (master)**. Gerar nova invalida a anterior. Self-service, sem homologação documentada. Mas o estabelecimento precisa ter **e-commerce habilitado** na Rede [?: a doc só diz "Para vender > e-commerce"]. Fonte: `erede-primeiro-passos.md` e `erede-documentacao.md` (linha ~66).
- Autenticação **OAuth 2.0 client_credentials**: `POST https://api.userede.com.br/redelabs/oauth2/token` (sandbox `https://rl7-sandbox-api.useredecloud.com.br/oauth2/token`), `Authorization: Basic base64(clientId:clientSecret)`, `grant_type=client_credentials`. Token dura **24 min** (`expires_in` 1440). Obrigatório (quem não migrou pode ter transações bloqueadas). Fonte: `autenticacao.md`
- Link de Pagamento API: público-alvo "clientes da Rede credenciados que aceitaram os termos do Link de Pagamento no portal". Credencial de produção: **e-mail para ecommerce@userede.com.br** com dados do parceiro, CNPJ, cliente etc.; "para cada credencial um e-mail diferente". Ou seja, **tem fricção de parceria**. Fonte: `payment-link/sobre.md`, `payment-link/tutorial-sandbox.md`
- Parceiro/OAuth de plataforma onde o dono autoriza: **não existe** na doc.

### 2.2 Pix

- **"Método de pagamento disponível apenas para correntistas Itaú."** Esta é a maior restrição: o dono precisa ter conta no Itaú, cadastrar a chave Itaú na Rede (portal > Para vender > PIX > "quero utilizar o Pix" > aceitar termos > agência e conta) e a liquidação cai nessa conta. Fonte: `erede-documentacao.md` seção Pix (~linha 2251)
- Criar: `POST /v2/transactions` (a seção Pix cita esse path; URLs de ambiente: produção `https://api.userede.com.br/erede/v2/transactions`, sandbox `https://sandbox-erede.useredecloud.com.br/v2/transactions`; o Postman da Rede ainda usa `/v1/transactions` nos exemplos de cartão [?]).
- Body: `kind: "Pix"`, `reference` (até 50, obrigatório, nosso id), `orderId` (opcional), `amount` (**centavos**, R$10,00 = 1000), `qrCode.dateTimeExpiration` (`YYYY-MM-DDThh:mm:ss`, **máx. 15 dias**).
- Resposta: `tid`, `reference`, `qrCodeResponse.qrCodeData` = **copia e cola (EMV)**, `qrCodeResponse.qrCodeImage` (base64), `qrCodeResponse.dateTimeExpiration`, `returnCode`/`returnMessage`.
- Consultar: `GET /v2/transactions/{tid}` ou `GET /v2/transactions?reference={referencia}`. Status: **Pending / Approved (pago) / Canceled (devolvido)**. `qrCodeData` só volta enquanto pendente. QR expirado devolve erro **3036 "QR Code Expired"**. Devolução parcial mantém Approved. Consultas por reference só até 90 dias para Pix.
- Cancelar não pago: **não há endpoint de cancelar QR não pago** na doc; só devolução (`POST /v2/transactions/{tid}/refunds`, até 90 dias, total ou parcial, síncrona). QR expira sozinho [?] (nenhum "void").
- Mapeamento: Pending -> pendente; Approved -> paga; Canceled -> estornada; 3036 -> vencida (cancelada pelo nosso relógio).

### 2.3 Link de pagamento por API

- Base: `https://payments-api.useredecloud.com.br/payment-link` (simulador `https://payments-apisandbox.useredecloud.com.br/payment-link`). Headers: `Authorization: Bearer`, `Company-number: <PV>`, `Content-Type: application/json`.
- Criar: `POST /v1/create` com `amount` (**reais, decimal ou inteiro**, ex. 100.00), `expirationDate` (`MM/DD/YYYY`, até +15 dias), `installments` (1..12), `paymentOptions` (`credit`, `pix`; em produção depende das habilitações), `description` (até 50), `createdBy`, `comments`. Resposta: `paymentLinkId`, `url`. Fonte: `payment-link/tutorial-sandbox.md`
- Consultar: `GET /v1/details/{paymentLinkId}` com `Order.status` em **CREATED, CANCELED, REJECTED, REVERSED, PAID** (os cenários do simulador). `Reversible` e `Refunds` no retorno.
- Cancelar: `PATCH /v1/cancel/{paymentLinkId}`.
- **Mudança em curso**: o identificador migra para UUID (fases 12/08 e 02/09 de 2026) e a doc manda usar o `paymentLinkId` retornado. Tratar o id como string opaca.
- Limite do simulador: amount < 20.000.

### 2.4 Webhook

- **Pix:** a URL é **por CNPJ** (uma só URL por CNPJ, vale para todos os PVs) e o cadastro é **ligando para a central** (4001 4433 / 0800 728 4433) informando CNPJ, PV, e-mail e URL; ativação em 2 dias úteis. Eventos `PV.UPDATE_TRANSACTION_PIX` (pago) e `PV.REFUND_PIX`. POST JSON com `id`, `merchantId`, `events[]`, `data.txid`, `data.id` (TID), `data.endToEndId`. Header `authorization` opcional (a doc fala em "piloto" e pedir por e-mail). A Rede recomenda esperar 10 min antes de consultar. Se a URL não estiver cadastrada, **nenhum evento** é enviado. Fonte: `erede-documentacao.md` (Cadastro de URL / Notificação via webhook).
- **Link:** **não há webhook** ("Ainda não há webhook... polling necessário; previsão futura"); polling de 1 em 1 min a partir de 5 min, prazo 15 dias. Fonte: `payment-link/tutorial-sandbox.md`.
- Para nosso modelo, o cadastro por telefone com URL única por CNPJ é incompatível com onboarding self-service: o dono tem que ligar, e só cabe **uma** URL por CNPJ (se o dono já usa webhook com outro sistema, conflita).

### 2.5 Recorrência

- Recorrência de cartão com Card-on-File/3DS no e.Rede (não detalhado). Pix Automático da Rede: **não encontrei** [?].

### 2.6 Sandbox

- Existe: criar conta no Portal do Desenvolvedor, projeto em "Meus Projetos", credenciais de teste geradas na área logada. `https://sandbox-erede.useredecloud.com.br/v2/transactions`. Cenários de Pix no sandbox: simulação da notificação via webhook mencionada [?] (detalhes não lidos). Link tem simulador com ids fixos (`33j36w0` CREATED, `cqf5kab` PAID, etc).

### 2.7 Exigências técnicas

- OAuth2 client_credentials, token 24 min (renovar entre 15 e 23 min). TLS 1.2. Sem mTLS nem IP fixo documentados para e.Rede.
- Valor mínimo: transações < R$0,99 podem ser bloqueadas (erro N99).

### 2.8 Popularidade / disponibilidade

- Rede (Itaú) tem forte presença entre pequenos negócios, mas o Pix API só serve quem tem conta Itaú. Para o resto, fica o Link só com cartão ou "pix" sujeito a habilitação [?], sem webhook.

### 2.9 Riscos

1. **Pix só para correntista Itaú**: corta a maior parte da base.
2. Webhook Pix por CNPJ via telefone; Link sem webhook (polling obrigatório).
3. Link de pagamento API em produção depende de e-mail para a Rede (parceria).
4. Expiração do QR gera erro 3036 em vez de status; sem cancelar QR pendente.
5. IDs do Link mudando para UUID em 2026.
6. Campos de data dos dois produtos diferentes (ISO no Pix, MM/DD/YYYY no Link) e unidades diferentes (centavos no Pix, reais no Link).

### 2.10 Veredito Rede

**Não serve como gateway geral.** Só como integração de nicho para donos Itaú, ou depois que a Rede lançar webhook de Link e liberar Pix não-Itaú. Esforço **G** (dois produtos, polling, onboarding por telefone/e-mail, OAuth com renovação).

---

## 3. GETNET (Plataforma Digital)

Fonte: o portal developers.getnet.com.br é Next.js e não é legível em HTML puro. Li o OpenAPI oficial embutido nas páginas `https://developers.getnet.com.br/products-docs/<id>/swagger` (Link de Pagamento | Plataforma Digital, id `b07ilzfwy21roh8ui801cvxz`; API de Idempotência, id `rv4tz0jamap7lsor1myfb6zs`) e o texto "Notificações 1.1" via `https://developers.getnet.com.br/api/documentation/functional/uis74ikqfv8v87u3y5prgp68`. Existe também o portal global `docs.globalgetnet.com` (menu "Payment Link API", conteúdo não aberto [?]).

### 3.1 Credenciais, contrato, parceria

- Autenticação: OAuth2 client_credentials. `POST /auth/oauth/v2/token`, `Authorization: Basic base64(client_id:client_secret)`, `Content-Type: application/x-www-form-urlencoded`, corpo `scope=oob&grant_type=client_credentials`. `expires_in` de exemplo 3600 s. Servidor documentado: `https://api-homologacao.getnet.com.br/`. **Base de produção não aparece no OpenAPI** [?] (comumente `api.getnet.com.br`, mas não confirmado na doc oficial).
- Headers extras: `seller_id` (UUID, "Código de identificação do e-commerce"), opcional na doc, mas requerido na prática para multi-seller [?].
- Como o dono obtém `seller_id`/`client_id`/`client_secret`: a doc oficial **não explica**. Integradores terceiros dizem que a Getnet **envia** as credenciais ao contratar a Plataforma Digital, e que há "Chaves de Autenticação Plataforma Digital" no painel Getnet [?]. Contratar o serviço exige contato com a Getnet ("produtos_digitais@getnet.com.br" aparece no OpenAPI para contratar o serviço de criptografia). Ou seja: **sem caminho self-service comprovado**; provavelmente exige contrato de e-commerce com o comercial.
- Parceiro/OAuth de plataforma: a doc tem "Parceria Comercial" institucional (site.getnet.com.br/parcerias), sem OAuth para o lojista.

### 3.2 Criar Pix

- `POST /v1/payments/qrcode/pix` (v1) e `POST /v2/payments/qrcode/pix` (API de Idempotência). Headers: `Authorization: Bearer`, `Content-type: application/json; charset=utf-8`, `seller_id`, e **`x-qrcode-expiration-time`** (segundos; **default 180 s, máximo 1800 s**).
- Body: obrigatórios `amount` (inteiro em **centavos**) e `currency` ("BRL"); opcionais `order_id`, `customer_id` (repassados na notificação).
- Resposta: `payment_id`, `status` (PENDING, WAITING, EXPIRED, ERROR, APPROVED, DENIED), `additional_data.qr_code` = **copia e cola**, `additional_data.transaction_id`, `creation_date_qrcode`, `expiration_date_qrcode`, `psp_code`.
- **Pegadinha grande:** o QR expira em **no máximo 30 minutos** e por padrão 3 min. Para cobrança por chat (cliente paga horas depois) é ruim; teríamos que regerar o QR a cada abertura/lembrete, e o `payment_id` muda.
- Sandbox: valores mágicos (amount 9000 aprova em 10 s; 9088 nega).

### 3.3 Link de pagamento (GetPay)

- `POST /v1/payment-links` (headers Authorization, seller_id). Body obrigatório: `label` (6..36), `order{product_type, title, description, amount (centavos)}`, `payment{credit{enable,...}, debit{enable,...}, pix{enable}}`; opcionais `expiration` (ISO), `max_orders`. Resposta 201: `link_id` (uuid), `url`, `status` (ACTIVE, SUSPENDED, EXPIRED). Nota: `payment.credit` e `payment.debit` são **obrigatórios** mesmo que só queiramos Pix [?: dá para mandar `enable:false`].
- Consulta: `GET /v1/payment-links/{link_id}`; ordens: `GET /v1/payment-links/{link_id}/payment-orders` e `.../payment-orders/{payment_order_id}` (status da ordem: SUCCESSFUL, CREATED, FAILED). `GET /v1/payment-links/enabled-products` mostra quais meios o seller tem habilitados.
- Suspender/alterar: `PATCH /v1/payment-links/{link_id}` (corpo exato de suspensão não lido [?]).
- Um link tem várias ordens: é link reutilizável, como o da Cielo.

### 3.4 Consulta de pagamento

- `GET /v1/payments/info/{payment_id}` (v1) retorna `status` entre APPROVED, AUTHORIZED, DENIED, CANCELED, CAPTURED, ERROR. A doc de Pix na consulta cita que a API de consulta cobre PIX [?] (confirmado indiretamente pelo texto do GetPay "bloco transaction varia: ... PIX"). Para Pix gerado por QR, o status "WAITING/EXPIRED/APPROVED/DENIED" vem no objeto do QR; **não localizei endpoint dedicado de consulta de QR Pix** [?].
- Mapeamento: WAITING/PENDING -> pendente; APPROVED -> paga; EXPIRED/DENIED/ERROR -> cancelada (pelo relógio); estorno de Pix via `POST /v1/payments/cancel/request` (D+n) [?].

### 3.5 Cancelar não pago

- Pix: não há cancelamento, o QR expira (3 min a 30 min). Cancelamento (`/v1/payments/cancel/request`) é para transações com mais de 1 dia (D+n).

### 3.6 Webhook ("Notificações 1.1")

- A Getnet chama uma **URL HTTPS via método GET** com os dados na **query string** (`payment_type=pix&order_id=...&payment_id=...&amount=...&status=APPROVED&transaction_id=...`). Sem corpo, **sem autenticação, sem assinatura documentada**.
- As URLs são cadastradas **no credenciamento** (5 URLs: crédito, débito, boleto, boleto pago?, pix...). Para alterar, **contatar o atendimento da Getnet**. Fonte: `.../documentation/functional/uis74ikqfv8v87u3y5prgp68`.
- Ou seja, o dono não cadastra sozinho a URL: depende de suporte. Combina mal com onboarding self-service.
- Conseguimos seguir "só o id sai do webhook": `payment_id` na query, e relemos pela API.

### 3.7 Recorrência

- Recorrência Getnet (planos, assinaturas, clientes): endpoints `/v1/plans`, `/v1/subscriptions`, `/v1/customers`; é cartão (cofre); exige contratar o pacote Recorrência. Pix Automático: não encontrado [?].

### 3.8 Sandbox

- Sim: `https://api-homologacao.getnet.com.br`. Credenciais de sandbox: "aba Configurações > Identificação da API" no painel, segundo integradores [?]. Pix com valores mágicos (9000 / 9088).

### 3.9 Exigências técnicas

- OAuth2 client_credentials com Basic; token `expires_in` 3600 no exemplo (renovar); sem mTLS nem IP fixo documentados na API de pagamentos. Cartão exige tokenização/criptografia (irrelevante para Pix).

### 3.10 Popularidade / disponibilidade

- Getnet (Santander) tem base grande de maquininhas, mas a Plataforma Digital (e-commerce) é produto separado, com credenciais enviadas pela Getnet e contrato; o Pix via API é "habilitado pelo produto" [?]. Boleto Pix é do Santander.

### 3.11 Riscos

1. Sem caminho self-service comprovado para credenciais; depende de contrato e do time Getnet.
2. QR Pix expira em no máximo 30 min (padrão 3 min): ruim para cobrança por conversa.
3. Webhook GET sem autenticação, cadastrado no credenciamento e alterável só pelo suporte.
4. Sem endpoint claro de consulta/cancelamento de QR Pix.
5. Base de produção não documentada no OpenAPI; docs divididas em dois portais (developers.getnet.com.br e docs.globalgetnet.com), com versões v1/v2 e "Payment Link Deprecated".

### 3.12 Veredito Getnet

**Não recomendado.** Esforço **G** (onboarding por contrato, QR de 30 min, webhook sem autenticação cadastrado pelo suporte, polling obrigatório). Só revisitar se houver cliente pagante real na Getnet.

---

## 4. Comparação com o que já temos (Asaas = baseline P)

| Critério | Asaas | Cielo | Rede | Getnet |
|---|---|---|---|---|
| Credencial | 1 chave colada, self-service | 2 credenciais por produto, 2FA, depende de contrato | PV + chave, mas Pix só Itaú | Enviada pela Getnet |
| Webhook cadastrável por API | Sim | Não (portal, 2FA) | Não (telefone) | Não (suporte) |
| Sandbox Pix completo | Sim | Não | Parcial | Parcial |
| Expiração do Pix | Controlável | 24 h | 15 dias | 30 min |
| Cancelar QR | Sim | Sim (`/void`) | Não | Não |
| Recorrência Pix | Pix Automático | Não (API E-commerce) | [?] | [?] |
| Esforço | P | **M** | **G** | **G** |

## 5. Recomendação final

1. Se quiser cobrir "dono tem maquininha", a ordem de valor é: **Cielo** (única que conseguimos fazer funcionar de forma plausível), depois nada. Rede e Getnet ficam de fora até haver cliente concreto.
2. Para Cielo: implementar `criarCobranca` com `POST /1/sales` Pix Cielo2 (centavos, `Payment.QrCode.Expiration` em segundos, `QrCodeString` como copia e cola, `PaymentId` como `pagamentoId`), `lerPagamento` com `GET apiquery.../1/sales/{PaymentId}` mapeando 12/2/11/13, `cancelarPagamento` com `PUT .../void`, webhook opcional (header secreto) e **polling como caminho principal** até validar que o Pix Cielo2 notifica. Link fica fora do MVP.
3. Pedir ao Gabriel um dono real com Cielo E-commerce + Pix Cielo habilitado para testar com R$ 0,01 já que não há sandbox.
4. Perguntas em aberto antes de codar (`[?]`): (a) Pix Cielo2 dispara Post de Notificação? (b) status final após `void`; (c) lista completa de `Payment.Status` do Link; (d) custo/mensalidade do Pix Cielo; (e) base de produção Getnet.
