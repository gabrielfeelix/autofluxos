# Plano: administração da plataforma e permissões (24/set/2026)

Pedido do Gabriel: a parte do cliente ganhou cara nova, a administração ficou
"xoxa e desorganizada". Este plano organiza conceito, hierarquia, nomes, telas
e a ordem de construção. Mapeamento feito no código em `e3575a3`/`123e524`.

## 1. O que existe hoje (medido no código)

| Tela | O que faz | Problema |
|---|---|---|
| `/painel` (`PainelShell`) | Lista todos os clientes por quem espera resposta | Mesmo universo de `/admin/contas`, outra casca, outro nome ("Clientes") |
| `/admin/contas` (`contas-admin.tsx`) | Grade de cartões de todas as contas, "+ acesso", apagar | Cartões não escalam; clicar abre o app do cliente, não um detalhe |
| `/admin/usuarios` | Lista de pessoas, papel global, "entrar como", suspender | Lista solta, sem tabela nem filtro |
| `/admin/consumo`, `/admin/auditoria`, `/admin/alertas` | Consumo x plano, log, falhas | Cada uma com um desenho; nenhuma usa a tabela do app (`components/lead/colunas-da-tabela.tsx`) |
| `src/app/admin/layout.tsx` | Barra lateral própria, feita à mão | Não é a `BarraLateral` do app; sem ícones, sem esqueleto |
| Planos | `src/core/planos.ts` fixo no código (Essencial R$297, Operação R$597, Escala R$1.197) | Não dá para editar; o pedido de troca do cliente (`acaoPedirTrocaDePlano`) só grava auditoria, ninguém atende |
| Editar organização | Nome, logo e responsável só pela própria organização (`ajustes/negocio`) | Admin da 4YU não edita, não troca plano, não suspende a organização |
| Funções | 3 papéis fixos (`owner`, `admin`, `member`) + modelos `gestor`/`operador` aplicados como exceções por pessoa | Não existe tela de funções; gestor não tem regra de hierarquia |

## 2. Conceitos e hierarquia (as palavras que valem daqui em diante)

```
Plataforma AutoFluxos (nós, 4YU)
 └─ Organização  (antes: cliente / conta / companhia / empresa)
     └─ Pessoa da organização, com uma Função
         Proprietário > Administrador > Gestor > Atendente
```

- **Organização** é o cliente que paga. Um nome só em toda a interface. No
  código a tabela continua `clients` e a rota `/clientes/[id]`: renomear banco e
  URL não paga o risco.
- **Usuário** é um login. Um usuário pode estar em **várias** organizações, com
  função diferente em cada uma (é o grupo de empresas). Então "usuário" e
  "pessoa da organização" não são a mesma coisa: a tela de Usuários da
  administração lista logins; a tela Pessoas da organização lista quem trabalha
  ali e com qual função.
- **Função** substitui "papel". É um conjunto nomeado de capacidades com
  escopo (próprios / equipe / todos). As 8 capacidades já existem em
  `core/permissoes.ts`.
- **Administrador da plataforma** (nós) não é função de organização. Entra em
  qualquer organização como "Suporte 4YU", com rastro na auditoria.

### Regra de hierarquia (vale na tela Pessoas e no servidor)

Cada função tem um nível: Proprietário 4, Administrador 3, Gestor 2,
Atendente 1.

1. Você só **vê e edita** pessoas de nível **abaixo** do seu. O gestor vê ele
   mesmo e os atendentes (da equipe dele); não vê administradores.
2. Você só **atribui** funções até o seu nível. O gestor promove atendente a
   gestor; não cria administrador.
3. O Proprietário é um só e não é rebaixado por ninguém além dele.
4. O que cada um **enxerga no dia a dia** já segue o escopo (feito em
   `123e524`): atendente vê as conversas e contatos dele e os sem dono; gestor,
   os da equipe e os sem dono; administrador e proprietário, tudo.

## 3. Arquitetura de informação

### Administração da plataforma: uma casca só

Some a divisão "Clientes" x "Administração". `/painel` vira a primeira tela da
administração. Mesma `BarraLateral` do app (ícones, grupos, recolher, tema,
celular), só que com os itens da plataforma:

