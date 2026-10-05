# Decisões

Append-only. Cada entrada: data, decisão, porquê, onde está no código.

## 01/out/2026: chat do site no estilo tawk.to

- **Visitante do site não junta com o contato do WhatsApp de mesmo número.**
  O telefone do formulário não é verificado: qualquer um digita o número de
  outra pessoa. Juntar daria ao navegador do visitante (que lê a conversa pelo
  segredo) o histórico do WhatsApp do dono do número. O número fica em
  `campos.whatsapp` do contato do site, com origem `contato`; a equipe junta à
  mão se quiser. `src/server/receber-do-site.ts` (`guardarFicha`).
- **Formulário vai junto da primeira mensagem**, não numa rota própria: contato
  sem mensagem continua sendo robô testando a rota. Conferido antes do 202
  (`lerFicha` em `src/core/chat-do-site.ts`); erro volta ao formulário.
- **`pedirContato` antigo vira formulário**: `true` → nome obrigatório +
  WhatsApp opcional; `false` → sem formulário. Sem migration de dados, na leitura
  (`lerFormulario`).
- **Recentes sem login**: o servidor tem um fio por visitante; o balão guarda no
  `localStorage` o `ref` da primeira mensagem de cada conversa e fatia o fio por
  essas marcas. CPF e demais dados do formulário nunca vão para o
  `localStorage`. `public/chat/v1.js` (`conversas`, `marcar`).
- **Pergunta própria** grava em `campos.<chave da pergunta>` e cria a definição
  em `campos_definidos` (texto curto) só se a chave não existir.

## 01/out/2026: ligação de voz no chat do site

- **Áudio de navegador para navegador (WebRTC), sem servidor de mídia.** O
  servidor só guarda a sinalização em `public.chamadas` (0118): a oferta do
  visitante e a resposta do atendente, cada uma com todos os candidatos ICE
  dentro, então são duas escritas e nenhuma conexão longa na Vercel.
  `src/server/chamadas.ts`.
- **O Inbox toca pelo stream que já existe** (`/inbox/stream`, evento
  `chamadas`), só em conta com a opção ligada. Toca para quem está com o Inbox
  aberto; o primeiro que atende leva (`update ... where status = 'chamando'`).
- **Só STUN por padrão.** Rede com NAT simétrico (empresa, parte do 4G) precisa
  de TURN, que entra pela variável `CHAMADA_ICE_SERVERS` sem mudar código.
- **Só o visitante liga, e só depois da primeira mensagem**: contato sem
  conversa é robô, e o Inbox não toca para ele.

## 01/out/2026: ligação pelo WhatsApp pausada

- **Pausada pelo dono na fase 0**, antes de qualquer tela. Retomar pelo
  [handoff](HANDOFF-01-OUT-LIGACAO-WHATSAPP.md), seção "Andamento da fase 0".
- **Por que travou:** Calling exige limite de 2.000 no portfólio. A demo
  (`1301107846409860`) está em `TIER_250` com portfólio verificado; ligar o
  Calling volta `138015`. O `health_status` culpa o nome de exibição sem
  revisão, e editar o nome não abriu revisão (`AVAILABLE_WITHOUT_REVIEW`).
  Saída: chamado no suporte da Meta. Mesmo bloqueio vale para cliente.
- **O que ficou no ar:** o webhook grava eventos `calls` em `alertas`
  (`src/server/sonda-ligacao.ts`, `5a7ce51`). Inofensivo enquanto nenhum
  número tem Calling ligado; remover ou substituir na fase 1.


## 02/out/2026: o aviso de handoff diz conta, canal, porquê e a última fala

- **Por quê:** o dono recebeu "Um contato está esperando atendimento / a IA
  não soube responder, em \"loja_detalhes\": \"produtoId\" não é um
  identificador..." e não soube de qual conta era nem quem escreveu.
- **O que mudou:** título com nome ou telefone; corpo com `Conta · Canal`, o
  porquê em frase de gente (`resumoDoMotivo` em `src/core/aviso-de-handoff.ts`)
  e a última mensagem do contato, cortada em 90 caracteres. O Inbox mostra a
  mesma frase; o motivo cru fica no banco e na dica, para diagnóstico.
