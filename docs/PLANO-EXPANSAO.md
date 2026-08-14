# Plano de expansão — o que construir, em que ordem, e quanto custa

Sai da [ANALISE-BOTCONVERSA.md](ANALISE-BOTCONVERSA.md) e da fila do
[ESTADO.md](ESTADO.md). Este documento é **de organização**: o que é cada
atividade, quanto tempo leva, o que a gente ganha quando ela fica pronta, e por
que a ordem é essa.

Ele não substitui plano de execução. Cada etapa ganha o seu, em
`docs/superpowers/plans/`, escrito na hora de começar — passo a passo, com teste
antes do código. Aqui é o mapa; lá é o roteiro.

Escrito em 13/ago/2026.

---

## Como ler os tamanhos

**Um "dia" = uma sessão de trabalho focada**, construindo no padrão desta base:
teste antes, motor puro, documentação junta, commit por peça. Não é hora de
digitação — é o ciclo inteiro até estar verde e no ar.

Onde há intervalo (`2–3 dias`), o número maior é o realista quando aparecer o que
sempre aparece.

**Três coisas não são código e podem travar tudo**, então estão marcadas como
🔒 no plano:

| Trava | O que é | Quem destrava |
|---|---|---|
| 🔒 **Meta** | verificação da empresa → Provedor de Tecnologia → Embedded Signup v4 | processo externo, prazo desconhecido |
| 🔒 **Agenda** | o SaaS de agendamento existir com API | outro projeto ([BRIEF-AGENDA.md](BRIEF-AGENDA.md)) |
| 🔒 **Cliente** | Prelúdio responder se topa o bot falar faixa de preço | conversa comercial |

---

## Etapa 0 — Consertos ✅ feito

Commit `86a3140`, 248 testes verdes.

| O quê | Resultado |
|---|---|
| **Limite de tamanho da mensagem** — não existia em lugar nenhum | Dava para escrever 3.000 caracteres numa pergunta com botões, publicar, e a Meta recusar a mensagem inteira em produção. São **dois** limites: 4096 no texto puro, **1024 na interativa** (a que carrega botão ou lista). O validador barra, o painel mostra o contador |
| **A contradição do cofre** | A ajuda dos cabeçalhos do bloco de API dizia que o cofre não existia e **mandava usar n8n** — 15 linhas acima do seletor de Credencial que diz "o valor fica no cofre". Cofre existe desde a migration `0006`, e mandar usar n8n é o que o ESTADO.md proíbe como resposta |

---

## O que a releitura achou, e eu não tinha visto

Seis coisas. A primeira muda a ordem do plano.

### 1. A atribuição de anúncio está chegando de graça, e a gente joga fora

Confirmado em [`receber-mensagem.ts`](../src/server/receber-mensagem.ts): o
`webhookSchema` lê `metadata`, `contacts` e `messages`. **Não lê `referral`.**

Quando a pessoa chega por um anúncio Click-to-WhatsApp, a Cloud API manda junto
da primeira mensagem um objeto `referral` com `source_id` (o anúncio),
`source_url`, `headline`, `body` e `ctwa_clid`. A gente descarta no parse.

**Cliente 01 é tráfego pago.** Isso responde "qual anúncio trouxe este lead"
**sem construir Campanhas**, sem tela nova e **sem migration** — `contacts.campos`
e `messages.payload` já são `jsonb`, e a tela de leads já cria coluna sozinha a
partir dos campos.

É a melhor relação impacto/custo de toda a análise, e sobe para a primeira
posição.

### 2. Três features precisam da mesma peça que não existe: um agendador

- **Sequências** (retomada do lead morno)
- **Timeout de pergunta** — o ramo Fisioterapia do MGM tem duas saídas: resposta
  válida e **"se usuário não responder"**. Nossa `pergunta` fica parada no nó
  para sempre
- **Lembretes da Agenda** — o [BRIEF-AGENDA.md](BRIEF-AGENDA.md) já prevê que ela
  vai querer avisar, e que quem fala com o cliente final somos nós

Construir uma vez destrava três. E tem restrição dura: o motor roda serverless
**sem estado vivo**, então agendador aqui é **tabela + cron**, nunca temporizador
na memória.

