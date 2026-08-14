# Expansão — como está hoje, o que existe fora, e o que vamos construir

Documento **canônico** da expansão do AutoFluxos. Reúne quatro coisas que estavam
espalhadas:

1. **Como está hoje** — o nosso estado real, campo a campo, com arquivo e linha
2. **O que o concorrente tem** — 31 telas do BotConversa, redesenhadas
3. **O que fazer** — cada item com estado esperado e passos
4. **Em que ordem** — rodadas, travas e o que fica de fora

Substitui `ANALISE-BOTCONVERSA.md` e `PLANO-EXPANSAO.md`, que foram dobrados aqui
dentro. **Três documentos sobre o mesmo assunto se contradizem em uma semana** —
o [ESTADO.md](ESTADO.md) já registra ter pagado esse preço uma vez.

Irmãos que continuam valendo: [ESTADO.md](ESTADO.md) (retomada e fila geral),
[ARQUITETURA.md](ARQUITETURA.md) (as regras), [BRIEF-UI.md](BRIEF-UI.md) (o que
cada tela nossa faz), [BRIEF-AGENDA.md](BRIEF-AGENDA.md),
[CONEXOES.md](CONEXOES.md), [PLANILHAS.md](PLANILHAS.md).

Escrito em 13/ago/2026.

> **Sobre as imagens.** Os prints chegaram como conteúdo de conversa, não como
> arquivo — não há PNG para commitar. Cada tela foi **redesenhada como layout**
> nas seções abaixo. Perde cor e tipografia; mantém estrutura, rótulos e números
> reais, e sobrevive a `git diff`.

---

## Sumário

