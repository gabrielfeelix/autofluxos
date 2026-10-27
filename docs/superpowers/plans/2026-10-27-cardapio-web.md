# Cardápio Web (Fase 2): plano de implementação

**Goal:** o lojista do Cardápio Web cola a chave de API, e todo pedido de lá entra no quadro de Pedidos, com o cliente avisado de cada etapa.

**Spec:** `docs/PLANO-INTEGRACOES-CARDAPIO.md` (Fase 2) e a documentação oficial (`docs.cardapioweb.com/llms.txt`, lida em 27/out/2026).

## O que a documentação decidiu

- **Pedidos só com a chave do lojista** (`X-API-KEY`, gerada em Configurações > Integrações > API). Self-service, sem parceria.
- **Catálogo exige `X-PARTNER-KEY`** (chave de integradora, pedida por e-mail a `integracao@cardapioweb.com`). Fica fora desta fase: `lerCatalogo` devolve o motivo.
- Base `https://integracao.cardapioweb.com/api/partner/v1`. Limite: 300 requisições a cada 3 min por loja.
- Webhook legado: URL e token opcional cadastrados pelo lojista no Portal; eventos `ORDER_CREATED` e `ORDER_STATUS_UPDATED` com `order_id`, `merchant_id`, `X-Webhook-Token`. Responder 200 em até 5 s; 15 retentativas e depois **pausa**.
- Polling: `GET /orders?updated_since=` (no máximo 24 h atrás) devolve pedidos resumidos; o completo é `GET /orders/{id}`.
- Pedido de marketplace (iFood) repassado vem com telefone de central: `telefoneDoPedido` já recusa.

## Mapa de status

| Cardápio Web | Nosso |
|---|---|
| `waiting_confirmation`, `pending_payment`, `pending_online_payment`, `scheduled_confirmed` | `novo` |
| `confirmed`, `ready` | `em_preparo` |
| `released`, `waiting_to_catch` | `saiu` (entrega ou retirada) |
| `delivered`, `closed` | `entregue` |
| `canceled` | `cancelado` |

`order_type`: `delivery` → entrega, `takeout` → retirada, `onsite` → local, `closed_table` (mesa) → ignorado.

## Tasks

1. **Conector** `src/cardapios/cardapio-web.ts` + teste com o payload da documentação: `traduzirPedido`, `statusDoCardapioWeb`, `conectorCardapioWeb(chave)` (`lerPedido`, `pedidosDesde`, `lerCatalogo`), `lojaDoCardapioWeb(chave)`.
2. **Token do webhook** por conta, HMAC do `BETTER_AUTH_SECRET` (molde do Asaas), e a rota `POST /api/webhook/cardapio-web/[clienteId]`: token errado 401; resto 200 e `after()` lê o pedido e chama `receberPedidoDeFora`. (Desvio do plano geral: `/api/webhook/` já é aberto no proxy.)
3. **Conectar e desligar** (`server/cardapios/cardapio-web.ts` + ações): testa a chave em `GET /merchant`, guarda em `connections` (cabeçalho `X-API-KEY`), grava `cardapios_conectados` com o `merchant_id`.
4. **Passada de 10 min**: a rota `/api/manutencao/pedidos` também percorre os cardápios ativos (`pedidosDesde` com folga de 2 min), rede de segurança do webhook.
5. **Tela** `/loja/cardapios/cardapio-web`: chave, aviso ao cliente ligado por padrão, URL e token do webhook com copiar, passo a passo do Portal. Ficha ganha `href`.
