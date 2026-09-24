# Magento, Adobe Commerce e GraphCommerce para o cross-sell

Pesquisa de 23/set/2026 para o item "Cross-sell" em
`PLANO-23-SET-O-QUE-CONSTRUIR.md` (seção "Em aberto"): o bot ler ao vivo o
catálogo da loja do cliente, com preço e estoque reais, recomendar, e avisar o
sistema dele quando vender.

**Não confundir com crossdocking**, que é logística de armazém. O item é
cross-sell.

> Levantamento em documentação pública, não testado contra loja real. As
> afirmações de API vêm da doc oficial da Adobe; a de adoção no Brasil vem de
> comparativos de blog, sem número de participação de mercado.

---

## Conclusão

**Magento é conector secundário, não prioridade.** No Brasil ele é plataforma
de operação grande, com dev próprio (junto com VTEX). PME, que é o nosso
público, está em Nuvemshop, Tray, Loja Integrada, Bling e Tiny. Pesquisar
esses antes.

Se um dia vier cliente Magento, o caminho é barato na leitura e caro no aviso
de venda. Detalhes abaixo.

---

## Ler o catálogo: aberto, sem credencial

A query GraphQL `products` é pública, funciona sem token.
<https://developer.adobe.com/commerce/webapi/graphql/schema/products/queries/products>

- **Preço:** `price_range { minimum_price { regular_price final_price discount } }`.
  Não há `special_price`: a promoção já vem em `final_price`.
- **Estoque:** só `stock_status` (`IN_STOCK` / `OUT_OF_STOCK`). Sem número.
- **Recomendação pronta:** `crosssell_products`, `upsell_products`,
  `related_products`. O lojista já cadastrou o que combina com o quê; o bot não
  precisa inventar.
- **Paginação:** `pageSize` máximo 25.

**Armadilha:** com "Display Out of Stock Products" desligado na loja, produto
esgotado **some** da query. O bot não sabe que ele existe.

## Estoque exato: só com acesso de administrador

O Magento (MSI) separa quantidade física por armazém de **salable quantity**
(o que sobra depois das reservas de pedidos não expedidos). O número só sai
pela REST autenticada:

`GET /V1/inventory/get-product-salable-quantity/:sku/:stockId`
<https://developer.adobe.com/commerce/webapi/rest/inventory/check-salable-quantity/>

"Só restam X" é exibição de tema, não campo da API.

## O que pedir ao lojista

Uma **Integration** (System > Integrations) com escopo mínimo: Catalog leitura,
e Sales se formos criar pedido.

Desde a 2.4.4 o token da Integration não vale sozinho como Bearer. O lojista
precisa ligar: Stores > Config > Services > OAuth > Consumer Settings >
"Allow OAuth Access Tokens to be used as standalone Bearer tokens".
<https://developer.adobe.com/commerce/php/development/backward-incompatible-changes/>

Esse token **não expira**. Vai para o Vault, no mesmo padrão da 0040.

## Avisar a venda

Dá para criar pedido por GraphQL (`createEmptyCart` até `placeOrder`), e o MSI
reserva o estoque sozinho. Mas frete, pagamento e checkout customizado de cada
loja viram problema nosso, e Magento BR costuma ter checkout de terceiro que o
`placeOrder` padrão não cobre.

**Começar pelo link de carrinho:** o bot recomenda, o cliente final fecha na
loja. Zero responsabilidade sobre checkout.

## Saber quando muda: não há aviso no Open Source

Adobe I/O Events e Commerce Webhooks são **só do Adobe Commerce pago**.
<https://developer.adobe.com/commerce/extensibility/events/>

No Open Source: polling do catálogo, ou o lojista instala extensão paga de
webhook.

## GraphCommerce: irrelevante para nós

Vitrine headless em Next.js (Reach Digital) sobre o GraphQL do Magento, com
GraphQL Mesh. Não é camada de dado. Cliente com GraphCommerce é Magento normal:
falamos direto com o Magento.
<https://www.graphcommerce.org/>

---

## Sondagem da loja do cliente: PCYES (23/set/2026)

`https://www.pcyes.com.br`, só leitura pela busca pública, sem credencial.

- **GraphQL aberto**: `storeConfig` respondeu 200. `store_code` `default`,
  moeda `BRL`.
- **`product_url_suffix` é `null`**, e o link certo é `https://www.pcyes.com.br/<url_key>`
  (conferido: 200). Tratar `null` como `.html` quebraria todo link.
- **Busca funciona**: "mouse" devolve 75 produtos, com `sku`, nome, preço
  (`regular_price` e `final_price`) e `stock_status`.
- **"Combina com" quase vazio**: em 87 produtos de quatro buscas (teclado,
  headset, cadeira, gabinete), `crosssell_products` e `upsell_products` vieram
  vazios em todos, e `related_products` preenchido em 6. Sugerir complemento
  vai responder vazio na maioria dos casos até o lojista cadastrar.
- **Cloudflare na frente**, mas não barrou chamada sem user-agent de navegador
  a partir daqui. Não prova que não barra IP da Vercel: conferir na Task 8 do
  plano.

---

## Nuvemshop (pesquisa de 24/set/2026, F4 do plano de navegação)

Levantamento na documentação oficial (`tiendanube.github.io/api-documentation`,
`nuvemshop.dev`, central de ajuda), **não testado contra loja real**. O que não
deu para confirmar está marcado.

### Conclusão