- [Parte 0 — A base de evidência](#parte-0--a-base-de-evidência)
- [Parte 1 — Como está hoje](#parte-1--como-está-hoje)
- [Parte 2 — O que o BotConversa tem, tela a tela](#parte-2--o-que-o-botconversa-tem-tela-a-tela)
- [Parte 3 — O que fazer](#parte-3--o-que-fazer)
- [Parte 4 — Ordem, rodadas e travas](#parte-4--ordem-rodadas-e-travas)
- [Parte 5 — O que não fazer](#parte-5--o-que-não-fazer)
- [Parte 6 — Perguntas em aberto](#parte-6--perguntas-em-aberto)

---

## Parte 0 — A base de evidência

**Conta observada:** MGM Studio Pilates, workspace `210139`, número
`+55 11 93213-9312`, operador `Eduardo`, segundo administrador `Daniel Mutti`.
31 telas, incluindo o editor aberto bloco a bloco e uma conversa real de operação.

**O que o print prova sobre a Meta** — vale mais que qualquer feature aqui:

| Campo (Configurações → WhatsApp) | Valor |
|---|---|
| WABA | `468946307261350`, selo **CoEx** (Coexistence) |
| Limites de mensagem | **250 BICs / 24 horas** |
| Verificação da empresa | **Não verificado** |
| Status do número · da conta | Conectado · Ativo |
| Linha de crédito | **Compartilhado** |

**O cliente opera com a empresa dele não verificada.** O que trava não é a
verificação do cliente — é a **nossa**, para virar Provedor de Tecnologia. E
"linha de crédito compartilhada" é o modelo que o [ESTADO.md](ESTADO.md) já
prevê: a Meta cobra por dentro do provedor. Confirmar na doc da Meta antes de
usar em reunião.

---

## Parte 1 — Como está hoje

### 1.1 O que o produto faz

Desenhar fluxo arrastando bloco · testar a conversa ao lado · publicar versão
imutável · receber mensagem do WhatsApp e responder · chamar o sistema do cliente
no meio da conversa · guardar credenciais num cofre · o lead cair na tela · e
responder o lead pelo painel dentro da janela de 24h.

**Base local:** 252 testes passando, `typecheck` e `lint` limpos. O painel
publicado está em `autofluxos.4yu.com.br`.

### 1.2 As telas que existem

```
/                          lista de clientes
/clientes/[id]             início — fluxos, números, atalho de leads
/clientes/[id]/fluxos      lista de automações
/clientes/[id]/fluxos/[id] EDITOR (catálogo · canvas · painel Bloco/Testar)
/clientes/[id]/leads       tabela com colunas dinâmicas
/clientes/[id]/leads/[id]  um lead: campos coletados + conversa + resposta
/clientes/[id]/conexoes    credenciais (cofre)
/clientes/[id]/contexto    o que o negócio faz (fecha o escopo da IA)
/clientes/[id]/numero      conectar número de WhatsApp
/clientes/[id]/ajustes     cadastro do cliente
/login                     senha única
```

Navegação do cliente: **4 abas** — `Início` · `Fluxos` · `Leads` · `Ajustes`
([`cliente-shell.tsx:9-13`](../src/components/design/cliente-shell.tsx)).

### 1.3 Os sete blocos, campo a campo

De [`core/flow/schema.ts`](../src/core/flow/schema.ts):

| Bloco | Campos | Saídas |
|---|---|---|
| `mensagem` | `texto` | uma |
| `pergunta` | `texto`, `salvarEm?`, `opcoes[]`, `opcoesDe?` | **uma por opção**; dinâmica → `escolheu` e `vazio` |
| `condicao` | `variavel`, `operador` (`igual`/`diferente`/`contem`/`vazio`/`preenchido`), `valor` | `verdadeiro`, `falso` |
| `salvar-campo` | `campo`, `valor` (interpola) | uma |
| `ia` | `instrucao`, `salvarEm?` | uma |
| `handoff` | `motivo`, `mensagem` | **nenhuma** — acaba ali |
| `http` | `metodo`, `url`, `cabecalhos[]`, `corpo`, `mapear[]`, `aoFalhar`, `conexaoId?` | uma |

**Limites codificados:** `LIMITE_BOTOES 3` · `LIMITE_LISTA 10` ·
`LIMITE_ROTULO 20` · `LIMITE_TEXTO 4096` · `LIMITE_TEXTO_INTERATIVO 1024`
(os dois últimos entraram em `86a3140`).

### 1.4 As garantias do motor — o que ninguém precisa lembrar de desenhar

Estas são **vantagem estrutural** e aparecem várias vezes adiante:

- **Escape global:** "atendente", "humano", "falar com alguém" transferem de
  qualquer ponto
- **Anti hello-loop:** 3ª resposta não entendida → pessoa
- **Áudio, imagem e documento** → pessoa, nunca "não entendi"
- **Ciclo no desenho** estoura trava e chama humano
- **O validador recusa publicar fluxo sem caminho até humano**
- **Integração que falha** → pessoa, com o motivo real no painel
- **Falha de entrega vira handoff e para o resto das ações** — mandar a terceira
  depois da segunda ter falhado entrega conversa fora de ordem
- **Sessão presa à versão publicada** — editar às 15h não quebra a conversa das 14h

### 1.5 O banco

`clients` · `flows` · `flow_versions` · `channels` · `contacts` · `sessions` ·
`messages` · `handoffs` · `connections` (cofre) · `locks`, mais a view `leads`
(`security_invoker = true`).

**Colunas que importam para o que vem:** `contacts.campos jsonb`,
`messages.payload jsonb`, `sessions.status`, `sessions.criado_em`,
`messages.wa_message_id unique`.

**RLS ligada e sem nenhuma política, de propósito.** A chave que vai ao navegador
não lê nada; todo acesso passa pelo servidor.

### 1.6 O que não existe — a lista honesta

| Não temos | Consequência hoje |
|---|---|
| **Subfluxo** | Trecho reusado é redesenhado a cada uso |
| **Qualquer coisa baseada em tempo** | Sem sequência, sem lembrete, sem timeout de pergunta, sem horário de atendimento |
| **Mídia** (imagem, vídeo, arquivo, áudio de saída) | O motor só tem `enviar_texto` e `enviar_opcoes` |
| **Atraso / "digitando"** | Quatro parágrafos chegam no mesmo segundo |
| **Ação de notificar/atribuir pessoa** | O handoff avisa uma tabela e mais ninguém |
| **Equipe, papéis, atribuição** | Uma senha só, um operador |
| **Inbox** | Trocar de conversa é voltar → achar → clicar → esperar |
| **Etiquetas, notas, campos manuais** | Só existe o que o fluxo coletou |
| **Qualquer métrica** | O cliente renova por fé |
| **Modelos da Meta** | Fora das 24h não há como retomar |
| **Palavras-chave do cliente** | Só as de escape, fixas no motor |
| **Campanhas / origem do lead** | Um número → um fluxo, e não se sabe de onde veio |
| **Registros (auditoria)** | "Quem publicou isso?" não tem resposta |
| **Histórico de versões na tela** | `listarVersoes` existe no repo e nenhuma tela usa |
| **Formatação, contador de emoji, inserir variável por clique** | Textarea puro |

---

## Parte 2 — O que o BotConversa tem, tela a tela

Barra lateral, **11 itens** contra os nossos 4:

```
Painel de Controle · Contatos · Campanhas · Kanban · Transmissão · Inbox ·
Automação · Fluxos de conversa · Integrador · Configurações · Modelos
```

No rodapé, seletor de workspace: **um workspace por cliente**. O operador entra
*dentro* do cliente. O nosso é o oposto — um painel com todos os clientes — e é
o modelo certo para agência.

### 2.1 Painel de Controle

```
┌─ Gerenciamento de chats ────────────── [Este mês ▾] ─┐
│ ████████████████████████│░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Conversas 39 (100%)     │   Chatbot respondeu 11 (28%)│
└──────────────────────────────────────────────────────┘
┌─ Desempenho pessoal ────────────────── [Este mês ▾] ─┐
│ Atividade do chat          │ Métricas de tempo        │
│  👤 0        ↩ 0      🗄 0 │  [Mediana] Média         │
│  Atribuições Primeiras  Chats│  —  Até a 1ª resposta   │
│              respostas fechados│ —  Até o fechamento   │
└──────────────────────────────────────────────────────┘
┌─ Estatísticas por período ── [Novos Contatos ▾] [📈][📊] ┐
│ 14┤                                                  ╱  │
│  8┤        ╱╲          ╱╲                          ╱    │
│  4┤      ╱    ╲      ╱    ╲    ___    ╱╲    ___  ╱      │
│   └ ago1 ago2 ago3 ago4 ago5 … ago11 ago12 ago13        │
└──────────────────────────────────────────────────────────┘
┌─ Eventos personalizados ──────────────────── [Criar] ─┐
│                        👻                              │
│           Nenhum evento personalizado ainda            │
│  "Create custom events, integrate them into flows      │
│   with the Action Block, and track their statistics"   │  ← inglês em tela PT
│         [Adicionar primeiro evento personalizado]      │
└────────────────────────────────────────────────────────┘
```

### 2.2 Contatos

```
Contatos            [Importar Contatos ↑] [Baixe Relatório ↓] [Criar Contato 👤+]
┌ Mais popular ─┐ ┌─ [Filtros ▼]                    [🔍 Busca] ─┐
│ ETIQUETAS   ⌃ │ │ ☐ Usuários            WhatsApp    Inscrição │
│ ┌───────────┐ │ │ ☐ S Silvia Balbina   +5511985557718 13/08 15:20│
│ │primeira_  │ │ │     940225066                        ⋮      │
│ │mensagem_  │ │ │ ☐ S Silvia Oliveira  +5511962675114 12/08 11:13│
│ │nao_suport.│ │ │ ☐ C Claudinei        +5511999877286 12/08 08:13│
│ └───────────┘ │ │ ☐ T Tatiana Cerqueira+5511995260012 11/08 08:08│
│ SEQUÊNCIAS    │ │ ☐ L Lu               +5511943644979 10/08 19:14│
│   nenhum item │ │ ☐ K Kleber Corredor  +5511997447263 10/08 18:11│
│ CAMPANHAS     │ │ … (55 no total)                             │
│   nenhum item │ └─────────────────────────────────────────────┘
└───────────────┘
```

**A única etiqueta que existe é `primeira_mensagem_nao_suportada`** — a plataforma
marcando sozinha quem abriu a conversa com áudio ou mídia. Ser a única em uso diz
que isso acontece muito.

### 2.3 Campanhas

```
Campanhas                    [Baixe Relatório] [Criar Nova Campanha +]
Todas as Campanhas  0
                            🤖
              Você ainda não tem nenhuma campanha

┌─ Criar Nova Campanha ──────────────────────── ✕ ─┐
│  [ Nome                                        ] │
│  Fluxo                                           │
│  [ Selecionar                                ⌃ ] │
│  [ Insira a frase que vai iniciar o robô…      ] │
│  Por favor, não termine esta frase com ponto (.),│
│  exclamação (!) ou ponto de interrogação (?)     │
│  [           Criar Campanha                    ] │
└──────────────────────────────────────────────────┘
```

**Campanha = porta de entrada extra no mesmo número.** A frase vem no anúncio
Click-to-WhatsApp e leva a um fluxo específico.

### 2.4 Kanban

Empty state grande com mockup de produto em tamanho real — **de imobiliária**
("Visita agendada", "Assinatura do contrato", corretor, R$600 mil) numa conta de
estúdio de pilates. Modal de criação: nome + descrição.

No mockup, o card do negócio abre um painel lateral com `Manager` / `Chat` /
`Bot` — ou seja, **o kanban é uma dimensão do contato, não uma tela**.

### 2.5 Transmissão

```
Transmissão  [Ativas e Agendadas 📅] [Rascunhos 📝] [Histórico 🕐]
                                          [Criar Nova Transmissão +]
              Não Há Transmissões Agendadas

┌─ Criar Transmissão ─────────────────────────────────── ✕ ─┐
│ Configurações de Transmissão │ Segmentação   [Mostrar usuários]│
│ Nome                         │ Usuários que receberão: 55      │
│ [ Sem título          ] 0/30 │ (○) Enviar para contatos com    │
│ Fluxo                        │     automação pausada           │
│ Somente fluxos que começam   │                                 │
│ com um modelo de mensagem do │   Adicionar filtros para        │
│ WhatsApp estão disponíveis   │   refinar seu público           │
│ para transmissões.           │      ┌ Adicionar filtro ┐       │
│ [ Selecionar             ⌄ ] │      └─ ─ ─ ─ ─ ─ ─ ─ ─┘       │
├──────────────────────────────┴─────────────────────────────────┤
│ Definir hora e executar depois ☐          [ Iniciar agora ]    │
└────────────────────────────────────────────────────────────────┘
```

**A contagem do público antes de disparar (`55`) é o freio que evita o erro
caro.** E o aviso sobre modelo aprovado aparece **antes** de escolher o fluxo.

### 2.6 Inbox — a tela mais importante do conjunto

```
Inbox
┌ Atribuído ──┐┌ Conversas      + 🔔 ⚙┐┌ W Walter        🗄 ⋮ ┐┌ Perfil    ⋮ ✕ ┐
│ 👥 Todos  55││ [🔍 Busca          ] ││                      ││ 👤 Administrador│
│ 👻 Nenhum 55││ [Todos ▾] [Não lidas]││ ──── 31 julho ────   ││ Nenhum atendente│
│ E Meus chats││                      ││ ⓦ Boa tarde          ││ atribuído     ⌄│
│             ││ SB Silvia B.   15:37 ││   Comunico que não   ││ Chat            │
│Administrado.││    Plano trimest…  ✓✓││   poderei comparecer ││ Aberto        ⌄│
│ 🟣 Daniel M.││ SO Silvia O.    qua  ││   hoje               ││┌──────────────┐│
│ E  Eduardo  ││    Olá Silvia, q…  ✓✓││   Estou bom for de   │││ Automação    ││
│             ││ W  Walter       qua  ││   barriga      13:47 │││ está ligada  ││
│             ││    Ok Walter. Aul… ✓✓││      Oi boa tarde,   ││└──────────────┘│
│             ││ C  Claudinei    qua  ││      obrigada por    ││ Kanban       + │
│             ││    Obrigado.      ②  ││      avisar, melhoras││ Dados do Us. ② ⌃│
│             ││ @  🚶 Walk      ter  ││      pra você. 13:49✓✓││  Telefone       │
│             ││    🤔             ✓✓ ││                      ││  +5511964429299│
│             ││ S  Sarah        ter  ││ ──── 5 agosto ────   ││  E-mail      — │
│             ││ DG Daiene G.    ter  ││ ⓦ Talia              ││  Inscrição      │
│             ││    Boa tarde, tud… ④ ││   Parabéns pelo seu  ││  31/07/26 13:47│
│             ││ MD Marcia D.    ter  ││   aniversário…       ││  CPF         — │
│             ││ ●  🚫 Este tipo de   ││                15:32 ││  Registrado por│
│             ││    mensagem não…  ② ││      Oi Walter. O    ││  meio de: Direto│
│             ││ TC Tatiana C.   ter  ││      aniversário da  ││  Chat fecha em:│
│             ││ KC Kleber C.    ter  ││      Thalya será no  ││  Expirado      │
│             ││                      ││      dia 12/08 16:46✓✓││ Notas        + │
│             ││                      ││ ──── 6 agosto ────   ││ Etiquetas    + │
│             ││                      ││ ⓦ Então esqueça por  ││ Sequências   + │
│             ││                      ││   enquanto até a     ││ Campanhas    + │
│             ││                      ││   semana que vem kkkk││ Campos       + │
│             ││                      ││                12:39 ││ Personalizados │
│             ││                      ││      👍 kkk  12:40 ✓✓││                │
│             ││                      ││ ──── 12 agosto ────  ││                │
│             ││                      ││ ⓦ Havia marcado hoje ││                │
│             ││                      ││   às 18h00 mas eu não││                │
│             ││                      ││   vou poder compare- ││                │
│             ││                      ││   cer favor desmarcar││                │
│             ││                      ││   obrigado     10:28 ││                │
│             ││                      ││      Ok Walter.      ││                │
│             ││                      ││      Aula desmarcada.││                │
│             ││                      ││              11:14 ✓✓││                │
│             ││                      │├──────────────────────┤│                │
│             ││                      ││ Use uma mensagem     ││                │
│             ││                      ││ modelo para entrar em││                │
│             ││                      ││ contato após 24 horas││                │
│             ││                      ││ ⊕  📋  ✏️            ││                │
└─────────────┘└──────────────────────┘└──────────────────────┘└────────────────┘
```

**Cinco leituras desta conversa:**

1. **O bot não participou de nenhuma mensagem.** Doze dias de operação real —
   falta, remarcação, aniversário, cancelamento — tudo humano. O bot cuida da
   porta da frente; **o Inbox é onde o negócio acontece todo dia**.
2. **"Lead" é o nome errado para o Walter.** Ele é aluno há meses e nunca vai ter
   coluna preenchida na nossa tabela de leads.
3. **É um fio contínuo, não uma sessão** — separadores de data ao longo de meses.
4. **Três das quatro mensagens dele são da Agenda** ("não poderei comparecer",
   "favor desmarcar", "semana que vem"). É o [BRIEF-AGENDA.md](BRIEF-AGENDA.md)
   chegando por WhatsApp e sendo respondido no polegar. **É o melhor argumento
   comercial da Agenda que existe.**
5. **`✓✓` de lido.** Nós temos `entregue`; não temos leitura.

### 2.7 Automação

```
Automação   [Palavras Chave 🔗] [Sequências 🔀] [Webhooks 🕸]      [Criar]
Todas as Palavras-chave 1                              [🔍 Busca]
┌────────────────────────────────────────────────────────────────┐
│ Iniciar Fluxo              Mensagem       Execuções            │
│ PRINCIPAL - ATENDIMENTO ⌄  É ⌄            11        [●━] ⋮     │
│ testeux                    [testeux ✕] [+]                     │
└────────────────────────────────────────────────────────────────┘
```

**Palavras-chave** (gatilho global) e **Sequências** (disparo no tempo). Nós temos
escape fixo no motor e **nada** baseado em tempo.

### 2.8 Fluxos de conversa

```
Fluxos de conversa                    [Criar Pasta +] [Criar Novo Fluxo +]
Fluxos Padrões Básicos ⌄
┌ ─ ─ ─ ─ ─ ┐┌ ─ ─ ─ ─ ┐┌ ─ ─ ─ ─ ─ ─ ─ ┐┌ ─ ─ ─ ─ ─ ─ ─ ┐┌ ─ ─ ─ ─ ─ ─ ─ ┐
│ Selecionar││  Criar  ││ Fluxo de      ││ Fluxo padrão  ││ Fluxo Pós-    │
│ existente ││   novo  ││ resposta      ││ para mídia    ││ Atendimento   │
│           ││         ││ padrão        ││               ││               │
└ ─ ─ ─ ─ ─ ┘└ ─ ─ ─ ─ ┘└ ─ ─ ─ ─ ─ ─ ─ ┘└ ─ ─ ─ ─ ─ ─ ─ ┘└ ─ ─ ─ ─ ─ ─ ─ ┘
Todos os Fluxos                                        [🔍 Busca]
┌──────────────────────────────────────────────────────────────────┐
│ Nome                    Conexões  Execuções  CTR %  Última alter. │
│ PRINCIPAL - ATENDIMENTO    🔗        —         —    13/08/2026  ⋮ │
│ SUB - REAGENDAR             —        —         —    11/08/2026  ⋮ │
│ SUB - AGENDAR               —        —         —    11/08/2026  ⋮ │
└──────────────────────────────────────────────────────────────────┘
```

**Contei doze `Conexão de Fluxo` apontando para `SUB - AGENDAR`.** Doze caminhos
da conversa terminam no mesmo trecho, escrito uma vez.

E `SUB - REAGENDAR` não recebe nenhuma chamada que eu tenha achado — **provável
fluxo órfão**, invisível porque a coluna `Conexões` está vazia.

### 2.9 Integrador — três abas

```
Integrador                            ⓘ 0/5.000 ações utilizadas
[Automações] [Apps] [Histórico]
[Todos os grupos ⌄] [Todas Automações ⌄] [🔍 Buscar]
┌ ─ ─ ─ ─ ─ ─ ┐┌───────────────────┐┌───────────────────┐
│      +      ││ Automação #386230 ││ Automação #385271 │
│    Nova     ││ "De" selecione um ││ "De" selecione um │
│  automação  ││      app          ││      app          │
│             ││ "Em" o app não foi││ "Em" o app não foi│
│             ││    selecionado    ││    selecionado    │
│             ││ Transações: 0 tot ││ Transações: 0 tot │
│             ││ [▶ Executar] ⚙📋⋯ ││ [▶ Executar] ⚙📋⋯ │
└ ─ ─ ─ ─ ─ ─ ┘└───────────────────┘└───────────────────┘

Aba Histórico: [Histórico][Analytics]  Atualização em 09 seg   ID:767104
               Não foram encontrados dados
```

**Não é produto do BotConversa.** É um iPaaS de terceiro embutido — quase
certamente o **Albato**, que publica catálogo de conectores BotConversa. Sinais:
quota própria em "ações", numeração em outra faixa, um `ID:767104` que não aparece
em nenhuma outra tela, "Atualização em 09 seg", visual diferente do resto.

**E o resultado está no print: duas automações vazias criadas por acidente que
ninguém apagou**, e 5.000 ações que o cliente paga sem usar.

### 2.10 Configurações

```
Configurações
┌ Conexões ──────┐ WhatsApp   [Conta] [Modelos de mensagem]  [↻ Atualizar]
│ • WhatsApp     │ ┌──────────────────────┐┌──────────────────────┐
│ Geral          │ │ Nome de exibição     ││ Número conectado     │
│ • Companhia    │ │ 🟣 MGM PILATES  ✏️   ││ +55 11 93213-9312 📋│
│ • Equipe       │ └──────────────────────┘└──────────────────────┘
│ • Horário de   │ ┌──────────────────────┐┌──────────────────────┐
│   atendimento  │ │ ID da conta WhatsApp ││ Limites de mensagens │
│ • Inbox        │ │ Business             ││ 250 BICs / 24 horas ⓘ│
│ • Registros    │ │ 468946307261350 📋   ││                      │
│ • Faturamento  │ │              [CoEx]  ││                      │
│ • Integrações  │ └──────────────────────┘└──────────────────────┘
│ Automação      │ Status nº    Verif. empresa  Status conta  Crédito
│ • Campos       │ [Conectado]  [Não verificado] [Ativo]  [Compartilhado]
│ • Etiquetas    │
│ • Respostas    │ Automações
│   rápidas      │ ┌ Iniciadores de conversa ─────────┐
│ Preferências   │ │ [Configurar]                     │
│ • Notificações │ ├ Mensagem de boas-vindas ─────────┤
└────────────────┘ │ [Selecionar fluxo            ⌄]  │
                   ├ Resposta padrão ─────────────────┤
                   │ [Selecionar fluxo            ⌄]  │
                   └──────────────────────────────────┘
```

### 2.11 Modelos

Vazio: *"Ainda não há modelos / Crie o seu primeiro modelo"* + `[Criar]`.
São templates de **fluxo** — colidindo de nome com `Modelos de mensagem` (Meta),
que fica dentro de Configurações.

### 2.12 O editor — menu de blocos e painel

```
┌ + ──────────────────┐
│ ⚡ Ação             │   ┌─ Enviar mensagem ─────────────── ✕ ─┐
│ 🔽 Condição         │   │ Janela de mensagens de 24 horas  ⓘ  │
│ 🚀 Conexão de fluxo │   │  ● Dentro de    ○ Fora de           │
│ 🔀 Randomizador     │   ├─────────────────────────────────────┤
│ 🕐 Atraso           │   │ ┌───────────────────────────── ✕ ─┐ │
│    inteligente      │   │ │ Olá! 👋 Seja muito bem-vindo(a) │ │
│ 🎯 Integração       │   │ │ ao MGM Pilates. Eu sou a        │ │
│ 🤖 Assistente GPT   │   │ │ assistente virtual…             │ │
│ 💬 Enviar mensagem  │   │ │ [B][I][S][{}][☺]     196/1024   │ │
└─────────────────────┘   │ └─────────────────────────────────┘ │
                          │ ┌─────────────────────────────┐  >  │
                          │ │ 📅 Aula Experimental        │     │
                          │ ├─────────────────────────────┤  >  │
                          │ │ 👤 Já sou aluno(a)          │     │
                          │ ├─────────────────────────────┤  >  │
                          │ │ Mais Informações            │     │
                          │ └─────────────────────────────┘     │
                          │ ⓘ Você pode adicionar até 3 botões  │
                          │   de resposta                       │
                          ├─────────────────────────────────────┤
                          │ [Texto]   [Imagem]  [Vídeo]         │
                          │ [Arquivo] [Áudio]   [Salvar]        │
                          │ [Atraso]  [AutoOff] [Contato]       │
                          │ [Botão de lista]                    │
                          └─────────────────────────────────────┘
```

**O bloco deles é uma pilha de pedaços**; o nosso `mensagem` é
`data: { texto: string }` — um `<textarea rows={4}>`
([`painel.tsx`](../src/components/editor/painel.tsx)).

### 2.13 Visualização — o teste com cara de WhatsApp

```
Todas as alterações salvas   [Modo edição 🔴] [Compartilhar fluxo →]
        ┌─ 📱 Visualização ──────────────── ↻  ⤢ ─┐
        │ 👤 Danilo Fogaça   Ir para o cartão do  │
        │                        contato →        │
        ├─────────────────────────────────────────┤
        │ ░░░ (papel de parede do WhatsApp) ░░░  │
        │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
        │ ┌─────────────────────────────────┐    │
        │ │ Olá! 👋 Seja muito bem-vindo(a) │    │
        │ │ ao MGM Pilates.                 │    │
        │ │ Eu sou a assistente virtual e   │    │
        │ │ vou te ajudar da forma mais     │    │
        │ │ rápida possível.                │    │
        │ │ Antes de começarmos, qual opção │    │
        │ │ mais se adequa ao que você      │    │
        │ │ esta buscando?           20:40  │    │
        │ ├─────────────────────────────────┤    │
        │ │ ↩  📅 Aula Experimental         │    │
        │ ├─────────────────────────────────┤    │
        │ │ ↩  👤 Já sou aluno(a)           │    │
        │ ├─────────────────────────────────┤    │
        │ │ ↩  Mais Informações             │    │
        │ └─────────────────────────────────┘    │
        ├─────────────────────────────────────────┤
        │ (+) [                          ]  🎤   │
        └─────────────────────────────────────────┘
```

**Alternador `Modo edição` ↔ `Visualização`** no cabeçalho, painel flutuante
sobre o canvas, e **o teste roda como um contato nomeado** com link para o cartão
dele.

### 2.14 Compartilhar fluxo

```
┌─ Compartilhar esse fluxo ──────────────── ✕ ─┐
│ Habilitar link para compartilhamento     [●━]│
│ ┌──────────────────────────────────────────┐ │
│ │ https://app.botconversa.com.br/share-flow│ │
│ │ ?share_code=50b7de7c-7436-4473-ab75-…  📋│ │
│ └──────────────────────────────────────────┘ │
│ Quem pode copiar este fluxo?                 │
│  ◉ Qualquer usuário com acesso ao link       │
│  ○ Ninguém                                   │
│  ○ Apenas empresas listadas por mim          │
└──────────────────────────────────────────────┘
```

### 2.15 O fluxo do MGM, lido inteiro

```
Bloco Inicial → Ação: Reiniciar automação → Mensagem de boas-vindas (196/1024)
   │
   ├── [📅 Aula Experimental] → "Excelente escolha ✨…" + Atraso 1s ⇢ SUB-AGENDAR
   │
   ├── [👤 Já sou aluno(a)] → "Olá! 😊 Como podemos ajudar?"
   │       └── [Reagendar aula] ⇢ SUB-AGENDAR
   │
   └── [Mais Informações] → "Em que podemos ajudar?"
           ├── [📍 Localização] → Av. Paulista, 352-55, CEP 01310 🎁
           │                     → "Podemos ajudar em algo Mais?"
           ├── [💰 Valores] → "Nossos planos variam conforme a frequência…"
           │       ├── [Agendar aula] ⇢ SUB-AGENDAR
           │       └── [Atendimento]  → "Iremos lhe direcionar para um dos
           │                             membros da nossa equipe! 🎁"
           │                           → Ação: notificar Daniel Mutti (WhatsApp)
           └── [😀 Serviços] → "Sobre qual assunto?"
                   ├── [Pilates] → "O que você está buscando?"
                   │      ├── [Agendar aula]     ⇢ SUB-AGENDAR
                   │      ├── [Personal Pilates] → texto longo + Atraso 1s
                   │      │        ├── [Agendar aula] ⇢ SUB-AGENDAR
                   │      │        └── [Obrigado(a)]  → "Tenha um ótimo dia 😊" ⚠
                   │      └── [Tirar dúvida] → "Tire suas Dúvidas Sobre o Pilates!"
                   │             ├── [O que é?]       → texto+Atraso → "Que tal agendar?"
                   │             ├── [Metodologia]    → texto+Atraso → "Que tal agendar?"
                   │             └── [Como funciona?] → texto+Atraso → "Que tal agendar?"
                   ├── [Fisioterapia] → texto + Atraso (Digitando 1 seg)
                   │        → "Qual é o seu nome?"  (salva em `Nome para Fisio`)
                   │             ├── resposta válida    → Ação: atribuir e abrir
                   │             │                        atendimento (Daniel Mutti)
                   │             │                      → "Em breve entraremos…"
                   │             └── se não responder   → (outro caminho)   ⏱
                   └── [Voltar ao Menu] ⇢ PRINCIPAL - ATENDIMENTO

"Podemos ajudar em algo Mais?"   (reaproveitado em vários pontos)
   ├── [📅 Agendar aula]  ⇢ SUB-AGENDAR
   ├── [No momento não!]  → Integração: Google Sheets → Insert a new row
   │                        (planilha "LISTA DE TURMA E PRESE…")
   └── [Voltar ao Menu]   ⇢ PRINCIPAL - ATENDIMENTO
```

**⚠ Pelo menos cinco folhas terminam em "Muito obrigado! Tenha um ótimo dia 😊" —
sem nenhum caminho até uma pessoa.** O nosso validador **recusaria publicar este
fluxo**. É a melhor evidência empírica de que a regra do handoff obrigatório é
boa: ela pega um fluxo real, em produção, num cliente pagante.

**⏱ A pergunta "Qual é o seu nome?" tem saída para "se usuário não responder".**
Nossa `pergunta` fica parada no nó para sempre.

### 2.16 A tabela de blocos: eles × nós

| Bloco deles | Nosso | Situação |
|---|---|---|
| Enviar mensagem | `mensagem` + `pergunta` | esqueleto igual, **conteúdo 10× mais pobre** |
| Condição | `condicao` | **paridade** |
| Assistente GPT | `ia` | **paridade** (a nossa é fechada no contexto, de propósito) |
| Integração | `http` | **mais poderoso, menos usável** |
| Ação | `handoff` (parcial) | falta notificar, atribuir, etiquetar |
| Conexão de fluxo | — | **não existe** |
| Atraso inteligente | — | **não existe** |
| Randomizador | — | não existe, e não precisa |
| — | `salvar-campo` | **só nós** |
| — | **pergunta dinâmica** (`opcoesDe`) | **só nós, e é a melhor peça** |
| — | credencial por referência no cofre | **só nós** |
| — | versão publicada imutável | **só nós** (a confirmar neles) |

---

## Parte 3 — O que fazer

Cada item no mesmo formato: **hoje** · **lá** · **estado esperado** · **como
fazer** · **tamanho**.

Tamanho em **rodadas**, não em dias. Uma rodada = construir + você revisar +
validar. Pelo histórico do repo (motor, simulador, banco, editor, publicação e
webhook em 55 minutos no dia 11/08), o gargalo é revisão, não construção.

---

### ✅ 0. Consertos — feito, commit `86a3140`

**Hoje era:** não existia limite de tamanho de mensagem em lugar nenhum. Dava
para escrever 3.000 caracteres numa pergunta com botões, publicar, e a Meta
recusar a mensagem inteira em produção — a pessoa não recebe nada. E a ajuda dos
cabeçalhos do bloco de API dizia que o cofre não existia e **mandava usar n8n**,
15 linhas acima do seletor de Credencial que diz "o valor fica no cofre".

**Estado atual:** `LIMITE_TEXTO 4096` e `LIMITE_TEXTO_INTERATIVO 1024` no schema,
validador barrando com `TEXTO_LONGO`, contador no painel que **mostra e não
corta**, três testes novos, e o texto do cofre corrigido. 248 testes verdes.

---

### ✅ 1. Atribuição de anúncio (`referral`)

**Hoje era:** [`receber-mensagem.ts`](../src/server/receber-mensagem.ts) — o
`webhookSchema` lê `metadata`, `contacts` e `messages`. **Não lê `referral`.**
Quando alguém chega por anúncio Click-to-WhatsApp, a Cloud API manda junto da
primeira mensagem um objeto com `source_id` (o anúncio), `source_url`,
`headline`, `body` e `ctwa_clid`. Descartamos no parse.

**Lá:** campo `Registrado por meio de: Direto` no perfil do contato, e a tela de
Campanhas inteira construída em cima disso.

**Estado atual:** a tabela de leads mostra `origem`, `origem_anuncio` e
`origem_titulo` em colunas criadas sozinhas. `Direto` para quem chegou sem
anúncio. A atribuição acontece sob a trava do contato e só enquanto `origem` não
existe, então uma mensagem futura não apaga a aquisição verdadeira nem campos
coletados pelo fluxo.

**Como foi feito:**
1. Acrescentar `referral` ao `mensagemSchema` (opcional, todos os campos
   opcionais — a Meta muda o formato sem avisar)
2. Em `tratarUma`, gravar `origem` como `Anúncio` ou `Direto`; quando houver
   `referral`, acrescentar `origem_anuncio` e `origem_titulo`
3. Gravar só na **primeira** vez: o `referral` só vem na mensagem que abre a
   conversa, e sobrescrever apagaria a origem verdadeira numa volta futura
4. Teste com payload real de `referral` em `receber-mensagem.test.ts`

**Não precisa de migration** — `contacts.campos` já é `jsonb` e a tabela de leads
já cria coluna a partir dos campos
([`leads/page.tsx:47-55`](../src/app/clientes/%5BclienteId%5D/leads/page.tsx)).

**Tamanho:** meia rodada. **É a melhor relação impacto/custo de toda a análise** —
cliente 01 é tráfego pago e essa pergunta não tem resposta hoje.

---

### ✅ 2. Funil e execuções

**Hoje era:** nenhuma métrica em lugar nenhum.

**Lá:** `Conversas 39 (100%) → Chatbot respondeu 11 (28%)`, execuções por
palavra-chave, e as colunas `Execuções`/`CTR %` na lista de fluxos (vazias no
print — o mesmo número existe em três telas e aparece numa).

**Estado atual:** no início do cliente, uma faixa mostra conversas deste mês,
resolvidas pelo bot com percentual, esperando pessoa e os três números do mês
anterior. Na lista de fluxos, cada automação mostra suas execuções históricas.

**Como foi feito:**
1. A view `metricas_sessoes` agrupa no Postgres por cliente, fluxo, mês de São
   Paulo e desfecho; o índice começa em `flow_version_id`
2. `repos/metricas.ts` lê a mesma agregação para o funil e para as execuções,
   sem N+1 e sem trazer cada sessão para o Next
3. `encerrada` só significa “resolvida pelo bot” quando a sessão nunca teve
   handoff — “Já atendi” também encerra sessão e não pode virar mérito do bot
4. O teste cobre mês atual/anterior, virada UTC × São Paulo, duas automações,
   isolamento entre clientes e atendimento humano já resolvido

**Tamanho:** meia rodada. Já é um `group by` — o dado existe desde a migration
`0003`.

---

### 3. Etiquetas automáticas

**Hoje:** não existe etiqueta. Tratamos mídia (garantia do motor) e não contamos.

**Lá:** `primeira_mensagem_nao_suportada` é a **única** etiqueta em uso no MGM —
o que diz que abrir conversa com áudio acontece muito.

**Estado esperado:** filtros na tabela de leads por "abriu com áudio/mídia", "foi
para pessoa", "nunca respondeu depois da primeira".

**Como fazer:** todas são **derivadas de dado que já existe** — `messages` e
`handoffs`. Nada de escrita nova, nada de migration. Uma função que classifica o
lead na leitura, e chips de filtro na tabela.

**Tamanho:** meia rodada.

---

### 4. Atraso e "digitando…"

**Hoje:** o motor devolve todas as ações de uma vez e
[`receber-mensagem.ts`](../src/server/receber-mensagem.ts) aplica em sequência.
Quatro parágrafos chegam no mesmo segundo.

**Lá:** todos os ramos longos do MGM têm `Atraso — Digitando 1 seg` antes das
mensagens de venda.

**Estado esperado:** campo opcional `atraso` (segundos) no bloco de mensagem. O
canal espera e, quando der, manda o indicador de digitando.

**Como fazer:**
1. `atraso?: number` no `noMensagemSchema`, com teto (3s)
2. O motor **não dorme** — ele descreve: a ação `enviar_texto` ganha `atrasoMs`
3. Quem dorme é o canal
4. **A armadilha:** `after()` tem `maxDuration = 60` e tempo de função é cobrado.
   Por isso o teto de 3s. **Atraso maior tem que virar agendamento (item 12)** —
   decidir isso agora custa nada, descobrir depois custa reescrever o canal
5. No simulador, o atraso é visual (já existe indicador de digitando)

**Tamanho:** meia rodada.

---

### 5. Pele de WhatsApp na aba Testar

**Hoje:** [`conversa.tsx`](../src/components/conversa.tsx) desenha bolhas com as
cores do painel e escreve, em fonte mono, `no WhatsApp isto vira botões`.
**Explicamos com texto o que dá para mostrar com pixel.**

**Lá:** papel de parede, bolhas brancas, botões renderizados como o WhatsApp
renderiza (largura total, ↩ verde), horário, contato nomeado.

**Estado esperado:** alternador **`Conversa` / `Bastidores`** dentro do painel.
`Conversa` = fidelidade visual. `Bastidores` = o que já temos, que é **superior
ao deles** e não pode ser perdido: eventos inline (`guardou nome = "joao"`,
`passou para um humano — {motivo}`), o 🎤 que testa mídia de verdade, o aviso de
fluxo desatualizado, e o aviso de que testar API grava de verdade.

**Como fazer:**
1. Estado `modo` no componente; a lista de itens é a mesma, muda o desenho
2. Em `Conversa`, item de sistema some (fica no contador "N eventos")
3. Botões com o desenho real: até 3 = botões largura total; acima = lista
4. Sempre visível: **reiniciar**
5. **Extra que vale:** testar como um lead existente — carregar as `vars` de um
   contato real. O motor já aceita, porque `executar(fluxo, sessao, entrada)`
   recebe a sessão pronta. Resolve "por que quebrou com a Maria?"

**Tamanho:** uma rodada.

---

### 6. Inserir `{{variavel}}` por clique

**Hoje:** o painel **já lista** as variáveis do fluxo
([`painel.tsx:251-264`](../src/components/editor/painel.tsx)) — para copiar à mão.

**Estado esperado:** clicar insere no cursor do campo em foco.

**Tamanho:** um quarto de rodada.

---

### 7. Ação: notificar pessoa

**Hoje:** `handoff` tem dois campos — `motivo` e `mensagem`. Avisa o painel e
mais ninguém. Se o operador não estiver com a tela aberta, o lead quente espera.

**Lá:** `Ação → Notificar membro da equipe: Daniel Mutti por WhatsApp` e
`Ação → Atribuir e abrir atendimento: Daniel Mutti`.

**Estado esperado:** o handoff manda mensagem no WhatsApp de quem atende, com o
nome do lead, o motivo e o link para a tela dele.

**Como fazer:**
1. Números de notificação no cadastro do cliente (migration pequena, ou
   `clients.config jsonb`)
2. `handoff` ganha campo opcional "avisar"
3. O envio é **efeito de servidor**, junto do resolvedor — o motor não faz rede
4. **Falha ao notificar não pode derrubar a conversa** — o handoff já aconteceu;
   avisar é melhor-esforço, com registro
5. Fora da janela de 24h isso exige modelo aprovado (item 13) — enquanto não
   houver, vale só para quem trocou mensagem nas últimas 24h. **Dizer isso na
   tela**

**Tamanho:** uma rodada.

---

### 8. Horário de atendimento

**Hoje:** o motor não sabe que horas são. `src/core/` não lê relógio.

**Lá:** `Configurações → Geral → Horário de atendimento`. E no print do Inbox o
bot do MGM responde *"Não estamos disponíveis no momento"* **às 11h12** — resposta
fora de hora, em horário comercial.

**Estado esperado:** cada cliente define os horários; fora deles o fluxo pode
desviar.

**Como fazer:**
1. **`agora` entra por parâmetro:** `executar(fluxo, sessao, entrada, { agora })`.
   Mesmo padrão que a base já usa em `FabricaDeCanal`. **A pureza fica intacta e
   o teste fica determinístico**
2. Operador novo na `condicao`: `dentro_do_horario`
3. Horários e fuso no cadastro do cliente
4. Teste com horário fixo, sem depender do relógio da máquina

**Tamanho:** uma rodada.

---

### 9. Respostas rápidas e 10. Automação ligada/desligada

**Hoje:** quem atende digita as mesmas cinco frases o dia inteiro. E "responder
assume a conversa" / "Já atendi" existem, mas como consequência de uma ação —
não como interruptor visível.

**Estado esperado:** lista de respostas rápidas na caixa de resposta; e no lead,
um estado claro **"Automação está ligada / desligada"** que dá para alternar.

**Tamanho:** meia rodada cada.

---

### 11. Inbox

**Hoje:** `/leads` (tabela) e `/leads/[id]` (uma página por pessoa). Trocar de
conversa é voltar → achar → clicar → esperar a página.

**Lá:** quatro painéis numa tela só; trocar de conversa é um clique.

**Estado esperado:** **duas telas, não uma.** `Leads` continua sendo a tabela de
qualificação (dono/gestor: quem entrou, o que o bot coletou). `Inbox` é novo (quem
atende: com quem eu falo agora).

**Como fazer:**
1. Lista de conversas — a view `leads` (migration `0004`) já junta contato +
   última mensagem + handoff aberto. Falta contagem de não lidas e ordenação
2. Tela de três painéis, seleção no cliente, **sem navegação**
3. Fio contínuo: separadores de data e "carregar mais antigas" em vez de cortar
   com aviso
4. Painel de dados à direita, reusando o que a tela do lead já mostra

**Fora desta etapa, de propósito:** atribuição a atendente. "Meus chats" só
significa algo com mais de um usuário — entra com papéis (item 15).

**Tamanho:** uma a duas rodadas.

---

### 12. Agendador

**Hoje:** nada baseado em tempo existe.

**Estado esperado:** uma tabela de "coisas para fazer depois" e um cron que a
consome.

**Por que primeiro que sequências:** **destrava três features de uma vez** —
sequências (13), timeout de pergunta (14) e os lembretes que a Agenda vai querer
disparar ([BRIEF-AGENDA.md](BRIEF-AGENDA.md) §"No outro sentido").

**Restrição dura:** o motor roda serverless **sem estado vivo**. Agendador aqui é
**tabela + cron**, nunca temporizador na memória.

**Tamanho:** uma rodada.

---

### 13–14. Modelos da Meta, "janela 24h" no bloco, Sequências, Timeout, Transmissão

🔒 **Travado na Meta** (modelo aprovado) e parcialmente no cliente.

| Item | Hoje | Estado esperado |
|---|---|---|
| **Modelos da Meta** | Fora da janela de 24h não há como retomar. Item 2 da fila do ESTADO | Cadastro, sincronização e envio de modelo aprovado |
| **"Dentro / Fora da janela" no bloco** | Não existe | O bloco declara em que regime roda. **Sem isso o cliente desenha uma retomada que falha no envio e ninguém descobre até o lead sumir** |
| **Sequências** | Não existe | Dia 1, dia 3, dia 7. **É o que ataca o "morno esfria" do cliente 01** |
| **Timeout de pergunta** | A conversa fica parada no nó para sempre | Saída "se não responder em X" — o MGM tem isso no ramo Fisioterapia |
| **Transmissão** | Não existe | Envio segmentado, **com a contagem do público antes de disparar** |

**Tamanho:** duas a três rodadas, depois da Meta liberar.

---

### 15. Papéis de usuário

🔒 **Não é pré-requisito para construir. É pré-requisito para o primeiro cliente
logar.** Enquanto o painel for só nosso, não há escalada — há uma senha que já dá
acesso a tudo.

**No dia em que um cliente ganhar login, duas coisas do [ESTADO.md](ESTADO.md)
entram junto e não depois:**

- `/api/simular` aceita fluxo inventado + `fluxoId` de qualquer cliente e manda a
  credencial dele para a URL do corpo
- a sessão do painel é `SHA-256(senha)` pura, sem nonce e sem carimbo — cookie
  copiado vale para sempre e não há como revogar um acesso só

Mais: login de verdade, papéis (operador / cliente somente-leitura), isolamento
por cliente, atribuição de conversa no Inbox, e **Registros** (quem publicou o
quê).

**Tamanho:** duas rodadas.

---

### 16. Subfluxos

**Hoje:** um fluxo é um grafo e acabou.

**Lá:** doze `Conexão de Fluxo` apontando para `SUB - AGENDAR`.

**Estado esperado:** um bloco que chama outro fluxo; o trecho de agendamento
escrito uma vez e usado de doze lugares.

**Como fazer:**
1. **Decidir se volta ao chamador.** Pelos prints parece **pulo sem volta**. Sem
   volta simplifica muito — a sessão só troca de grafo. Com volta exige pilha na
   sessão, que hoje é plana. **Recomendação: sem volta**
2. Nó `sub-fluxo` no schema, motor e validador
3. **O validador precisa recusar ciclo entre fluxos**, não só dentro de um
4. **Congelamento em cascata:** publicar A congela o grafo de A **e** a versão
   publicada de cada subfluxo alcançável. Sem isso, a conversa das 14h se vê num
   bloco que não existe mais — que é a razão de `flow_versions` existir
5. Navegação entre fluxos no editor
6. Coluna "chamado por N fluxos" na lista — **fluxo órfão fica visível**, e o
   `SUB - REAGENDAR` do MGM parece ser um

**Tamanho:** uma a duas rodadas.

---

### 17. Integrações de primeira parte

🔒 **Travado na Agenda existir.**

**Hoje, ligar a Agenda num fluxo seriam sete passos**, cinco deles digitação
exata: cadastrar credencial → arrastar bloco API → escolher GET → digitar
`https://agenda.4yu.com.br/disponibilidade?dia={{dia}}` → mapear `livres` →
arrastar pergunta dinâmica → apontar `opcoesDe` → ligar `escolheu` e `vazio`.

**Estado esperado:** `Conectar Agenda 4YU` → autoriza → token provisionado pelo
servidor e Conexão criada sozinha. No editor, bloco **`Agenda: horários livres`**
já com método, endereço, mapeamento e as duas saídas.

**O que preserva a arquitetura:** preset **não é tipo de nó novo** — é um `http`
pré-preenchido com rótulo. O motor continua com sete tipos, o validador é o
mesmo, e a versão publicada congela um `http` comum, então mudança na API da
Agenda **não quebra fluxo publicado**.

**Tamanho:** uma rodada.

---

### 18. Alavanca de agência

| Item | Estado esperado | Tamanho |
|---|---|---|
| **Campanhas** | Várias portas de entrada por número — dois anúncios, dois atendimentos | 1 rodada |
| **Compartilhar / instalar fluxo** | Barateia o setup de R$1.800 a partir do 2º cliente do mesmo ramo | 1 rodada |
| **Palavras-chave do cliente** | `cancelar`, `segunda via`, `horário`, somadas às de escape do motor | ¼ rodada |
| **Fluxos padrão configuráveis** | Boas-vindas, resposta padrão, mídia, pós-atendimento. **A garantia continua no motor**; o que muda é qual fluxo ela chama | ½ rodada |

---

### 19. Mídia no motor

**Hoje:** só `enviar_texto` e `enviar_opcoes`
([`types.ts:70-78`](../src/core/engine/types.ts)).

**Adiado, não descartado.** Exige mídia no motor, no canal e no simulador. Entra
quando um cliente pedir a foto do espaço — o que num estúdio de pilates é
questão de tempo.

**Tamanho:** uma a duas rodadas.

---

## Parte 4 — Ordem, rodadas e travas

### As três travas que não são código

| Trava | O quê | Bloqueia |
|---|---|---|
| 🔒 **Meta** | verificação da empresa → Provedor de Tecnologia → Embedded Signup v4 (o v2 morre em **15/out/2026**) | Modelos, Sequências, Transmissão, atender cliente novo |
| 🔒 **Agenda** | o SaaS existir com API | Integrações de primeira parte |
| 🔒 **Cliente** | a Prelúdio topa o bot falar faixa de preço? | O desenho do fluxo do cliente 01 |

### A ordem

| Rodada | Itens | Resultado |
|---|---|---|
| **1** | 1 · 2 · 3 · 4 · 6 | Sabe de onde vem o lead, tem o número da renovação, e o bot deixa de despejar parágrafo |
| **2** | 5 · 9 · 10 | O teste tem cara de WhatsApp; quem atende trabalha mais rápido |
| **3** | 7 · 8 | O lead quente chega em quem atende, no horário em que o negócio funciona |
| **4–5** | 11 | Inbox |
| **6–7** | 16 | Subfluxos — aguenta atendimento de tamanho real |
| **8** | 12 | Agendador (destrava três) |
| *quando a Meta liberar* | 13 · 14 | Lead morno volta |
| *quando o 1º cliente logar* | 15 | Papéis + os dois furos de segurança |
| *quando a Agenda existir* | 17 | AutoFluxos + Agenda em um clique |
| *do 2º cliente do ramo em diante* | 18 | Setup barato |
| *quando alguém pedir foto* | 19 | Mídia |

### Por que esta ordem

1. **Itens 1–4 primeiro porque são pequenos e vendem.** Enquanto a Meta não
   libera, o que dá para melhorar é o que se mostra numa reunião e o que prova
   valor a quem já paga. Nenhum depende de nada.
2. **Inbox antes de subfluxo** porque o Inbox atende cliente que já existe (o MGM
   opera assim hoje) e subfluxo atende fluxo que ainda não foi desenhado.
3. **Agendador antes de sequências** porque ele destrava três coisas e não tem
   trava.
4. **Papéis quando o cliente for logar** — nunca depois.

### Se for para escolher um bloco só

**Rodada 1.** O item 1 sozinho já responde uma pergunta que o cliente 01 tem hoje
e nós não sabemos responder.

---

## Parte 5 — O que não fazer

| Descartado | Por quê |
|---|---|
| **Kanban / CRM** | Outro produto. A coluna `Situação` já é o embrião certo se um dia virar |
| **Integrador (iPaaS)** | O BotConversa alugou e o print mostra o preço: duas automações vazias e 5.000 ações que ninguém usa. A regra do ESTADO.md — *"faltou peça? constrói a peça"* — sai **reforçada** |
| **Randomizador (A/B)** | Volume não justifica |
| **Eventos personalizados** | Métrica sem pergunta é dado morto |
| **Escolha explícita botão × lista** | A nossa inferência pela quantidade é melhor — não dá para escolher errado |
| **`Reiniciar automação`** | Gambiarra deles para destravar sessão presa. A nossa fica presa à versão publicada e não tem o problema |
| **Seções de perfil arrastáveis** | Personalização cara para um problema que ninguém tem |

### Erros deles que viram regra nossa

1. **Um nome, uma coisa.** "Modelos" (fluxo) × "Modelos de mensagem" (Meta). E
   **três lugares chamados automação**. Quando os nossos Modelos da Meta
   existirem, **não podem se chamar só "Modelos"**.
2. **Não crescer a lateral por acumulação.** 11 itens contra os nossos 4. Cada
   item desta lista precisa achar casa em `Fluxos`, `Leads`/`Inbox` ou `Ajustes`
   antes de virar item novo.
3. **Painel que mostra zero ensina a não abrir.**
4. **Métrica sem referência não é informação** (`28%` sozinho).
5. **Empty state ensina o negócio de quem está olhando**, não o de outro segmento.
6. **Id de banco não aparece na tela.**
7. **O mesmo número em três telas, exibido em uma.**

---

## Parte 6 — Perguntas em aberto

| Pergunta | Por que importa | Como responder |
|---|---|---|
| **O BotConversa versiona fluxo?** | Nenhum print mostra "publicar" — só *"alterações salvas automaticamente"*. Se editar altera o que está no ar na hora, é diferença grande a nosso favor | Testar numa conta. **Confirmar antes de afirmar em reunião** |
| **`Conexão de fluxo` volta ao chamador?** | Decide a implementação do item 16 | Observação nos prints sugere que não |
| **Subfluxo nosso: volta ou não?** | Sem volta simplifica muito | **Decisão sua** |
| **Inbox substitui Leads ou vive ao lado?** | Minha recomendação é ao lado | **Decisão sua** |
| **A Prelúdio topa faixa de preço?** | Muda o fluxo inteiro do cliente 01 | Conversa comercial |
| **O que `Iniciadores de conversa` faz?** | Talvez seja ice breaker da Meta, que é grátis | Doc da Meta |
| **`Sequências` deles respeita a janela de 24h?** | Se não respeitar, é armadilha que a gente não deve copiar | Testar |
| **A verificação da empresa do cliente é mesmo dispensável?** | Muda o discurso de venda | Doc da Meta |
