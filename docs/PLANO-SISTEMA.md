# O sistema completo — tela a tela, a partir dos 18 prints

Escrito em **17/ago/2026**. Substitui a fase D em diante do
[PLANO-PRODUTO.md](PLANO-PRODUTO.md), que ficou pequeno demais depois da
decisão de 17/ago: **a conta é do cliente, e ele faz tudo nela.**

Este documento responde uma pergunta só: **quais telas existem, o que cada uma
faz, e o que o banco precisa ter para elas funcionarem.** Ordem e critério de
aceite estão no [PLANO-MESTRE.md](PLANO-MESTRE.md); o porquê de cada feature
continua em [EXPANSAO.md](EXPANSAO.md).

> **Fonte:** 18 prints do BotConversa na conta MGM Studio Pilates (workspace
> `210139`), incluindo o editor aberto bloco a bloco, o painel de controle com
> números reais e o menu de partes da mensagem. Cada linha da seção 3 aponta o
> print de onde saiu.

---

## 1. A decisão que reorganiza tudo

Até agora o AutoFluxos era **um painel de agência**: um operador da 4YU entra,
vê todos os clientes, desenha os fluxos de todos. O cliente não entra.

A partir de agora são **dois produtos com o mesmo banco**:

| | Administrador (4YU) | Cliente (dono da conta) |
|---|---|---|
| Entra em | `/admin` | `/` (a conta dele) |
| Vê | todas as contas, todos os usuários, auditoria | **só a conta dele** |
| Faz | cria conta, convida dono, entra como | **tudo**: cria, edita, publica, apaga |
| Navega por | sidebar de administração | sidebar do produto |

E a ponte entre os dois: **"entrar como"**. O administrador abre a conta de um
cliente e passa a ver exatamente o que ele veria — não a senha dele, uma sessão
marcada como impersonada, com prazo e registro.

**Consequência que não é óbvia:** o editor de fluxo, as conexões, o acervo e a
publicação deixam de ser "coisa nossa". Eles são do cliente. Tudo que hoje
assume "quem está logado pode tudo em qualquer cliente" precisa passar a provar
**de qual conta** a pessoa é. Isso não é uma tela — é uma varredura no código
inteiro, e é a fase 1.

---

## 2. A navegação

Fim das abas no topo. Sidebar à esquerda, com colapso (print 12 mostra a deles
colapsada em ícones), identidade da conta no rodapé e o **seu** usuário no canto
superior direito (prints 1 e 4).

### 2.1 Sidebar do cliente

```
┌─────────────────────┐
│  ▣ AutoFluxos    ⧉  │  ⧉ = colapsar
├─────────────────────┤
│ ⌂  Painel           │  números do mês, funil, gráfico
│ ✉  Inbox            │  atender, atribuir, responder
│ ☺  Contatos         │  quem é quem, etiquetas, importar
│ ⑂  Automações       │  → Fluxos · Gatilhos · Sequências · Modelos de fluxo
│ ◈  Campanhas        │  → Campanhas · Transmissões
│ ▤  Quadros          │  kanban do funil
│ ⇄  Integrações      │  serviços externos, credenciais, webhooks
│ ⚙  Configurações    │  perfil, número, equipe, horário, etiquetas,
│                     │    respostas rápidas, acervo, mensagens aprovadas
└─────────────────────┘
│ MS  MGM Pilates  ›  │  conta atual
└─────────────────────┘
```

**Oito itens, não onze.** O EXPANSAO já tinha escrito a regra depois de contar os
deles: *não crescer a lateral por acumulação*. Três decisões saem disso:

1. **`Automações` junta o que eles espalham em dois lugares.** Eles têm
   `Automação` (palavras-chave, sequências, webhooks) **e** `Fluxos de conversa`,
   e o EXPANSAO já registrou isso como erro deles: *três lugares chamados
   automação*. Aqui é um item com abas.
2. **`Campanhas` e `Transmissão` viram um item.** Os dois são "alcançar gente";
   separá-los obriga a decidir qual é qual antes de saber o que se quer fazer.
