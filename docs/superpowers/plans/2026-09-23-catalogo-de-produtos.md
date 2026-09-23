# Plano 23/set/2026: catálogo de produtos para o bot e para a equipe

> **Executado em 23/set/2026.** Estado, decisões e pendências: `docs/HANDOFF-23-SET-CATALOGO.md`.

> Para o próximo agente: leia antes `AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`
> (inteiro, a etapa 1 mexe no banco compartilhado com a Verandi) e
> `docs/HANDOFF-23-SET-MAGENTO.md`. Seja cético: o que está aqui foi conferido
> no código em 23/set, e o código ganha se discordar.

## O que o Gabriel pediu (decidido com ele em 23/set)

1. **Importar planilha** na tela de Produtos: botão "Importar", modelo de
   exemplo para baixar (CSV e Excel), sem cadastrar um a um.
2. **Conta sem Magento** (ex.: 15 serviços, nenhum CRM): o bot tem que
   buscar e mandar o card desses itens igual faz com a Magento.
3. **Produtos no Inbox**: quem atende busca por nome ou SKU, acha e manda o
   card no chat. "Não estou fazendo isso tudo só pelo bot."
4. Com Magento ligada, a tela de Produtos **não copia** o catálogo: mostra
   que ele vem da loja. Copiar criaria preço e estoque velhos (a PCYES tem
   600+ itens; a busca é ao vivo pela API).

## Como está hoje (conferido)

- `public.produtos` (migration `0079`, preço na `0091`): `id, nome, especie
  ('produto'|'servico'), preco, arquivado_em`. Serve ao CRM: `venda_itens`,
  `quadro_cartoes`, segmentação. Nome único entre ativos. Arquivar não apaga.
- Tela: `src/app/clientes/[clienteId]/ajustes/produtos/page.tsx`, ações em
  `src/server/acoes-produtos.ts`, repo `src/server/repos/produtos.ts`, regra
  em `src/core/produtos.ts`. **Sem importação. O bot não lê esta tabela.**
- Loja: interface `Loja` em `src/loja/types.ts` (`buscar`, `combinaCom`,
  `lerPorSku`, `linkDaBusca`, `lerConfig`). Implementações: `magento.ts`,
  `falsa.ts`. A conta resolve a loja em `lojaAtivaDaConta`
  (`src/server/adaptador-da-loja.ts`). Tipo do item: `ProdutoDaLoja`
  (`src/core/loja.ts`). Card: `loja_mostrar` → ação `enviar_produtos` →
  `canal.enviarProdutos` (cta_url no WhatsApp).
- Resposta do Inbox: `src/components/lead/responder.tsx`; envio de mídia
  pela equipe em `src/server/acoes-midia-do-inbox.ts` (modelo a seguir).

## Etapas (uma por commit, commit e push e deploy conferido a cada uma)

### 1. Banco: o catálogo aguenta o card

Migration nova (número: `ls supabase/migrations | tail -1`, hoje a última é
`0092`). Em `public.produtos`: `sku text`, `descricao text`, `link text`,
`foto text`, todos opcionais. Índice único parcial em `(client_id, sku)`
entre ativos com sku não nulo. `set search_path = public, extensions`.
Ensaiar no Docker local, conferir que a Verandi (`app_verandi`) não é
tocada, e **só aplicar em produção com autorização do Gabriel na sessão**.

### 2. Importar planilha

- Botão "Importar" na tela de Produtos. Aceita `.csv` e `.xlsx`.
- Modelos para baixar: `modelo-produtos.csv` e `.xlsx`, colunas
  `nome, tipo, sku, preco, descricao, link, foto`, com 3 linhas de exemplo
  (um produto, um serviço, um sem preço). `tipo` aceita "produto" ou
  "serviço" (com e sem acento). Preço aceita `1.299,90` e `1299.90`.
- Prévia antes de gravar: quantos entram, quantos atualizam (casa por sku,
  senão por nome), quantos têm erro e **qual linha e por quê**. Linha com
  erro não derruba as outras.
- Parse puro em `src/core/` com teste unitário (a parte que erra calada).
- Foto: só URL `https`. Upload de imagem fica fora desta etapa.

### 3. O catálogo vira uma `Loja`

- `src/loja/catalogo.ts` implementando `Loja` sobre `public.produtos`:
  `buscar` por nome, sku e descrição (sem acento, `normalizar` de
  `core/engine/interpolar.ts`); `lerPorSku`; `combinaCom` devolve vazio;
  `linkDaBusca` devolve o link do item ou vazio; `emEstoque` sempre `true`
  (catálogo manual não tem estoque).
- `lojaAtivaDaConta`: Magento ligada ganha; sem Magento e com catálogo ativo
  não vazio, devolve o catálogo. As consultas "Buscar produto na loja" e
  "Mandar o card" no editor passam a valer para as duas fontes.
- Serviço sem foto sai como texto com link (caminho que já existe).

### 4. Produtos no Inbox

- Botão "Produtos" no `responder.tsx`, ao lado de anexo e emoji. Abre busca
  por nome ou SKU sobre a **mesma** `lojaAtivaDaConta` (Magento ao vivo ou
  catálogo). Resultado com foto, nome, preço, estoque quando houver.
- Tocar num item manda o card (`enviarProdutos`, texto com link sem foto),
  gravado como saída da equipe (`autorDaPessoa`), com o `wa_message_id`
  devolvido (ver `confirmarEntrega(registro, waMessageId)`).
- Respeitar a janela de 24h como o envio de texto já respeita.

### 5. Tela de Produtos com Magento ligada

Aviso no topo: "O catálogo desta conta vem da loja Magento" com link para
Integrações. A lista local continua (é o CRM), mas não é preenchida da loja.

## Fora deste plano

Carrinho e pedido (etapas 2 e 3 do Magento), sincronizar Magento para a
tabela, upload de foto, estoque no catálogo manual.

## Regras da casa

Commit e push na `main` ao fim de cada etapa, e conferir o deploy `READY`
na Vercel. Sem subagente. Sem travessão. Validar com `npm run typecheck`,
teste do arquivo e `npm run build`; não rodar a suíte inteira. Mexeu em
`Acao`: rodar `src/server/efeitos/simulador-nao-escapa.test.ts`. O Gabriel é
designer: telas novas, ele olha no ar e diz o que está feio.
