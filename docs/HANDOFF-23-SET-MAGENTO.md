# Handoff 23/set/2026: Magento da PCYES no bot (etapa 1, o produto certinho)

> **Para o próximo agente: seja cético com tudo o que está escrito aqui.** Cada
> afirmação diz se foi **provada** (e com o quê) ou só **suposta**. Trate
> "suposto" como "provavelmente errado até você provar". Nesta mesma sessão,
> três suposições do handoff anterior caíram quando alguém olhou a loja de
> verdade (foto, busca curta, nomes de permissão). Se o código ou a produção
> disserem outra coisa, eles ganham, e você corrige este documento.

## Leia antes, nesta ordem

1. `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md`: obrigatório antes de encostar
   no banco. A produção é dividida com a Verandi e não tem backup.
2. Este arquivo.
3. Se precisar do porquê de uma decisão: `docs/superpowers/plans/2026-09-23-magento-cross-sell.md`
   (o plano, com as decisões que não se reabrem sem motivo novo) e
   `docs/INTEGRACAO-MAGENTO-23-SET.md` (a pesquisa e a primeira sondagem).

## Depois deste handoff (23/set, tarde)

- **Próximo trabalho decidido**: catálogo de produtos (importar planilha,
  bot sem Magento, produtos no Inbox). Plano em
  `docs/superpowers/plans/2026-09-23-catalogo-de-produtos.md`.
- Inbox, no ar: menu do bot embaixo da bolha com a opção tocada, toque em
  verde, motivo do `unsupported` guardado (`083e6e6`, `b33ff74`, `0527eec`).
- Saída do bot e da equipe passou a gravar `wa_message_id` (antes, 0 de 99).
  Só vale para mensagens novas.
- Nome em mensagem sai "Daniel", nunca `*DANIEL*` (`3bb4f58`,
  `core/engine/interpolar.ts`).
- Não provado: os nomes de `motivoDoNaoSuportado` (`enquete`, `mensagem
  editada`) são suposição sobre o `unsupported.type` da Meta; conferir no
  primeiro caso real (`messages.payload`).

## O contexto em cinco linhas

- Cliente: **PCYES** (`https://www.pcyes.com.br`), loja Magento. Quer o bot do
  WhatsApp vendendo com o catálogo real.
- Três etapas, decididas com o Gabriel: (1) mandar o produto certinho, **este
  trabalho**; (2) catálogo na Meta e carrinho nativo do WhatsApp; (3) Pix e
  pedido. Só a etapa 1 existe. As outras são planos futuros.
- **Tudo é só leitura na loja.** Nada cria, altera ou apaga nada no Magento.
  Regra do Gabriel ("não podemos sair apagando as coisas").
- O **código da etapa 1 está pronto e no ar**. O que falta é ligar numa conta
  e ver funcionando com gente de verdade, e isso depende do Gabriel (seção
  "A parte do Gabriel").
- A **conta da PCYES não existe** no AutoFluxos. Há 6 contas em produção,
  nenhuma é ela.

## A parte do Gabriel (é isto que ele vai te perguntar)

Tudo aqui depende de login no painel, de decisão comercial ou da PCYES. O
agente não tem acesso ao painel (ele pede login) e não deve criar conta nem
ligar nada em produção sem o Gabriel.

Responda a ele com esta lista, nesta ordem, e **com o link de cada tela**
(regra da casa: sem link clicável não vale).

### 1. Decidir onde testar primeiro

Duas opções:

- **Agora, na conta "Cliente 00, do Gabriel"** (`4d26cf4c-7c49-485a-8819-68da3931c530`),
  que já existe e tem o WhatsApp de teste dele. Recomendado: prova tudo antes
  de a PCYES ter número.
- **Esperar a conta da PCYES**, que só faz sentido quando o número de
  WhatsApp dela entrar (previsto para a semana de 28/set).

### 2. Ligar a loja na conta escolhida (5 minutos, no painel)

1. Abrir a tela. Na Cliente 00:
   https://autofluxos.4yu.com.br/clientes/4d26cf4c-7c49-485a-8819-68da3931c530/ajustes/integracoes/magento
   (responde 307 para o login, conferido em 23/set). Em outra conta, troque o
   id.
2. Endereço: `https://www.pcyes.com.br`. Clicar em **Testar conexão**. Tem
   que aparecer uma amostra de 3 produtos com preço.
   - Se der erro aqui, **mande o texto do erro ao agente**: é a primeira vez
     que a Vercel fala com a PCYES, que tem Cloudflare na frente (ver
     "Não provado", item 2).
3. Clicar em **Ligar**.
4. Olhar a tela com olho de designer e dizer o que está feio ou confuso:
   **ninguém viu essa tela renderizada ainda**.

