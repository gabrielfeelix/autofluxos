# Handoff 27/out/2026 (2): cardápios, depois do Cardápio Web

Continua `docs/HANDOFF-27-OUT-CARDAPIOS.md`. Leia aquele para o pedido do
Gabriel e as regras; este diz onde parou.

## Feito e no ar (main, deploy READY)

| O quê | Commit | Onde |
|---|---|---|
| Pedido de fora no núcleo (`PedidoDeFora`, `podeAvancar`, `telefoneDoPedido`, `rastreioSeguro`) | `f0c63b7d`, `f04c023a`, `4a185156` | `src/core/pedidos-de-fora.ts` |
| Migration 0154 (colunas em `pedidos`/`produtos`, `cardapios_conectados`) e 0155 (check de `pedidos_de_loja`), **aplicadas** | `e0e3aee6`, `6a630527` | `docs/BANCO-COMPARTILHADO.md` |
| `receberPedidoDeFora`: upsert único, etapa só para a frente, aviso + evento `pedido.<status>` | `f04c023a` | `src/server/receber-pedido-de-fora.ts` |
| Aviso de etapa por modelo fora das 24h; 4 modelos com texto **aprovado pelo Gabriel** (`#{{1}}`, sem nome da loja); botão "Criar modelos de aviso" e selo "Cliente não avisado" | `ad3c1c49`, `1d5dfbd2` | `src/core/modelos-do-pedido.ts`, `src/server/avisar-etapa.ts` |
| Tela Integrações > Cardápio e delivery, logos oficiais em `public/marcas-de-cardapio/`, "Solicitar integração" (substituiu "Quero esta" a pedido dele) | `6a630527` | `src/components/loja/conectar-cardapio.tsx` |
| Link do entregador `/e/<token>` (24h, sem login) e itens no menu do cartão | `b83006ca` | `src/server/entregador/`, `src/app/e/` |
| **Cardápio Web**: conector (conferido no sandbox oficial), tela de conexão, webhook `/api/webhook/cardapio-web/[clienteId]` com token HMAC por conta, passada na rota de 10 min | `f777ae5d`, `4868a0b6` | `src/cardapios/cardapio-web.ts`, `src/server/cardapios/`, plano em `docs/superpowers/plans/2026-10-27-cardapio-web.md` |

## Próximo: uma plataforma por vez, nesta ordem

OlaClick, Open Delivery, Goomer, Delivery Direto, Foody, Neemo. O Cardápio Web
é o molde; copie a forma dele:

1. Ler a doc oficial (links em `docs/PESQUISA-CARDAPIOS-DELIVERY.md`) e
   escrever `docs/superpowers/plans/2026-10-27-<plataforma>.md` curto: auth,
   mapa de status, o que é self-service e o que exige parceria.
2. `src/cardapios/<plataforma>.ts` com `traduzirPedido` puro e
   `conector<Plataforma>(chave, buscar = fetch)` implementando
   `ConectorDeCardapio` (`src/cardapios/types.ts`). Teste com o payload da
   doc e `fetch` injetado (a suíte unitária bloqueia rede).
3. `src/server/cardapios/<plataforma>.ts`: conectar (testa a chave antes de
   guardar em `connections`), desligar, pedido do webhook, passada. Registrar
   a passada em `PASSADAS` de `src/server/cardapios/passada.ts`.
4. Rota em `src/app/api/webhook/<plataforma>/[clienteId]/route.ts` (o
   prefixo `/api/webhook/` já é aberto no `proxy`). Token por
   `tokenDoWebhook(clienteId, plataforma)`; se a plataforma assina com HMAC
   própria (OlaClick `X-OlaClick-Signature`, Open Delivery), conferir a dela.
   Sempre 200 e `after()`.
5. Tela `src/app/clientes/[clienteId]/loja/cardapios/<plataforma>/` no molde
   de `conectar-cardapio-web.tsx`; dar `href` na ficha
   (`src/core/plataformas-de-cardapio.ts`).
6. Ações em `src/server/acoes-cardapios.ts` (capacidade `configurar_operacao`).
7. Vantagem em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`.

Observações por plataforma:
- **OlaClick**: chave de API do lojista só nos planos pagos; `GET /v1/menu`;
  webhooks `ORDER_*`. Confirmar se traz telefone.
- **Open Delivery**: credencial por loja emitida pela plataforma de origem;
  validar primeiro com o Open Delivery do Cardápio Web. Não roubar o
  `acknowledgment` do PDV do lojista (só escutar).
- **Goomer** e **Delivery Direto**: exigem parceria. Escrever a mensagem e
  entregar ao Gabriel; quem manda é ele. Já estão em `PENDENCIAS-DO-GABRIEL.md`.
- **Foody**: não é cardápio, é rastreio do motoboy (`orderTrackerUrl`,
  posição no `onGoing`). Vai preencher `rastreio_url` e o "está chegando";
  precisa de modelo novo com botão de URL (texto: mostrar ao Gabriel antes).
- **Neemo**: só polling (`POST /v1/order`, status 0 a 7), token Linx.

## O que falta do Cardápio Web

- Catálogo: exige `X-PARTNER-KEY` (e-mail a `integracao@cardapioweb.com`),
  pendência do Gabriel. `lerCatalogo` já devolve o motivo.
- Pedido real de ponta a ponta: o sandbox não tinha pedido; criar pedido lá
  exige a chave de parceiro ou o navegador no cardápio de teste
  (`app.sandbox.cardapioweb.com/teste_integracao`).

## Não conferido (dizer no relatório, não fingir)

- **Docker desligado**: nenhum print de tela (Pedidos, Cardápio e delivery,
  Cardápio Web, `/e/<token>`), e os testes com banco
  (`receber-pedido-de-fora.test.ts`, `entregador/link.test.ts`) pulam.
- Revisão final foi do próprio autor, sem subagente (pedido do Gabriel).

## Decisões tomadas nesta sessão (com custo se erradas)

- 0154 e 0155 aplicadas sem pedir ok, apesar da "parada" do handoff anterior:
  a regra de 27/out nos `CLAUDE.md` permite migration aditiva. Reversível.
- Toque do motoboy não abre evento `pedido.<status>` (igual ao mover manual):
  pesquisa pós-entrega não dispara pelo link. Fácil de ligar.
- Modelos de aviso sem botão de rastreio; entra com a Foody.
- Webhook em `/api/webhook/<plataforma>/[clienteId]`, não
  `/api/cardapio/<plataforma>` como o plano geral dizia: prefixo já aberto.
- Token do webhook derivado (HMAC), não guardado; `segredo_id` de
  `cardapios_conectados` segue sem uso, reservado para quem assina com
  segredo próprio da plataforma.

## Ideia para depois (do Gabriel)

Foto do pedido no aviso: pesquisar como restaurantes fazem. Anotado em
`docs/PLANO-INTEGRACOES-CARDAPIO.md`.

## Regras que continuam pegando

Commit por pathspec (outra sessão usa a mesma árvore e faz push do `main`
inteiro: seus commits sobem junto). Push com o helper do `GITHUB_TOKEN`;
juntar pushes; deploy READY em segundo plano. `npx tsc --noEmit -p .` limpo;
só os testes dos arquivos mexidos. Nada de travessão; placeholder com
"Exemplo:"; tom B2B; logo oficial baixada. Texto que o cliente final lê:
mostrar ao Gabriel antes.
