# Cardápios, Fase 0 (fundação) e Fase 1 (link do entregador): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pedido de qualquer origem externa entra no quadro de Pedidos e avisa o cliente em cada etapa, inclusive fora das 24h; e o motoboy próprio avisa "saí" e "entreguei" por um link, sem login.

**Architecture:** pedido de fora vira linha de `pedidos` (0146) com `plataforma` + `id_externo`; uma função única (`receberPedidoDeFora`) faz upsert, cria contato e dispara aviso e evento quando a etapa muda. O aviso de etapa passa a sair por modelo aprovado quando a janela está fechada. O link do entregador é um token assinado que move o pedido pelo mesmo `moverPedido`.

**Tech Stack:** Next.js (versão do repo; ler `node_modules/next/dist/docs/` antes de rota nova), Supabase (Postgres, `public`), Vitest, Cloud API da Meta.

**Spec:** `docs/PLANO-INTEGRACOES-CARDAPIO.md` (fases e decisões) e `docs/PESQUISA-CARDAPIOS-DELIVERY.md` (dados das plataformas).

## Global Constraints

- Banco dividido com a Verandi: ler `docs/BANCO-COMPARTILHADO.md`; próxima migration pelo disco (`ls supabase/migrations | tail -1`, hoje `0153`); tudo `public.`; nunca `supabase db push`; aplicar em produção só com autorização do Gabriel, depois de ensaio `begin; ...; rollback;`.
- Tabela nova: RLS ligada, `revoke all ... from public, anon, authenticated`, `grant` explícito a `service_role`.
- Nenhum travessão longo em arquivo tocado. Placeholder de campo começa com "Exemplo:". Tom de SaaS B2B na tela.
- **Texto que o cliente final lê (modelos da Meta): mostrar ao Gabriel e esperar ok antes de submeter.**
- `npx tsc --noEmit -p .` limpo sem filtro; testes só dos arquivos mexidos (`npx vitest run <arquivos>`); nunca a suíte inteira.
- Commit por pathspec (`git commit -- <arquivos>`): outra sessão usa a mesma árvore. Push com o helper do `GITHUB_TOKEN`; conferir deploy READY em segundo plano.
- UI: print local 1440 e 390 (`scripts/ux-local/`) quando o Docker estiver ligado; se não estiver, dizer que não houve print.
- Feature nova entra em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`.

## Review Focus

1. **O mesmo aviso chega duas vezes** (webhook + polling, ou retentativa): não duplica pedido nem repete aviso. Teste na Task 3.
2. **Aviso atrasado com status velho** (`em_preparo` chega depois de `saiu`): não volta a etapa nem avisa de novo. Teste na Task 1.
3. **Pedido sem telefone ou com telefone de central** (iFood repassado pelo Cardápio Web): entra no quadro sem contato, sem aviso, sem alerta repetido. Teste na Task 3.
4. **Link do entregador vencido, adulterado ou de pedido cancelado**: página diz o motivo, não move nada. Teste na Task 6.
5. **Conta sem modelo aprovado e janela fechada**: aviso não sai, a tela do quadro mostra "cliente não avisado" em vez de fingir. Teste na Task 4.

---

### Task 1: Pedido de fora no núcleo

**Files:**
- Create: `src/core/pedidos-de-fora.ts`, `src/core/pedidos-de-fora.test.ts`

**Interfaces:**
- Produces:
  - `PLATAFORMAS_DE_PEDIDO = ['cardapio_web','olaclick','opendelivery','goomer','delivery_direto','neemo','entregador'] as const`; `type PlataformaDePedido`
  - `type PedidoDeFora = { plataforma: PlataformaDePedido; idExterno: string; numeroExibido: string; status: StatusDePedido; telefone: string | null; nome: string | null; entrega: EntregaDoPedido; endereco: string | null; totalCentavos: number; itens: { nome: string; quantidade: number; precoCentavos: number }[]; rastreioUrl: string | null }`
  - `podeAvancar(atual: StatusDePedido, novo: StatusDePedido): boolean`
  - `eventoDaEtapa(status: StatusDePedido): string` (`pedido.em_preparo`, `pedido.saiu`, ...)

- [ ] **Step 1: testes** em `pedidos-de-fora.test.ts`:
  - `podeAvancar('saiu','em_preparo')` é `false`; `podeAvancar('em_preparo','saiu')` é `true`; `podeAvancar('novo','cancelado')` é `true`; `podeAvancar('entregue','cancelado')` é `false`; `podeAvancar('saiu','saiu')` é `false`.
  - `eventoDaEtapa('saiu')` é `'pedido.saiu'`.
- [ ] **Step 2:** `npx vitest run src/core/pedidos-de-fora.test.ts` falha (módulo não existe).
- [ ] **Step 3:** implementar; a ordem é a de `STATUS_DE_PEDIDO` (`src/core/pedidos.ts:12`), `cancelado` vale de qualquer etapa antes de `entregue`.
- [ ] **Step 4:** testes passam; `npx tsc --noEmit -p .` limpo.
- [ ] **Step 5:** commit `feat(pedidos): pedido de fora no núcleo`.

### Task 2: Migration 0154

**Files:**
- Create: `supabase/migrations/0154_pedidos_de_fora.sql`

**Interfaces:**
- Produces (banco):
  - `pedidos`: `plataforma text` (check na lista da Task 1), `id_externo text`, `numero_exibido text`, `telefone text`, `nome_cliente text`, `rastreio_url text`, `cliente_avisado_em timestamptz`; `origem` passa a aceitar `'externo'`; índice único parcial `(cliente_id, plataforma, id_externo) where id_externo is not null`.
  - `cardapios_conectados`: `id uuid pk`, `client_id → clients on delete cascade`, `plataforma text` (mesma lista, menos `entregador`), `conexao_id → connections`, `id_na_plataforma text`, `segredo_id uuid` (cofre), `avisar_cliente boolean not null default false`, `importar_catalogo boolean not null default true`, `catalogo_em timestamptz`, `pedidos_lidos_ate timestamptz`, `ativo boolean not null default true`, `criado_em`; único `(client_id, plataforma)`.
  - `produtos`: `origem text`, `id_externo text`; único parcial `(cliente_id, origem, id_externo) where id_externo is not null`.

- [ ] **Step 1:** escrever a migration no molde da `0153` (cabeçalho com o que muda e "nada da Verandi é tocado"; `revoke`/`grant` na tabela nova).
- [ ] **Step 2:** ensaio pela Management API: `begin; <migration>; select has_table_privilege('anon','public.cardapios_conectados','select'); rollback;` volta `false`, e a coluna não existe depois.
- [ ] **Step 3:** commit `feat(banco): 0154, pedidos de fora e cardápios conectados` (sem aplicar).
- [ ] **Step 4:** pedir autorização ao Gabriel; aplicar; reler; registrar em `docs/BANCO-COMPARTILHADO.md`.

### Task 3: Receber um pedido de fora

**Files:**
- Modify: `src/server/repos/pedidos.ts` (nova função)
- Create: `src/server/receber-pedido-de-fora.ts`, `src/server/receber-pedido-de-fora.test.ts` (com `describe.skipIf` sem banco, como os outros de `src/server`)

**Interfaces:**
- Consumes: Task 1 (`PedidoDeFora`, `podeAvancar`, `eventoDaEtapa`); `tratarEvento` (`src/server/receber-evento.ts`); `acharContatoPeloTelefone`, `criarContato`.
- Produces:
  - `gravarPedidoDeFora(clienteId: string, p: PedidoDeFora, contatoId: string | null): Promise<{ pedido: Pedido; antes: StatusDePedido | null }>` em `repos/pedidos.ts` (upsert pelo índice único; `numero` interno pelo mesmo gerador de `inserirPedido`).
  - `receberPedidoDeFora(clienteId: string, p: PedidoDeFora, opcoes: { avisarCliente: boolean }): Promise<'novo' | 'andou' | 'igual' | 'ignorado'>` em `receber-pedido-de-fora.ts`. Nunca estoura: erro vira `alertar`.

- [ ] **Step 1: testes**:
  - o mesmo `PedidoDeFora` duas vezes: 1 linha em `pedidos`, segunda chamada devolve `'igual'`, `tratarEvento` chamado uma vez;
  - `saiu` depois `em_preparo`: segunda devolve `'ignorado'`, status continua `saiu`;
  - telefone `null`: pedido gravado com `contato_id` nulo, nenhum aviso;
  - `avisarCliente: false` com telefone desconhecido: não cria contato.
- [ ] **Step 2:** falham.
- [ ] **Step 3:** implementar. Contato: `telefoneCanonico`; achar; criar só com `avisarCliente`. Etapa mudou e `podeAvancar`: `avisarEtapaDoPedido` (Task 4) e `tratarEvento({ evento: eventoDaEtapa(status), telefone, dados: { pedido: numeroExibido, nome, plataforma } })`.
- [ ] **Step 4:** testes passam (com banco local) e tsc limpo.
- [ ] **Step 5:** commit `feat(pedidos): receber pedido de fora no quadro`.

### Task 4: Aviso de etapa por modelo fora das 24h

**Files:**
- Create: `src/core/modelos-do-pedido.ts` (+ teste), `src/server/avisar-etapa.ts`
- Modify: `src/server/pedidos.ts:174-206` (`moverPedido` usa `avisarEtapaDoPedido`; `avisarNaConversa` sai), `src/server/acoes-pedidos.ts` (ação de criar os modelos), tela do quadro de Pedidos (botão "Criar modelos de aviso" e selo "cliente não avisado")

**Interfaces:**
- Produces:
  - `MODELOS_DO_PEDIDO: { status: StatusDePedido; entrega: EntregaDoPedido | 'qualquer'; nome: string; corpo: string }[]`. Nomes `aviso_pedido_em_preparo`, `aviso_pedido_saiu_entrega`, `aviso_pedido_pronto_retirada`, `aviso_pedido_cancelado`; corpo com `{{1}}` = número do pedido e `{{2}}` = nome da loja; categoria `UTILITY`. **Texto aprovado pelo Gabriel antes do Step 5.**
  - `modeloDaEtapa(status, entrega): { nome; corpo } | null`
  - `avisarEtapaDoPedido(clienteId: string, pedido: Pedido, autor: AutorDaSaida | null): Promise<'na_janela' | 'por_modelo' | 'sem_modelo' | 'sem_contato'>`: dentro da janela, texto de `avisoDoStatus`; fora, modelo aprovado via `modeloComClique` (leva o link de rastreio quando houver botão de URL); grava `cliente_avisado_em`.
  - `acaoCriarModelosDoPedido(clienteId: string)`: no molde de `acaoCriarModelosDaVerandi` (`src/server/acoes-ponte-verandi.ts:48`).

- [ ] **Step 1: testes** de `modeloDaEtapa`: `('saiu','entrega')` dá `aviso_pedido_saiu_entrega`; `('saiu','retirada')` dá `aviso_pedido_pronto_retirada`; `('pago', ...)` dá `null`; todo `corpo` passa em `validarTemplate(nome, { corpo }, 'UTILITY')` sem erro.
- [ ] **Step 2:** falham. **Step 3:** implementar. **Step 4:** passam; tsc limpo.
- [ ] **Step 5:** mostrar os quatro textos ao Gabriel; com o ok, commit `feat(pedidos): aviso de etapa por modelo fora das 24h`.

### Task 5: Conexões de cardápio (base para as Fases 2 a 8)

**Files:**
- Create: `src/cardapios/types.ts`, `src/server/repos/cardapios.ts`, `src/app/clientes/[clienteId]/loja/cardapios/page.tsx`
- Modify: página de Integrações (`src/app/clientes/[clienteId]/loja/page.tsx`) com o grupo "Cardápio e delivery"

**Interfaces:**
- Produces:
  - `type ItemDeCatalogo = { idExterno: string; nome: string; descricao: string | null; precoCentavos: number | null; foto: string | null; categoria: string | null; disponivel: boolean }`
  - `type ConectorDeCardapio = { lerCatalogo(): Promise<ResultadoDaLoja<ItemDeCatalogo[]>>; pedidosDesde(desde: Date): Promise<ResultadoDaLoja<PedidoDeFora[]>>; lerPedido(idExterno: string): Promise<ResultadoDaLoja<PedidoDeFora | null>> }`
  - `repos/cardapios.ts`: `cardapioDaConta(clienteId, plataforma)`, `salvarCardapio(...)`, `cardapiosAtivos()`, `marcarPedidosLidos(id, ate)`, `marcarCatalogo(id, em)`.
  - Página com um cartão por plataforma (Cardápio Web, OlaClick, Goomer, Delivery Direto, Foody, Neemo, Open Delivery) em "Em breve" com "Quero esta" (`acaoQueroEstaPlataforma`), mais o cartão ativo do Link do entregador (Fase 1). Logos oficiais baixadas, nunca desenhadas.

- [ ] **Step 1:** tipos e repo; tsc limpo.
- [ ] **Step 2:** página; print 1440 e 390 (ou registrar que o Docker não estava ligado).
- [ ] **Step 3:** commit `feat(integrações): cardápio e delivery na tela de integrações`.

### Task 6: Link do entregador (Fase 1)

**Files:**
- Create: `src/server/entregador/token.ts` (+ `token.test.ts`), `src/app/e/[token]/page.tsx`, `src/server/acoes-entregador.ts`
- Modify: `src/proxy.ts` (liberar `/e/`), cartão do pedido no quadro (botão "Link do entregador": copia e oferece "Enviar pelo WhatsApp" com `wa.me` sem número)

**Interfaces:**
- Consumes: `moverPedido` (Task 4 já com `avisarEtapaDoPedido`).
- Produces:
  - `criarTokenDoEntregador({ clienteId, pedidoId }, agora?): string` e `lerTokenDoEntregador(token, agora?): { ok: true; dados: { clienteId; pedidoId } } | { ok: false; motivo: 'invalido' | 'vencido' }`, no molde de `formularios-do-whatsapp/token.ts`; validade 24h.
  - `acaoEntregador(token: string, passo: 'saiu' | 'entregue'): Promise<{ ok: true; status: StatusDePedido } | { ok: false; erro: string }>`; autor `{ tipo: 'automacao' }`.
  - Página `/e/[token]`: número do pedido, nome e endereço do cliente (com botão "Abrir no mapa"), dois botões grandes ("Saí para entregar", "Entreguei"), estado otimista, mobile primeiro.

- [ ] **Step 1: testes** do token: ida e volta; um caractere trocado dá `invalido`; 25h depois dá `vencido`.
- [ ] **Step 2:** testes da ação (com banco local): pedido `cancelado` devolve `{ ok: false }` e não muda; `entregue` duas vezes não avisa duas vezes.
- [ ] **Step 3:** falham. **Step 4:** implementar. **Step 5:** passam; tsc limpo.
- [ ] **Step 6:** print da página em 390 (é a tela do motoboy) e do botão no quadro em 1440.
- [ ] **Step 7:** vantagens + commit `feat(pedidos): link do entregador avisa saí e entreguei`; push; deploy READY.

---

## Depois desta fase

Cada plataforma (Fases 2 a 8 de `docs/PLANO-INTEGRACOES-CARDAPIO.md`) vira um
plano próprio com uma task de conector (`src/cardapios/<plataforma>.ts`
implementando `ConectorDeCardapio`, com testes sobre payloads reais da
documentação), uma de webhook (`/api/cardapio/<plataforma>`) e uma de tela de
conexão. A ordem: Cardápio Web, OlaClick, Open Delivery, Goomer, Delivery
Direto, Foody, Neemo.
