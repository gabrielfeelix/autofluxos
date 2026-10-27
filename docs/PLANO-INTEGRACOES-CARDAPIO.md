# Plano: integrações de cardápio digital e delivery (27/out/2026)

Pedido do Gabriel: conectar o AutoFluxos a toda plataforma de cardápio ou
delivery próprio que dê alguma conexão (catálogo, status, aviso ao cliente). O
que faltar, a gente cria. Pesquisa de base: `docs/PESQUISA-CARDAPIOS-DELIVERY.md`.

## A ideia em uma frase

Todo pedido de fora (Cardápio Web, Goomer, OlaClick...) vira um pedido **no
quadro de Pedidos que o AutoFluxos já tem** (0146), e todo produto de fora vira
item **do catálogo próprio** (`produtos`). A partir daí, o que já existe faz o
resto: o aviso de cada etapa, o "cadê meu pedido" da IA, o evento
`pedido.<status>` que abre qualquer fluxo.

Por que assim, e não um caminho por plataforma: o quadro de Pedidos já tem
etapas, aviso ao cliente e tela; o catálogo próprio já é o que a IA de vendas
consulta. Cada plataforma nova vira só um **conector** (ler catálogo, ler
pedido, traduzir status), e o lojista vê tudo no mesmo lugar, venha de onde
vier.

## O que já existe e será reaproveitado

| Peça | Onde | Serve para |
|---|---|---|
| Quadro de Pedidos, status `novo → pago → em_preparo → saiu → entregue / cancelado` | `0146`, `src/core/pedidos.ts`, `src/server/pedidos.ts` | Destino de todo pedido de fora |
| Aviso de etapa na conversa (`avisoDoStatus`) | `src/server/pedidos.ts:moverPedido` | Hoje **só dentro das 24h**: falta o modelo aprovado (Fase 0) |
| Catálogo próprio (`produtos`: nome, preço, descrição, foto, categoria, estoque) | `src/server/repos/produtos.ts`, importação por planilha | Destino de todo catálogo de fora |
| Evento `pedido.<status>` + "começar pelo modelo" + uma vez por pedido | `src/server/receber-evento.ts`, `evento-com-modelo.ts` (0152) | Fluxo próprio do lojista em cada etapa (pesquisa pós-compra, cupom) |
| Passada periódica (GitHub Actions, 10 min) | `.github/workflows/pedidos-da-loja.yml`, `acompanhar-pedidos.ts` (0153) | Polling de quem não tem webhook |
| Credencial no cofre | `src/server/repos/conexoes.ts` | Token/API key de cada plataforma |
| Token assinado para página pública | `src/server/formularios-do-whatsapp/token.ts` | Link do entregador |

## Fases

Cada fase é publicável sozinha. A ordem põe primeiro o que não depende de
parceiro nenhum.

| Fase | O quê | Depende de terceiro? | Entrega para o lojista |
|---|---|---|---|
| **0. Fundação** | Pedido de fora no quadro (`origem`, `plataforma`, `id_externo`, telefone); avisos de etapa **por modelo aprovado** fora das 24h, criados com 1 clique; tabela de cardápios conectados; interface de conector; tela Integrações > Cardápio e delivery | Não | "Saiu para entrega" chega mesmo sem conversa aberta |
| **1. Link do entregador** | Página pública por pedido (sem login) com "Saí" e "Entreguei"; o atendente manda o link ao motoboy | Não | Os 39% com motoboy próprio passam a avisar o cliente sem digitar nada |
| **2. Cardápio Web** | Conector: catálogo (`/catalog`, foto, descrição, complementos) + pedidos por webhook `ORDER_STATUS_UPDATED` e polling | API Key gerada pelo lojista (já existe). App Store deles depois | Catálogo importado sozinho; pedido do Cardápio Web no quadro |
| **3. OlaClick** | Conector: `/v1/menu` + webhooks `ORDER_*` | API Key do lojista (planos Premium+) | Idem |
| **4. Open Delivery** | Conector genérico do padrão Abrasel: `/merchant` (catálogo), `newEvent` com HMAC + polling, `DISPATCHED`/`DELIVERED`, ETA e entregador | Credencial por loja emitida pela plataforma | Uma implementação para vários; validar primeiro com o Open Delivery do Cardápio Web (self-service) |
| **5. Goomer** | Open Delivery da Goomer (`partner-api.goomer.app/opendelivery`) | **Parceria com a Goomer** (credencial não é self-service) | O maior parque sem aviso de status |
| **6. Delivery Direto** | Conector: `/admin-api/v1/catalog`, webhooks `ORDER_STATUS_CHANGED` | Parceria (client_id em até 7 dias úteis) + usuário de API do lojista | Idem |
| **7. Foody** | Rastreio: `orderTrackerUrl` no aviso de "saiu", e "está chegando" quando a posição do motoboy entra no raio | Token do lojista (planos pagos) | "Está chegando" com link do mapa |
| **8. Neemo** | Polling `POST /v1/order`, status 0 a 7 | Token Linx | Só status |
| **9. "Cadê meu pedido"** | Ferramenta da IA lê o pedido do contato no quadro (etapa, previsão, link de rastreio) | Não | A pergunta do pico respondida sozinha |