### 3. Ligar no fluxo da conta (no editor)

1. Abrir o fluxo que atende o WhatsApp da conta.
2. No bloco de **IA**, marcar as consultas **Buscar produto na loja**,
   **Mandar o card do produto** e, se quiser, **Sugerir o que combina**.
3. Conferir que a conta tem o **contexto do negócio** escrito e a **IA
   contratada** no fluxo. Sem isso a publicação recusa, e o próprio editor
   diz o motivo.
4. **Publicar**.

### 4. Testar pelo WhatsApp dele

Mandar para o número da conta, do celular dele:

- "vocês têm headset?" (tem que responder com preço real);
- "me manda o link do primeiro" (tem que chegar o **card com foto** e o
  botão "Ver na loja");
- "quanto custa a cadeira sentinel?";
- uma coisa que a PCYES não vende, tipo "vocês vendem geladeira?" (não pode
  inventar produto; tem que oferecer o link de busca da loja ou dizer que não
  achou).

Mandar ao agente um print ou o texto do que chegou. **O card com foto
chegando é a prova que falta** (ver "Não provado", item 1).

### 5. Pedir o token à PCYES (opcional agora)

O token passou a servir **só para dizer quantas unidades restam**. A foto já
vem sem ele. Não é bloqueio para ligar.

- Mandar ao técnico da loja o `docs/GUIA-MAGENTO-LOJISTA.md` (tem o passo a
  passo e os nomes de permissão que a própria loja informou).
- Quando o token chegar, colar na mesma tela do passo 2, seção "Estoque
  exato". Depois disso, é a Task 12 do agente (abaixo).

### 6. Da PCYES, fora do nosso controle

- Número de WhatsApp da PCYES conectado ao AutoFluxos (semana de 28/set).
- Conta da PCYES criada no AutoFluxos (o Gabriel cria no painel, ou pede ao
  agente o caminho). Depois, repetir os passos 2 a 4 nela.
- Catálogo na Meta: só para a etapa 2, que ainda não tem plano.

## O que já está feito (tudo em `main`, com push; push na `main` é deploy)

| Commit | O quê |
|---|---|
| `4ec9144`, `c2a4645` | pesquisa Magento, plano e sondagem da PCYES |
| `5cdd14a` | `src/core/loja.ts` (regra pura), `src/loja/magento.ts` (GraphQL público), `src/loja/falsa.ts` |
| `aa36ed2` | migration `0092_lojas_integradas`, **aplicada em produção** |
| `85e0044` | `src/server/repos/lojas.ts`, `src/server/adaptador-da-loja.ts` |
| `17b5d30` | ferramentas `loja_buscar` e `loja_combina_com`, resolvedor |
| `29ebe1f` | tela Integrações › Loja Magento |
| `eb798f8` | editor: consultas de loja no bloco de IA |
| `78c7628`, `bb7c052`, `5578898` | token de administrador (só GET), tela do token, guia do lojista |
| `999ff51` | **bug**: apagar o token pela tela de Chaves de API falhava (check da 0092); consertado sem migration |
| `a7f96cb` | **card do produto** (`loja_mostrar`): WhatsApp `cta_url`, Instagram `generic`, texto com link sem foto |
| `84c3f07` | produto com variações de preço sai como "a partir de" |
| `71c2ddd` | busca vazia oferece o link de busca da loja; vitrine pública não chega na loja; auditoria do `enviar_produtos` |
| `5af0d0a` | token da loja fora do seletor de credencial dos fluxos, e a publicação recusa |
| `ffa2482` | **foto real sem token** (via `/V1/products/{sku}`), aviso de token revogado na tela e em alerta |

### Como o bot usa a loja, hoje

- `loja_buscar`: busca no GraphQL público (sem credencial). Com token,
  acrescenta a quantidade exata. Vazio devolve `buscaNaLoja`, o link da busca
  do site.
- `loja_combina_com`: o "combina com" que o lojista cadastrou. Na PCYES quase
  sempre vazio (dado da loja, não bug: em 87 produtos, `crosssell` vazio em
  todos e `related` em 6).
- `loja_mostrar`: a IA escolhe até 3 produtos que **a mesma resposta** já
  viu (trava `soDeResultadoAnterior`; a memória de ids é por rodada, então
  produto de mensagem anterior exige nova busca, e buscar mais mostrar cabem
  nas 2 voltas). O resolvedor relê o preço na loja, busca a foto e devolve a
  ação `enviar_produtos`, que sai logo depois da frase da IA.
- Aplicador (`src/server/receber-mensagem.ts`, `case 'enviar_produtos'`):
  foto real e canal com `enviarProdutos` viram card; o resto vira texto com
  link. O histórico (Inbox) guarda o texto do card; `payload` guarda o
  produto.
