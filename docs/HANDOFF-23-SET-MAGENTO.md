# Handoff 23/set/2026: Magento no bot (cross-sell), o que falta

> **Para o próximo agente: seja cético com tudo o que está escrito aqui,
> inclusive com este aviso.** Este documento foi escrito por quem fez o
> trabalho, no fim de uma sessão longa, e quem fez tende a achar que está
> certo. Cada afirmação abaixo diz se foi **provada** (com o quê) ou só
> **suposta**. Trate "suposto" como "provavelmente errado até você provar".
> Se o código ou a produção contradisserem este documento, o código e a
> produção ganham, e corrija o documento.

## Leia antes, nesta ordem

1. `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md` (obrigatório antes de encostar
   no banco; a produção é dividida com a Verandi e não tem backup).
2. `docs/superpowers/plans/2026-09-23-magento-cross-sell.md`: o plano inteiro,
   com as decisões que não se reabrem sem motivo novo. O bloco "Andamento" no
   topo foi atualizado até a Task 11.
3. `docs/INTEGRACAO-MAGENTO-23-SET.md`: a pesquisa e a sondagem real da PCYES.
4. Este arquivo.

## O contexto em quatro linhas

- Cliente: **PCYES** (`https://www.pcyes.com.br`), loja Magento. Quer o bot do
  WhatsApp vendendo com o catálogo real.
- Desenho em três etapas, decidido com o Gabriel: (1) mandar o produto
  certinho, **este trabalho**; (2) catálogo na Meta e carrinho nativo do
  WhatsApp; (3) Pix e pedido. Só a etapa 1 está em andamento.
- **Tudo é só leitura na loja.** Nada cria, altera ou apaga nada no Magento.
  Isso é regra do Gabriel ("não podemos sair apagando as coisas"), não detalhe.
- Pendências do lado da PCYES: **token de administrador** (vão gerar), **número
  de WhatsApp no AutoFluxos** (semana de 28/set), **catálogo na Meta** (ainda
  vão criar). A **conta da PCYES não existe** no AutoFluxos hoje (6 contas em
  produção, nenhuma é ela).

## O que foi feito (commits em `main`, todos com push, e push é deploy)

| Commit | O quê |
|---|---|
| `4ec9144` | pesquisa Magento |
| `c2a4645` | plano + sondagem da PCYES |
| `5cdd14a` | `src/core/loja.ts` (regra pura) + `src/loja/magento.ts` (GraphQL público) + `src/loja/falsa.ts` |
| `aa36ed2` | migration `0092_lojas_integradas`, **aplicada em produção** |
| `85e0044` | `src/server/repos/lojas.ts` + `src/server/adaptador-da-loja.ts` |
| `17b5d30` | ferramentas `loja_buscar` e `loja_combina_com`; `chamada` virou união `http`/`loja`; resolvedor |
| `29ebe1f` | tela Integrações › Loja Magento; conserto do ciclo de import em `http.ts` |
| `eb798f8` | editor: seção de loja no bloco de IA; validador não exige credencial para loja |
| `78c7628` | `src/loja/magento-admin.ts`: token, só GET, foto e estoque |
| `bb7c052` | `src/loja/enriquecer.ts`: foto e quantidade por cima da busca pública, prazo 3 s |
| `5578898` | tela do token + `docs/GUIA-MAGENTO-LOJISTA.md` |

## O que foi provado, e com o quê

- **GraphQL público da PCYES**: `curl` de 23/set. Aberto, 200, preço e estoque
  vêm, `product_url_suffix` é `null` (link sem `.html`, conferido 200).
  `traduzirProdutos` rodado contra a resposta real de "headset": promoção de/por,
  esgotado e link corretos.
- **0092**: ensaio em transação contra a produção (as três travas recusaram o
  que deviam) e releitura objeto a objeto depois de aplicar; Verandi intacta
  (35 migrations, 42 tabelas, 16 policies); PostgREST 200/401 nos dois
  produtos. Registrado em `docs/BANCO-COMPARTILHADO.md`.
- **Testes unitários** dos arquivos novos e dos vizinhos que mudaram: passam.
  `npm run typecheck`, `eslint` nos arquivos tocados e `npm run build` limpos.
  A **suíte inteira não foi rodada** (preferência do Gabriel; rode por arquivo).
- **A vitrine do link público não consulta a loja**: ela não passa
  `clienteId`, e sem conta `executarNaLoja` recusa antes de procurar a loja
  (teste em `resolver-loja.test.ts`, trava de texto em
  `simulador-nao-escapa.test.ts`).
- **A página nova existe em produção**: `/clientes/<id>/ajustes/integracoes/magento`
  responde 307 para `/entrar` (não 404, não 500).

## O que NÃO foi provado (suponha que pode estar errado)