3. **`Modelos` não vira item de menu.** É a regra do print 12, dita pelo próprio
   operador: *"o uso só é prático para quem tem muitos clientes"*. Modelo de
   **fluxo** entra como aba de Automações; **mensagem aprovada pela Meta** entra
   em Configurações. E os dois **não podem se chamar a mesma coisa** — colidir
   `Modelos` com `Modelos de mensagem` é o erro nº 1 da lista deles.

### 2.2 Sidebar do administrador

```
│ ▤  Contas           │  lista de clientes, criar, entrar como
│ ☺  Usuários         │  quem existe, papel, convite, sessões
│ ⚑  Auditoria        │  quem publicou, quem entrou como quem
│ ♡  Saúde            │  entregas falhando, números, cotas, alertas
│ ⚙  Plataforma       │  configuração global
```

### 2.3 Cabeçalho (prints 3, 4, 5)

- **🔔 Notificações** — abas `Todos · Menções · Não lidas`, com engrenagem.
  *(No print delas o estado vazio está **em inglês** numa tela em português. É o
  tipo de descuido que a gente não copia.)*
- **? Ajuda** — Central de ajuda, Relatar bug, Comunidade.
- **Avatar** — nome, *Ir para o perfil*, **status `Disponível`/`Ausente`**,
  idioma, opções de login, sair.

O status de presença não é enfeite: é o que o Inbox usa para saber a quem
atribuir e para mostrar quem está online.

### 2.4 Faixa de impersonação

Quando o administrador entra como cliente, uma faixa fixa no topo diz de quem é
a conta e oferece **sair**. Sem ela, é questão de tempo até alguém publicar um
fluxo achando que está na conta errada.

---

## 3. As telas, print a print

### 3.1 Painel do cliente · prints 6 e 7

O que os prints mostram, com os números reais da conta:

```
Bem-vindo, Eduardo 👋
MGM Studio Pilates espaço de trabalho

┌ Gerenciamento de chats ⓘ ──────────────── [Este mês ⌄] ┐
│ ████████████████████████│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Conversas 42 (100%)     │      Chatbot respondeu 11 (26%)│
└────────────────────────────────────────────────────────┘
┌ Desempenho pessoal ────────────────────── [Este mês ⌄] ┐
│ Atividade do chat            │ Métricas de tempo        │
│ 👤 0        ↩ 0       🗄 0   │ [Mediana] Média          │
│ Atribuições Primeiras  Chats │  —  Até a primeira resp. │
│            respostas  fechados│ —  Até o fechamento     │
└────────────────────────────────────────────────────────┘
┌ Dados ─────────────────────────────────── [Este mês ⌄] ┐
│ Estatísticas por período  [Novos Contatos ⌄]  [📈][📊] │
│ 14┤                                      ╱╲            │
│  8┤                                     ╱  ╲           │
│  4┤    ╱╲    ╱╲   ___   ╱╲   ___      ╱     ╲___╱      │
│   └ ago1 ... ago13 ... ago17                           │
└────────────────────────────────────────────────────────┘
┌ Eventos personalizados ⓘ ─────────────────── [Criar] ──┐
│                      👻  (vazio)                        │
└────────────────────────────────────────────────────────┘
```

**Temos:** o funil mensal (`metricas_sessoes`, migration `0011`) já entrega
conversas, resolvidas pelo bot e esperando pessoa, com mês anterior.

**Falta:**

| Peça | Como fazer |
|---|---|
| Barra proporcional em vez de números soltos | Só desenho. `26%` sozinho não é informação — o mês anterior ao lado é o que dá referência |
| **Desempenho pessoal** | Atribuições, primeiras respostas e chats fechados **por usuário**. Depende de atribuição existir (fase 1) |
| **Métricas de tempo** | Mediana/média até a primeira resposta humana e até o fechamento. Sai de `messages` + `handoffs`; é agregação em view, não laço no Next |
| **Gráfico por período** | Série diária com seletor de métrica (Novos contatos, Conversas, Resolvidas) e alternador linha/barra |
| ~~Eventos personalizados~~ | **Fora.** O EXPANSAO já decidiu: métrica sem pergunta é dado morto, e o print prova — está vazio numa conta em produção |

