# Plano: navegação por seções e CRM de verdade (24/set/2026)

Pedido do Gabriel, com 30 prints da Brevo como referência: *"estamos jogando
tudo pra debaixo do tapete (configurações) esperando que o usuário saiba
utilizar"*. Este plano reorganiza a barra lateral em seções com subitens, tira
de Configurações o que é uso diário e define as telas de CRM que faltam.

Fora de escopo por decisão do dono: tudo de **Marketing, e-mail e
Transacional** da Brevo.

---

## 1. O diagnóstico, medido no código

A barra lateral hoje é plana, 9 itens (`src/components/design/secoes-do-cliente.tsx`,
`ITENS`): Painel, Inbox, Atividades, Contatos, Funil de vendas, Relatórios,
Automações, Transmissões, Configurações.

Configurações tem 16 telas em 5 grupos (`src/components/design/itens-de-ajustes.ts`).
Metade delas **não é configuração**, é ferramenta de trabalho:

| Tela | Onde está hoje | Uso real | Problema |
|---|---|---|---|
| Etiquetas | Configurações | diário, é a "lista" do negócio | escondida |
| Respostas rápidas | Configurações | diário, quem atende | escondida |
| Catálogo | Configurações | semanal, quem vende | escondida |
| WhatsApp, Instagram | Configurações | olhar saúde do canal | escondida |
| Integração Magento | Configurações > Conexões | é a loja do cliente | escondida dois níveis |
| Segmentos | `/leads/segmentos` | semanal | **não está em menu nenhum** |
| Mensagens salvas | `/favoritas` | diário | **não está em menu nenhum** |
| Respostas coletadas | `/respostas` | semanal | **não está em menu nenhum** |
| Fluxos, Gatilhos, Sequências | abas dentro de Automações | diário | invisível até entrar |
| Visões do Inbox (minhas, sem dono, todas) | filtro dentro da tela | diário | sem contagem à vista |

E o que **não existe**:

- **Página do negócio.** O clique no cartão abre um diálogo
  (`src/components/quadros/painel-do-contato.tsx`). Não há tela com etapa,
  tempo na etapa, histórico do negócio, atividades e contato juntos.
- **Negócios em lista.** Só existe o quadro (colunas).
- **Relatório de vendas.** `relatorios/page.tsx` é de atendimento; de vendas só
  conta ganhos e perdidos. Não há receita por mês, conversão por etapa, motivo de
  perda em gráfico nem desempenho por vendedor, embora `motivos_de_perda` exista
  (migration `0080`).
- **Loja como seção.** `lojas_integradas` (migration `0092`) aceita só
  `plataforma in ('magento')`.

## 2. O que a Brevo acerta, e o que não copiar

**Copiar:**

1. **Seção com subitens.** "CRM" abre Contatos, Listas, Segmentos, Oportunidades,
   Tarefas. A pessoa vê o mapa inteiro do produto sem abrir nada.
2. **Visões da caixa de entrada no menu, com número.** "Não atribuídas 1" na
   barra é o que faz alguém agir.
3. **A página da oportunidade.** Informações à esquerda, etapa atual com
   progresso (1/7) e tempo na etapa no centro, histórico logo abaixo, contato e
   empresa à direita, ações no topo (Anotação, E-mail, Tarefa, Mais). Aba
   Histórico com filtros por tipo.
4. **Cartões / Lista** no mesmo lugar, com total em R$ por coluna.
5. **Relatórios de vendas em três perguntas:** quanto entrou (receita), onde
   perco (conversão por etapa e motivo), quem vende (equipe).
6. **Comércio com cartão por plataforma**: instalar + ver guia, e ao lado o que
   a conexão rende ("nunca perca uma venda", "carrinho abandonado").
7. **Estado vazio que ensina e tem um botão.** Todas as telas vazias deles
   dizem o que aparece ali e oferecem o primeiro passo.

**Não copiar:**

- **Telefone** da Brevo não é canal de entrada: é discador (ligação por voz,
  pago). Nosso equivalente é a chamada do WhatsApp, já pesquisada em
  `docs/PESQUISA-VOZ-E-CHAMADA.md`. Fora deste plano.
- **Reuniões** da Brevo é página de agendamento tipo Calendly, ligada ao Google
  Agenda. Vale, mas tem custo que não aparece (seção 6).