- Foto: `GET /rest/V1/products/{sku}` **sem credencial**, lendo
  `media_gallery_entries`. URL absoluta `https` vai como está (caso da
  PCYES, CDN `cdn.oderco.com.br`); caminho relativo vira
  `{endereco}/media/catalog/product{file}`. Com 401 e havendo token, tenta de
  novo com ele. Foto só é buscada para o card, não em toda busca.
- Token: só estoque (MSI ou legado). A tela confere o token ao abrir
  (`estadoDoToken`, pelo caminho de estoque) e mostra "A loja recusou o
  token". Na conversa, recusa vira `alertar` uma vez por conta por dia.

## O que foi provado, e com o quê

- **GraphQL público da PCYES** (curl, 23/set): aberto, preço e estoque vêm,
  link sem `.html`. Aceita `maximum_price`. Termo de 2 letras funciona (`pc`
  traz 603). As cadeiras são `SimpleProduct`, uma por cor.
- **REST da PCYES responde a anônimo** (curl, 23/set): `/V1/products/{sku}`
  traz a galeria com a URL do CDN, e o CDN responde 200 `image/png`.
  `/V1/products/{sku}/media` responde **400** com ou sem token. Estoque
  (`stock-resolver`, `stockItems`, `get-product-salable-quantity`) responde
  **401** sem token, com os códigos `Magento_InventorySalesApi::stock` e
  `Magento_Catalog::catalog_inventory`. A página `catalogsearch/result` é 200.
- **Banco**: a 0092 foi ensaiada e conferida em produção (Verandi intacta).
  No Docker local, replay 0001 a 0092 limpo.
- **Testes de integração no Docker** (Supabase local): `src/server/repos/lojas.test.ts`
  (10, inclui o bug do token e a lista sem o token) e
  `src/server/card-do-produto.test.ts` (do webhook até o canal e o histórico,
  com modelo e loja falsos); `src/server/receber-mensagem.test.ts` inteiro
  continua passando.
- **Unitários**: `src/core`, `src/loja`, `src/channels`, `src/server/efeitos`,
  adaptador e ações da loja passam. Typecheck, eslint dos tocados e build
  limpos. A suíte inteira não é rodada (preferência do Gabriel).
- **JSON para a Meta**: testes com o corpo exato do `cta_url` e do `generic`.
  Limites conferidos na documentação da Meta em 23/set (corpo 1024, botão 20;
  generic até 10 elementos, título e subtítulo 80).

## O que NÃO foi provado (suponha que pode estar errado)

1. **O card num WhatsApp de verdade.** A URL da foto do CDN não tem extensão;
   o `content-type` é `image/png`. Supõe-se que a Meta aceita pelo tipo. Se o
   card não chegar, o erro volta da Cloud API e a conversa vai para uma
   pessoa (a entrega que falha para no humano). É o passo 4 do Gabriel.
2. **Vercel contra o Cloudflare da PCYES.** Do WSL nunca barrou. Da Vercel
   ninguém testou. O primeiro "Testar conexão" em produção é a prova.
3. **Nenhuma tela foi vista renderizada.** Tela da loja, seção do token, aviso
   de token recusado, card em Integrações, consultas de loja no editor: tudo
   escrito pelas classes das telas vizinhas, às cegas. O Gabriel é designer:
   peça que ele olhe (passo 2.4).
4. **Caminho do token com token real**: `stock-resolver/website/base` supõe o
   código de site `base`; `get-product-salable-quantity` supõe número inteiro;
   o `chamarHttp` só manda credencial para a mesma origem, e um redirecionamento
   de `/rest` derrubaria o token. Tudo isso é a Task 12.
5. **Instagram**: o `generic` só foi testado pelo JSON. Nenhuma conta com
   Instagram usa loja hoje.
6. **Inbox**: o card aparece como texto (nome, preço, link), não como card.
   Decisão consciente, não bug; se o Gabriel quiser card no Inbox, é trabalho
   de tela novo.

## O que falta do lado do agente

### Task 8: ligar e provar (depende dos passos 1 a 4 do Gabriel)

Quando o Gabriel ligar e testar:

- Conferir no log de chamadas da IA (`src/server/repos/ia-chamadas.ts`, tabela
  de chamadas em produção, **só leitura**) que `loja_buscar` e `loja_mostrar`
  aparecem com `ok` e sem nada sensível.
- Se o card não chegar: ler o alerta e o erro da Cloud API. Suspeita número
  um: a URL do CDN sem extensão. Saída provável: mandar como texto com link
  (já é o caminho sem foto) até entender.