1. **Nenhuma tela foi vista renderizada.** O painel pede login e a sessão não
   tinha acesso. Tela da loja, seção do token, card em Integrações e a seção de
   loja no editor foram escritas pelas classes das telas vizinhas, às cegas. O
   Gabriel é designer: **peça um acesso ou que ele abra e aponte**, e revise
   espaçamento, hierarquia, estado de carregamento (o teste leva 2 a 3 s e só
   o texto do botão muda) e o layout em celular.
2. **Cloudflare contra a Vercel.** A PCYES tem Cloudflare na frente. Daqui
   (WSL) não barrou nem sem user-agent. **Da Vercel ninguém testou.** O primeiro
   clique em "Testar conexão" em produção é essa prova.
3. ~~`src/server/repos/lojas.test.ts` nunca rodou.~~ **Rodou em 23/set**, no
   Docker local com replay 0001 a 0092: 9 de 9 passam.
4. **Todo o caminho do token é suposição sobre a API da Adobe**, testado só com
   rede falsa:
   - `GET /rest/V1/inventory/stock-resolver/website/base`: supõe que o código
     do site é `base`. A PCYES pode usar outro.
   - `GET /rest/V1/inventory/get-product-salable-quantity/{sku}/{stockId}`:
     supõe que devolve um número inteiro.
   - `GET /rest/V1/products/{sku}/media` e a URL montada como
     `{endereco}/media/catalog/product{file}`. **Esta é a suspeita mais forte
     da lista:** o GraphQL público da PCYES devolve placeholder em 100% dos
     produtos, e o site mostra foto real. Uma explicação provável é imagem em
     storage remoto ou CDN, e nesse caso a URL montada dá 404. **Com o token em
     mãos, faça `curl -I` na URL de foto de três produtos antes de ligar
     qualquer coisa que dependa dela.**
   - Os nomes de permissão (ACL) no `docs/GUIA-MAGENTO-LOJISTA.md` são
     aproximados. O próprio guia diz isso ao lojista.
   - O `chamarHttp` só manda credencial para a mesma origem. Se `/rest` da
     PCYES redirecionar (ex.: sem `www` para com `www`), o token cai no salto e
     a resposta vira 401. Não testado.

## Bugs e fraquezas conhecidos, em ordem de gravidade

1. ~~BUG: apagar a Conexão do token pela tela de Chaves de API falha.~~
   **Provado e consertado em 23/set.** O teste em `src/server/repos/lojas.test.ts`
   falhou no Docker com `violates check constraint "lojas_estoque_exige_token"`.
   Conserto sem migration: `apagarConexao` (`src/server/repos/conexoes.ts`)
   desliga o estoque exato da loja que aponta para a Conexão antes do delete.
   A Conexão do token também saiu do seletor de credencial do editor e da
   tela de horário, e a publicação recusa fluxo que aponte para ela
   (`listarConexoesParaFluxos`). Na tela de Chaves ela continua.
2. ~~Produto configurável mostra o menor preço como se fosse o preço.~~
   **Consertado em 23/set:** `maximum_price` entra na query e, quando é maior
   que o mínimo, o produto vem com `precoAPartirDe` no lugar de `preco` (sem
   de/por), e o card diz "a partir de". Sondagem real no mesmo dia: a PCYES
   aceita o campo, e as 20 cadeiras de "cadeira" são `SimpleProduct` com mínimo
   igual ao máximo (cada cor é um SKU). Na PCYES o caso quase não acontece.
3. ~~Busca vazia vira "não temos".~~ **Consertado em 23/set:** busca vazia
   devolve ao modelo `buscaNaLoja` (`{endereco}/catalogsearch/result/?q=`,
   200 na PCYES), e a descrição manda oferecer o link em vez de negar. A
   suposição do "mínimo de 3 letras" estava errada para a PCYES: `pc` traz 603
   produtos e `mo` traz 131 (GraphQL real, 23/set).
4. **Não há aviso de token revogado.** O plano pedia a tela avisar "o token
   parou de funcionar". Não foi feito: o bot cai para "tem / não tem" em
   silêncio e a tela mostra o estado salvo, não um teste ao vivo.
5. **`loja_combina_com` vai responder vazio quase sempre na PCYES.** Em 87
   produtos sondados, `crosssell` e `upsell` vazios em todos, `related` em 6.
   Não é bug, é dado da loja; a tela avisa o lojista.

## O que falta, em ordem

### A. Consertar o bug 1: feito (ver acima)

### B. Task 10b: feita em 23/set

Como ficou, para quem for mexer:

- Ferramenta `loja_mostrar` (`src/core/ferramentas.ts`): até 3 SKUs, em três
  argumentos (`produtoId`, `produtoId2`, `produtoId3`), todos pela trava
  `soDeResultadoAnterior`. A memória de ids é **por rodada**: produto de uma
  mensagem anterior exige nova busca, e a descrição manda o modelo buscar de
  novo (buscar + mostrar cabem nas 2 voltas).