```
AutoFluxos · Administração
  Visão geral        quem espera, organizações ativas, consumo do mês, alertas abertos
  OPERAÇÃO
  Organizações       tabela
  Usuários           tabela
  COMERCIAL
  Planos             os planos e o que cada um libera
  Pedidos de plano   trocas pedidas pelas organizações
  SISTEMA
  Funções            o que cada função pode fazer
  Consumo · Alertas · Auditoria
```

Todas as listas usam **tabela** em largura cheia com a mesma barra de
filtros (`barra-de-lista.tsx`), busca, ordenação e contagem. Cartões só na
Visão geral, onde respondem uma pergunta ("onde tem gente esperando").

### Organização: tela de detalhe (nova)

`/admin/organizacoes/[id]`, com abas:

| Aba | Conteúdo |
|---|---|
| Resumo | números do mês, quem espera, canais conectados, botão **Abrir como suporte** |
| Dados | nome, logo, responsável, telefone, e-mail, CNPJ (editável) |
| Plano | plano atual, trocar plano, limites e consumo |
| Pessoas | quem tem acesso e com qual função, dar acesso |
| Auditoria | o log só desta organização |
| Zona de perigo | suspender, apagar (o apagar com confirmação digitada que já existe) |

### Dentro da organização

- **Configurações > Pessoas** (hoje "Equipe"): tabela com nome, e-mail,
  função, equipe, status, último acesso. Filtrada pela regra de hierarquia.
  Exceções por pessoa continuam, escondidas em "Ajustar acesso desta pessoa".
- **Configurações > Funções** (só leitura para a organização): o que cada
  função pode fazer, na mesma matriz da administração.

## 4. Ordem de construção

Cada fase fecha com print local em 1440 e 390, commit, e um deploy ao fim da
frente.

| Fase | Entrega | Banco? |
|---|---|---|
| A1 | Casca única da administração com `BarraLateral`; `/painel` vira Visão geral; nomes "Organização" em toda a interface; "‹ Todos os clientes" vira "‹ Administração" | não |
| A2 | Organizações em tabela + detalhe com abas Resumo, Dados, Pessoas, Auditoria, Zona de perigo | não (edição usa colunas que já existem) |
| A3 | Usuários em tabela: organizações de cada um, função em cada uma, último acesso, suspender, entrar como | não |
| A4 | Consumo, Alertas e Auditoria na mesma tabela e barra de filtros | não |
| A5 | Plano pela administração: trocar o plano da organização e atender os pedidos de troca | talvez (histórico de pedidos) |
| A6 | Planos editáveis: sai de `core/planos.ts` para tabela `planos` (nome, preço, limite de conversas, números, recursos liberados) | **sim** |
| A7 | Funções de verdade: tabela `funcoes` com nível e capacidades, `af_membros` aponta para a função, tela Funções (admin) e Pessoas com hierarquia (organização) | **sim** |

A6 e A7 mexem no banco de produção **compartilhado com a Verandi**
(`docs/BANCO-COMPARTILHADO.md`): migration nova em `public`, numerada pelo
diretório, aplicada só com autorização explícita do Gabriel.

## 5. Decisões tomadas neste plano

- **Organização** na interface, sem renomear banco nem URL.
- **Tabela** para listas administrativas; cartão só onde responde "onde agir".
- A fila **sem dono** é visível para atendente e gestor: é dela que eles pegam
  conversa. Se o Gabriel quiser que o atendente só receba por distribuição, é
  uma linha em `alcancaDono` (`core/permissoes.ts`).
- `member` sem exceção (acesso completo menos configurar a empresa) vira
  **Administrador** na migração das funções (A7), porque é o que ele faz hoje.

## 6. Execução (24/set/2026)

| Fase | Commit | O quê |
|---|---|---|
| A1 | `518bc66` | casca única, `/admin` como Visão geral |
| A2 | `afcae57` | organizações em tabela e detalhe com abas |
| A3 | `cf8b496` | usuários em tabela |
| A4 | `36c8aa5` | consumo, alertas e auditoria |
| A5 | `af34014` | trocar plano e atender pedidos |
| A6 | `712e0fc` | planos editáveis (`0099`) |
| A7 | `f190147` | funções e Pessoas com hierarquia (`0100`) |
| fechamento | `d3da637`, `ad07b08`, `3405afc` | registro da produção, lint, Pessoas no celular |

