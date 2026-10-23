# Plano: mais gateways na cobrança pelo chat (23/out/2026)

> **Estado (23/out/2026):** ondas 1 e 2 e as bases 1, 2 e 4 feitas no código
> (Woovi, PagHiper, Stripe, Efí, Iugu, Pagar.me; migration `0151`, aplicada;
> tela em catálogo). Testadas só contra respostas simuladas: faltam as contas de teste
> (ver "O que depende do Gabriel"). Onda 3 e Base 3 esperam a decisão sobre
> Vercel Pro ou `pg_cron`.

Para quem vai implementar. Cada cliente recebe num lugar diferente, e a
cobrança pelo chat só serve se ligar na conta que ele já usa. Este plano diz
**quais** gateways entram, **em que ordem**, **o que precisa existir antes** e
**o que depende do Gabriel**.

Base: pesquisa na documentação oficial de 25 gateways, em cinco relatórios
nesta pasta (`pesquisa-*.md`, com a fonte de cada afirmação e `[?]` no que não
se confirmou). As afirmações que decidem a ordem foram conferidas de novo na
fonte (lista no fim).

Já no ar: Mercado Pago (OAuth), Asaas (chave), InfinitePay (tag), PagBank
(OAuth). Molde de implementação e regras do projeto:
`docs/HANDOFF-23-OUT-GATEWAYS.md`.

## A regra que filtra tudo

Entra quem cumpre as três:

1. **O dono liga a conta dele sozinho**, sem gerente, contrato novo ou técnico.
2. **A cobrança nasce na conta dele** e o dinheiro cai direto para ele. Nada
   de subconta, split ou repasse por terceiro.
3. **Dá para saber que pagou sem o dono fazer nada**: aviso cadastrável por API
   ou por cobrança, ou, na falta, releitura periódica (ver "Base 3").

## Veredito

| Gateway | Conecta como | Pix na conversa | Cartão/boleto | Aviso de pago | Sandbox | Esforço | Onda |
|---|---|---|---|---|---|---|---|
| **Woovi** | AppID colado; OAuth (WooviApp) depois | sim (`brCode`) | não (cartão pelo suporte) | por API, assinado RSA-SHA256 | sim | P | 1 |
| **PagHiper** | `apiKey` + `token` colados | sim | boleto | por cobrança (`notification_url`) | não achado | P | 1 |
| **Stripe** | OAuth Connect Standard | sim [?] servidor | cartão, boleto | um webhook da plataforma, assinado | sim | M | 1 |
| **Efí** | client_id/secret + certificado .p12 | sim (API Pix BACEN) | Bolix | por chave Pix, sem mTLS (skip) + HMAC + IP | sim | M | 2 |
| **Iugu** | token colado (RSA + aprovação do admin) | sim (`qrcode_text`) | cartão, boleto | por API, sem assinatura | sim | M | 2 |
| **Pagar.me** | chave `sk_` colada | sim, exige nome, e-mail, CPF e telefone | cartão, boleto, link | só pelo painel, assinatura [?] | sim | M a G | 2 |
| **Inter** | client_id/secret + certificado | sim (API Pix BACEN) | boleto | mTLS: releitura | sim | M | 3 |
| **Sicoob** | idem, com e-CNPJ do dono | sim (API Pix BACEN) | boleto | mTLS: releitura | [?] | M | 3 |
| **Cielo** | MerchantId/Key (exige E-commerce contratado) | sim (`QrCodeString`) | cartão, link | só pelo portal: releitura | não para Pix | M | 3 |
| **Cora** | Parceria Cora (comercial) ou certificado | sim (`invoices`) | boleto | aviso sem mTLS | sim | M | 3 |
| Sicredi, BB, C6 | certificado via técnico, convênio ou gerente | sim | boleto | mTLS: releitura | parcial | G | se pedirem |
| PicPay | client_id/secret, webhook manual no painel | sim (link) | cartão | chave estática | sim | G | se pedirem |
| Vindi | chave, webhook manual sem assinatura | [?] | cartão | manual | [?] | M | se pedirem |
| Rede | Pix só para correntista Itaú | | | por telefone | | G | não |
| Getnet | credencial só por contrato; QR de 30 min | | | pelo suporte | | G | não |
| Appmax, Zoop, EBANX | loja, subconta ou vendedor estrangeiro | | | | | | não |
| SumUp, Ton/Stone, Nubank PJ, Itaú, Bradesco, Santander | sem API de cobrança para terceiro | | | | | | não |