> **Sobre "eu entro e vejo meus lucros":** não temos dado de dinheiro, e inventar
> por multiplicação vira mentira no relatório do cliente. O caminho honesto é a
> Fase 6 (conectores de CRM) trazer valor fechado do RD Station. Até lá, o painel
> mostra o que é verdade: quanta gente chegou, quanto o bot resolveu sozinho,
> quanto tempo levou para alguém responder.

### 3.2 Contatos · print 8

```
Contatos       [Importar Contatos ↑] [Baixe Relatório ↓] [Criar Contato 👤+]
┌ Mais popular ─┐┌ [Filtros ▼]                         [🔍 Busca] ┐
│ ETIQUETAS   ⌃ ││ ☐ Usuários              WhatsApp      Inscrição │
│ primeira_msg… ││ ☐ F Felipe Ferreira  +5511913259925 17/08 19:12 │
│ SEQUÊNCIAS    ││     941556191                             ⋮     │
│   nenhum item ││ ☐ R Ricardo          +5511995325698 17/08 10:52 │
│ CAMPANHAS     ││ …                                               │
└───────────────┘└─────────────────────────────────────────────────┘
```

**Temos:** paginação de 50, busca por nome e telefone (agora casando as duas
grafias do nono dígito), CSV do filtro atual, etiquetas derivadas, importação
com conciliação, nome corrigível e anotação.

**Falta:**

| Peça | Detalhe |
|---|---|
| **Etiquetas manuais** | Hoje as nossas são derivadas do histórico. Faltam as que uma pessoa cria e aplica — é o que o rail esquerdo lista |
| **Rail de filtros** | Etiquetas / Sequências / Campanhas, com contagem, e `[Filtros ▼]` para os menos usados |
| **Criar contato à mão** | Nome + telefone, sem esperar a pessoa escrever |
| **Seleção múltipla** | Checkbox por linha + ações em lote: etiquetar, exportar, apagar |
| **Menu ⋮ por linha** | Abrir, etiquetar, pausar bot, apagar |

**Não copiar:** o número embaixo do nome no print (`941556191`) é id interno
vazando na tela. É o erro nº 6 da lista deles.

### 3.3 Campanhas · prints 9, 10, 11

```
┌─ Criar Nova Campanha ─────────────── ✕ ─┐
│ [ Nome                                 ] │
│ Fluxo                                    │
│ [ Selecionar                        ⌄ ]  │ → busca + lista de fluxos
│ [ Insira a frase que vai iniciar o robô ]│
│ Por favor, não termine esta frase com    │
│ ponto (.), exclamação (!) ou (?)         │
│ [        Criar Campanha                ] │
└──────────────────────────────────────────┘
```

**Campanha = porta de entrada extra no mesmo número.** A frase vai no anúncio
Click-to-WhatsApp; quem chega com ela cai num fluxo específico em vez do padrão.

**Temos:** metade do caminho — o webhook já guarda `origem`, `origem_anuncio` e
`origem_titulo` do `referral`. **Falta** a frase virar roteamento.

**A ser construído:** tabela de campanhas (nome, fluxo, frase, ativa), casamento
da frase na entrada **antes** do fluxo padrão, contagem de execuções e
atribuição do contato à campanha.

**A regra do ponto final merece nota:** eles pedem que a frase não termine com
pontuação porque o WhatsApp às vezes a remove. A gente **normaliza sozinho** em
vez de pedir — pedir para o usuário compensar um detalhe da plataforma é empurrar
o nosso problema para ele.

### 3.4 Quadros (Kanban) · prints 12 e 13

```
[teste ⌄]                        [🔍 Busca]      ⓘ ⚙ ⚙
┌ A fazer 0 ─┐┌ Em andamento 0 ─┐┌ Concluído 0 ─┐ [+]
│ + Adicionar││ + Adicionar     ││ + Adicionar  │
└────────────┘└─────────────────┘└──────────────┘
```