- Anotar o resultado em `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção "Em
  produção", com data.

### Task 12: com o token real (depende do passo 5 do Gabriel)

- Conectar o token na tela; conferir que o teste diz MSI ou legado.
- Conferir a quantidade de 2 produtos contra o painel do Magento dela
  (quantidade vendável, não a física).
- Desconectar e conferir que o segredo sumiu do Vault e o bot voltou a "tem
  / não tem". Reconectar.
- Corrigir o guia do lojista se os nomes de tela da versão dela forem outros.

### Pequenos, sem depender de ninguém

- Card do produto no Inbox, se o Gabriel quiser (hoje é texto).
- O alerta de token recusado é por instância de servidor (memória); em várias
  instâncias pode repetir no mesmo dia. Aceitável hoje.

## Como trabalhar aqui (regras que já custaram caro)

- **Banco de produção**: nada sem autorização explícita do Gabriel **na
  sessão**. Nunca `supabase db push`/`db reset` contra produção. Leitura pela
  Management API: `SUPABASE_ACCESS_TOKEN` de `../.secrets/4yu.env` e o ref
  literal `xxxynoshwirupkdzwxbj`. Migration primeiro, deploy depois. Próximo
  número: `ls supabase/migrations | tail -1` (hoje a última é a 0092).
- **Docker local**: o Gabriel liga o Docker Desktop. `npx supabase start` sobe o
  stack nas portas `5643x`. Se disser "from backup" e a última migration
  local for antiga, `npx supabase db reset --local` refaz do zero (é local, o
  `config.toml` não está ligado a projeto remoto). Os testes de integração
  leem `.env.teste-local` (fora do git; já existe nesta máquina apontando para
  `http://127.0.0.1:56431`). Rodar um arquivo:
  `npx vitest run --config vitest.integration.config.ts <arquivo>`. Arquivo
  novo de integração entra em `test/suites.ts`.
- **Validação**: `npm run typecheck`, o teste do arquivo que você mexeu
  (`npx vitest run --config vitest.unit.config.ts <arquivo>`) e `npm run build`.
  Não rode a suíte inteira. **Mas rode `src/server/efeitos/simulador-nao-escapa.test.ts`
  sempre que mexer em `Acao`**: ele cobra auditoria de toda ação nova, e o
  commit do card ficou vermelho por não ter rodado ele.
- **Nenhum `switch` sobre ação é exaustivo no tipo.** Ação nova compila sem o
  `case` e some em silêncio. Os lugares: `src/server/receber-mensagem.ts`
  (aplicador), `src/components/conversa.tsx` (simulador).
- Commit e push ao fim de cada tarefa, sem perguntar. Sem subagente. Sem
  travessão em nenhum arquivo. Respostas curtas ao Gabriel, decisão tomada,
  link clicável para painel externo.
- Token do Magento nunca em log, doc, commit ou retorno de ação.

## Onde está cada coisa

| Arquivo | Papel |
|---|---|
| `src/core/loja.ts` | regra pura: queries GraphQL, tradução, "a partir de", card em texto, link de busca |
| `src/loja/types.ts` | interface `Loja` (`buscar`, `combinaCom`, `lerPorSku`, `linkDaBusca`, `lerConfig`) |
| `src/loja/magento.ts` | GraphQL público (GET, termo e SKUs como variável) |
| `src/loja/magento-admin.ts` | REST: foto sem token, estoque e conferência com token; só GET, lista fixa |
| `src/loja/enriquecer.ts` | foto e quantidade por cima, prazo total de 3 s |
| `src/loja/falsa.ts` | loja em memória para teste |
| `src/server/adaptador-da-loja.ts` | monta a loja da conta; `estadoDoToken`; alerta de recusa |
| `src/server/repos/lojas.ts` | `public.lojas_integradas` |
| `src/server/repos/conexoes.ts` | `apagarConexao` desliga o estoque antes; `listarConexoesParaFluxos` |
| `src/server/acoes-loja.ts` | ações da tela (testar, ligar, desligar, token) |
| `src/core/ferramentas.ts` | `loja_buscar`, `loja_combina_com`, `loja_mostrar` |
| `src/server/efeitos/resolver.ts` | `executarNaLoja`, cards junto do texto (`comCards`) |
| `src/core/engine/types.ts` | ação `enviar_produtos` |
| `src/channels/cloud-api.ts`, `instagram.ts`, `types.ts` | `enviarProdutos` |
| `src/server/receber-mensagem.ts` | aplicador do card |
| `src/components/conversa.tsx` | card no simulador |
| `src/components/cliente/loja-magento.tsx` e `src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx` | a tela |
| `supabase/migrations/0092_lojas_integradas.sql` | a tabela |
| `docs/GUIA-MAGENTO-LOJISTA.md` | o que o técnico da loja segue para gerar o token |
