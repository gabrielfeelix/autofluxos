# O que o BotConversa faz, campo a campo, e o que disso vale para nós

Análise de 31 telas do BotConversa rodando num cliente real (**MGM Studio
Pilates**, workspace `210139`, número `+55 11 93213-9312`, Cloud API oficial com
Coexistence), incluindo o editor de fluxo aberto bloco a bloco, o painel de
edição de mensagem, a Visualização e uma conversa real de operação no Inbox.

**Como ler:** a comparação aqui é **campo contra campo**, com o nosso código na
mão — não conceito contra conceito. Onde diz "não temos", foi conferido no
schema, no painel ou no motor, e o arquivo está citado.

Escrito em 13/ago/2026. Cruza com [ESTADO.md](ESTADO.md),
[BRIEF-UI.md](BRIEF-UI.md), [BRIEF-AGENDA.md](BRIEF-AGENDA.md),
[CONEXOES.md](CONEXOES.md).

---

## Índice

- [O que o print prova sobre a Meta](#o-que-o-print-prova-sobre-a-meta)
- [Parte I — Os blocos, um a um](#parte-i--os-blocos-um-a-um)
- [Parte II — O bloco de mensagem deles é uma pilha, o nosso é um campo](#parte-ii--o-bloco-de-mensagem-deles-é-uma-pilha-o-nosso-é-um-campo)
- [Parte III — Visualização × a nossa aba Testar](#parte-iii--visualização--a-nossa-aba-testar)
- [Parte IV — O Inbox, e por que a nossa tela de Leads não é ele](#parte-iv--o-inbox-e-por-que-a-nossa-tela-de-leads-não-é-ele)
- [Parte V — Integrações de primeira parte (a tese que vale mais que o Integrador)](#parte-v--integrações-de-primeira-parte)
- [Parte VI — Configurações](#parte-vi--configurações)
- [Parte VII — As outras telas](#parte-vii--as-outras-telas)
- [Parte VIII — O fluxo do MGM lido inteiro](#parte-viii--o-fluxo-do-mgm-lido-inteiro)
- [Parte IX — A fila](#parte-ix--a-fila)
- [Parte X — O que não copiar, e o que consertar em casa](#parte-x--o-que-não-copiar-e-o-que-consertar-em-casa)

---

## O que o print prova sobre a Meta

Antes das features, o que vale mais: em **Configurações → WhatsApp**,

| Campo | Valor |
|---|---|
| WABA | `468946307261350`, selo **CoEx** |
| Limites de mensagem | **250 BICs / 24 horas** |
| Verificação da empresa | **Não verificado** |
| Status da conta | Ativo · Linha de crédito **Compartilhado** |

**O cliente opera com a empresa dele não verificada.** O que trava não é a
verificação do cliente — é a *nossa*, para virar Provedor de Tecnologia. E
"Linha de crédito: Compartilhado" é o modelo que o [ESTADO.md](ESTADO.md) já
prevê: a Meta cobra por dentro do provedor.

Isso corrige uma leitura pessimista da nossa fila. Confirmar na doc da Meta antes
de usar em reunião.

---

## Parte I — Os blocos, um a um

Você perguntou direto: *"a gente tem uma ação, uma condição, conexão de fluxo,
randomizador, atraso inteligente, integração, assistente GPT, enviar mensagem —
não sei se é o caso que a gente tem todos aqui"*. Resposta exata, conferida em
[`src/core/flow/schema.ts`](../src/core/flow/schema.ts) e
[`src/components/editor/painel.tsx`](../src/components/editor/painel.tsx):

| Bloco deles | Nosso equivalente | Veredito |
|---|---|---|
| **Enviar mensagem** | `mensagem` + `pergunta` | Temos o esqueleto. **O conteúdo é 10× mais pobre** — ver Parte II |
| **Condição** | `condicao` | **Paridade.** 5 operadores (`igual`, `diferente`, `contem`, `vazio`, `preenchido`), duas saídas |
| **Assistente GPT** | `ia` | **Paridade** (nossa é fechada no contexto do negócio, de propósito) |
| **Integração** | `http` | Temos, **mais poderoso e menos usável** — ver Parte V |
| **Ação** | `handoff` (parcial) | **Falta quase tudo.** Ver abaixo |
| **Conexão de fluxo** | — | **Não existe.** A maior lacuna do produto |
| **Atraso inteligente** | — | **Não existe.** Nem atraso simples |
| **Randomizador** | — | Não existe, e não precisa |
| — | `salvar-campo` | **Só nós** |
| — | **Pergunta dinâmica** (`opcoesDe`) | **Só nós, e é a nossa melhor peça** |
| — | Credencial por referência no cofre (`conexaoId`) | **Só nós** |
| — | Versão publicada imutável (`flow_versions`) | **Só nós** (a confirmar neles) |

### O que "Ação" faz neles, e o que temos de cada uma

No fluxo do MGM aparecem quatro ações distintas:

| Ação deles | Nós |
|---|---|
| `Reiniciar automação` | Não temos — **e não precisamos**. É gambiarra para destravar contato preso; nossa sessão fica presa à versão publicada e não tem esse problema |
| `Notificar membro da equipe: Daniel Mutti por WhatsApp` | **Não temos.** Nosso `handoff` avisa o painel e mais ninguém |
| `Atribuir e abrir atendimento: Daniel Mutti` | **Não temos.** Não existe noção de equipe |
| Etiquetar contato | **Não temos.** Não existe etiqueta |

Nosso `handoff` tem exatamente dois campos ([schema.ts:112](../src/core/flow/schema.ts)):
`motivo` (interno) e `mensagem` (despedida). Nada de para quem, nada de avisar.

**Isto importa mais do que parece.** O handoff é o momento em que o produto
entrega o lead quente. Hoje esse lead cai numa tabela que alguém precisa estar
olhando. Se o operador estiver almoçando, o lead espera — e o
[ESTADO.md](ESTADO.md) diz que o cliente 01 fecha contrato bom com lead quente.
**Um aviso no WhatsApp de quem atende não depende de papéis de usuário, não
depende da Meta, e é meio dia de trabalho.**

### A peça que só nós temos, e que vale registrar

A **pergunta dinâmica** ([schema.ts:62-76](../src/core/flow/schema.ts)): as
opções não são desenhadas, vêm de uma variável preenchida por uma chamada de API,
separadas por `;`. As saídas viram `escolheu` e `vazio` — e o validador **cobra
as duas**, porque lista que vem de fora vem vazia com frequência.

Nada nos prints do BotConversa faz isso. Os botões deles são sempre texto fixo
digitado no editor.

E é exatamente a peça que faz a **Agenda** funcionar: *"os horários livres de
quarta"* não existem na hora do desenho. O [BRIEF-AGENDA.md](BRIEF-AGENDA.md) já
especificou a resposta no formato `"7h00;10h00;15h00"` **por causa deste bloco**.

Ou seja: no bloco mais importante para o nosso próximo produto, nós estamos à
frente. Vale saber disso ao olhar a lista de faltas abaixo.

---

## Parte II — O bloco de mensagem deles é uma pilha, o nosso é um campo

Esta é a diferença que você viu e eu tinha resumido como "bloco composto". É mais
do que isso.

### O que o painel deles tem, item por item

```
┌─ Enviar mensagem ─────────────────────── ✕ ─┐
│ Janela de mensagens de 24 horas  ⓘ          │
│  ● Dentro de    ○ Fora de                   │   ← regime da mensagem
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────── ✕ ─┐ │
│ │ Olá! 👋 Seja muito bem-vindo(a)…        │ │   ← pedaço "Texto"
│ │ [B] [I] [S] [{}] [☺]         196/1024   │ │   ← toolbar + contador real
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ >   │
│ │ 📅 Aula Experimental                │     │   ← botão = card + alça `>`
│ ├─────────────────────────────────────┤ >   │
│ │ 👤 Já sou aluno(a)                  │     │
│ ├─────────────────────────────────────┤ >   │
│ │ Mais Informações                    │     │
│ └─────────────────────────────────────┘     │
│ ⓘ Você pode adicionar até 3 botões de resposta │ ← limite dito no lugar
├─────────────────────────────────────────────┤
│ [Texto] [Imagem] [Vídeo]                    │
│ [Arquivo] [Áudio] [Salvar]                  │   ← 10 peças anexáveis
│ [Atraso] [AutoOff] [Contato]                │
│ [Botão de lista]                            │
└─────────────────────────────────────────────┘
```

### O que o nosso painel tem, item por item

[`painel.tsx:77-79`](../src/components/editor/painel.tsx) — o bloco `mensagem`
inteiro:

```tsx
{no.type === 'mensagem' && (
  <Area rotulo="Texto" valor={no.data.texto} aoMudar={(texto) => aoMudarDados({ texto })} />
)}
```

E `Area` é um `<textarea rows={4}>` com a legenda `aceita {{variavel}}`.

O schema confirma ([schema.ts:45-51](../src/core/flow/schema.ts)):
`data: { texto: string }`. **Um campo. Só.**

### O inventário da diferença

| Peça deles | Nós | Custo de fazer | Vale? |
|---|---|---|---|
| **Contador `196/1024`** | Não temos, e **não temos nem o limite** | Trivial | **Sim.** Hoje dá para digitar 3.000 caracteres e a Meta recusa em produção. É um limite da Cloud API que não está em lugar nenhum do nosso código |
| **Toolbar B / I / S** | Não temos | Baixo | Sim. O WhatsApp tem negrito (`*x*`), itálico (`_x_`), tachado (`~x~`) — e o cliente escreve isso errado na mão |
| **`{}` — inserir variável** | Temos a **lista** de variáveis no rodapé do painel, para copiar à mão | Baixo | **Sim.** Nós já sabemos quais variáveis existem ([painel.tsx:251-264](../src/components/editor/painel.tsx)); falta o clique que insere no cursor |
| **Emoji** | Não temos | Baixo | Sim — o fluxo do MGM usa emoji em quase toda mensagem |
| **Imagem / Vídeo / Arquivo / Áudio** | **Não temos.** O motor só tem `enviar_texto` e `enviar_opcoes` ([types.ts:70-78](../src/core/engine/types.ts)) | **Alto** | **Sim, mas depois.** Exige mídia no motor, no canal e no simulador. Um estúdio querer mandar a foto do espaço é o caso óbvio |
| **Atraso / "digitando…"** | Não temos | **Baixo** | **Sim, e primeiro.** Ver abaixo |
| **AutoOff** | Temos o efeito (sessão → `humano`), não temos o controle | Baixo | Sim, como propriedade |
| **Salvar** (dentro da mensagem) | Temos `salvar-campo` como bloco separado, e `salvarEm` na pergunta | — | Já resolvido melhor |
| **Contato** (vCard) | Não temos | Médio | Não agora |
| **Botão de lista** explícito | **Inferimos pela quantidade** (≤3 botões, ≤10 lista) | — | **A nossa é melhor.** Ver abaixo |
| **Janela 24h: Dentro/Fora** | Não temos | Médio | **Sim — e é pré-requisito dos Modelos** (item 2 da fila) |

### Três leituras que mudam decisão

**1. O atraso não é enfeite.** Todos os ramos longos do MGM têm
`Atraso — Digitando 1 seg` antes das mensagens de venda. O nosso motor devolve
todas as ações de uma vez e o canal dispara em sequência — quem recebe leva
quatro parágrafos no mesmo segundo. Isso *lê* como robô. O custo é uma
propriedade opcional no bloco de mensagem e um `sleep` no canal; o ganho é a
percepção inteira do produto.

**2. A nossa inferência botões/lista é melhor que a escolha explícita deles.**
Eles têm "Botão de resposta" e "Botão de lista" como peças diferentes — dá para
escolher errado. Nós decidimos pela quantidade no motor, e o painel avisa em
texto ([painel.tsx:360-367](../src/components/editor/painel.tsx)):

> `3 de até 3 — o WhatsApp mostra como botões.`

O que falta não é a escolha, é **ver**. Hoje é uma frase; deveria ser o
desenho. Isso liga direto na Parte III.

**3. "Janela de mensagens: Dentro de / Fora de" é a peça que destrava os
Modelos.** O item 2 da nossa fila é Modelos da Meta, e eu não tinha percebido
onde ele encosta no editor: **o bloco precisa declarar em que regime roda**.
Dentro da janela é texto livre; fora, só modelo aprovado. Quando construirmos
Modelos, esse radio (ou equivalente) tem que existir no bloco — senão o cliente
desenha uma sequência de retomada que falha no envio e ninguém descobre até o
lead sumir.

---

## Parte III — Visualização × a nossa aba Testar

Você disse: *"seria basicamente o teste, só que com a cara do WhatsApp, com o
fluxo — é bem legal"*. É, e a diferença é mais estrutural do que estética.

### O que a Visualização deles tem

- Um alternador no cabeçalho do editor: **`Modo edição` ↔ `Visualização`** —
  estado da tela, não uma aba lateral
- Painel flutuante sobre o canvas, com **🔄 reiniciar** e **⤢ recolher**
- **Uma linha de contato: avatar + `Danilo Fogaça` + link `Ir para o cartão do
  contato`** — o teste roda **como uma pessoa de verdade**, e dá para pular para
  o perfil dela
- Papel de parede do WhatsApp, bolhas brancas com sombra, horário `20:40`
- Os botões renderizados **como o WhatsApp renderiza**: largura total, um por
  linha, com o ↩ verde à esquerda
- Campo de digitação falso, com `+` e 🎤

### O que a nossa aba Testar tem — e onde ela ganha

[`src/components/conversa.tsx`](../src/components/conversa.tsx), lido inteiro:

| Nosso | Deles |
|---|---|
| **Chama o motor de verdade**, pela mesma rota do webhook (`/api/simular`) | provavelmente também |
| **Eventos de sistema inline**: `guardou nome = "joao"`, `passou para um humano — {motivo}`, `conversa encerrada`, `a chamada para {url} não foi executada` | **nada disso** |
| **Botão 🎤** que testa mídia de verdade e prova que áudio vai para humano | não visto |
| **Aviso de fluxo desatualizado** com "recomeçar para testar" — e **não reinicia sozinho**, de propósito | não visto |
| **Aviso quando o fluxo chama API**: *"testar cinco vezes grava cinco vezes no sistema do cliente"* | não visto |
| **Indicador de digitando** enquanto o motor responde | — |
| Fim de conversa distingue `humano` de `encerrada`, com textos diferentes | — |
| Aparência | **bolhas com as cores do painel, legenda em fonte mono `no WhatsApp isto vira botões`** | **WhatsApp de verdade** |
| Identidade | sessão anônima | **um contato nomeado, com link para o cartão** |
| Lugar na tela | aba fixa no painel direito | modo de tela inteira, flutuante, recolhível |

**A conclusão não é "copiar".** Nossa aba Testar é funcionalmente superior — ela
mostra os bastidores, que é o que faz desenhar fluxo ser possível. O que ela não
faz é **parecer com o resultado**, e é isso que se mostra numa reunião.

O caminho certo é somar, com um alternador dentro do próprio painel:

- **`Conversa`** — pele de WhatsApp fiel: papel de parede, bolhas, botões
  renderizados como botão de verdade e lista como lista de verdade, horário.
  Some a legenda `no WhatsApp isto vira botões` — porque aí dá para **ver**.
- **`Bastidores`** — o que temos hoje, com os eventos de sistema.

Duas peças pequenas que valem junto:
- **Reiniciar sempre visível** (hoje só aparece quando a conversa morre ou o
  fluxo muda).
- **Testar como um lead existente** — carregar as `vars` de um contato real e
  rodar o fluxo com elas. Resolve "por que o fluxo quebrou com a Maria?" sem
  adivinhação. É a versão útil do "Ir para o cartão do contato" deles, e o nosso
  motor já aceita: `executar(fluxo, sessao, entrada)` recebe a sessão pronta.

---

## Parte IV — O Inbox, e por que a nossa tela de Leads não é ele

Você disse: *"aquilo é muito legal... inbox seria tipo leads basicamente"*.
Concordo com o entusiasmo e discordo do "basicamente" — **são duas telas com dois
propósitos**, e é aí que está o achado.

### A conversa do Walter, dissecada

O print traz uma conversa real, e ela é a evidência mais valiosa do conjunto:

```
31 julho
  Walter → "Boa tarde / Comunico que não poderei comparecer hoje /
            Estou bom for de barriga"                              13:47
  MGM   → "Oi boa tarde, obrigada por avisar, melhoras pra você."  13:49 ✓✓

5 agosto
  Walter → "Talia / Parabéns pelo seu aniversário muita saúde paz
            e prosperidade / Um grande abraço"                     15:32
  MGM   → "Oi Walter. O aniversário da Thalya será no dia 12/08"   16:46 ✓✓

6 agosto
  Walter → "Então esqueça por enquanto até a semana que vem kkkk"  12:39
  MGM   → "👍 kkk"                                                 12:40 ✓✓

12 agosto
  Walter → "Havia marcado hoje às 18h00 mas eu não vou poder
            comparecer favor desmarcar obrigado"                   10:28
  MGM   → "Ok Walter. Aula desmarcada."                            11:14 ✓✓
```

**Cinco coisas saem daqui:**

**1. O bot não participou de nenhuma dessas mensagens.** Nem uma. Doze dias de
operação real do estúdio — falta, remarcação, conversa social — tudo humano.
O bot cuida da porta da frente (lead novo); **o Inbox é onde o negócio acontece
todo dia**.

**2. "Lead" é o nome errado para o Walter.** Ele é aluno há meses. Nossa tela se
chama `Leads` e a tabela tem colunas do que o fluxo coletou — vocabulário de
captação. Um aluno cancelando aula não é um lead, e nunca vai ter coluna
preenchida. **A tela precisa de outro nome ou de outra tela ao lado.**

**3. É um fio contínuo, não uma sessão.** Separadores `31 julho`, `5 agosto`,
`6 agosto`, `12 agosto` num único fio. A nossa tela mostra a conversa do contato
e **corta as antigas** com o aviso *"conversa longa — mostrando só as mensagens
mais recentes"* ([leads/[contatoId]/page.tsx:153](../src/app/clientes/%5BclienteId%5D/leads/%5BcontatoId%5D/page.tsx)).
Faltam os separadores de data e um "carregar mais antigas".

**4. Três das quatro mensagens do Walter são da Agenda.** "não poderei
comparecer", "favor desmarcar", "até a semana que vem". Falta, cancelamento,
reposição. É o [BRIEF-AGENDA.md](BRIEF-AGENDA.md) inteiro chegando por WhatsApp,
sendo respondido à mão. **Este print é o melhor argumento comercial da Agenda que
existe** — e mostra que o par Agenda+AutoFluxos não é integração teórica: é o
trabalho que o Daniel faz hoje com o polegar.

**5. `✓✓` de lido.** Nós temos `entregue` booleano e mostramos *"envio não
confirmado"*. Não temos leitura. Não é urgente, mas quem atende usa isso para
decidir se cobra resposta.

### O que a tela deles tem, painel por painel

**Coluna 1 — Atribuído:** `Todos 55` · `Nenhum… 55` · `Meus chats` · lista de
administradores (`Daniel Mutti`, `Eduardo`).

**Coluna 2 — Conversas:** busca, filtro `Todos`/`Não lidas`, e cada linha com
avatar, nome, **prévia da última mensagem**, horário relativo (`15:37`, `qua`,
`ter`) e **badge de não lidas** (`2`, `4`).

**Coluna 3 — Conversa:** cabeçalho com nome + 📥 arquivar + ⋮. Histórico com
separadores de data, avatar só nas de entrada, `✓✓` nas de saída. Composer
**desabilitado** com *"Use uma mensagem modelo para entrar em contato após 24
horas"* — e ainda assim três ícones ativos embaixo: ⊕ anexo, 📋 respostas
rápidas, ✏️.

**Coluna 4 — Perfil:** `Administrador ▾` (Nenhum atendente atribuído) ·
`Chat ▾` (Aberto) · faixa verde **"Automação está ligada"** · seções colapsáveis:
`Kanban` · `Dados do Usuário` (Telefone, E-mail, Data de inscrição, CPF,
`Registrado por meio de: Direto ⓘ`, `Chat fecha em: Expirado`) · `Notas` ·
`Etiquetas` · `Sequências` · `Campanhas` · `Campos Personalizados`.

### Onde a nossa ganha, e onde perde feio

**Ganhamos em duas coisas, e são coisas boas:**

- **Colunas dinâmicas do que o fluxo coletou**
  ([leads/page.tsx:47-55](../src/app/clientes/%5BclienteId%5D/leads/page.tsx)):
  a tabela descobre as colunas a partir do que existe. No BotConversa isso é
  "Campos Personalizados", escondido numa seção colapsada do perfil. Para
  qualificar lead, a nossa grade é melhor.
- **A janela de 24h é calculada no servidor**
  ([leads/[contatoId]/page.tsx:35-37](../src/app/clientes/%5BclienteId%5D/leads/%5BcontatoId%5D/page.tsx)),
  com o comentário certo: *"o relógio do navegador de quem abre a tela não é
  fonte de verdade para uma regra da Meta"*. Convergimos com eles no
  comportamento e ganhamos no rigor.

**Perdemos em uma coisa, e é estrutural:**

> **A nossa tela de lead é uma página por pessoa, com navegação.** Abrir o
> próximo lead é: voltar para a lista → achar a linha → clicar → esperar a
> página. A deles é uma tela só, três painéis, e trocar de conversa é **um clique
> sem navegação**.

Para quem atende 55 conversas, isso não é conforto — é a diferença entre
trabalhar e clicar. E o nosso caminho é curto: a lista, a conversa e o painel de
dados **já existem como componentes**; falta a tela de três painéis que os põe
lado a lado com estado de seleção no cliente.

### A decisão de produto que sai daqui

**Não transformar a tabela de leads em Inbox. Ter as duas.**

| Tela | Para quem | O que responde |
|---|---|---|
| **Leads** (temos) | dono, gestor, e nós | "quem entrou, o que o bot coletou, quem está esperando" |
| **Inbox** (falta) | quem atende, todo dia | "com quem eu preciso falar agora" |

E o Inbox precisa, no mínimo: lista com prévia + não lidas, fio contínuo com
separadores de data, painel de dados à direita, e **o interruptor "Automação
está ligada"** visível — que é o conceito que hoje temos escondido dentro de
"responder assume a conversa" / "Já atendi".

---

## Parte V — Integrações de primeira parte

Aqui está o ponto mais forte que você levantou, e ele vale mais que o Integrador
inteiro deles:

> *"nas integrações já tem que estar quase pré-conectado com nossos sistemas.
> Todo sistema que a gente tiver que é nosso, a API instantânea. Clicou, só
> precisa criar uma continha, boa, já conectou a API na hora."*

### Por que isso é melhor do que o que eles têm

O `Integrador` do BotConversa é um iPaaS de terceiro embutido — quase certamente
**Albato**, que publica catálogo de conectores BotConversa. Os sinais estão todos
na tela: quota própria (`0/5.000 ações utilizadas`), numeração em outra faixa
(`Automação #386230`), um `ID:767104` que não aparece em nenhuma outra tela,
`Atualização em 09 seg`, e visual que não é o do resto do painel.

O resultado no print: **duas automações vazias, criadas por acidente, que ninguém
apagou**, e uma quota de 5.000 ações que o cliente paga sem usar.

**Conector genérico é sempre morno.** O de primeira parte é quente: nós temos os
dois lados.

### Como isso se encaixa no que já existe

O [BRIEF-AGENDA.md](BRIEF-AGENDA.md) já fechou a fronteira:

> *"O que a Agenda precisa entregar é um token e alguns endereços."*

E as [Conexões](CONEXOES.md) já são o lugar certo: cada cliente cadastra
credencial uma vez, o valor mora no cofre, o bloco aponta por `conexaoId`
([schema.ts:164-172](../src/core/flow/schema.ts)). **A infraestrutura está
pronta.** O que falta é o atalho.

**Hoje, ligar a Agenda no fluxo seria:** cadastrar credencial → arrastar bloco
API → escolher GET → digitar `https://agenda.4yu.com.br/disponibilidade?dia={{dia}}`
→ mapear `livres` → arrastar pergunta dinâmica → apontar `opcoesDe` para `livres`
→ ligar as saídas `escolheu` e `vazio`. **Sete passos, e cinco deles são
digitação exata que erra fácil.**

**Com integração de primeira parte:** `Conectar Agenda 4YU` → autoriza → o token
é provisionado e a Conexão nasce sozinha. Depois, no editor, um bloco
**`Agenda: horários livres`** que já vem com método, endereço, mapeamento e as
duas saídas ligadas. O cliente só escolhe o dia.

### O que isso pede tecnicamente

Um bloco de primeira parte **não é tipo de nó novo** — é um `http` pré-preenchido
com um rótulo. Isso importa: mantém a regra do
[ARQUITETURA.md](ARQUITETURA.md) (`src/core/` não sabe o nome de cliente nenhum),
o motor continua com sete tipos, o validador continua o mesmo, e a versão
publicada continua sendo um `http` comum. **O preset é interface, não motor.**

Três coisas para desenhar quando chegar a hora:

1. **Provisionamento do token** — a Agenda precisa de um endereço que emita
   credencial de máquina para um cliente, chamado pelo nosso servidor. Nunca pelo
   navegador.
2. **Catálogo de presets versionado** — se a Agenda mudar `/disponibilidade`, os
   fluxos publicados **não podem quebrar**: eles guardam o `http` congelado, não
   o preset. Isso já é verdade pela imutabilidade, e é bom que seja.
3. **O mesmo mecanismo serve para terceiros populares** — Sheets à frente. O
   [PLANILHAS.md](PLANILHAS.md) resolve a estrutura; o preset resolve os sete
   passos. Não são concorrentes.

**E a regra do [ESTADO.md](ESTADO.md) sai desta análise mais forte:** *"faltou
peça? Constrói a peça"*. O BotConversa alugou, e o print mostra o preço.

---

## Parte VI — Configurações

Você disse que dá para descartar, mas que vale pensar. Vale mesmo — três delas
são baratas e uma é obrigatória no dia do login.

**Menu deles:** Conexões (`WhatsApp`) · Geral (`Companhia`, `Equipe`, `Horário de
atendimento`, `Inbox`, `Registros`, `Faturamento`, `Integrações`) · Automação
(`Campos`, `Etiquetas`, `Respostas rápidas`) · Preferências (`Notificações`).

| Item | Nós hoje | Veredito |
|---|---|---|
| **Horário de atendimento** | **Nada.** O motor não sabe que horas são | **Construir.** No print do Inbox o bot do MGM responde *"Não estamos disponíveis no momento"* às 11h12 — resposta fora de hora, em horário comercial. É configuração de cliente, não código |
| **Registros** (auditoria) | Nada | **Junto com o login** (item 1 da fila). Com dois usuários, "quem publicou isso?" vira pergunta |
| **Respostas rápidas** | Nada | **Barato e útil.** No Inbox, quem atende repete as mesmas cinco frases. Os ícones 📋 no composer deles são isso |
| **Etiquetas** | Nada | Sim — ver a etiqueta automática deles, adiante |
| **Campos** (personalizados) | Temos, mas só o que **o fluxo** coleta | O gap é campo preenchido **à mão** por quem atende |
| **Equipe** | Nada | É o item 1 da fila (papéis) |
| **Companhia** | Temos (`contexto`, CNPJ, logo) | Paridade |
| **Faturamento** | Nada | Não agora — cobramos por fora |
| **Notificações** | Nada | Encosta no "Ação: notificar" da Parte I |

**Uma peça de Configurações que eu tinha subestimado:** logo abaixo dos dados do
WhatsApp eles têm três seletores — `Iniciadores de conversa`, `Mensagem de
boas-vindas` (selecionar fluxo) e `Resposta padrão` (selecionar fluxo). Somados
aos `Fluxos Padrões Básicos` da tela de fluxos (`resposta padrão`, `padrão para
mídia`, `pós-atendimento`), isso é **um roteador de entrada configurável**.

Nós resolvemos os mesmos casos **no motor, e melhor**: mídia vai para humano na
garantia, não na configuração; a 3ª resposta sem entender vira handoff. Mas
resolvemos **fechado** — o cliente não escolhe o que acontece. O meio-termo:
**a garantia continua no motor; o que muda é qual fluxo ela chama.**

---

## Parte VII — As outras telas

Denso, só o que muda decisão.

### Painel de Controle
Funil `Conversas 39 (100%)` → `Chatbot respondeu 11 (28%)`; "Desempenho pessoal"
(Atribuições `0`, Primeiras respostas `0`, Chats fechados `0`; tempo até primeira
resposta e até fechamento, com alternador **Mediana/Média**); "Estatísticas por
período" (dropdown de métrica + linha/barra); "Eventos personalizados" (vazio,
**com o texto em inglês** numa tela em português).

**Nós não temos nenhuma métrica.** O funil `conversas → resolvidas pelo bot` é o
número que sustenta os R$700/mês — hoje o cliente renova por fé. Já temos o dado
bruto: `sessions`, `messages` e `handoffs` existem desde a migration `0003`.

**Não copiar:** dois terços do painel deles são zero permanente para este
cliente, e `28%` aparece sem meta e sem comparação.

### Contatos
`Importar Contatos` · `Baixe Relatório` · `Criar Contato`; filtros por
**Etiquetas / Sequências / Campanhas**.

**O achado está na única etiqueta existente:
`primeira_mensagem_nao_suportada`.** É a plataforma marcando sozinha quem abriu a
conversa com áudio ou mídia — e ser a única etiqueta em uso diz que **isso
acontece muito**. Nós já *tratamos* o caso (garantia do motor: mídia vai para
humano). **Não marcamos e não contamos.** É a diferença entre resolver e saber
que resolveu — e é exatamente a métrica que justifica a garantia.

**Não copiar:** cada linha mostra dois números sem rótulo (o WhatsApp e um id
interno tipo `940225066`).

### Campanhas
Modal: nome, fluxo, e *"a frase que vai iniciar o robô"* (com a regra de não
terminar em pontuação). **Campanha = porta de entrada extra no mesmo número.**

Hoje amarramos **um número → um fluxo**. O cliente 01 é **tráfego pago**: sem
isso, não dá para rodar dois anúncios com atendimentos diferentes nem saber de
onde o lead veio. O campo `Registrado por meio de: Direto` no perfil deles é a
atribuição que nos falta.

### Transmissão
Contagem ao vivo do público (`55`) **antes** de disparar, filtro de segmentação,
toggle "enviar para quem pausou a automação", agendar ou iniciar agora, e o aviso
de que só fluxos que começam com modelo aprovado aparecem na lista.

**Copiar quase literal quando construirmos:** a contagem antes do disparo é o
freio que evita o erro caro.

### Automação → Palavras-chave · Sequências · Webhooks
Palavra-chave: gatilho global "esta palavra leva a este fluxo" (`11 execuções`).
Nós temos escape fixo no motor (`atendente`, `humano`); o cliente não consegue
acrescentar `cancelar`, `segunda via`, `horário`.

**Sequências é a peça grande.** Não temos **nada** baseado em tempo. E o problema
declarado do cliente 01 está no [ESTADO.md](ESTADO.md): *"lead quente converte;
morno esfria"*. Morno esfria porque ninguém volta nele. Sequência depende de
modelo aprovado (fora das 24h) — que já é o **item 2** da fila. **Modelos e
Sequências são o mesmo projeto**, e ele ataca o problema pelo qual o cliente 01
pagou.

### Fluxos de conversa
`Fluxos Padrões Básicos` (cinco slots) + tabela com `Nome`, `Conexões`,
`Execuções`, `CTR %`, `Última alteração`. Três fluxos: `PRINCIPAL - ATENDIMENTO`,
`SUB - REAGENDAR`, `SUB - AGENDAR`.

**Subfluxos: contei doze `Conexão de Fluxo` apontando para `SUB - AGENDAR`.** Doze
caminhos da conversa terminam no mesmo trecho, escrito uma vez. No AutoFluxos
seria desenhado doze vezes, e mudar o horário significaria editar doze cópias —
ou esquecer uma. **É a maior lacuna funcional do produto.**

A decisão que ela puxa: se A chama B, **o que a publicação congela?** Publicar A
tem que congelar o grafo de A **e** a versão publicada de cada subfluxo
alcançável — senão a conversa das 14h se vê num bloco que não existe mais, que é
o motivo de `flow_versions` existir. Pelos prints, `Conexão de Fluxo` parece ser
**pulo sem volta** (`SUB - AGENDAR` não retorna ao chamador), o que simplifica
muito. Provavelmente é o que devemos fazer.

**Não copiar:** `CTR %` e `Execuções` vazios nos três fluxos, enquanto a tela de
Automação diz 11 execuções e o painel diz 11 respostas do bot. O mesmo número em
três telas, exibido em uma.

### Compartilhar fluxo / Modelos
Link com `share_code` e `Quem pode copiar este fluxo?` (qualquer um com o link /
ninguém / apenas empresas listadas por mim). Par da tela `Modelos` (vazia).

**Para a 4YU isso é alavanca de margem direta:** vendemos o mesmo tipo de fluxo
para vários clientes do mesmo ramo. Instalar um fluxo pronto num cliente novo
barateia o setup de R$1.800 a partir do segundo cliente do segmento.

### Kanban
Empty state grande + modal de quadro. **Concordo: é CRM, é outro produto.** Uma
observação que vale guardar: no mockup deles o card abre um painel lateral com
`Manager`/`Chat`/`Bot` — o kanban é **uma dimensão do contato**, não uma tela. A
nossa coluna `Situação` já é um kanban de duas colunas (`com o bot` /
`aguardando humano`). Se um dia virar CRM, cresce por ali.

**Não copiar:** o mockup do empty state é de **imobiliária** ("Visita agendada",
"Assinatura do contrato", R$600 mil) numa conta de estúdio de pilates.

---

## Parte VIII — O fluxo do MGM lido inteiro

```
Bloco Inicial → Ação: Reiniciar automação → Mensagem de boas-vindas (196/1024)
   │  "Olá! 👋 Seja muito bem-vindo(a) ao MGM Pilates. Eu sou a assistente
   │   virtual… Antes de começarmos, qual opção mais se adequa ao que você
   │   está buscando?"
   │
   ├── [📅 Aula Experimental] → "Excelente escolha ✨…" + Atraso 1s → ⇢ SUB - AGENDAR
   │
   ├── [👤 Já sou aluno(a)] → "Olá! 😊 Como podemos ajudar?"
   │       └── [Reagendar aula] → ⇢ SUB - AGENDAR
   │
   └── [Mais Informações] → "Em que podemos ajudar?"
           ├── [📍 Localização] → Av. Paulista, 352-55, Bela Vista, CEP 01310 🎁
           │                       → "Podemos ajudar em algo Mais?"
           ├── [💰 Valores] → "Nossos planos variam conforme a frequência…"
           │       ├── [Agendar aula] → ⇢ SUB - AGENDAR
           │       └── [Atendimento]  → "Iremos lhe direcionar para um dos
           │                             membros da nossa equipe! 🎁"
           │                           → Ação: notificar Daniel Mutti (WhatsApp)
           └── [😀 Serviços] → "Sobre qual assunto?"
                   ├── [Pilates] → "O que você está buscando?"
                   │      ├── [Agendar aula]     → ⇢ SUB - AGENDAR
                   │      ├── [Personal Pilates] → texto longo + Atraso 1s
                   │      │        ├── [Agendar aula] → ⇢ SUB - AGENDAR
                   │      │        └── [Obrigado(a)]  → "Tenha um ótimo dia 😊"  ⚠
                   │      └── [Tirar dúvida] → "Tire suas Dúvidas Sobre o Pilates!"
                   │             ├── [O que é?]       → texto + Atraso → "Que tal agendar?"
                   │             ├── [Metodologia]    → texto + Atraso → "Que tal agendar?"
                   │             └── [Como funciona?] → texto + Atraso → "Que tal agendar?"
                   ├── [Fisioterapia] → texto + Atraso (Digitando 1 seg)
                   │        → "Qual é o seu nome?"  (salva em `Nome para Fisio`)
                   │             ├── resposta válida → Ação: atribuir e abrir
                   │             │                     atendimento (Daniel Mutti)
                   │             │                   → "Em breve entraremos em contato…"
                   │             └── não respondeu   → (outro caminho)
                   └── [Voltar ao Menu] → ⇢ PRINCIPAL - ATENDIMENTO

"Podemos ajudar em algo Mais?"  (reaproveitado em vários pontos)
   ├── [📅 Agendar aula]  → ⇢ SUB - AGENDAR
   ├── [No momento não!]  → Integração: Google Sheets → Insert a new row
   │                        (planilha "LISTA DE TURMA E PRESE…")
   └── [Voltar ao Menu]   → ⇢ PRINCIPAL - ATENDIMENTO
```

**⚠ Pelo menos cinco folhas terminam em *"Muito obrigado! Tenha um ótimo dia
😊"* — fim de conversa sem nenhum caminho até uma pessoa.** Quem chegou ali com
dúvida que o menu não cobre, acabou. **O nosso validador recusaria publicar este
fluxo.** É a melhor evidência empírica de que a regra do handoff obrigatório é
boa: ela pega um fluxo real, em produção, num cliente pagante.

**Três outras leituras:**
- O bloco de Sheets grava no fim da conversa — o cenário do
  [PLANILHAS.md](PLANILHAS.md), e a prova de que o cliente que vive em planilha
  espera que o bot escreva nela.
- A pergunta "Qual é o seu nome?" tem **duas saídas: resposta válida e "se
  usuário não responder"**. Nós não temos timeout de pergunta — a conversa fica
  parada no nó para sempre. Vale registrar como lacuna pequena e real.
- `Ação: Reiniciar automação` como primeiro bloco é gambiarra para destravar
  contato preso em estado antigo. Nossa sessão presa à versão publicada não tem
  esse problema.

---

## Parte IX — A fila

Ordenada por **impacto ÷ custo**, cruzada com a fila do [ESTADO.md](ESTADO.md).
Os itens 1 e 2 de lá (papéis e Modelos) continuam onde estão; isto **acrescenta**.

### Faz o produto aguentar cliente real

| # | O quê | Por quê | Tamanho |
|---|---|---|---|
| **A** | **Subfluxos** + congelamento em cascata na publicação | 12 chamadas num fluxo real. Sem isso o atendimento vira 12 cópias | Grande |
| **B** | **Modelos + Sequências + "Dentro/Fora da janela" no bloco** (um projeto só) | Ataca o "morno esfria" do cliente 01. Já é o item 2 da fila, agora com o pedaço do editor que faltava | Grande |
| **C** | **Ação: notificar / atribuir pessoa** | Handoff que ninguém vê não é handoff. Não depende de papéis | Média |
| **D** | **Inbox** (três painéis, fio contínuo, sem navegação) | É onde a operação acontece — a conversa do Walter prova | Média |

### Barato, e muda a percepção de qualidade

| # | O quê | Tamanho |
|---|---|---|
| **E** | **Atraso + "digitando…"** como propriedade do bloco de mensagem | Pequeno |
| **F** | **Contador `x/1024`** no texto — hoje **não temos nem o limite** | Trivial |
| **G** | **Pele de WhatsApp na aba Testar**, com alternador `Conversa`/`Bastidores` | Pequeno |
| **H** | **Horário de atendimento** por cliente | Pequeno |
| **I** | **Clique que insere `{{variavel}}`** no cursor (a lista já existe) | Trivial |
| **J** | **Palavras-chave** do cliente, somadas às de escape do motor | Pequeno |
| **K** | **Respostas rápidas** para quem atende | Pequeno |
| **L** | **Automação ligada/desligada** visível no contato | Pequeno |

### Justifica a mensalidade

| # | O quê | Tamanho |
|---|---|---|
| **M** | **Funil `conversas → resolvidas pelo bot`** + execuções por fluxo (o dado já está em `sessions`/`messages`/`handoffs`) | Média |
| **N** | **Etiquetas automáticas** (mídia como 1ª mensagem, handoff, sem resposta) — marcar o que já tratamos, para poder contar | Pequeno |

### Alavanca (nosso modelo, não o deles)

| # | O quê | Tamanho |
|---|---|---|
| **O** | **Integrações de primeira parte** — Agenda 4YU em um clique + blocos-preset | Média |
| **P** | **Campanhas** (várias portas por número) + origem do contato | Média |
| **Q** | **Compartilhar/instalar fluxo** entre clientes | Média |
| **R** | **Mídia no motor** (imagem, vídeo, arquivo, áudio) | Grande |

### Não construir

Kanban/CRM · Integrador iPaaS · Randomizador · Eventos personalizados · Seções de
perfil arrastáveis · `Reiniciar automação` · Escolha explícita entre botão e lista.

---

## Parte X — O que não copiar, e o que consertar em casa

### Erros deles que valem como regra para nós

1. **Um nome, uma coisa.** "Modelos" (fluxo, na lateral) × "Modelos de mensagem"
   (Meta, dentro de Configurações). E **três lugares chamados automação**:
   `Automação` na lateral (palavras-chave, sequências, webhooks), `Automação` em
   Configurações (campos, etiquetas, respostas rápidas — que são cadastro) e
   `Integrador` (que é automação de verdade e não se chama assim). Quando os
   nossos Modelos da Meta existirem, **não podem se chamar só "Modelos"**.
2. **Não crescer a lateral por acumulação.** Onze itens de primeiro nível contra
   os nossos quatro. Cada peça desta fila precisa achar casa em `Fluxos`,
   `Leads`/`Inbox` ou `Ajustes` antes de virar item novo.
3. **Painel que mostra zero ensina a não abrir.**
4. **Métrica sem referência não é informação** (`28%` sozinho).
5. **Empty state ensina o negócio de quem está olhando**, não o de outro
   segmento.
6. **Id de banco não aparece na tela.**
7. **Costura entre produtos vaza para o cliente** — quota separada, numeração
   estranha, outro idioma, lixo acumulado.
8. **Mesmo número, três telas, exibido em uma** (execuções/CTR).

### Duas coisas para consertar na nossa base, achadas ao ler o código

**1. O painel do bloco de API se contradiz.** Em
[`painel.tsx:427-431`](../src/components/editor/painel.tsx), a ajuda dos
cabeçalhos diz:

> *"Não coloque token aqui… **O cofre de segredos ainda não existe** — enquanto
> isso, use endereço que já traz a chave (Apps Script, n8n)…"*

E **quinze linhas acima**, no mesmo painel, o seletor de Credencial diz *"O valor
fica no cofre"*. O cofre existe desde a migration `0006`
([CONEXOES.md](CONEXOES.md)). O texto ficou de antes e **manda usar n8n**, que é
justamente o que o [ESTADO.md](ESTADO.md) proíbe como resposta. Conserto de dois
minutos, e é o tipo de contradição que o próprio ESTADO.md já registrou ter
custado caro uma vez.

**2. Não temos o limite de 1024 caracteres em lugar nenhum.** `LIMITE_BOTOES`,
`LIMITE_LISTA` e `LIMITE_ROTULO` existem em
[`schema.ts:12-16`](../src/core/flow/schema.ts); o limite do corpo da mensagem,
não. Dá para digitar 3.000 caracteres, publicar, e a Meta recusar em produção —
falha que só aparece com cliente real conversando.

---

## O que ainda não sei

- **Se o BotConversa versiona fluxo.** Nenhum print mostra "publicar" — só
  *"Todas as alterações foram salvas automaticamente"* e um alternador
  `Modo edição`/`Visualização`. Se editar altera o que está no ar na hora, é
  diferença grande a nosso favor. **Confirmar antes de afirmar em reunião.**
- **Se `Conexão de fluxo` volta ao chamador.** Pelos prints, parece pulo sem
  volta. Isso decide a implementação.
- **O que `Iniciadores de conversa` faz** (ice breakers da Meta?).
- **Se `Sequências` respeita a janela de 24h sozinha**, ou deixa agendar uma
  sequência que vai falhar no envio.
- **O que a segunda saída da pergunta ("se usuário não responder") espera** — e
  quanto tempo.