Quem tem maquininha Stone entra pelo Pagar.me (é da Stone). Quem tem
maquininha Rede ou Getnet não tem caminho hoje.

## Bases, antes das ondas

### Base 1: uma migration para o plano inteiro

Os três `*_gateway_check` (`conexoes_de_pagamento`, `cobrancas`,
`assinaturas`) aceitam um nome por vez, e cada gateway novo pedia uma
migration e uma autorização. **Uma migration só** passa a aceitar todos os
nomes deste plano de uma vez (`woovi`, `paghiper`, `stripe`, `efi`, `iugu`,
`pagarme`, `inter`, `sicoob`, `cielo`, `cora`). Nome aceito sem código não
faz nada: a tela é que oferece o gateway. Número pelo diretório.

### Base 2: credencial com mais de um campo

`AcessoAoGateway` é `{ token, ambiente }`. Woovi, Asaas, InfinitePay e Stripe
cabem nisso. Não cabem:

- PagHiper: `apiKey` + `token`.
- Efí, Inter, Sicoob: `client_id`, `client_secret`, certificado e chave
  privada, e a chave Pix que recebe.
- Cielo: `MerchantId` + `MerchantKey`.

Desenho: o cofre guarda **um JSON** por conexão (o `token_ref` aponta para
ele), e cada `channels/<gateway>.ts` lê e valida o seu formato com zod.
Nenhuma coluna nova. O certificado vai no mesmo JSON, em base64.

**Certificado de banco é a credencial mais sensível que vamos guardar**:
movimenta a conta. Pedir só os escopos de cobrança (nunca `pix.send` ou
pagamento), nunca devolver o certificado à tela, e avisar o dono 30 dias antes
de ele vencer (validade de cerca de 1 ano [?]).

### Base 3: confirmar sem aviso (releitura)

Inter, Sicoob, Sicredi, BB e Cielo **não conseguem avisar a Vercel**: o
padrão do Banco Central exige mTLS na chegada, e a Vercel não recebe
certificado de cliente; a Cielo só cadastra aviso no portal. Para esses, quem
confirma é a releitura.

O agendador de hoje (`src/app/api/manutencao/tarefas/route.ts`) roda de carona
nos avisos do WhatsApp e num cron diário. Isso já cobre o caso comum: quem
pagou costuma mandar "paguei", e essa mensagem dispara a fila. Não cobre quem
paga calado.

Plano:

1. Tarefa `conferir_pagamento` em escada após criar a cobrança (2, 5, 15, 30
   minutos, depois de hora em hora até o vencimento), na fila que já existe.
   Ela chama `aplicarPagamento`, que já é a única porta para `paga`.
2. A página `/pagar/` e o Inbox ganham "Já paguei": relê na hora.
3. **Decisão do Gabriel** para a escada rodar no horário: Vercel Pro (cron a
   cada minuto) ou `pg_cron` + `pg_net` no Supabase chamando a rota.
   `pg_cron` é extensão **global** do projeto dividido com a Verandi: exige a
   avaliação dos dois produtos (`docs/BANCO-COMPARTILHADO.md`). Sem nenhum dos
   dois, a onda 3 funciona só com a carona e o botão.

### Base 4: a tela de Pagamentos

Quatro cartões cabem; quatorze não. A tela vira uma lista agrupada (**Bancos**,
**Maquininhas**, **Carteiras e gateways**), com busca, o conectado no topo e
cada gateway abrindo o seu painel de conexão. Trabalho de desenho no fio
principal, com print em 1440 e 390. Fazer junto com a onda 1, antes de a tela
passar de seis.

## Onda 1: sem dependência nenhuma

### Woovi