**`0099` e `0100` em produção desde 24/set/2026** (ensaio com 56 capacidades
iguais antes e depois; registro em `docs/BANCO-COMPARTILHADO.md`). Deploy
`3405afc` READY. Hierarquia testada no navegador local: gestor só vê a si e a
atendente da equipe dele; gestor promoveu atendente a gestor; administradora
não vê o proprietário nem tem "Proprietário" nas opções; proprietário passou a
posse e virou Administrador (`af_membros`: `owner`/`proprietario` e
`admin`/`administrador`). Prints em `.ux-local/a7/`.

## 7. Próxima frente: ações por tela (pedido do Gabriel, 24/set)

Hoje a administração **edita** plano e função, troca plano, suspende
organização, mexe em pessoas e em usuários (admin da plataforma, suspender,
derrubar sessões). Falta o resto das ações. Decisões, já tomadas:

**Planos (A8, precisa de migration nova, numerada pelo diretório)**
- Criar plano, e "Duplicar" como atalho. Sai o `check` de ids fixos de
  `planos.id` e de `clients.plano`; o id nasce do nome e não muda depois.
- Excluir: **bloqueado enquanto houver organização no plano**. O modal diz
  "N organizações estão neste plano", lista as organizações e oferece "Mover
  todas para [plano]" antes de deixar excluir. Pedido de troca pendente para
  o plano também bloqueia. Sempre sobra pelo menos um plano à venda.
- "Tirar de venda" (`ativo = false`) continua sendo o caminho sem perda: quem
  já está no plano fica, ninguém novo entra.
- A landing segue em `core/planos.ts` (decisão da A6); plano novo não aparece
  nela sozinho.

**Usuários (A9, sem banco)**
- Editar nome e e-mail; redefinir senha (senha provisória, como no Dar acesso).
- Organizações do usuário: pôr numa organização com função, trocar a função,
  tirar dela (mesma regra de hierarquia, com o Suporte no nível 5).
- Excluir usuário: bloqueado se ele for o único Proprietário de alguma
  organização; o modal lista quais e manda passar a posse antes.

**Organizações (A10, sem banco)**
- Criar organização pela administração (nome, plano, proprietário por e-mail).
- Excluir organização: modal que mostra o que se perde (contatos, conversas,
  canais) e pede o nome digitado; bloqueado com canal conectado, que precisa
  ser desconectado antes. Suspender continua sendo o caminho reversível.

**Funções**: continuam as quatro, sem criar nem excluir. O nível é a
hierarquia, e função nova no meio quebraria "quem mexe em quem".

## Decisões da execução

- **Rotas**: `/admin` é a Visão geral; `/admin/organizacoes` e o detalhe
  `/admin/organizacoes/[id]/*` seguem o plano. `/painel` e `/admin/contas`
  continuam e redirecionam (links salvos, retornos de WhatsApp e Instagram).
- **Hierarquia pura em `src/core/funcoes.ts`**, feita já na A2 porque a aba
  Pessoas precisava dela; a A7 só acrescentou a tabela. Suporte 4YU tem nível 5
  (fora da escada). Ninguém edita a si mesmo. Dar Proprietário passa a posse e
  o dono anterior vira Administrador. Exceções por pessoa não passam da
  política de quem concede.
- **Função sem tabela** é derivada da política efetiva (cabe no Atendente,
  Atendente; cabe no Gestor, Gestor; senão Administrador). A migração da A7
  usa a mesma regra e grava a diferença como exceção, então ninguém ganha nem
  perde acesso (o `member` sem exceção vira Administrador sem configurar a
  organização nem corrigir venda, que é o que ele faz hoje).
- **Planos**: a tabela edita os três planos existentes, não cria plano novo
  (`clients.plano` guarda o id). A landing continua lendo `core/planos.ts`.
- **Suspender organização** (`clients.suspensa_em`, na 0099) bloqueia o painel
  para as pessoas da organização e deixa o Suporte 4YU entrar; não desliga bot
  nem canais.
- **Pedidos de plano** vêm da auditoria; a resposta vira ato com o id do pedido
  em `detalhes.pedido`.
- **Funções na organização** ficam em Configurações > Pessoas > Funções (só
  leitura), sem item novo no menu de Configurações, para não colidir com o
  plano de navegação em andamento.
- **AGENTS.md**: as linhas com travessão geradas pelo `next dev` ficaram (o
  bloco é recriado); a linha nossa foi corrigida.