- **Revisto:** antes o aviso não levava conteúdo da conversa "porque atravessa
  o servidor de push". A carga do Web Push é cifrada de ponta a ponta
  (RFC 8291), o servidor não lê; é o que o WhatsApp já faz.

## 02/out/2026: casca azul, opção C (painéis flutuantes)

- **Por quê:** o painel era branco sobre cinza com um azul, o kit padrão de
  SaaS. O dono quer personalidade (referência: Bitrix24), sem serifa, bege ou
  itálico: cor em alguns lugares, respiro na lateral, fonte maior.
- **Duas opções desenhadas**, protótipo navegável em
  https://claude.ai/artifact/UBK2qodWLXc2nMqqpVxBsJ (botão A/C no canto):
  - **A, casca:** lateral e cabeçalho direto no azul, texto branco; o trabalho
    numa folha clara encaixada (canto superior esquerdo arredondado).
  - **C, flutuante (escolhida):** fundo azul em degradê (`#1a3fb8` → `#1d4ed8`
    → `#3a6cf0`, 135°) com fios e blocos de fluxo a 10%; lateral é ilha branca
    com margem; cabeçalho e título no azul; conteúdo em painéis de vidro.
  - Comparação das três primeiras ideias (A, B só lateral, C):
    https://claude.ai/artifact/F2NHZe7abCP6q9kRMNcJQW
- **Regras do dono para a C:** vidro (translúcido com desfoque) em vez de
  branco chapado onde der; quando muitos cartões ficarem picotados, um quadro
  único por trás; a tela de conversa é **um** quadro unindo lista, chat e
  ficha, nunca três blocos soltos. Trocar para A deve continuar possível: tudo
  passa por token.
