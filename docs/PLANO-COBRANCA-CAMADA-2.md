# Plano: cobrança camada 2 (pedidos, recorrência, relatórios por ramo)

Aprovado por inteiro em 22/out/2026. Continua `docs/PLANO-COBRANCA-CAMADA-1.md`.
Migration: a próxima é a que o diretório disser, nunca a numeração daqui.

## Achados que moldaram o plano

- A Verandi já cobra a mensalidade: `cobranca` e `pagamento` (0056 dela), uma
  por contrato e competência. O AutoFluxos não gera mensalidade de quem usa a
  Verandi: lê a do mês e devolve o pagamento pela API dela.
- `public.pedidos_de_loja` (0103) é o voto "Quero esta"; a tabela nova é `pedidos`.
- O escopo do papel já filtra a Análise (`filtroDoAcesso`), e operador e gestor
  já são atribuíveis (`components/conta/editor-de-acesso.tsx`).
- O arranjo da Análise mora em cookie (`server/preferencias.ts`): o padrão por
  ramo e perfil é valor inicial no código.

## Ordem: d, c, a, b

O MGM é o único cliente pagante e é `aulas`; pedidos ainda não têm cliente.

### d) Cobrar do Inbox (2 a 3 dias, sem migration)
- Catálogo por padrão (busca com foto, quantidade, soma no servidor), aba
  **Valor livre** para sinal, ajuste e serviço avulso. Sem catálogo, abre no
  Valor livre com "Cadastrar produtos".
- Itens gravados em `cobrancas.itens`. Loja conectada: mesma busca de `loja_buscar`.
- Cartão da cobrança na conversa, com status que muda sozinho.
- "O que mais vende" soma também cobranças pagas com item.

### c) Recorrência (8 a 10 dias)
| Modo | Gateway |
|---|---|
| Pix do mês na conversa (relógio gera e lembra) | qualquer |
| Pix Automático (autoriza uma vez; `paymentCreationMode: SUBSCRIPTION`) | Asaas |
| Cartão recorrente | Asaas `subscriptions`, Mercado Pago `preapproval` |

Conta com Verandi: dois endpoints novos na API da Verandi (cobrança do mês,
pagamento recebido). Sem Verandi: tabela `assinaturas`. Lembrete fora da janela
de 24 h é modelo de utilidade, pago.

### a) Pedidos (6 a 8 dias)
- `pedidos` e `pedido_itens`; `produtos.estoque` (nulo = não controla).
- Status com código neutro e rótulo por ramo; `aulas` não tem Pedidos.
- Cobrança paga move para pago; pagar na entrega é marcado à mão.
- Estoque baixa quando o pedido nasce, volta no cancelamento ou vencimento.
- Quadro para restaurante, lista para os outros. Pedido feito no site fica no site.

### b) Relatórios (6 a 9 dias)
- Atendente vê em R$ as próprias vendas (`ler_valores: proprios` no operador).
- Seletor Eu / Equipe / Conta para quem enxerga mais que o próprio.
- Arranjo inicial por ramo e perfil; blocos que não servem ao ramo ficam fora de "adicionar".
- Por ramo: aulas (matrículas, experimental que virou matrícula, mensalidade em
  dia, faltas e evasão só com Verandi), e-commerce (pedidos do chat, ticket,
  conversão, carrinho abandonado só com Nuvemshop e Magento), restaurante
  (pedidos por hora, tempo de preparo e entrega, prato mais pedido), comércio
  (vendas do chat, produto procurado que não tem).

## Andamento
- d: no ar no código (22/out). Cobrar com abas Do catálogo e Valor livre
  (`components/lead/botao-de-cobrar.tsx`, soma em `core/cobrar-do-catalogo.ts`),
  cartão na conversa (`components/inbox/cartao-da-cobranca.tsx`, confere o status a
  cada 15 s enquanto aguarda), bloco "Mais vendidos pelo chat" em Vendas. Sem migration.
- c1 (base da mensalidade): no ar em 22/out. Migration `0145_mensalidades`
  (`assinaturas`, `cobrancas.assinatura_id` e `competencia`, origem `mensalidade`)
  aplicada em produção com autorização. Datas em `core/mensalidade.ts`; relógio `server/mensalidades.ts` no
  cron de tarefas; envio comum `server/mandar-cobranca.ts`; página pública
  `app/pagar/[codigo]` (código assinado em `server/link-de-pagar.ts`); modelo
  `lembrete_de_cobranca` criado por Ajustes > Pagamentos; ficha > Cobranças >
  Mensalidades.