- Começar pelo **AppID colado** (molde Asaas): o dono gera em Woovi > API/Plugins.
- Cobrança `POST /api/v1/charge` com `correlationID` = nossa referência e
  `value` em centavos; copia e cola em `charge.brCode`, link em
  `paymentLinkUrl`. Não exige CPF.
- Aviso: `POST /api/v1/webhook` ao conectar, com o segredo da organização no
  endereço; conferir a assinatura `x-webhook-signature` (RSA-SHA256, chave
  pública da Woovi) **e** reler `GET /api/v1/charge/{correlationID}`.
- Vencimento: `expiresIn`; cancelar `DELETE /api/v1/charge/{id}`.
- Depois, OAuth (WooviApp): exige conta Woovi da 4YU com AppID de escopo
  `WOOVI_APP_APPLICATION_POST` e o app cadastrado em store.woovi.com.
- `[?]`: se o GET devolve `paidAt` (senão, a hora do aviso).

### PagHiper

- `apiKey` + `token` colados (Base 2). Pix e boleto; sem cartão.
- `notification_url` em cada cobrança, com o segredo da organização (molde
  InfinitePay); o aviso só traz ids, e a releitura com as credenciais do dono
  é o fluxo da própria PagHiper.
- Contrato montado pelo plugin oficial (`paghiper/woocommerce-paghiper`): o
  endpoint de criar Pix não está no índice da documentação. Primeiro passo é
  confirmar com uma conta real. Vencimento só em dias inteiros.

### Stripe

- OAuth Connect Standard: o dono autoriza, guardamos o `stripe_user_id`
  (`acct_...`) e chamamos com **a nossa chave secreta** + `Stripe-Account`.
  Essa chave da 4YU vale para todas as contas conectadas: é segredo crítico.
- Aviso: um webhook Connect só, da plataforma, `Stripe-Signature`
  (HMAC-SHA256), com `account` no evento. Não há cadastro por dono.
- Pix: `PaymentIntent` em `brl`, copia e cola em
  `next_action.pix_display_qr_code.data`; validade de 60 s a 14 dias
  (`expires_at`); cancelar o PaymentIntent.
- **Fazer um teste antes de tudo**, em modo de teste: (a) se o PaymentIntent
  com Pix confirma no servidor, sem Stripe.js (a doc só mostra
  `stripe.confirmPixPayment` no navegador); (b) se conta **brasileira** recebe
  Pix (a doc diz "usuários da Stripe da [país]" e o extrato pode mostrar
  EBANX). Se (a) falhar, a cobrança vai como link do Checkout (até 24 h), que
  também funciona na conversa.
- Pix fica de fora para MCC proibido (clínica, consultório, farmácia, bar):
  conferir a capability ao conectar e dizer na tela.

## Onda 2: precisa da Base 2

### Efí

- O dono gera no app da Efí: aplicação com escopos de cobrança, `client_id`,
  `client_secret` e o certificado `.p12` (grátis, na hora). Ele sobe o `.p12`
  na nossa tela; o servidor extrai certificado e chave e guarda no cofre.
- Adaptador **API Pix padrão do Banco Central** (o mesmo que a onda 3 reusa):
  token `client_credentials` com mTLS, `PUT /v2/cob/{txid}` (`txid` com 26 a
  35 caracteres alfanuméricos, derivado da nossa referência), `GET` para
  reler, `PATCH` status `REMOVIDA_PELO_USUARIO_RECEBEDOR` para cancelar.
- Aviso: `PUT /v2/webhook/{chave}` com o cabeçalho de pular mTLS (a doc oficial
  descreve a opção; o nome `x-skip-mtls-checking` aparece na comunidade, não na
  página: confirmar no sandbox), endereço com HMAC e `ignorar=`, e conferir o
  IP de origem. Releitura sempre.

### Iugu

- Atrito: criar o token exige **chave RSA** e aprovação de um administrador
  da conta, e o token aparece uma vez. Para o dono não mexer com chave: o
  servidor gera o par RSA, a tela mostra a pública para ele colar na Iugu, e
  ele cola de volta o token. Se cada requisição também exigir assinatura RSA
  `[?]`, a privada fica no cofre.
