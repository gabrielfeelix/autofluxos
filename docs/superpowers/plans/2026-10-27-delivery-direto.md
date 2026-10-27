# Delivery Direto: plano de implementação

**Goal:** o pedido do Delivery Direto entra no quadro, e o cliente é avisado de cada etapa. **Código pronto, travado** até o Delivery Direto emitir o nosso `client_id` de integrador (e-mail em `docs/parcerias/delivery-direto.md`).

**Fonte:** `deliverydireto.com.br/admin-api/docs/openapi.yaml` (27/out/2026).

## O que a especificação decidiu

- OAuth de senha em `POST /admin-api/token`: `username`/`password` do usuário de API que o lojista cria, mais `client_id`/`client_secret` **nossos**. Todo pedido leva `X-DeliveryDireto-ID` (a loja) e `X-DeliveryDireto-Client-Id`. Token de 6 h, em memória.
- Pedidos: `GET /admin-api/v1/orders` com `lastModifiedStart/End` (por dia), `includeCanceledOrders`, `showItems`, `ordersId`. Dinheiro em centavos (`{ value, currency }`). Telefone em `customer.telephone`.
- **Sem webhook nesta fase:** o `PUT /webhooks` é um por tipo de evento na loja, e não está claro se é por integrador; cadastrar o nosso poderia tirar o do PDV. Pedido entra pela passada de 10 minutos. Rever quando houver acesso.

## Status

`WAITING` → novo; `APPROVED` → em_preparo; `IN_TRANSIT` → saiu; `DONE` → entregue; `REJECTED` ou `isCanceled` → cancelado; `HIDDEN`, `WARNING` → novo (não move). Tipo: `DELIVERY` entrega, `TAKEOUT` retirada, `DESK` local, `TABLE` ignorado, `BY_PHONE` entrega se tiver endereço.

## Para liberar

1. Delivery Direto responde com `client_id` e `client_secret`.
2. Gravar `DELIVERY_DIRETO_CLIENT_ID` e `DELIVERY_DIRETO_CLIENT_SECRET` no cofre e na Vercel (`autofluxos`, produção).
3. A ficha sai de "Em breve" sozinha (`deliveryDiretoLiberado`). Testar com a loja de homologação antes de oferecer.