### 3. O funil já é uma consulta, não um projeto de dados

`sessions` tem `status` e `criado_em` desde a migration `0003`; `handoffs`
existe. "Conversas → resolvidas pelo bot" é um `group by`. Eu tinha estimado
médio; é pequeno.

### 4. A view `leads` já entrega a maior parte do Inbox

A migration `0004` já junta contato + última mensagem + handoff aberto, com
`security_invoker = true`. Para a lista do Inbox falta contagem de não lidas e
ordenação. O Inbox é mais barato do que eu disse.

### 5. O atraso tem uma armadilha de serverless

O motor devolve todas as ações de uma vez e `receber-mensagem` aplica em
sequência dentro do `after()`, com `maxDuration = 60`. Um `sleep` **gasta tempo
de função cobrado** e come o orçamento que o ESTADO.md já avisa ser curto.

Desenho que evita o beco: **atraso curto (≤ 3s) dorme inline; qualquer coisa
maior vira agendamento** (item 2). Decidir isso agora custa nada; descobrir
depois custa reescrever o canal.

### 6. O horário de atendimento cabe sem quebrar a regra do motor

`src/core/` não faz rede e não lê relógio. Mas **tempo pode entrar por
parâmetro** — `executar(fluxo, sessao, entrada, { agora })` — que é o mesmo
padrão que a base já usa em `FabricaDeCanal`. A pureza fica, o teste fica
determinístico, e horário de atendimento deixa de ser impossível.

**Bônus da releitura:** `SUB - REAGENDAR` aparece na lista de fluxos do MGM e eu
não achei nenhuma chamada para ele nos prints — provável fluxo órfão. Quando
subfluxo existir aqui, a lista de fluxos precisa de uma coluna "chamado por N" —
é o que a coluna `Conexões` deles parece ser.

---

## Etapa 1 — Prova e percepção

> **3–5 dias · sem trava · pode começar hoje**

As peças pequenas que fazem o produto **parecer** pronto e **provar** que
funciona. Todas usam dado ou código que já existe.

| # | Atividade | Tempo | O que muda |
|---|---|---|---|
| 1.1 | **Atribuição de anúncio** — ler `referral` do webhook, guardar em `contacts.campos` | 0,5 dia | A tela de leads passa a mostrar de qual anúncio veio cada pessoa, com coluna criada sozinha. Sem migration |
| 1.2 | **Funil e execuções** — `conversas → resolvidas pelo bot`, execuções por fluxo, tudo por consulta | 1 dia | O número que sustenta a renovação. Hoje o cliente renova por fé |
| 1.3 | **Etiquetas automáticas derivadas** — 1ª mensagem foi mídia, foi para handoff, nunca respondeu | 0,5 dia | Marca o que a gente **já trata** e não conta. A etiqueta `primeira_mensagem_nao_suportada` é a única em uso no MGM — isso acontece muito |
| 1.4 | **Atraso + "digitando…"** como propriedade do bloco de mensagem (≤3s inline) | 0,5 dia | Deixa de ler como robô despejando quatro parágrafos no mesmo segundo |
| 1.5 | **Pele de WhatsApp na aba Testar**, com alternador `Conversa` / `Bastidores` | 1 dia | O que se mostra numa reunião. Nossos eventos de bastidor continuam — em outra aba, não apagados |
| 1.6 | **Clicar para inserir `{{variavel}}`** no cursor (a lista já existe no painel) | 0,25 dia | Some o erro de digitar nome de variável errado |

**Resultado da etapa:** dá para sentar na frente de um cliente, desenhar o fluxo,
mostrar a conversa com cara de WhatsApp, e **abrir um número que prova que o bot
resolveu X% sozinho**. Hoje não dá para nenhuma das duas.

---

## Etapa 2 — O handoff que realmente entrega o lead

> **3–4 dias · sem trava**

O handoff é o momento em que o produto entrega o lead quente. Hoje ele cai numa
tabela que alguém precisa estar olhando.