- **Objetos personalizados**: nossos campos personalizados no contato cobrem.
- **Listas separadas de etiquetas**: na Brevo, lista é grupo fixo e segmento é
  regra. Nós já temos os dois: **etiqueta é a lista**, segmento é a regra. Criar
  um terceiro conceito só confunde.
- Coisas em inglês no meio do português ("Tasks", "of 1 pages", "Yesterday").

## 3. A barra lateral nova

```
Início
Conversas                     ● (ponto se há gente esperando)
   Minhas conversas        3
   Sem responsável         1
   Todas as conversas
   Mensagens salvas
   Respostas rápidas
   Canais
CRM
   Contatos
   Segmentos
   Etiquetas
   Negócios
   Atividades              2  (atrasadas)
Automações
   Fluxos
   Gatilhos
   Sequências
   Transmissões
   Respostas coletadas
Loja                          (só com o recurso ligado)
   Conectar loja
   Catálogo
Análise
   Atendimento
   Vendas
─────────────
Configurações
Você (rodapé, já existe)
```

**Nomes, decididos:**

- **Conversas**, não "Inbox": palavra de quem atende, e é a da Brevo, RD e
  Kommo em português.
- **Negócios**, não "Oportunidades" nem "Funil de vendas": curto, é o que o
  Pipedrive e o Agendor usam no Brasil, e o cartão já é a negociação
  (`docs/MODELO-CRM.md`). Dentro da tela, o seletor continua mostrando os funis.
- **Atividades** fica. Já foi discutido e construído (Fase 1 do plano de UX).
- **Loja**, não "Comércio" nem "E-commerce".
- **Análise** agrupa os relatórios. "Relatórios" hoje vira "Análise > Atendimento".

**Comportamento, decidido:**

1. Clicar no nome da seção **abre a seção e vai para o primeiro subitem**. Só a
   seção atual fica aberta (sanfona), para a barra não virar uma lista de 25.
2. Contagem só onde pede ação: Minhas conversas, Sem responsável, Atividades
   atrasadas. Com a seção fechada, a contagem vira um ponto no nome.
3. Barra recolhível para só ícones, com dica ao passar o mouse. O estado fica em
   **cookie**, não `localStorage`, para o servidor desenhar certo e a barra não
   piscar.
4. Permissão por subitem, com a mesma `EXIGENCIA_DA_SECAO`. Seção sem subitem
   liberado some inteira.
5. `ITENS` continua sem I/O: o esqueleto desenha a barra real (regra de
   `secoes-do-cliente.tsx`). As contagens chegam depois, como hoje o
   `ContadorDaAgenda`.
6. **Nenhum link salvo quebra.** Tela que muda de seção ganha rota nova e a
   antiga redireciona. `/quadros`, `/leads` e `/inbox` ficam como estão; só o
   rótulo muda.
7. Celular (`barra-do-celular.tsx`): Conversas, Contatos, Negócios, Atividades e
   "Mais", que abre a barra inteira.

**Configurações fica só com o que se ajusta uma vez:** Dados da empresa, Pessoas
e acesso, Objetivo e recursos, Plano e consumo, Conhecimento da IA, Horário e
retomada, Arquivos e mídias, Conexões (webhooks, Anúncios, Chaves de API).

## 4. Mapa de mudança, tela a tela

| Tela | Hoje | Vai para |
|---|---|---|
| Painel | Painel | Início |
| Inbox | item solto | Conversas > Minhas / Sem responsável / Todas (a mesma tela, filtro pela URL) |
| Favoritas | sem menu | Conversas > Mensagens salvas |
| Respostas rápidas | Configurações | Conversas > Respostas rápidas |
| WhatsApp, Instagram | Configurações | Conversas > Canais (uma tela, um cartão por canal com a saúde; o detalhe técnico continua lá dentro) |
| Contatos | item solto | CRM > Contatos |
| Segmentos | sem menu | CRM > Segmentos |
| Etiquetas | Configurações | CRM > Etiquetas |
| Funil de vendas | item solto | CRM > Negócios |
| Atividades | item solto | CRM > Atividades |
| Fluxos, Gatilhos, Sequências | abas | Automações > subitens (as abas somem da tela) |
| Transmissões | item solto | Automações > Transmissões |
| Respostas | sem menu | Automações > Respostas coletadas |
| Integrações > Magento | Configurações | Loja > Conectar loja |
| Catálogo | Configurações | Loja > Catálogo |
| Relatórios | item solto | Análise > Atendimento |

