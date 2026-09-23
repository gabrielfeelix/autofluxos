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