| # | Atividade | Tempo | O que muda |
|---|---|---|---|
| 2.1 | **Ação: notificar pessoa** — avisar no WhatsApp de quem atende quando o handoff acontecer | 1,5 dia | Lead quente para de esperar o operador abrir o painel. **Não depende de papéis de usuário** |
| 2.2 | **Horário de atendimento** por cliente, com `agora` entrando por parâmetro no motor | 1 dia | O bot deixa de responder "estamos fora do horário" às 11h da manhã, que é o que o MGM faz hoje |
| 2.3 | **Respostas rápidas** para quem atende, na caixa de resposta do lead | 0,5 dia | Quem atende repete as mesmas cinco frases o dia inteiro |
| 2.4 | **Automação ligada/desligada** visível e alternável no contato | 0,5 dia | Hoje o conceito existe escondido dentro de "responder assume" / "Já atendi" |

**Resultado da etapa:** o lead quente chega em quem atende, no canal em que a
pessoa já está, dentro do horário em que o negócio funciona.

---

## Etapa 3 — Inbox

> **4–6 dias · sem trava**

A tela onde a operação acontece. A conversa do Walter no print — falta,
remarcação, aniversário, cancelamento, doze dias, **nenhuma mensagem do bot** —
é a prova de que ela é o produto, não um extra.

| # | Atividade | Tempo | O que muda |
|---|---|---|---|
| 3.1 | **Lista de conversas** — prévia da última mensagem, não lidas, ordenação, busca (a view `leads` já entrega a maior parte) | 1,5 dia | |
| 3.2 | **Tela de três painéis sem navegação** — trocar de conversa é um clique, não voltar→achar→clicar→esperar | 1,5 dia | Com 55 conversas, é a diferença entre trabalhar e clicar |
| 3.3 | **Fio contínuo** — separadores de data, "carregar mais antigas" em vez de cortar calado | 1 dia | Hoje a conversa longa é cortada com um aviso |
| 3.4 | **Painel de dados à direita** — o que o fluxo coletou, notas, situação, automação | 1 dia | |

**Decisão tomada aqui:** o Inbox **não substitui** a tabela de Leads. São duas
telas com dois donos — Leads responde "quem entrou e o que o bot coletou" (dono,
gestor); Inbox responde "com quem eu falo agora" (quem atende). E o Walter, aluno
há meses, **não é um lead** — o vocabulário da tela atual não serve para ele.

**Atribuição de conversa a atendente fica de fora desta etapa**, de propósito:
"Meus chats" só significa alguma coisa com mais de um usuário. Ela entra junto
com papéis.

**Resultado da etapa:** o cliente tem onde operar o dia a dia, e não só onde ver
lead novo.

---

## Etapa 4 — Papéis de usuário

> **4–6 dias · é o item 1 do [ESTADO.md](ESTADO.md)**

**Não é pré-requisito para construir. É pré-requisito para o primeiro cliente
logar.** Enquanto o painel for só nosso, não há escalada de privilégio — há uma
senha que já dá acesso a tudo.

No dia em que um cliente ganhar login, **duas coisas do ESTADO.md entram junto e
não depois**:

- `/api/simular` aceita fluxo inventado + `fluxoId` de qualquer cliente e manda a
  credencial dele para a URL do corpo
- a sessão do painel é `SHA-256(senha)` pura, sem nonce e sem carimbo — cookie
  copiado vale para sempre e não há como revogar um acesso só

| # | Atividade | Tempo |
|---|---|---|
| 4.1 | Login de verdade, sessão revogável, sair | 1,5 dia |
| 4.2 | Papéis (operador / cliente somente-leitura) e isolamento por cliente | 2 dias |
| 4.3 | Fechar os dois furos acima | 1 dia |
| 4.4 | Atribuição de conversa no Inbox ("Meus chats", "Nenhum atendente") | 1 dia |
| 4.5 | Registros — quem publicou o quê | 0,5 dia |

**Resultado:** o cliente pode ver os leads dele sem ver os dos outros, e a gente
pode revogar um acesso.

---

## Etapa 5 — Subfluxos

> **5–8 dias · sem trava · a maior lacuna funcional do produto**

Doze `Conexão de Fluxo` apontando para `SUB - AGENDAR` num fluxo real. Sem isso,
o mesmo atendimento aqui seria desenhado doze vezes, e mudar o horário
significaria editar doze cópias — ou esquecer uma.

