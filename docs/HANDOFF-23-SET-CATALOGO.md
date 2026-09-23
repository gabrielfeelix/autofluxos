# Handoff 23/set/2026: catálogo de produtos (bot, Inbox e planilha)

> Para o próximo agente: seja cético. O que está marcado como provado diz com
> o quê; o resto é suposição. Se o código ou a produção discordarem, eles
> ganham e você corrige este arquivo.

Plano executado: `docs/superpowers/plans/2026-09-23-catalogo-de-produtos.md`
(as 5 etapas). Antes de mexer no banco: `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md`.
Contexto do Magento: `docs/HANDOFF-23-SET-MAGENTO.md`.

## O que foi feito (tudo em `main`, com push; deploy `034d8dd` READY)

| Commit | O quê |
|---|---|
| `b211466` | migration `0093`: `produtos.sku/descricao/link/foto` + índice único parcial de sku. **Aplicada em produção** (registro em `BANCO-COMPARTILHADO.md`) |
| `68d0c59` | importar planilha `.csv`/`.xlsx` na tela de Produtos, modelos em `/api/modelos/produtos?formato=xlsx|csv`, prévia com erro por linha |
| `e760fe6` | `src/loja/catalogo.ts`: catálogo da conta vira `Loja`; `lojaAtivaDaConta` cai nele sem Magento |
| `8626880` | `?` ao lado do título com passo a passo (`components/design/ajuda-da-tela.tsx`, reusável), descrição de 2 linhas, arrastar planilha |
| `4108338` | telefone de WhatsApp como `+55 (44) 99877-5978` (tela do WhatsApp, quadro, cartão de contato, ficha) |
| `5e736ef` | Inbox: botão de sacola, busca por nome/SKU, tocar manda o card (`server/acoes-produtos-do-inbox.ts`) |
| `53c468a` | tela de Produtos avisa quando o catálogo vem da Magento |
| `034d8dd` | achados da revisão final (editor liberado para catálogo, paginação >1000, CSV Windows-1252, separador pelo cabeçalho, teto do xlsx, `HTTPS` maiúsculo, erros na tela) |

## Decisões (não reabrir sem motivo novo)

- **Célula vazia não apaga** na reimportação. Apagar é no botão do item.
- Casa por **SKU, senão por nome**; arquivado não entra no casamento.
- **Card exige foto e link**; só foto vira texto com link (o `cta_url` sem url a Meta recusa).
- Catálogo não tem estoque: `semControleDeEstoque` tira o "em estoque" do card.
- `produtoId` do catálogo é `sku ?? id`; `lerPorSku` aceita os dois.
- Magento ligada ganha do catálogo; a tabela nunca é preenchida com a loja.
- Dependência nova: `fflate` (abrir e gerar o `.xlsx`).

## Provado, e com o quê

- Banco: replay 0001 a 0093 no Docker; travas (sku duplicado sem caixa, `http://`, arquivar libera sku); ensaio em transação na produção; REST 200/401 e Verandi 200.
- Unitários: `core/planilha`, `core/importar-produtos`, `core/modelo-de-produtos`, `loja/catalogo`, `core/loja`, canais, efeitos, ferramentas (417 passam).
- Integração (Docker): `server/repos/produtos.test.ts` 17/17 (importar, reimportar, lote recusado, >1000 itens).
- Typecheck e build limpos.

## NÃO provado (pendências)

### Do Gabriel (precisa de login ou olho de designer)

1. **Olhar as telas no ar**, nenhuma foi vista renderizada:
   - Produtos (importar, arrastar, `?`): https://autofluxos.4yu.com.br/clientes/4d26cf4c-7c49-485a-8819-68da3931c530/ajustes/produtos
   - Sacola no Inbox: https://autofluxos.4yu.com.br/clientes/4d26cf4c-7c49-485a-8819-68da3931c530/leads
   - Número formatado: https://autofluxos.4yu.com.br/clientes/4d26cf4c-7c49-485a-8819-68da3931c530/ajustes/whatsapp
2. **Baixar o modelo `.xlsx` e abrir no Excel de verdade** (só foi provado que ele volta pela nossa leitura).
3. **Importar uma planilha real** de cliente (ex.: 15 serviços) na Cliente 00.
4. **Ligar no bot da Cliente 00**: editor, bloco de IA, marcar "Buscar produto na loja" e "Mandar o card", publicar, e perguntar pelo WhatsApp por um item do catálogo. O card com foto chegando é a prova.
5. **Mandar um produto pela sacola do Inbox** e ver chegar no celular.

### Do agente, sem depender de ninguém (minors adiados da revisão)

- `.xlsx` com prefixo de namespace (`<x:c>`, alguns exportadores .NET) lê vazio.
- Aspas soltas no meio de célula sem aspas no CSV (`TV 32"`) bagunçam a leitura.
- `r:id` do workbook entra num `RegExp` sem escape (`core/planilha.ts`).
- Atualização que acerta 0 linhas (item arquivado entre prévia e confirmação) conta como atualizado.
- Chave de nome sem acento na importação x índice do banco com acento ("Pão"/"Pao").
- Catálogo lido inteiro a cada busca do bot e a cada tecla da sacola (ok no tamanho de hoje).
- Card do produto no Inbox aparece como texto, não card (mesma decisão do Magento).
- Upload de foto (hoje só URL `https`) e estoque no catálogo manual: fora do plano.

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `supabase/migrations/0093_catalogo_com_card.sql` | colunas novas |
| `src/core/planilha.ts` | CSV e xlsx em linhas, com número da linha real |
| `src/core/importar-produtos.ts` | linha em item, erros, casamento (`planejarImportacao`) |
| `src/core/modelo-de-produtos.ts` + `src/app/api/modelos/produtos/route.ts` | modelo para baixar |
| `src/server/acoes-importar-produtos.ts` | prévia e gravação (arquivo relido na confirmação) |
| `src/server/repos/produtos.ts` | `gravarImportacao`, `listarProdutos` paginado, `temProdutoAtivo` |
| `src/components/produtos/importar-planilha.tsx` | modal de importação |
| `src/loja/catalogo.ts` | catálogo como `Loja` |
| `src/server/adaptador-da-loja.ts` | Magento ganha, senão catálogo |
| `src/server/acoes-produtos-do-inbox.ts`, `src/components/lead/seletor-de-produto.tsx` | sacola do Inbox |
| `src/components/design/ajuda-da-tela.tsx` | `?` com passo a passo, reusável em outras telas |