- c2 e c3 (cartão recorrente e Pix Automático, Asaas): código no ar em 22/out,
  escrito contra a documentação e sem teste real (falta a chave do sandbox).
  Cartão: `POST /subscriptions` sem o cartão, o pagador põe na fatura do
  primeiro mês; os pagamentos chegam com `subscription` e viram a cobrança do
  mês em `cobrancaDaRecorrencia`. Pix Automático: jornada 3, modo `MANUAL`; o
  relógio cria cada mês com `pixAutomaticAuthorizationId`. Adesão conferida no
  gateway ao abrir a ficha e na passada diária (`sincronizarAdesao`). Cartão
  pelo Mercado Pago (`preapproval`) espera a aplicação do Mercado Pago.
- c4 (ponte Verandi): não será feita. O MGM não vai usar cobrança (Gabriel, 22/out); só se pedir.
- a (Pedidos): no ar em 22/out. Migration `0146_pedidos` (`pedidos`,
  `pedido_itens`, `produtos.estoque`) aplicada em produção com autorização.
  Etapas, nomes e visão por ramo em `PacoteDoNicho.pedidos` (`core/nichos.ts`;
  aulas = `null`, sem menu nem pedido); regras em `core/pedidos.ts`; banco em
  `server/repos/pedidos.ts` (número `max+1` com nova tentativa no `unique`,
  estoque por troca condicional, sem o pool do SQL direto, que não enxerga
  `produtos`); fluxo em `server/pedidos.ts`. Cobrar do catálogo com Retirada e
  Entrega reserva o estoque e cria o pedido antes da cobrança e desfaz se ela
  não sair; o bloco Cobrar do fluxo cria pedido sem itens. Paga move para
  pago; vencida ou cancelada cancela e devolve o estoque. Tela
  `loja/pedidos` (quadro ou lista, atualiza a cada 20 s), botão Estoque no
  catálogo. Pago depois de vencido não reabre o pedido cancelado.
- b (Relatórios), parte feita em 22/out: em Análise > Vendas, nos ramos com
  Pedidos e para quem vê a conta inteira, os blocos `pedidos` (vendidos,
  ticket médio, tempo de preparo e de entrega, cancelados), `pedidos-horarios`
  (dia e hora) e `pedidos-entrega` (entrega ou retirada). Conta em
  `core/analise-de-pedidos.ts`. Mais pedido = o bloco que já existia, "Mais
  vendidos pelo chat". Sem cookie de arranjo, a ordem inicial é a do ramo
  (`PacoteDoNicho.primeirosEmVendas`; aulas vazio, nada muda).
- b, resto feito em 22/out (liberado pelo Gabriel: só o Daniel, dono, entra
  no painel do MGM, e nada some para ele). Atendente (`operador`) com
  `ler_valores: proprios`; pedidos mostram total só com `ler_valores: todos`,
  porque pedido não tem dono. Seletor Eu / Equipe / Conta em Atendimento,
  Vendas e na planilha (`core/recorte-da-analise.ts`, `?ver=`, padrão o maior
  recorte, só estreita). Bloco `mensalidades` em Vendas (novas, ativas, em
  dia, canceladas, recebido; `core/analise-de-mensalidades.ts`), primeiro no
  ramo aulas. **Fora**: aula experimental, faltas e evasão, que moram na
  Verandi (ler de lá cruza produtos no banco); só com ponte própria.
- Registro anterior: b, **liberado em 22/out** (só o Daniel, dono, entra no painel; nada some para ele). Era adiado por causa do MGM; ver `docs/HANDOFF-22-OUT-RELATORIOS-B.md`:
  `ler_valores: proprios` no operador (as funções personalizadas do MGM
  herdariam), relatórios de aulas (matrículas, experimental, mensalidade em
  dia, faltas) e o seletor Eu / Equipe / Conta (mudaria a Análise do MGM).
  Bloco de pedido para o atendente que vê só os seus também fica para o
  seletor: pedido não tem dono hoje.