## 5. Telas novas

### 5.1 Página do negócio (a mais importante)

Rota nova `/clientes/[id]/negocios/[cartaoId]`. O diálogo do quadro continua
(é rápido para mexer em vários cartões) e ganha **"Abrir negócio"**. Isto revê
a decisão "o clique abre painel, não página" do `docs/MODELO-CRM.md`: o painel
fica para o gesto rápido, a página para trabalhar o negócio.

- **Topo:** voltar, nome do negócio, valor, temperatura, situação (Aberto,
  Ganho, Perdido). Ações: Anotação, Mensagem (abre a conversa no WhatsApp),
  Atividade, `⋯` (mudar de funil, ganho, perdido, excluir).
- **Abas:** Visão geral · Histórico.
- **Esquerda, Informações** (edição no lugar, otimista): valor, produto,
  previsão de fechamento, responsável, origem do lead, criado em, última
  alteração.
- **Centro, Etapa atual:** as etapas do funil como degraus clicáveis ("3 de 6,
  Proposta"), barra de progresso, *"nesta etapa há 3 dias, aberto há 12"*
  (`entrouNaColunaEm` já existe). Na última etapa, botões Ganho e Perdido (o
  perdido pede o motivo de `motivos_de_perda`). Abaixo, **Histórico recente**:
  as 5 últimas coisas e "Ver tudo".
- **Direita:** Contato (nome, telefone, etiquetas, última mensagem, botão Abrir
  conversa), Atividades abertas com "+ Nova", Outros negócios desta pessoa.
- **Aba Histórico:** filtros Tudo · Anotações · Atividades · Etapas · Conversa ·
  Automação. Fonte: `eventos_do_contato` (0058) filtrado pelo negócio. Se o
  evento não guarda o id do cartão, a migration adiciona `cartao_id` anulável
  (próximo número **pelo diretório**, aplicar só no local, anotar no fim).

### 5.2 O cartão mostra o negócio, não a pessoa (decidido com o Gabriel, 24/set)

**Um funil só, e ele é de negócios.** No banco já é assim: `quadro_cartoes` é a
negociação (título, valor, situação, motivo) e aponta para o contato
(`contato_id`). O que engana é a cara do cartão: hoje abre com avatar e nome da
pessoa (`src/components/quadros/quadro.tsx`, perto da linha 464) e o título vem
embaixo, pequeno. Parece um funil de contatos.

Vira, nesta ordem: **título do negócio** (grande), **valor**, e embaixo, menor,
**o lead** (avatar, nome, telefone), temperatura e dias na etapa. Cartão sem
título mostra "Negócio de <nome>" em cinza, para ninguém achar que é a pessoa.
Quando o bot cria o cartão sozinho (política de entrada, migration `0075`), o
título nasce do produto de interesse se houver.

Não existe funil de contatos. O ciclo de vida da pessoa (`contacts.estagio`:
novo, qualificado, negociando, cliente, perdido, inativo) continua sendo um
campo que muda sozinho, visto em Contatos como coluna e filtro, nunca em
colunas de arrastar.

### 5.2b Negócios em lista

Alternância **Quadro | Lista** no topo de CRM > Negócios, como a Brevo.
Colunas: negócio, contato, etapa, valor, responsável, temperatura, dias na
etapa, previsão. Usa `BarraDeLista` (a mesma barra de busca e filtros). No
quadro, cada coluna mostra a soma em R$ ao lado da contagem.

### 5.3 Análise > Vendas

Período no topo, três abas:

- **Receita:** ganho no período, ticket médio, gráfico por mês.
- **Conversão:** taxa de vitória, quantos passam de cada etapa para a próxima
  (barras, a maior perda destacada), motivos de perda em barras.
- **Equipe:** por responsável, ganhos, valor, taxa de vitória, tempo médio até
  fechar.

Vazio: explica o que aparece ali e oferece "Criar negócio". Quem vê valor segue
a regra que já existe (`podeVerValor`).

### 5.4 CRM > Etiquetas (a nossa "lista")

Tabela: etiqueta, cor, contatos, criada em, `⋯` (renomear, juntar com outra,
apagar). Clicar no número abre Contatos já filtrado. A tela de
`ajustes/etiquetas` redireciona para cá.

### 5.5 Conversas > Canais

Um cartão por canal (WhatsApp, Instagram), estado em camadas (conectado,
atenção, desconectado) e o próximo passo escrito. É a tarefa 6.4 do plano de UX
aplicada no lugar certo.

### 5.6 Loja > Conectar loja (a cereja)

Grade de cartões por plataforma, como a Brevo, com as plataformas **do Brasil**
em primeiro, e à direita o que a conexão rende: o bot responde com o produto
certo, estoque e link; carrinho abandonado vira mensagem; pedido pago vira
negócio ganho.

| Plataforma | Estado | Por quê |
|---|---|---|
| Magento / Adobe Commerce | **Conectada** (já existe, PCYES) | `docs/HANDOFF-23-SET-MAGENTO.md`, guia em `docs/GUIA-MAGENTO-LOJISTA.md` |
| Nuvemshop | próxima | maior base de loja pequena no Brasil |
| WooCommerce | próxima | conexão por chave, sem aprovação de loja de apps |
| Shopify | depois | pede app aprovado pela Shopify para instalar em loja alheia |
| VTEX, Tray, Loja Integrada | "Em breve" | |

Cartão "Em breve" tem **"Quero esta"**: grava o pedido por conta. É a nossa
medida de demanda para decidir a ordem, sem achismo.

Antes de construir cada uma: pesquisar a API (como autentica, se avisa pedido e
carrinho por webhook, se exige app publicado) e registrar como foi feito no
`docs/INTEGRACAO-MAGENTO-23-SET.md`. A tabela `lojas_integradas` ganha as
plataformas no `check`.

Loja aparece na barra quando o recurso está ligado em Objetivo e recursos
(mesmo mecanismo do `crmVisivel`). Estúdio de pilates não vê Loja.

## 6. Fica fora agora, com o gatilho que traz de volta

| O quê | Por que não agora | Volta quando |
|---|---|---|
| Empresas (B2B) | clientes atuais vendem para pessoa, não empresa | primeiro cliente que vende para empresa |
| Reuniões com Google Agenda | ler e escrever agenda é escopo sensível: o Google exige verificação do app, semanas | Loja e Negócios prontos; pedir a verificação em paralelo, antes de construir |
| Pedidos e carrinho abandonado | dependem de plataforma com webhook | Nuvemshop ou WooCommerce conectada |
| Telefone (ligação) | é outro produto | ver `docs/PESQUISA-VOZ-E-CHAMADA.md` |
| Objetos personalizados, Fidelização, Marketing, e-mail | fora do produto | não volta |

## 7. Ordem de construção

Cada fase fecha com commit local, prints em 1440 e 390 e `tsc` + build. Deploy
só no fim da frente.

**F1. Barra lateral por seções** (sem tela nova, só mudança de lugar)
- `ITENS` vira seções com subitens; sanfona; contagens; recolher com cookie.
- Rotas novas para Etiquetas, Respostas rápidas, Canais, Catálogo, Loja; as
  antigas redirecionam.
- Abas de Automações viram subitens.
- Configurações perde os itens que saíram.
- Aceite: todo item da seção 4 acessível em até 2 cliques; nenhum link antigo
  dá 404; esqueleto sem piscar; papel de atendimento não vê Automações nem
  Configurações.

**Estado da F1 (feita em 24/set, commit `1a954c9`, só local, sem deploy):**

- Esqueleto em `src/components/design/secoes-do-cliente.tsx`: `SECOES` (seções
  com `itens`), `ITENS` (achatado), `AbaDoCliente` = a "porta" de cada tela
  (permissão e nome na tela de sem acesso). Para uma tela nova: subitem em
  `SECOES`, porta em `EXIGENCIA_DA_SECAO` e `ENDERECO_DA_ABA`, prefixo em
  `aba-do-caminho.ts` (`PREFIXOS` e `DO_CAMINHO`), e teste nos dois `.test.ts`.
- Subitem aceso sai de caminho + busca (`acesoDoCaminho`): `?de=` nas
  Conversas, `?aba=` em Automações. `?de=minhas` vira o id de quem olha na
  página do Inbox.
- Contagens em `barra-do-cliente.tsx` (`contarDaBarra`, com `cache`), repo
  `contarConversasDaBarra` em `repos/leads.ts`. Atrasadas = `vencidas` da agenda.
- Barra recolhida: cookie `autofluxos-barra` (`cookie-da-barra.ts`), lido por
  `server/preferencias.ts`. O script do `<head>` copia o valor antigo do
  `localStorage` para o cookie uma vez.
- Rotas movidas (308 em `next.config.ts`, `SAIRAM_DE_CONFIGURACOES`):
  `ajustes/whatsapp` e `instagram` para `conversas/canais/...`,
  `ajustes/respostas-rapidas` para `conversas/respostas-rapidas`,
  `ajustes/etiquetas` para `leads/etiquetas`, `ajustes/produtos` para
  `loja/catalogo`, `ajustes/integracoes/magento` para `loja/magento`.
  `/loja` vai para `/loja/magento` com 307 até a F4 existir.
- Tela nova `conversas/canais/page.tsx` (cartões por canal, estado de
  `catalogoDeIntegracoes`).
- Loja visível (`lojaVisivel` em `repos/recursos.ts`): objetivo `vender`, ou
  loja conectada, ou catálogo com item. Não há interruptor de Loja ainda (pediria
  migration); entra na F4.
- Análise tem só Atendimento; **Vendas entra na F3** como subitem novo em
  `SECOES` (porta `relatorios` ou uma nova).
- Celular: `BaixoPorSecoes` e `GavetaPorSecoes` em `barra-do-celular.tsx`.
- A administração (`/admin`) usa a mesma `BarraLateral` com `itens` planos;
  não quebrar esse caminho.

**F2. Cartão com cara de negócio, página do negócio e lista** (5.1, 5.2 e 5.2b)
- Aceite: do quadro, "Abrir negócio" leva à página; mudar etapa pelos degraus
  grava sem recarregar e aparece no histórico; aba Histórico filtra por tipo.

**Estado da F2 (feita em 24/set, commit `c3ed2ea`, só local, sem deploy):**

- Aceite conferido com Playwright no local (`.ux-local/f2.mjs`, fora do git):
  quadro, diálogo, "Abrir negócio", clique num degrau, recarregar, aba
  Histórico > Etapas mostra "Saiu de Novo contato para Aula experimental".
  Build de produção sem erro de hidratação.
- Página: rota `src/app/clientes/[clienteId]/negocios/[cartaoId]/page.tsx`
  (lê tudo) e `components/negocios/pagina-do-negocio.tsx` (tela, otimista).
  Ações novas em `server/acoes-negocio.ts` (previsão, trocar de funil, anotar
  no negócio); o resto reusa `acoes-crm.ts`, `acoes.ts` e
  `acoes-atividades.ts`. Nenhuma revalida a página aberta.
- Regras puras em `core/negocios.ts` (título provisório, degrau, dias,
  categoria do evento, filtro da lista), com teste.
- **Histórico sem migration:** o evento do negócio é o do contato com
  `dados.cartaoId` (convenção da 0072). `moverCartao`, `atribuirCartao` e a
  anotação da página passaram a gravar o id; `repos/negocios.ts` lê os do
  cartão mais os sem id (conversa, fluxo) desde a criação dele. Atividades
  entram no histórico vindas de `atividades.cartao_id`. Eventos antigos de
  mover e assumir não têm o id e aparecem só pela data.
- **Migration `0101_previsao_do_negocio.sql`**: `quadro_cartoes.previsao_de_fechamento`
  (date, anulável). **Aplicada só no local.** O cartão é lido com `*`, então
  o funil não cai em produção sem ela; só gravar a previsão falha. Aplicar em
  produção antes do deploy, com autorização.
- Cartão: `components/quadros/quadro.tsx`. A soma em R$ por coluna já existia.
- Lista: `?ver=lista` na mesma rota de `/quadros`, `components/negocios/lista-de-negocios.tsx`,
  filtros `busca`, `etapa`, `situacao`, `responsavel`, `temperatura` na URL.
  Alternância no `cabecalho-do-quadro.tsx`; o seletor de funil mantém a vista.
- Barra: `/negocios` acende CRM > Negócios (`aba-do-caminho.ts`, com teste).
- O servidor de dev da 3100 (do outro agente) serviu SSR velho de componente
  cliente; prints finais saíram de `next build` + `next start` na 3107.

**F3. Análise > Vendas e Etiquetas como lista** (5.3 e 5.4)
- Aceite: números batem com uma consulta à mão no banco local para um período.

**Estado da F3 (feita em 24/set, só local, sem deploy, sem migration):**

- **Aceite conferido.** Seed `scripts/ux-local/seed-vendas.mts` (90 negócios
  fechados em 12 meses, chave `seed-vendas-*`, `--apagar` desfaz). Período
  27/06 a 24/09/2026 (o padrão, 90 dias), conta local `afacb27c...`, consulta
  à mão com `(fechado_em at time zone 'America/Sao_Paulo')::date between ...`
  sobre `quadro_cartoes`: 19 ganhos, 21 perdidos, R$ 9.780,00, ticket
  R$ 543,33 (`avg(valor)` ignora o ganho sem valor), taxa 48% (anterior 6/12 =
  50%); motivos Comprou de outro 5, sem motivo 4, Sem interesse agora 4, Fora do
  perfil 3, Preço 3, Sem resposta 2; equipe Gabriel 7/14 R$ 4.140 11 dias,
  Carla 5/12 R$ 2.820 25 dias, Bruno 4/7 R$ 1.860 20 dias, Ana 3/7 R$ 960 19
  dias; criados no período por etapa 60/57/38/23. **A tela mostrou os mesmos
  números** (`.ux-local/f3.mjs`, fora do git).
- Vendas: rota `relatorios/vendas/page.tsx`, porta nova `vendas` em `SECOES`
  (exige `criar_oportunidade`, como Negócios; some com o CRM desligado, também
  em `cliente-shell.tsx`). Abas por `?aba=`, funil por `?funil=` (seletor só com
  mais de um funil), período com atalhos 30/90/365 (`ATALHOS_DE_VENDAS`, padrão
  90). Valor em R$ só com `ler_valores`; sem ele, tudo vira quantidade.
- Definições em `repos/analise-de-vendas.ts`, iguais ao cartão "Fechamentos" de
  Atendimento (todos os funis, `fechado_em`, escopo por `responsavel`). A
  passagem de etapa usa outra população, de propósito: negócios **criados** no
  período, até a etapa mais adiantada (atual ou do histórico `mudou-de-etapa`).
  Regras puras em `core/analise-de-vendas.ts`, com teste.
- Gráfico por mês: 12 meses até o fim do período, os do período em destaque
  (`grafico-mensal.tsx`). Período, cartão e comparações saíram de
  `relatorios/page.tsx` para `components/relatorios/pecas.tsx` (as duas telas usam).
- Etiquetas: `components/etiquetas/tabela-de-etiquetas.tsx`, ações em
  `server/acoes-etiquetas.ts` (criar e renomear otimistas; juntar e apagar
  confirmam). `juntarEtiquetas` em `repos/etiquetas.ts`, numa transação, não
  dispara sequência e recusa se a origem é gatilho (teste de integração). A
  contagem passou a `contato_etiquetas(count)`: a antiga lia um vínculo por
  linha e errava acima de 1000. Número abre `/leads?marca=<id>`.

**F4. Loja** (5.6): tela de plataformas, "Quero esta", Nuvemshop e WooCommerce
depois da pesquisa de cada uma.

**Estado da F4 (24/set, commits `5c94c9e` e `12ab219`, só local, sem deploy;
WooCommerce fica para depois):**

- **Migration `0103_loja_conectar.sql`, aplicada só no local. Falta
  autorização para produção**, e ela entra **antes** do deploy (o código lê
  `pedidos_de_loja`, `clients.loja_ativa` e `lojas_integradas.id_na_plataforma`).
  Aditiva: check de `plataforma` com `nuvemshop` e `woocommerce`,
  `id_na_plataforma` (anulável, único por plataforma), tabela
  `pedidos_de_loja` (RLS ligada, zero políticas, revoke com `public`) e
  `clients.loja_ativa` (anulável, sem default: `null` = regra de antes). Ao
  aplicar, registrar em `docs/BANCO-COMPARTILHADO.md` como a `0101`.
- Tela `loja/page.tsx` + `components/loja/conectar-loja.tsx`: "Disponível
  agora" (cartão largo) e "Em breve" (grade, Brasil primeiro), "O que a
  conexão rende" à direita, estado vazio com "Montar o catálogo". Regras puras
  em `core/plataformas-de-loja.ts` (lista, estado, ordem, `mostraLoja`), com
  teste. Sai o 307 de `/loja` do `next.config.ts`; "Conectar loja" em `SECOES`
  e `ENDERECO_DA_ABA` apontam para `/loja`. Cores das marcas em `globals.css`
  (`--marca-<id>`).
- "Quero esta": `acaoQueroEstaPlataforma` (`configurar_operacao`), otimista,
  uma vez por conta (chave conta + plataforma). Contar demanda:
  `select plataforma, count(*) from pedidos_de_loja group by 1`.
- Interruptor de Loja em Objetivo e recursos (`interruptor-da-loja.tsx`,
  `acaoDefinirLoja`). Loja conectada aparece mesmo desligada.
- **Nuvemshop**: pesquisa em `docs/INTEGRACAO-MAGENTO-23-SET.md`. OAuth de app
  de parceiro, `state` = bilhete do Instagram; retorno
  `api/loja/nuvemshop/retorno` (público no `proxy.ts`), webhook
  `api/webhook/nuvemshop` (HMAC; `app/uninstalled` e LGPD). Adaptador
  `loja/nuvemshop.ts`, tradução pura `core/nuvemshop.ts` com teste; o bot usa
  Magento ligada, senão Nuvemshop ligada, senão catálogo. Tela
  `loja/nuvemshop`.
- **Depende do Gabriel** para a Nuvemshop sair do "Em breve": conta de parceiro
  e app em <https://partners.nuvemshop.com.br> (escopos `read_products` e
  `read_orders`, retorno `https://autofluxos.4yu.com.br/api/loja/nuvemshop/retorno`,
  webhooks de LGPD para `https://autofluxos.4yu.com.br/api/webhook/nuvemshop`),
  e `NUVEMSHOP_APP_ID`/`NUVEMSHOP_CLIENT_SECRET` na Vercel. Primeira conexão
  real: conferir o link do produto (`canonical_url` ou `/produtos/<handle>/`,
  não confirmado na doc) numa loja demo.