- Fatura `POST /v1/invoices` com `payable_with: ["pix"]`, copia e cola em
  `pix.qrcode_text`; gatilho `POST /v1/web_hooks` (`invoice.status_changed`,
  form-urlencoded, sem assinatura: segredo no endereço e releitura).
- Fatura `canceled` ou `expired` ainda pode virar `paid`: tratar como paga, que
  é o que `aplicarPagamento` já faz com `vencida`.

### Pagar.me

- Chave `sk_` colada. Pix em `POST /orders`, copia e cola em
  `charges[0].last_transaction.qr_code`.
- Exige **nome, e-mail, CPF e telefone** de quem paga: a tela de cobrar pede o
  que faltar (hoje só pede o CPF).
- Aviso cadastrado pelo dono no painel (não achamos API): a tela mostra o
  endereço para ele colar. Releitura `GET /charges/{id}`.

## Onda 3: precisa da Base 3

- **Inter** e **Sicoob** no adaptador API Pix da Efí, só mudando URL base,
  token e escopos. O Inter reabriu integração em 12/mar/2026 com análise do
  banco; o Sicoob exige e-CNPJ ICP-Brasil do dono. Os dois sem aviso: releitura.
- **Cielo**: `POST /1/sales` com `Provider: Cielo2`, copia e cola em
  `Payment.QrCodeString`, QR de até 24 h, cancelar por `PUT .../void`. O QR
  vencido continua "pendente": quem vence é o nosso relógio. Sem sandbox de
  Pix: teste com centavos.
- **Cora**: a Parceria Cora (para CRM e ERP) depende de contato comercial; a
  integração direta pede certificado do dono. O aviso chega sem mTLS.

## Ordem de execução

| Passo | O quê | Antes precisa |
|---|---|---|
| 1 | Base 1 (migration) e Base 4 (tela em lista) | autorização para aplicar |
| 2 | Woovi (AppID) | conta sandbox Woovi |
| 3 | PagHiper | conta PagHiper de teste |
| 4 | Teste do Stripe, depois Stripe | conta Stripe da 4YU com Connect |
| 5 | Base 2 + Efí (com o adaptador API Pix) | conta Efí sandbox |
| 6 | Iugu, Pagar.me | contas de teste |
| 7 | Base 3 (releitura em escada) | decisão Vercel Pro ou `pg_cron` |
| 8 | Inter, Sicoob, Cielo, Cora | 7, e contas para testar |

Cada passo segue o molde do handoff: canal, registro, aviso, conexão, cartão,
catálogo, logo, tipo da API pública, doc da API, teste do aviso em
`assinatura-obrigatoria.test.ts`, vantagem em `docs/vantagens/`.

## O que depende do Gabriel

- Autorizar a migration da Base 1 (quando estiver escrita e testada).
- Criar contas de teste: Woovi sandbox (app.woovi-sandbox.com), PagHiper,
  Stripe (com Connect ligado), Efí, Iugu e Pagar.me. Sem conta, o gateway sai
  testado só contra respostas simuladas, como o PagBank hoje.
- Decidir a Base 3: Vercel Pro ou `pg_cron`.
- Cora: se quiser a Parceria, abrir o contato comercial.

## O que foi conferido de novo na fonte

- Stripe: validade do Pix de 60 s a 14 dias, cancelar pelo PaymentIntent,
  copia e cola em `pix_display_qr_code.data`; a confirmação no servidor e a
  elegibilidade de conta brasileira **não** aparecem na doc (viraram o teste
  do passo 4).
- Efí: aviso com HMAC no endereço e IP 34.193.116.226 na doc oficial; a opção
  de pular mTLS existe, o nome do cabeçalho só na comunidade.
- Cora: "Parceria" é para CRM e ERP, sem OAuth público documentado; a
  integração direta usa certificado (`matls-clients`).
- Woovi: troca do `code` do OAuth exige AppID da 4YU com
  `WOOVI_APP_APPLICATION_POST`; webhook por API.
- Iugu: RSA obrigatória na criação do token e aprovação do administrador
  (`dev.iugu.com/docs/tokens-de-autenticacao`).
- Agendador: cron diário no Hobby, carona nos avisos do WhatsApp
  (`src/app/api/manutencao/tarefas/route.ts`).