| # | Atividade | Tempo | Observação |
|---|---|---|---|
| 5.1 | **Decidir se o subfluxo volta ao chamador** | 0,5 dia | Pelos prints, parece **pulo sem volta**. Sem volta simplifica muito: a sessão só troca de grafo. Com volta exige pilha na sessão, que hoje é plana |
| 5.2 | Nó `sub-fluxo` no schema, motor e validador | 2 dias | Validador precisa recusar **ciclo entre fluxos**, não só dentro de um |
| 5.3 | **Congelamento em cascata na publicação** | 1,5 dia | Publicar A congela o grafo de A **e** a versão publicada de cada subfluxo alcançável. Sem isso, a conversa das 14h se vê num bloco que não existe mais — que é a razão de `flow_versions` existir |
| 5.4 | Bloco no editor + navegação entre fluxos | 1,5 dia | |
| 5.5 | Coluna "chamado por N fluxos" na lista | 0,5 dia | Fluxo órfão fica visível — o `SUB - REAGENDAR` do MGM parece ser um |

**Resultado:** o produto aguenta um atendimento do tamanho do que o mercado já
usa.

---

## Etapa 6 — O tempo: agendador, sequências e modelos

> **8–12 dias · 🔒 Meta (modelos aprovados) · 🔒 Cliente (a pergunta do preço)**

A peça que ataca o problema declarado do cliente 01 — *"lead quente converte;
morno esfria"*. Morno esfria porque **ninguém volta nele**.

| # | Atividade | Tempo | Observação |
|---|---|---|---|
| 6.1 | **Agendador** — tabela + cron, sem estado vivo | 2 dias | Destrava três features (ver achado 2) |
| 6.2 | **Modelos da Meta** — cadastro, sincronização, envio | 3 dias | Item 2 do ESTADO.md. 🔒 depende de modelo aprovado |
| 6.3 | **"Dentro / Fora da janela de 24h" no bloco** | 1 dia | A peça do editor que eu não tinha visto. Sem ela o cliente desenha uma retomada que falha no envio e ninguém descobre |
| 6.4 | **Sequências** — dia 1, dia 3, dia 7 | 2,5 dias | |
| 6.5 | **Timeout de pergunta** ("se não responder") | 1 dia | Usa o mesmo agendador |
| 6.6 | **Transmissão** com contagem do público antes de disparar | 1,5 dia | A contagem antes é o freio que evita o erro caro |

**Resultado:** o lead que esfriou recebe uma segunda chance automática — que é o
que o cliente 01 comprou sem saber.

---

## Etapa 7 — Integrações de primeira parte

> **3–5 dias · 🔒 Agenda existir**

A tese que vale mais que o Integrador inteiro do BotConversa: **conector genérico
é morno; o de primeira parte é quente, porque temos os dois lados.**

Hoje, ligar a Agenda num fluxo são sete passos, cinco deles digitação exata que
erra fácil.

| # | Atividade | Tempo |
|---|---|---|
| 7.1 | `Conectar Agenda 4YU` — provisiona token pelo servidor e cria a Conexão sozinha | 2 dias |
| 7.2 | Blocos-preset (`Agenda: horários livres`, `Agenda: marcar`) — `http` pré-preenchido com rótulo | 1,5 dia |
| 7.3 | Preset de Google Sheets, junto com o [PLANILHAS.md](PLANILHAS.md) | 1,5 dia |

**O que preserva a arquitetura:** preset **não é tipo de nó novo**. É um `http`
pré-preenchido. O motor continua com sete tipos, o validador é o mesmo, e a
versão publicada congela um `http` comum — então mudança na API da Agenda **não
quebra fluxo publicado**.

**Resultado:** vender AutoFluxos + Agenda junto deixa de ser duas configurações e
vira um clique.

---

## Etapa 8 — Alavanca de agência

> **4–6 dias · sem trava · faz sentido a partir do 2º cliente do mesmo ramo**