- **Corrigido no mesmo dia:** a primeira versão pôs um quadro de vidro geral
  atrás das telas e a barra em vidro; o dono rejeitou ("perde a
  personalidade"). Ficou: barra **branca sólida**, miolo **direto no azul**,
  cartões em vidro claro (`--vidro-cartao`, branco a 90%), inbox num quadro
  branco único. Mecânica: os tokens de uso (`--ink`, `--primary`...) apontam
  para `--p-*`; `.app-quadro` os troca por brancos e todo painel dentro dele
  volta aos `--p-*` (`globals.css`, bloco "A casca"). Nenhuma tela foi editada.
  Celular segue no fundo antigo.

## 02/out/2026: padrão de tela da conta (DS)

- **Topo de tela:** `CabecalhoDaTela` (`src/components/design/cabecalho-da-tela.tsx`):
  título, `Contagem` (pílula), descrição e ações **fora do cartão**, à direita.
  Padrão de Contatos, escolhido pelo dono; o cartão começa direto no conteúdo,
  sem repetir o título. Ação que mora em componente de cliente (modal com
  estado) recebe `topo: TopoDaTela` e desenha o cabeçalho com o próprio botão.
  Trilha só aparece com link de volta (senão repete o caminho do cabeçalho).
  Sem rótulo de seção em cima do título.
- **Menu de mais ações:** botão com texto ("Ações"), no fim da linha, nunca
  ícone solto entre dois botões.
- **Largura:** `Miolo largura="leitura|larga|cheia|toda"` (`miolo.tsx`) no lugar
  de 31 `<main>` escritos à mão.
- **Espera:** `EsqueletoDeAjuste` para as subtelas de Configurações.
- **Casca:** selo e cartão de estado tingidos (rose/amber/emerald/perigo...)
  soltos no azul viram pastilha clara com a cor do estado; `.quadro-seletor`
  (seletor de funil) é título branco no azul.

## 02/out/2026: escala de botão e componentes de base

- **Uma escala de botão, três medidas** (`globals.css`, "A escala de botão"):
  `botao-lg` 40px/14px (topo da tela), `botao-md` 36px/13px (seção, cartão,
  formulário, barra de busca), `botao-sm` 30px/12px (linha de tabela, inline).
  Cor pela variante: `botao-primario`, `botao-secundario`, `quadro-tool`
  (ferramenta), `botao-fantasma`, `botao-perigo`. Substituiu 67 combinações
  de `px/py/text` escritas à mão; `app-primary-button` e `app-secondary-button`
  deixaram de existir. Tudo em `@layer components` para `w-full`/`flex-1` de
  quem usa continuarem valendo. Componente: `design/botao.tsx`
  (`Botao`, `classesDoBotao`).
- **Topo é sempre lg sem a tela lembrar:** o contêiner de ações do
  `CabecalhoDaTela` tem `topo-acoes`, e o CSS põe qualquer botão ali em 40px
  (diálogo e menu dentro dele ficam de fora). `ModalFormulario` ganhou
  `tamanho`.
- **Barra de busca fora do cartão**, logo abaixo do topo, em todas as listas:
  `BarraDeLista` aceita `acoes` (na mesma linha, à direita, ex. "Marcar como
  vistos" de Alertas). Campo único `CampoDeBusca`; a lupa sumia no azul porque
  herdava `--dim` branco (agora `.campo-de-busca` volta os tokens claros).
- **Peças de base:** `MenuSuspenso` (`GrupoDoMenu`, `ItemDoMenu`,
  `ItemMarcavel`, no painel do Filtros; título de grupo em negrito e tinta
  cheia), `.caixa-de-marcar` (única caixa de seleção, máscara do tique em
  `--primary-ink` para ler na casca), `Pilula` e `Badge` (`design/pilula.tsx`;
  badge sempre sólido com texto branco, o de Alertas era âmbar sobre azul e não
  lia), barra de rolagem fina dentro de painel.
- **Barra lateral anda:** largura em 200ms; ao recolher o texto some antes, ao
  expandir aparece depois (`.barra-que-anda`), nada com `prefers-reduced-motion`.

## 02/out/2026: landing e páginas legais na casca azul

- **"Não somos dark mode"** (Gabriel). A landing saiu da paleta escura com
  ciano e foi para a casca azul do produto. Capa, fechamento e rodapé ficam
  soltos no azul; o miolo de leitura (problema até dúvidas) fica num quadro
  branco de cantos 32px por cima, como o quadro das telas da conta.
  `src/app/page.tsx` (`s.quadro`), `src/app/(site)/pagina-inicial.module.css`.
- **Um token muda de chão, não cem regras:** `--veu` é `255 255 255` no azul e
  `16 32 84` no quadro; toda borda e superfície translúcida virou
  `rgb(var(--veu) / a)`. Luz de cartão usa `--luz` (sempre branco), senão o
  brilho vira sujeira cinza no papel.
- **O degradê está escrito na página**, não lido de `--casca`: no tema escuro
  do painel a casca vira marinho, e a página de venda não acompanha.
- Saiu a grade de 64px da capa (dobrava com os fios). Partículas em branco.
  Cursor azul com contorno branco, para aparecer nos dois chãos.
- Privacidade, termos e exclusão de dados (`pagina-legal.tsx`,
  `privacidade.module.css`) seguem o mesmo esquema: capa no azul, texto no
  quadro branco.

## 02/out/2026: central de ajuda no formato de help center

- **"Cara de IA, não profissional"** (Gabriel). A página única com índice e
  texto corrido virou central no desenho de Intercom/Zendesk: home com busca
  grande no topo azul, categorias em cartões com a lista de artigos, mais
  procurados e contato; cada assunto é um artigo em `/ajuda/<id>` com trilha,
  artigos da categoria, sumário, anterior/próximo e relacionados.
- **Uma lista só:** `src/components/ajuda/artigos.ts` (categorias, artigos,
  busca e o `INDICE` da gaveta). O corpo de cada artigo continua nos
  `conteudo-*.tsx`, ligado pelo id em `corpos.tsx`.
- **Links antigos seguem vivos:** `/ajuda#datas` (gaveta, `AjudaDoCampo`,
  mensagens já mandadas) cai em `/ajuda/datas` pelo `RedirecionarAncoraAntiga`.
- Saíram os rótulos em monoespaçada caixa-alta do texto (código continua em
  mono). A réplica do bloco do editor ficou como está, porque espelha a tela.
- **Alternador único** (`design/alternador.tsx`, `.alternador` /
  `.alternador-opcao` / `.alternador-sm`): toda troca de modo (Quadro|Lista,
  Minhas|Equipe, Lista|Agenda, Grade|Lista, tipos de gatilho, período de
  relatório, Conectadas|Disponíveis, seções de Transmissões) usa o desenho do
  "Quadro | Lista" de Negócios, escolhido pelo dono: trilho translúcido,
  opção acesa branca sólida, demais em ghost. Aba sublinhada fica só para
  abas dentro de cartão (ficha do negócio).
- **Casca no celular:** os tokens do miolo valem em qualquer largura; topo e
  barra de baixo do celular seguem brancos, no papel da ilha.
- **Pedidos do contato na Inbox:** o Magento não filtra `/V1/orders` por
  telefone (fica no endereço). A lista de "Status do pedido" busca pelo CPF
  ou e-mail da ficha (`listarPedidosDaPessoa`) e marca os que têm o telefone
  da conversa; sem CPF nem e-mail, pede o número. Não testado contra a PCYES.

## 02/out/2026: documentação no formato de docs, com área de desenvolvedores

- Pedido do Gabriel: "ainda tem cara de IA, só card". A central virou casca de
  documentação (régua: RD Station Developers e shadcn/ui): lateral com filtro
  (atalho `/`) e grupos que recolhem, selo de método HTTP, título com
  "Copiar página" e setas anterior/próximo, sumário à direita, busca ⌘K nas
  duas áreas. `src/components/docs/casca.tsx`.
- **Duas áreas, um desenho:** Central de ajuda (`/ajuda/<id>`) e
  Desenvolvedores (`/ajuda/desenvolvedores/<pagina>`), trocadas pelo cabeçalho.
- **A área de desenvolvedores documenta só o que existe:** o webhook de
  entrada (`POST /api/webhook/entrada/{clienteId}`, HMAC no
  `x-autofluxos-assinatura`, 120/min, 64 KB, sem retry), o bloco Chama um
  sistema (GET/POST/DELETE, 10 s, https, credencial bearer/cabeçalho/query), as
  chamadas da Verandi e o script do chat do site. Não há API REST pública, e a
  página diz isso. Fonte: `src/components/docs/paginas-dev.tsx`.
- **Componentes novos:** painel de código marinho com abas de linguagem, copiar
  e realce próprio; lista de campos com tipo e obrigatório; respostas por
  status em sanfona; passos com linha vertical; sanfona com altura animada.
  Movimento só em resposta a gesto, parado com `prefers-reduced-motion`
  (`docs.css`).

## 02/out/2026: API pública, fase 1 (chaves, contatos, disparar fluxo)

- Plano em `docs/HANDOFF-02-OUT-API-PUBLICA.md`. Chave `af_live_<publico 12>_<segredo 43>`,
  base62; banco guarda só o SHA-256 do segredo e os 4 últimos (`0120_chaves_de_api.sql`),
  sem Vault porque nunca é lida de volta. Comparação em tempo constante, sem cache:
  revogar vale na chamada seguinte.
- **O limite de 120/min é chaveado pelo `publico`, não pelo id da linha**: sai do
  cabeçalho sem ir ao banco, então o limite vem antes da conferência da chave, na
  ordem tamanho, limite, chave, escopo, plano (`src/server/api/autenticar.ts`).
- O `clienteId` sai sempre da chave. `/api/v1/` aberto no `proxy.ts`.
- Recurso de plano novo `api` (`core/planos.ts`), no Escala por padrão do código;
  a tabela `planos` de produção só ganha quando o dono marcar no admin.
- Contato pela API: campos gravados com origem `importacao` (perdem para gente e
  para o contato, RB-19); `origem = 'API'` só no novo e congelada depois; etiqueta
  inexistente não é criada, volta em `avisos`; etiqueta aplicada mexe em sequência
  como na tela.
- `acharContatoPeloTelefone` virou repo (`repos/contato-por-telefone.ts`): o lead do
  formulário casava só pela forma exata, agora aceita as grafias do nono dígito.
- Item "Chaves de API" de Configurações renomeado para "Credenciais de sistemas":
  duas coisas chamadas "chave" confundiam.

## 02/out/2026: esqueleto com a forma da tela, e o vidro

- **Regra do carregamento:** o `loading.tsx` desenha a tela que vai chegar.
  Topo é `TopoCarregando` (o `CabecalhoDaTela` de verdade): título e descrição
  escritos, só contagem e botões viram osso. Busca é `EsqueletoDeBusca`, fora
  do cartão, com o texto de exemplo real. Troca de modo é
  `EsqueletoDeAlternador` com os rótulos reais. Osso dentro de cartão branco
  quando a tela tem cartão (`EsqueletoDeLinhas`). Título que muda com o ramo
  ("Alunos", "Cardápio") fica em osso. Peças em `design/esqueleto.tsx`;
  `EsqueletoDeAbas` saiu (`b9cf256`).
- **Uma espera só por tela:** a espera do `Suspense` da página usa a mesma peça
  do `loading.tsx` (`EsqueletoDoFunil`, `EsqueletoDeInbox`), senão a tela
  parece recomeçar.
- **Vidro (`.chip-vidro`, `globals.css`):** trilho translúcido do alternador
  (`--surface` + `--line`, aceso branco sólido) num controle solto no azul.
  Primeiro uso: atalhos de prazo de Atividades. Nunca dentro de cartão branco.
  Mostrado ao dono antes de espalhar.
- **Admin:** `EsqueletoDeTabela` (`admin/partes.tsx`) pede descrição e texto da
  busca reais; abas da organização viraram `Alternador`.
- **Inbox sem conversa pedida abre a do topo** (`502c5e0`): abrir a primeira que
  esperava atendente parecia "abriu a segunda".

## 02/out/2026: API pública fase 2, enviar modelo aprovado

- `POST /api/v1/mensagens/template` exige `Idempotency-Key` (tabela
  `api_idempotencia`, `0121`, 24h). Resposta guardada **só quando enviou**
  (202); qualquer recusa (teto, modelo pausado, Meta) libera a chave, porque
  nada saiu e a repetição deve poder tentar. Mesma chave com outro corpo: 422
  `idempotencia_conflito`; chamada simultânea: 409 `requisicao_em_andamento`.
- Teto diário por organização: `clients.teto_api_diario` (nulo = 500), via
  `consumirLimite` com o dia de Brasília na chave (zera à meia-noite, não 24h
  depois do primeiro envio). Ajuste em admin > organização > Plano.
- Modelo achado por **nome** (+ idioma quando há mais de um), status conferido
  na hora; cabeçalho de mídia recusado com 422 `template_com_midia` (precisa de
  upload, fica para depois). Quantidade de valores tem que bater com as
  variáveis: preencher sozinho com "tudo bem", como faz a tela, mandaria texto
  errado para o cliente de outro sistema.
- Na conversa, a mensagem aparece com autor "API"; na linha do tempo,
  `mensagem-enviada {modelo, via: 'API'}`.

## 02/out/2026: API pública fase 3, webhooks de saída

- Tabelas `webhooks_de_saida` (segredo `whsec_` no Vault, mostrado uma vez,
  trocável) e `entregas_de_webhook` (`0122`). Corpo montado **na emissão**:
  repetição manda o evento como era, não o estado atual.
- Emissão: `anotar` para `chegou`/`mudou-de-etapa` (import dinâmico, sem
  ciclo; só esses dois tipos pagam a consulta de assinantes). Ganhar/perder o
  banco grava direto (0072/0080), então quem emite é `concluirProcesso` e
  `registrarVendaEConcluir`, só quando não é repetida.
- Envio: `conferirEndereco` + conexão fixada no IP (`agenteFixadoEm`, agora
  exportado de `efeitos/http.ts`), redirecionamento é falha, 10 s. Assinatura
  `sha256=HMAC("timestamp.corpo")`. Esperas 1 min, 5 min, 30 min, 2 h, 12 h;
  20 falhas seguidas pausam o webhook. Teste (`webhook.teste`) não repete nem
  conta para a pausa.
- **Hobby só dispara cron 1x/dia**: 1ª tentativa no `after()` da emissão; novas
  tentativas de carona no webhook do WhatsApp e no pulso do Inbox (5 por vez);
  cron diário `/api/manutencao/webhooks` de piso (também limpa
  `api_idempotencia` vencida). Nova tentativa pode atrasar, nunca adiantar.
  `pegar_entregas_de_webhook` trava com `for update skip locked` + 60 s.

## 02/out/2026: API pública fase 4, leitura e funil

- Rotas em `/funil/oportunidades` (não `/funil/cartoes` do plano): o painel e
  os webhooks já dizem "oportunidade"; `cartão` é nome de banco.
- `GET /contatos` em ordem **crescente** de `criado_em, id`, cursor opaco com
  o instante **exato** do banco (microssegundos; passar por `Date` cortaria e
  repetiria o último da página) validado por regex antes de entrar no `or`.
  Filtro de etiqueta por nome via junção `!inner` com alias. Provado no
  PostgREST local.
- `POST /funil/oportunidades` garante uma aberta por funil: existente volta
  200 (e muda de etapa se pedido), nova 201; contato inexistente é criado e
  pode cair sozinho no funil padrão, por isso a procura vem depois de gravar.
- `PATCH` aceita uma forma por vez (`etapa_id` | ganha+valor | perdida+motivo
  da lista da conta), via `moverCartao`/`concluirProcesso`, autor "API".
- Tela API: grade de uma coluna ganhou `minmax(0,1fr)`; o `<pre>` do cURL
  alargava a página para 502px em 390 (defeito da fase 1).

## 02/out/2026: vidro e Alternador aprovados como padrão

- Dono aprovou com entusiasmo os atalhos de prazo em vidro (`.chip-vidro`,
  Atividades) e o `Alternador` de "Minhas | Equipe" e "Lista | Agenda". Pediu
  "em vários lugares".
- Regra: controle **solto no azul** (filtro que liga/desliga, filtro ativo
  com ✕) usa vidro; troca de modo **em qualquer lugar**, inclusive painel
  dentro de cartão, usa o trilho do `Alternador`. Aba sublinhada
  (`border-b-2`) saiu do DS.
- Aplicado: `ChipDeFiltro` → `.chip-vidro .chip-vidro-sm`
  (`campo-de-busca.tsx`); abas da ficha na Inbox (`abas-da-ficha.tsx`) e do
  painel do editor (`editor.tsx`) → `.alternador`.
- Dark: casca passou de marinho `#0a1433` (lia preto) para degradê azul
  profundo `#0c1e5c → #1f4bc4` (`globals.css`, `--casca` do escuro).

## 05/out/2026: atendente passa a contar no plano

- **Reverte** o "atendente ilimitado" de 16/set. Motivo: custo que a conversa
  não cobre. Cada Inbox aberto consulta o banco 1x/s (stream SSE); 200 pessoas
  no Essencial seriam 200 consultas/s por R$ 297, no Supabase compartilhado
  com a Verandi.
- Inclusos 3 / 10 / 25; extra R$ 69 / 59 / 49 por pessoa; acima de 50 é
  Enterprise (`LIMITE_DE_ATENDENTES_SEM_CONTRATO`). Não bloqueia: o modal de
  dar acesso mostra o custo e pede aceite (`acoes-pessoas.ts`).
- Essencial ganha IA, transcrição e transmissões (teto 2.000 envios/mês):
  todo concorrente pesquisado tem IA no plano de entrada.
- Teto de IA vira número do plano (1.500 / 3.000 / 6.000), soma transcrição,
  e some com chave própria (`tetoDeIaDaConta`).
- Teste grátis de 14 dias no Profissional, ativado pelo admin; vencido, os
  recursos pagos pausam (`recursos-do-plano.ts`).
- "Operação" vira "Profissional" só no nome; id `operacao` fica.
- Detalhe e pesquisa: `docs/PLANO-PRECOS-05-OUT.md`, migration `0128`.