- O resolvedor relê os SKUs na loja (`Loja.lerPorSku`, GraphQL com `sku: { in }`
  como variável) e devolve os produtos junto do texto. Só saem se a resposta
  sair; `nao_sei` e `confirmar` descartam os cards.
- Ação nova `enviar_produtos`, posta logo depois da frase da IA.
- Aplicador (`receber-mensagem.ts`): foto real e canal com `enviarProdutos`
  viram card; o resto vira texto com o link. O histórico guarda o texto do
  card (nome, preço, estoque, link), e o `payload` guarda o produto.
- WhatsApp: um `cta_url` por produto. Instagram: um `generic` com um elemento
  por produto. Telegram: texto com link. Limites conferidos na doc da Meta.
- A janela de 24h já é conferida antes de falar fora do webhook
  (`receber-mensagem.ts`, `dentroDaJanela`); dentro do webhook está aberta por
  definição.

Provado: testes unitários do JSON exato para a Meta, do resolvedor e da regra
pura; `src/server/card-do-produto.test.ts` (integração, Docker) do webhook até
o canal e o histórico. **Não provado:** o card renderizado num WhatsApp ou
Instagram de verdade, e a URL da foto (depende do token, item 4 acima). O
Inbox mostra o card como texto, não como card.

### C. Task 8: ligar na PCYES e provar

Depende de a conta da PCYES existir. Enquanto isso, dá para testar na conta
"Cliente 00, do Gabriel" (`4d26cf4c-7c49-485a-8819-68da3931c530`), **com o
Gabriel sabendo**. Passos no plano. O teste de Cloudflare/Vercel (item 2 da
lista de não provados) acontece aqui.

### D. Task 12: com o token real

Passos no plano. Acrescente, antes de tudo: `curl -I` nas URLs de foto (item 4
da lista de não provados) e confira o código do site para o stock-resolver.
Corrija o guia do lojista com os nomes reais de ACL.

## Regras da casa que já custaram caro

- **Migration primeiro, deploy depois.** Push na `main` é deploy (Vercel).
  Código que lê objeto novo publicado antes da migration derruba tela.
- **Nunca** `supabase db push`/`db reset` contra produção. Aplicar em produção
  **só com autorização explícita do Gabriel na sessão**; a de hoje valeu só
  para a 0092. Número da próxima migration: `ls supabase/migrations | tail -1`
  (hoje a última é a `0092`, mas confira).
- Banco de produção pela Management API: `SUPABASE_ACCESS_TOKEN` do
  `../.secrets/4yu.env` + ref literal `xxxynoshwirupkdzwxbj`
  (`POST https://api.supabase.com/v1/projects/<ref>/database/query` com
  `{"query": "..."}`). O cofre desta máquina **não** tem as `AUTOFLUXOS_*`
  que os runbooks antigos citam.
- **Sem travessão** em nenhum arquivo, novo ou antigo que você abrir.
- Commit e push ao fim de cada tarefa, sem perguntar.
- Implementar inline, sem subagente (preferência do Gabriel).
- Validar com `npm run typecheck`, o arquivo de teste da tarefa e
  `npm run build`; não rodar a suíte inteira.
- Segredo (token do Magento) nunca em log, doc, commit ou retorno de ação.
- Resposta ao Gabriel: curta, decisão tomada, link clicável quando mandar ele a
  um painel externo.

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/core/loja.ts` | regra pura: endereço, queries, tradução, link |
| `src/loja/types.ts` | interface `Loja`, `ViaDeEstoque` |
| `src/loja/magento.ts` | GraphQL público (GET, termo como variável) |
| `src/loja/magento-admin.ts` | token: só GET, lista fixa de caminhos |
| `src/loja/enriquecer.ts` | foto/quantidade por cima, prazo total |
| `src/loja/falsa.ts` | loja em memória para teste |
| `src/server/repos/lojas.ts` | `public.lojas_integradas`; não apaga linha |
| `src/server/adaptador-da-loja.ts` | monta a loja da conta, com ou sem token |
| `src/server/acoes-loja.ts` | ações da tela (testar, ligar, desligar, token) |
| `src/components/cliente/loja-magento.tsx` | a tela |
| `src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx` | a rota |
| `src/core/ferramentas.ts` | `loja_buscar`, `loja_combina_com`, união `ChamadaDeFerramenta` |
| `src/server/efeitos/resolver.ts` | `executarNaLoja`, credencial só para HTTP |
| `src/core/flow/validar.ts` | credencial exigida só para ferramenta HTTP |
| `src/components/editor/painel.tsx` | `ConsultasDaIa`: seção de loja |
| `supabase/migrations/0092_lojas_integradas.sql` | a tabela |
| `docs/GUIA-MAGENTO-LOJISTA.md` | o que o técnico da loja segue |