- Aceite conferido no local (`.ux-local/f4.mjs` e `f4-nuvemshop.mjs`, fora do
  git): pilates sem Loja no menu; ligar no interruptor mostra sem recarregar;
  "Quero esta" marca na hora e some depois de recarregar; `/loja`,
  `/loja/magento`, `/ajustes/integracoes/magento` e `/loja/catalogo` abrem;
  Conectar leva a `nuvemshop.com.br/apps/<id>/authorize?state=`; retorno com
  estado ruim, sem código e com código falso redireciona certo; webhook 401
  sem assinatura, 200 com ela, e desinstalar solta a loja e apaga o token. A
  API real da Nuvemshop respondeu 401 ao token falso (URL e User-Agent
  chegam). Prints em 1440 e 390 em `.ux-local/f4/`.

**F5. Pedidos e carrinho abandonado** como gatilho de automação.

**F6. Agenda com Google**, começando pelo pedido de verificação.

**Onde entra no plano de UX de 23/09:** F1 vem **antes** da Fase 6 dele, porque
6.4 e 6.6 mexem em telas (WhatsApp, conexões) que mudam de lugar aqui. O resto
daquele plano segue depois de F1.

## 8. Decisões tomadas neste plano

- Seções com subitens, sanfona, primeiro subitem ao clicar na seção.
- Nomes: Conversas, CRM, Negócios, Loja, Análise.
- Etiqueta é a lista; não existe "Listas" separado.
- Página do negócio além do diálogo do quadro (revê `MODELO-CRM.md`).
- Um funil só, de negócios: o cartão mostra o negócio na frente e o lead embaixo. Não existe funil de contatos.
- Rotas antigas redirecionam; nenhuma quebra.
- Plataformas de loja brasileiras primeiro; "Quero esta" mede a ordem.
- Empresas, Agenda com Google e Telefone ficam fora até os gatilhos da seção 6.

## Ambiente

Há outro agente trabalhando no mesmo diretório (arquivos de permissões, inbox e
leads com alterações não commitadas em 24/set). Commitar por caminho, nunca
`-A`, e conferir `git status` antes de mexer em `secoes-do-cliente.tsx`.