**Conectar por app de parceiro com OAuth, não por token colado.** É o único
caminho que serve a todo plano da Nuvemshop e que traz webhook assinado, que a
F5 (pedido pago, carrinho abandonado) vai precisar. O token colado ("aplicativo
sob medida") existe, mas só nos planos **Escala** e **Next**, que não são o
nosso público.

O que depende do Gabriel, e não tem API: criar a conta de parceiro e o app no
portal (<https://partners.nuvemshop.com.br>), e guardar `NUVEMSHOP_APP_ID` e
`NUVEMSHOP_CLIENT_SECRET` na Vercel. Sem as duas, a tela diz "conexão ainda
não liberada" e nada quebra.

### Autenticação

<https://tiendanube.github.io/api-documentation/authentication>

- O lojista abre `https://www.nuvemshop.com.br/apps/<app_id>/authorize`, aceita,
  e volta para a URL de retorno cadastrada no app com `?code=`. O `code` vale
  **5 minutos**.
- Troca: `POST https://www.nuvemshop.com.br/apps/authorize/token` com
  `client_id`, `client_secret`, `grant_type=authorization_code` e `code`.
  Resposta: `access_token`, `token_type` (`bearer`), `scope` e `user_id`, que
  **é o id da loja**.
- **O token não expira** ("They become invalid only after you get a new one,
  or if the user uninstalls your app"). Sem refresh token. Vai para o Vault
  pela Conexão (`connections`, padrão da 0040), como o token do Magento.
- Aceita `state` e o devolve no retorno
  (<https://nuvemshop.dev/en-US/api/authentication>). Usamos o mesmo bilhete
  assinado do Instagram (`server/instagram/estado.ts`): ele diz qual conta
  começou a conexão, e o retorno só grava com ele válido.
- A troca é em JSON (`Content-Type: application/json`), não formulário.
- A URL de retorno é fixa no app do portal:
  `https://autofluxos.4yu.com.br/api/loja/nuvemshop/retorno`.

### App não publicado

- Publicar na Loja de Aplicativos exige **homologação**
  (<https://nuvemshop.dev/apps/publish/homologation/overview>), com os três
  webhooks de LGPD obrigatórios.
- **Não confirmado na doc**, mas indicado pela própria central de ajuda (que
  tem página de suporte para "apps não disponíveis na Loja de Aplicativos"):
  app de parceiro não publicado é instalado pelo link de autorização. É o que
  o AutoFluxos usa. Conferir no primeiro lojista real.
- Parceiro ganha **loja demo** gratuita no portal, para testar.

### Chamadas

<https://tiendanube.github.io/api-documentation/intro>

- Base `https://api.nuvemshop.com.br/2025-03/<store_id>`.
- Cabeçalhos: `Authorization: Bearer <token>` (a doc de 2025; a antiga usava
  `Authentication: bearer`, e o adaptador manda os dois) e **`User-Agent` com
  nome do app e contato**, obrigatório (sem ele, 400).
- Limite: balde de 40 requisições, esvazia 2 por segundo (×10 em Escala/Next).
  O bot faz uma busca por pergunta: sobra folga.

### Produto

<https://tiendanube.github.io/api-documentation/resources/product>

- Busca: `GET /products?q=<texto>&published=true` procura em nome, tags e SKU.
  `fields` limita a resposta.
- `GET /products/sku/<sku>` devolve o primeiro produto com variação daquele
  SKU. É a releitura do card.
- Nome e `handle` vêm por idioma (`{"pt": ...}`).
- Preço é **por variação**, em texto: `price` e `promotional_price`.
- **Estoque exato sem token extra**: `stock` é número; `stock_management:
  false` (ou `stock` nulo) quer dizer estoque infinito. Melhor que o Magento,
  que só dá quantidade com token de administrador.
- Foto: `images[].src`, sem credencial extra.
- Link: `canonical_url` quando vier; senão `<domínio>/produtos/<handle.pt>/`
  (**não confirmado na doc**; conferir na loja demo).
- **Não há "combina com"** (cross-sell) na API: a sugestão de complemento
  responde vazio, como na maioria dos produtos da PCYES.

### Loja

`GET /store` (<https://tiendanube.github.io/api-documentation/resources/store>):
`original_domain` (`*.nuvemshop.com.br`), `domains` (os próprios),
`main_currency`, `name`. É daqui que sai o endereço da loja salvo em
`lojas_integradas.endereco`.

### Webhooks (F5)

<https://tiendanube.github.io/api-documentation/resources/webhook>

- Registro por API: `POST /webhooks` com `{"event", "url"}`, só `https://`.
- Eventos úteis: `order/paid`, `order/created`, `order/cancelled`,
  `app/uninstalled`.
- Assinatura: cabeçalho `x-linkedstore-hmac-sha256`, HMAC-SHA256 do corpo cru
  com o `client_secret` do app.
- Reenvio: espera 2xx em até 3 s; tenta de novo por até 48 h (entre 16 e 18
  tentativas, **número exato não confirmado**).
- LGPD, obrigatórios na homologação: `store/redact`, `customers/redact`,
  `customers/data_request`.

### Carrinho abandonado (F5)

<https://tiendanube.github.io/api-documentation/resources/abandoned-checkout>

- `GET /checkouts`: `abandoned_checkout_url` (link de recuperação),
  `contact_phone`, `contact_email`, `products`, `total`. Ficam 30 dias
  acessíveis.
- **Sem webhook**: só polling. A F5 precisa de uma passada periódica, como a
  manutenção diária, e não de um evento.
- Escopo: não há `read_checkouts`; **não confirmado** se `read_orders` cobre.

### Escopos pedidos no app

`read_products` (busca do bot) e `read_orders` (F5). Nada de escrita.