**Fora, por decisão:** Anota AI, Brendi, Yooga, Saipos Bot (concorrentes
diretos de bot no WhatsApp); iFood, 99Food, Keeta (marketplace, cliente
acompanha pelo app, telefone mascarado); Consumer (API só no sentido contrário);
Kyte, GrandChef, OnChef, Cardápio Fácil, Instadelivery (sem API pública);
Saipos API de Dados (pago por loja e com atraso até D+1).

## Decisões de arquitetura

- **Um pedido de fora é linha de `pedidos`**, com `plataforma` (`cardapio_web`,
  `olaclick`, `opendelivery`, `goomer`, `delivery_direto`, `neemo`, `entregador`)
  e `id_externo`, únicos por conta. Repetir o mesmo aviso não duplica.
- **Status de fora é traduzido para os nossos seis** num mapa por conector. O
  que não tem equivalente (ex.: `waiting_confirmation`) fica `novo`. Status
  nunca anda para trás por aviso atrasado.
- **Contato nasce do telefone do pedido** só com o aviso de status ligado na
  conexão, que é o aceite implícito de quem pediu com o telefone para receber
  aviso daquele pedido (mensagem de utilidade presa à transação). Marketing
  continua exigindo aceite próprio.
- **Catálogo de fora é cópia, não espelho ao vivo**: sincroniza ao conectar e
  a cada passada; item vindo de fora fica marcado (`origem`), e a tela diz
  "edite na plataforma". Preço e disponibilidade seguem a plataforma.
- **Webhook por plataforma** em `/api/cardapio/<plataforma>`, conferindo o
  segredo de cada um (`X-Webhook-Token`, `X-OlaClick-Signature`,
  `X-App-Signature`); responde 200 antes de processar (`after()`), porque o
  Cardápio Web pausa o webhook depois de 15 falhas.
- **Polling como rede de segurança** na mesma passada de 10 minutos, para o
  aviso que o webhook perdeu.

## Ideias para depois

- **Foto do pedido no aviso** (pedido do Gabriel, 27/out/2026): pesquisar como
  os restaurantes fazem (foto do prato pronto, da embalagem, nenhuma) e decidir
  se vira opção por loja. Exige modelo com cabeçalho de imagem, separado dos
  quatro de texto.

## O que depende do Gabriel

- **Goomer:** pedir credencial de parceiro Open Delivery (Fase 5).
- **Delivery Direto:** pedir client_id de parceiro (Fase 6).
- **Cardápio Web App Store** (opcional, depois da Fase 2): cadastro por
  e-mail em integracao@cardapioweb.com, vídeo do app, até 7 dias.
- **Texto dos modelos de aviso** (Fase 0): ver e aprovar antes de mandar à
  Meta.
- Um restaurante piloto em cada plataforma para o teste real.

Plano detalhado da Fase 0 e da Fase 1:
`docs/superpowers/plans/2026-10-27-cardapios-fase-0-e-1.md`.