Vários quadros por conta (`Integração do cliente`, `Aluguel`, `Compra`,
`Suporte ao cliente`), colunas configuráveis, cartões.

**O EXPANSAO tinha descartado Kanban** como "outro produto". **Isso muda**, e por
um motivo específico: o mockup deles mostra o cartão abrindo um painel lateral
com `Manager / Chat / Bot` — ou seja, **o cartão é um contato numa etapa**, não
um item de projeto solto. Assim ele deixa de ser um CRM paralelo e vira o que o
EXPANSAO já dizia ser o embrião certo: a coluna `Situação` do contato, desenhada.

**Regra de desenho que sai disso:** cartão sempre aponta para um contato. Não
existe cartão avulso — senão em três meses temos duas listas de gente que
divergem, que é exatamente o problema que a fase C acabou de resolver.

**Não copiar:** o empty state deles é um mockup **de imobiliária** ("Visita
agendada", "R$600 mil") numa conta de estúdio de pilates. Empty state ensina o
negócio de quem está olhando.

### 3.5 Transmissão · print 14

```
┌ Criar Transmissão ────────────────────────────────── ✕ ┐
│ Configurações           │ Segmentação    [Mostrar usuários]│
│ Nome [Sem título] 0/30  │ Usuários que receberão: 58       │
│ Fluxo                   │ ( ) Enviar para contatos com     │
│ Somente fluxos que      │     automação pausada            │
│ começam com um modelo   │                                  │
│ de mensagem do WhatsApp │ Adicionar filtros para refinar   │
│ estão disponíveis.      │      [ Adicionar filtro ]        │
│ [ Selecionar        ⌄ ] │                                  │
├─────────────────────────┴──────────────────────────────────┤
│ Definir hora e executar depois ☐          [ Iniciar agora ]│
└────────────────────────────────────────────────────────────┘
```

**Três coisas para copiar sem mudar nada:**

1. **A contagem do público antes de disparar (`58`).** É o freio que evita o erro
   caro, e ela aparece **antes** do botão.
2. **O aviso sobre modelo aprovado vem antes de escolher o fluxo**, não depois de
   falhar.
3. **`Mostrar usuários`** — dá para conferir a lista, não só o número.

**Depende de:** modelos da Meta aprovados (trava externa) e do agendador.

### 3.6 Inbox · print 15

```
┌ Atribuído ───┐┌ Conversas        + 🔔 ⚙ ┐┌────────────────┐
│ 👥 Todos  58 ││ [🔍 Busca             ] ││                │
│ 👻 Nenhum 58 ││ [Todos ⌄] [Não lidas]   ││      💬        │
│ E  Meus chats││ FF Felipe Ferr.   19:12 ││ Selecione um   │
│              ││    Muito prazer;)    ②  ││ destinatário   │
│Administradores│ BV Bru Valim 👑   15:43 ││                │
│ 🟣 Daniel M. ││    Obrigada!!        ①  ││ Escolha quem   │
│ E  Eduardo   ││ É  Érika           sex  ││ você gostaria  │
│              ││    📷 Imagem         ①  ││ de escrever    │
│              ││ VK Vera Kalckmann  sex  ││                │
│              ││    Adesivo           ②  ││                │
└──────────────┘└─────────────────────────┘└────────────────┘
```

**Temos:** o Inbox existe desde `d8b3671` — lista, conversa, resposta, respostas
rápidas, controle de automação por contato.

**Falta, e quase tudo depende de usuários existirem:**

| Peça | Detalhe |
|---|---|
| **Rail `Atribuído`** | Todos · Nenhum · Meus chats · um por atendente, com contagem |
| **Atribuir conversa** | A quem, e quem está `Disponível` |
| **Não lidas** | Contador azul por conversa e filtro `Não lidas` |
| **Tipo de mídia no preview** | `📷 Imagem`, `Adesivo` — hoje mostramos "(áudio, imagem ou documento)" para tudo |
| **Iniciar conversa `[+]`** | Escolher contato e escrever primeiro (dentro das regras da Meta) |
| **Paginação** | `listarLeads` traz tudo; com 58 tudo bem, com 5.000 não |
| **Painel lateral do contato** | Dados, etiquetas, notas, quadro, campos — reaproveitando a tela do contato |

### 3.7 Automações · print 16

```
Automação  [Palavras Chave 🔗] [Sequências 🔀] [Webhooks 🕸]      [Criar]
Todas Palavras-chave 1                                    [🔍 Busca]
┌──────────────────────────────────────────────────────────────────┐
│ ☐ Iniciar Fluxo             Mensagem        Execuções            │
│   PRINCIPAL - ATENDIMENTO ⌄ É ⌄             11        [●━]  ⋮    │
│   testeux                   [testeux ✕] [+]                      │
└──────────────────────────────────────────────────────────────────┘
```

Três coisas diferentes, e no nosso desenho elas ficam como abas de **Automações**
junto de `Fluxos`:

- **Gatilhos (palavras-chave):** frase → fluxo, com operador (`É`, `contém`…),
  contagem de execuções e liga/desliga. Hoje só temos as palavras de escape
  fixas no motor.
- **Sequências:** disparo no tempo depois de um evento. **Depende do agendador.**
- **Webhooks:** receber evento de fora e começar um fluxo. É o par do que já
  temos (chamar para fora).

### 3.8 Fluxos · prints 2, 17

```
Fluxos de conversa                    [Criar Pasta +] [Criar Novo Fluxo +]
Fluxos Padrões Básicos ⌄
┌ Fluxo de boas vindas ┐┌ resposta padrão ┐┌ padrão p/ mídia ┐┌ Pós-Atend. ┐
Todos os Fluxos                                            [🔍 Busca]
│ Nome                    Conexões  Execuções  CTR %  Última alteração  ⋮ │
│ PRINCIPAL - ATENDIMENTO    🔗        —         —    13/08/2026         │
```

**Temos:** lista com execuções, criar, apagar, editor, versões, rollback.

**Falta:**

| Peça | Detalhe |
|---|---|
| **Os 4 fluxos padrão** | Boas-vindas, resposta padrão, mídia recebida, pós-atendimento. Hoje é um número → um fluxo |
| **Pastas** | Com três fluxos não faz falta; com trinta, faz |
| **Coluna `Conexões`** | Quantos fluxos chamam este. No print deles ela está **vazia**, e por isso `SUB - REAGENDAR` é um órfão invisível. Depende de subfluxo |
| **CTR** | Percentual de quem clicou. Precisa registrar clique por opção |

### 3.9 O editor · prints 18, 19

Cabeçalho: `PRINCIPAL - ATEN…` / `Todos os Fluxos` · *"Todas as alterações foram
salvas automaticamente"* · **[Visualização]** · **[Compartilhar fluxo]**. Canvas
com `[+]` flutuante e botão de tela cheia.

**Falta:**

| Peça | Detalhe |
|---|---|
| **Bloco Inicial explícito** | Eles têm um bloco "Seu fluxo começa por este bloco". Nós marcamos um nó como início, o que é mais enxuto e menos visível. Vale desenhar melhor, não copiar |
| **Compartilhar fluxo** | Link público que deixa **copiar** o fluxo, com escopo (qualquer um / ninguém / empresas listadas). É o que sustenta os Modelos |
| **Auto-organizar** | O canvas deles espalha para a direita; o operador disse preferir **de cima para baixo**. Um botão que reorganiza resolve os dois |
| **Tela cheia e minimapa** | Barato e ajuda em fluxo grande |

### 3.10 O bloco de mensagem · prints 20 e 21 — **a mudança mais profunda**

```
┌ Enviar mensagem ──────────────────────── ✕ ┐
│ Janela de mensagens de 24 horas ⓘ           │
│  (•) Dentro de     ( ) Fora de              │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Olá! 👋 Seja muito bem-vindo(a)…        │ │
│ │ [B] [I] [S] [{}] [☺]        196/1024    │ │
│ └─────────────────────────────────────────┘ │
│ ┌ 📅 Aula Experimental ─────────────────┐ > │
│ ┌ 👤 Já sou aluno(a) ───────────────────┐ > │
│ ┌ Mais Informações ─────────────────────┐ > │
│ ⓘ Você pode adicionar até 3 botões       │
├─────────────────────────────────────────────┤
│ [Texto] [Imagem] [Vídeo] [Arquivo] [Áudio]  │
│ [Salvar] [Atraso] [AutoOff] [Contato]       │
│ [Botão de lista]                            │
└─────────────────────────────────────────────┘
```

**O bloco deles é uma pilha de pedaços. O nosso é `data: { texto: string }`.**
É a diferença que o EXPANSAO chamou de *"esqueleto igual, conteúdo 10× mais
pobre"*, e é o que faz a mesma conversa exigir cinco blocos nossos onde eles
usam um.

Dez tipos de pedaço, e o que cada um significa para nós:

| Pedaço | Nosso estado |
|---|---|
| Texto | temos, com formatação faltando |
| Imagem · Vídeo · Arquivo · Áudio | **temos** desde a fase B, como bloco separado |
| Botão de lista | temos, inferido pela quantidade de opções |
| Atraso | temos, até 3s |
| **Salvar** | temos como bloco `salvar-campo` |
| **AutoOff** | pausa o bot no contato — temos como ação de tela, não como bloco |
| **Contato** | enviar um cartão de contato. **Não temos** |

E duas coisas que faltam de verdade:

**1. Formatação (`B` `I` `S` `{}` `☺`).** O WhatsApp aceita `*negrito*`,
`_itálico_`, `~riscado~` e ```` ```mono``` ````. Hoje quem escreve precisa
lembrar da sintaxe. Barra de formatação + inserir variável por clique (que já
existe em `inserir-variavel.ts`) + emoji.

**2. Janela de 24 horas dentro do bloco.** `Dentro de` / `Fora de` diz se aquela
mensagem sai como texto livre ou como modelo aprovado. É o contrato que faz
Transmissão e retomada funcionarem — e nós hoje só sabemos avisar na tela do
lead que a janela fechou.

#### Como fazer isso sem quebrar as conversas em andamento

Este é o risco real da mudança, e ele tem nome: **`flow_versions` é imutável e
sessão fica presa à versão**. Uma conversa que começou às 14h continua rodando o
grafo de 14h. Se o formato de `mensagem` mudar de `{texto}` para
`{partes: [...]}`, todo grafo publicado antes disso **para de dar parse** e a
conversa morre no meio.

O caminho é **ler os dois formatos e nunca reescrever o que está gravado**:

1. `noMensagemSchema` aceita `texto` **ou** `partes`.
2. Um normalizador no `core/` transforma `{texto: "oi"}` em
   `{partes: [{tipo: 'texto', texto: "oi"}]}` **na leitura**.
3. O motor só conhece `partes`. O editor só escreve `partes`.
4. Nenhuma migration toca `flow_versions.grafo`. Versão publicada é imutável, e
   isso vale inclusive para a gente.

Teste que prende a regra: publicar no formato antigo, mudar o código, e a sessão
presa àquela versão continua respondendo igual.

### 3.11 Integrações · print 22

```
┌ Integração ──────────────────────── ✕ ┐
│ Adicionar método de integração         │
│ [ Adicionar Evento do Integrador   ⋯ ] │
│ [ Adicionar Integração do Zapier   ✳ ] │
│ [ Adicionar Integração de Webhook  ⛓ ] │
│ [ Adicionar Google Sheets          ▦ ] │
│ [ Adicionar integração com RD Station ]│
└────────────────────────────────────────┘
```

**O nosso bloco de Serviços externos é mais poderoso e menos usável** — ele fala
com qualquer API, e obriga a montar o POST na mão.

O caminho é **preset, não tipo novo de nó**: escolher "RD Station" preenche
método, URL, cabeçalhos e mapeamento de um bloco `http` comum. Alterar um preset
depois **não mexe em fluxo já publicado**, porque o que ficou gravado foi o bloco
resolvido, não uma referência viva.

Ordem: **RD Station primeiro** (é o cliente real), depois Google Sheets, depois
webhook genérico. **Zapier não entra** — é o iPaaS que o print 5 da leva anterior
mostrou custando 5.000 ações que ninguém usa.

### 3.12 Configurações

Junta o que hoje está espalhado entre `/ajustes`, `/contexto`, `/numero`,
`/conexoes` e `/acervo`, mais o que falta:

`Perfil do negócio` (nome, descrição, setor, e-mail, site, endereço — o print 8
da leva anterior mostra tudo isso visível **sem clicar em nada**) · `Número do
WhatsApp` (com WABA, limite, verificação, status, e **desconectar** achável mas
fora do caminho) · `Equipe` · `Horário de atendimento` · `Etiquetas` ·
`Respostas rápidas` · `Acervo` · `Contexto da IA` · `Mensagens aprovadas (Meta)`
· `Faturamento` · `Registros`.

### 3.13 Telas do administrador

Não têm print — são nossas.

- **Contas:** a lista de clientes de hoje, mais criar conta, convidar o dono e
  **entrar como**.
- **Usuários:** todos, com conta, papel, último acesso, sessões ativas, revogar,
  banir.
- **Auditoria:** quem publicou o quê, quem entrou como quem e quando, quem
  apagou contato. É exigência da fase 4 do plano mestre e vira exigência legal no
  dia em que houver contrato.
- **Saúde:** entregas falhando, números desconectados, cota da Meta, alertas.

---

## 4. O banco

Numeração real: a última é `0018`. **A próxima é `0019`** — conferir o diretório
antes, sempre ([BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md)).

| # | Migration | O que entra |
|---|---|---|
| 0019 | `auth_better` | Tabelas do Better Auth com `modelName` nosso: `af_usuarios`, `af_sessoes`, `af_contas`, `af_verificacoes`. **Nomes com prefixo**: Storage e Postgres são compartilhados com a Verandi, e `user`/`session` soltos em `public` são convite a colisão |
| 0020 | `contas_e_papeis` | `clients` vira a organização; `af_membros` (usuário × conta × papel); `dono`/`admin`/`atendente`. Índice por conta em tudo |
| 0021 | `auditoria` | `af_auditoria`: autor, conta, ação, alvo, quando, **e se foi impersonado**. Append-only |
| 0022 | `presenca_e_notificacoes` | Status do usuário; `notificacoes` por conta e usuário |
| 0023 | `atribuicao_e_leitura` | `conversas.atribuido_a`, `lida_em` por usuário. É o que faz "Não lidas" e "Meus chats" |
| 0024 | `etiquetas_manuais` | `etiquetas` + `contato_etiquetas`. As derivadas continuam derivadas — **não** viram linha |
| 0025 | `campanhas` | Campanha (nome, fluxo, frase, ativa) + atribuição do contato |
| 0026 | `gatilhos` | Palavras-chave por conta, com operador e execuções |
| 0027 | `agendador` | `tarefas` + claim atômico. **Destrava sequências, transmissão e timeout de pergunta** |
| 0028 | `transmissoes` | Transmissão, público congelado no disparo, resultado por contato |
| 0029 | `quadros` | Quadro, coluna, cartão — cartão **sempre** aponta para um contato |
| 0030 | `modelos_meta` | Mensagens aprovadas, sincronizadas da Graph API |
| 0031 | `pastas_e_compartilhamento` | Pasta de fluxo; link de compartilhamento com escopo |
| 0032 | `metricas_de_tempo` | View com mediana/média até primeira resposta e até fechamento |

**Regras que valem para todas:** objeto em `public`, qualificado com `public.`;
RLS ligada; `GRANT` decidido explicitamente; nada de `anon`/`authenticated`;
função `security definer` com `search_path` fixo. E **nada é aplicado em produção
sem eu mostrar o SQL antes**.

### O ponto de atenção do Better Auth

Ele fala Postgres direto (Kysely), não pelo PostgREST. Isso significa:

- conexão nova, pelo **pooler de transação (6543)**, com prepared statements
  desligados — em modo transação o Supavisor não os suporta;
- a porta 5432 fica só para migration;
- passamos a ter **dois caminhos** para o mesmo banco (supabase-js e pg). É
  dívida consciente: a alternativa é escrever hash de senha, recuperação, convite
  e impersonação à mão, que é onde erro custa caro.

---

## 5. Ordem

Cada fase termina com `npm test`, `typecheck`, `lint`, `build` verdes e commit
próprio.

| # | Fase | Entrega | Por que aqui |
|---|---|---|---|
| **1** | **Login, contas e papéis** | Better Auth, `af_membros`, sidebar, entrar como, auditoria | Nada abaixo existe sem saber **de quem é a conta**. E fecha o furo do `/api/simular`, que hoje manda credencial de qualquer cliente para a URL do corpo |
| **2** | **Bloco de mensagem em pilha** | Partes, formatação, emoji, variável por clique, janela de 24h | É o que faz o produto parecer completo por dentro. Compatível com versões antigas por normalização, nunca por reescrita |
| **3** | **Inbox de verdade** | Atribuição, não lidas, presença, tipo de mídia no preview, paginação, painel lateral | É onde o negócio do cliente acontece todo dia — doze dias de conversa real do MGM sem o bot participar de nenhuma |
| **4** | **Contatos completo** | Etiquetas manuais, rail de filtros, criar à mão, lote | Sustenta segmentação, campanha e transmissão |
| **5** | **Automações** | Gatilhos, 4 fluxos padrão, pastas, auto-organizar, compartilhar fluxo | Deixa o cliente montar o atendimento dele sem a gente |
| **6** | **Agendador** | Tarefas com claim atômico | Destrava três coisas e não tem trava externa |
| **7** | **Campanhas e quadros** | Campanha, roteamento por frase, kanban ligado ao contato | Depende de contatos e etiquetas |
| **8** | **Painel completo** | Barra proporcional, série diária, desempenho pessoal, métricas de tempo | Depende de atribuição existir (fase 3) |
| **9** | **Integrações** | Presets RD Station, Sheets, webhook de entrada | Quando houver o primeiro CRM de produção |
| **10** | **Meta** | Modelos aprovados, transmissão, retomada fora das 24h | **Trava externa**: verificação da empresa e App Review. Não é código nosso que destrava |

---

## 6. O que fica fora, e por quê

| Fora | Motivo |
|---|---|
| **Eventos personalizados** | Métrica sem pergunta é dado morto. O print prova: vazio numa conta em produção |
| **Zapier / iPaaS embutido** | O print da leva anterior mostra o preço — duas automações vazias e 5.000 ações pagas sem uso |
| **Randomizador (A/B)** | Volume não justifica |
| **Conectar número por QR** | Perder o número do cliente é o pior fracasso possível para uma agência. Só Cloud API oficial |
| **Cartão de contato como pedaço** | Entra junto com a fase 2 se o schema já estiver aberto; sozinho não paga a rodada |

---

## 7. Erros deles que viram regra nossa

Sete, e as três primeiras já custaram caro em algum lugar:

1. **Um nome, uma coisa.** `Modelos` (fluxo) × `Modelos de mensagem` (Meta), e
   três lugares chamados automação.
2. **Não crescer a lateral por acumulação.** Onze itens contra os nossos oito.
3. **Painel que mostra zero ensina a não abrir.** `Atribuições 0 · Primeiras
   respostas 0 · Chats fechados 0` numa conta com 58 conversas.
4. **Métrica sem referência não é informação.** `26%` sozinho não diz se é bom.
5. **Empty state ensina o negócio de quem está olhando** — não o de uma
   imobiliária numa conta de pilates.
6. **Id de banco não aparece na tela.**
7. **Idioma não mistura.** *"You don't have notifications yet"* numa tela em
   português.