| # | Atividade | Tempo | O que muda |
|---|---|---|---|
| 8.1 | **Campanhas** — várias portas de entrada por número | 2 dias | Dois anúncios com atendimentos diferentes no mesmo número |
| 8.2 | **Compartilhar / instalar fluxo** entre clientes | 2 dias | Barateia o setup de R$1.800 a partir do segundo cliente do segmento |
| 8.3 | **Palavras-chave do cliente**, somadas às de escape do motor | 0,5 dia | `cancelar`, `segunda via`, `horário` |
| 8.4 | **Fluxos padrão configuráveis** — boas-vindas, resposta padrão, mídia, pós-atendimento | 1,5 dia | **A garantia continua no motor**; o que muda é qual fluxo ela chama |

---

## Resumo

| Etapa | Tema | Tempo | Trava | Ganho principal |
|---|---|---|---|---|
| 0 ✅ | Consertos | — | — | Duas contradições fora |
| **1** | **Prova e percepção** | **3–5 d** | — | Demo boa + o número da renovação |
| **2** | **Handoff que entrega** | **3–4 d** | — | Lead quente não espera |
| **3** | **Inbox** | **4–6 d** | — | Onde a operação acontece |
| 4 | Papéis | 4–6 d | — | Cliente pode logar |
| **5** | **Subfluxos** | **5–8 d** | — | Aguenta atendimento real |
| 6 | Tempo (sequências) | 8–12 d | 🔒 Meta · 🔒 Cliente | Lead morno volta |
| 7 | Primeira parte | 3–5 d | 🔒 Agenda | AutoFluxos + Agenda em 1 clique |
| 8 | Alavanca de agência | 4–6 d | — | Setup barato do 2º cliente em diante |

**Total sem as travadas (1, 2, 3, 5, 8): 19–29 dias.**
**Com tudo: 34–52 dias.**

### Por que esta ordem

1. **1 e 2 primeiro porque são pequenas e vendem.** Enquanto a Meta não libera, o
   que dá para melhorar é o que se mostra numa reunião e o que prova valor a quem
   já paga. Nenhuma delas depende de nada.
2. **3 antes de 5** porque o Inbox atende cliente que já existe (MGM opera assim
   hoje), e subfluxo atende fluxo que ainda não foi desenhado.
3. **4 quando o primeiro cliente for logar**, não antes — mas **nunca depois**.
4. **5 antes de 6** porque subfluxo não tem trava e sequência tem duas.
5. **6 é a maior e a mais travada.** Começar por ela seria construir no escuro.
6. **7 espera a Agenda.** Não dá para conectar o que não existe.

### Sugestão de corte, se for para escolher só um bloco

**Etapas 1 + 2 (6–9 dias).** Elas mudam o que o cliente vê e o que a gente
consegue provar, não dependem de ninguém, e a 1.1 (atribuição de anúncio) sozinha
já responde uma pergunta que o cliente 01 tem e nós não sabemos responder.

---

## O que fica fora, e por quê

| Descartado | Por quê |
|---|---|
| **Kanban / CRM** | É outro produto. A coluna `Situação` já é o embrião certo se um dia virar |
| **Integrador (iPaaS)** | O BotConversa alugou e o print mostra o preço: duas automações vazias e quota que ninguém usa. A regra do ESTADO.md — "faltou peça? constrói a peça" — sai reforçada |
| **Randomizador (teste A/B)** | Volume não justifica |
| **Eventos personalizados** | Métrica sem pergunta é dado morto |
| **Escolha explícita botão × lista** | A nossa inferência pela quantidade é melhor: não dá para escolher errado |
| **`Reiniciar automação`** | Gambiarra deles para destravar sessão presa. Nossa sessão fica presa à versão publicada e não tem o problema |
| **Seções de perfil arrastáveis** | Personalização cara para um problema que ninguém tem |
| **Mídia no fluxo** (imagem, vídeo, arquivo) | Não descartado — **adiado**. Exige mídia no motor, no canal e no simulador. Entra quando um cliente pedir a foto do espaço |

---

## Como cada etapa começa

Quando a gente decidir a próxima, ela ganha um plano de execução em
`docs/superpowers/plans/AAAA-MM-DD-<nome>.md`, com passo a passo, teste antes do
código e commit por peça — o padrão que esta base já segue. Este documento não
tenta ser isso: um roteiro de 50 dias escrito hoje estaria errado na terceira
semana.
