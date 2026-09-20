# O modelo de CRM do AutoFluxos

> Decisão tomada em 15/set/2026, depois de olhar RD Station CRM, Kommo,
> respond.io e Chatwoot. Este documento manda no vocabulário do produto: se o
> código disser "lead" para uma coisa e a tela disser outra, é aqui que se
> decide quem está errado.

## A decisão em uma frase

**Existe um registro só de pessoa — o contato — e ele carrega um estágio de
ciclo de vida. O que se multiplica não é a pessoa, é o cartão no quadro.**

Ninguém "vira" outro registro. Lead, cliente e lead perdido são o mesmo
`contacts.id` com `estagio` diferente, e o histórico não se parte no meio.
Quem já foi cliente e volta a comprar reaparece com tudo que já conversou.

### Por que não copiar o RD

O RD Station CRM tem **Lead** e **Negociação** como coisas separadas, e faz
sentido para ele: venda B2B longa, um contato com três oportunidades abertas ao
mesmo tempo, proposta, produto, previsão de receita. O preço disso é um
cadastro duplo que o usuário precisa entender antes de usar — nos prints é
exatamente isso que aparece: a tela de Leads vazia, a tela de Negociações
vazia, e um formulário "Criar Lead" pedindo fonte, campanha, contato e empresa
antes de qualquer conversa existir.

Nosso usuário não cadastra nada. **A pessoa chega conversando.** O registro já
nasce do WhatsApp ou do Lead Ads. Pedir que ele entenda a diferença entre lead e
negociação antes de responder uma mensagem é cobrar imposto de um problema que
ele não tem.

O que o RD tem e nós pegamos: **etapas com significado**, **qualificação**,
**responsável**, **motivo de perda**, **origem/campanha** e, acima de tudo, o
**histórico do contato numa linha do tempo só** — é a parte da tela dele que
realmente informa.

### O que os concorrentes de chatbot fazem

- **respond.io** — tem exatamente o nosso modelo: um contato com *Lifecycle*, e
  as etapas de fábrica são `New Lead · Hot Lead · Payment · Customer · Cold
  Lead`. Ele se posiciona como a camada de conversa *na frente* do CRM.
- **Kommo** — cartão de lead criado automaticamente a cada mensagem nova, e um
  **segundo funil, o de clientes**, feito só para estimular recompra. É a
  resposta deles para "e depois que comprou?".
- **Chatwoot** — não tem funil nenhum: caixa compartilhada, atribuição, times,
  etiquetas, nota interna. Quem quer kanban instala plugin ou vai embora.

Ou seja: a régua da categoria é inbox + etiqueta + atribuição + um funil
simples. Ser competente aqui é chegar no nível do respond.io/Kommo, não no do
RD.

## Os estágios do contato

`contacts.estagio`, um valor só, sempre presente:

| Estágio | Quem está aqui | Como entra |
|---|---|---|
| `novo` | mandou a primeira mensagem, ninguém falou com ele ainda | automático, no primeiro recebimento |
| `qualificado` | respondeu o que o fluxo perguntou, tem interesse real | automático pelo fluxo, ou na mão |
| `negociando` | tem cartão aberto num funil de venda | automático ao entrar num quadro de venda |
| `cliente` | tem pelo menos um cartão ganho | automático no primeiro ganho |
| `perdido` | cartão fechado como perdido e nenhum outro aberto | automático ao perder |
| `inativo` | sem conversa há N dias (padrão 90) e sem cartão aberto | automático, pelo cron |

Três regras que evitam o CRM virar campo de digitação:

1. **O estágio é consequência, não formulário.** Só muda sozinho, a partir do
   que aconteceu. O ajuste manual existe, mas é exceção.
2. **`cliente` não volta para trás.** Quem comprou uma vez e some vira
   `inativo`, nunca `perdido` — perder um desconhecido e perder um cliente são
   fatos diferentes e o relatório precisa distinguir.
3. **Perder não apaga.** O cartão fecha, o contato fica, a conversa continua
   possível.

## O cartão é a negociação

`quadro_cartoes` já é "um contato numa etapa de um quadro". Falta pouco para
ele ser a oportunidade inteira, e é esse pouco que dá LTV sem inventar módulo
de vendas:

- `titulo` — o que está sendo vendido, texto livre ("Plano trimestral",
  "Orçamento cozinha"). Sem catálogo.
- `valor` — numérico, opcional.
- `responsavel` (`af_usuarios`) — quem assumiu. Herda de `contacts.atribuido_a`
  quando existe.
- `situacao` — `aberta` · `ganha` · `perdida`.
- `motivo` — obrigatório ao perder, escolhido de uma lista curta que o cliente
  edita (`preço`, `sem resposta`, `comprou de outro`, `fora do perfil`).
- `fechado_em` — quando saiu do aberto.

Com isso, sem nenhuma tela nova de produto:

- **Quanto esse cliente já rendeu** = soma das **vendas** válidas dele.
- **Recorrência** = quantas vendas e quando foi a última.
- **Previsão** = soma dos abertos por etapa, que é o número no topo da coluna.
- **Por que perdemos** = agrupar `motivo`.

Um contato pode ter vários cartões, em quadros diferentes, ao mesmo tempo. É
assim que quem compra de novo não precisa de cadastro novo.

> **As duas primeiras linhas mudaram na 0071.** Elas diziam "soma dos cartões
> ganhos". Por que deixaram de dizer, e o que vale em cada caso, está na
> fronteira logo abaixo.

## A fronteira: o que este documento descrevia, e o que vale agora

Este arquivo descreve o modelo desenhado antes da execução do
[plano por fases](plans/2026-09-19-operacao-chatbot-crm.md). Duas peças dele
foram substituídas na F1, e a diferença importa porque há dado gravado dos dois
lados.

### 1. Ganho não é compra (0071, T1.1)

**A regra antiga:** `quadro_cartoes.situacao = 'ganha'` respondia ao mesmo tempo
"este trabalho terminou bem" e "esta pessoa comprou".

**Por que quebrou:** os modelos de funil marcam como ganho a etapa final do
Atendimento ("Resolvido"), da Captação ("Qualificado") e da Agenda
("Compareceu"). Nenhuma delas é compra. A clínica que respondeu dez dúvidas
aparecia com dez compras e uma receita que ninguém faturou (RB-03, A11).

**O que vale:** `quadros.finalidade` separa `comercial` de `operacional`, e a
compra tem registro próprio em `vendas`. Concluir um processo operacional não
move receita nenhuma.

**O legado não foi convertido.** Todo quadro que já existia nasceu
`operacional`, porque marcar os antigos como comerciais transformaria, de uma
vez, todo "Resolvido" acumulado em compra — o defeito de novo, ao contrário.
Ganho antigo em quadro comercial continua contando como compra por
compatibilidade; a classificação assistida do legado é da F5 (RB-32). Nenhum
"Resolvido" virou venda.

### 2. Concluir é uma transação, e continuar é uma intenção (0072, T1.2)

**A regra antiga:** `fecharCartao` fazia quatro escritas em fila, e o comentário
dela admitia "não é transação". A passagem ao quadro seguinte, quando falhava,
escrevia `console.error` e devolvia `null`.

**Por que quebrou, nas duas pontas:**

- uma queda entre a segunda e a terceira escrita deixava o cartão ganho **sem**
  o evento no histórico: o contato virava cliente e a linha do tempo não
  explicava desde quando;
- a continuidade que falhava não deixava rastro nenhum no banco. O log da
  Vercel expira, e a pendência expirava junto — o ganho ficava registrado e
  ninguém nunca sabia que o pós-venda não abriu (RB-25, A26).

**O que vale:** `concluir_processo` grava estado final, evento e conclusão numa
transação só; `conclusoes_de_processo` guarda a conclusão com os ids e os nomes
**da época** (RB-24) e o estado da continuidade.

O quadro que responde "o que aconteceu com esta conclusão":

| `continuidade` | quer dizer |
|---|---|
| `nao_se_aplica` | este processo não encadeia, ou a conclusão não abre destino (perder, por exemplo) |
| `pendente` | há destino a abrir e ele ainda não abriu |
| `feita` | o cartão de destino existe, e `destino_cartao_id` diz qual |
| `falhou` | as tentativas acabaram; a pendência fica **visível** |

**A passagem continua acontecendo no mesmo clique.** A tentativa é inline e a
fila é a rede embaixo dela: adiar o caso comum para o cron transformaria o "o
contato entrou no funil Pós-venda" da tela em promessa. O que a T1.2 mudou não é
*quando* a passagem acontece, é o que sobra quando ela **não** acontece.

**A conclusão de origem nunca é desfeita por falha do destino.** São duas
transações separadas de propósito. Juntá-las devolveria o defeito invertido —
perder a venda registrada porque o pós-venda não abriu.

**Reabrir apaga a conclusão, e não a venda.** Reabrir é a correção do clique
errado, e o fato que ela corrige nunca deveria ter existido; venda tem
cancelamento auditado próprio (RB-31). O cartão já aberto no processo seguinte
também fica: ele é trabalho de alguém.

**O que ainda não existe:** a tela da pendência. A consulta
(`continuidadesPendentes`) existe desde a T1.2, porque sem ela "pendência
visível" é promessa; a tela é da F5.

## Funis encadeados: o SDR passa para o vendedor, que passa para o pós-venda

Funil não é um. Cada empresa parte o processo onde quiser — o SDR qualifica no
quadro dele e entrega; o vendedor fecha no dele; o pós-venda oferece outro
produto ou a renovação no terceiro. A peça que resolve isso é uma só:

**`quadros.seguinte_id`** — "cartão ganho aqui abre cartão lá, na primeira
etapa".

```
Captação (SDR)  --ganho-->  Vendas  --ganho-->  Pós-venda
```

Três motivos para ser encadeamento livre, e não um tipo de quadro com regra
dentro:

1. quem vende de um jeito só não configura nada e nunca lê a palavra "SDR";
2. quem tem três times encadeia três quadros sem a gente prever a combinação;
3. a passagem é **o gesto que já existe** — ganhar. Não inventa botão nenhum.

**O cartão antigo não some.** Ele fica `ganha` no quadro do SDR, que é como o
SDR enxerga o próprio resultado no fim do mês. O novo nasce no quadro seguinte
com o mesmo contato e o mesmo responsável, e o relógio de parado começa do zero
lá — que é o correto: a espera de quem acabou de chegar na mão do vendedor não
é a espera de quem estava com o SDR.

O funil de pós-venda, então, é só o último elo: o quadro de clientes do Kommo
sem nenhuma tela nova. Quem vende uma vez só não cria o quadro e não paga por
ele.

**O que decidimos não construir:** catálogo de produtos, carrinho, estoque,
proposta, contrato, assinatura com cobrança. É um produto inteiro e não é o
nosso. "O que ele comprou" mora no `titulo` e no `valor` do cartão ganho, que é
o suficiente para responder quanto, quando e o quê. No dia que um cliente pagar
para ter catálogo, ele entra como integração — não como tela nossa.

**Tarefas humanas (ligar, visitar, lembrar) ficam de fora por enquanto.** A
tabela `tarefas` que existe é fila de execução do motor, não agenda de vendedor,
e não deve ser reaproveitada para isso. O substituto imediato, que já existe, é
a **mensagem agendada**: o follow-up vira uma mensagem que sai sozinha, e isso é
mais útil do que um lembrete que ninguém abre.

## O caminho completo: o cara chega, e aí?

Vale para quem veio do Lead Ads do Facebook e para quem mandou "oi" no
WhatsApp — muda só a origem registrada.

1. **Chega.** Contato criado ou reencontrado pelo `wa_id`. Origem gravada
   (anúncio, campanha, formulário ou orgânico). Estágio `novo`.
2. **Entra no quadro sozinho.** Todo contato novo ganha cartão na primeira
   etapa do quadro padrão. Sem isso o funil só mostra quem alguém lembrou de
   arrastar — e o quadro passa a mentir.
3. **O fluxo trabalha.** Pergunta, coleta em `campos`, etiqueta. Se o fluxo
   concluir a qualificação, move o cartão de etapa e o estágio vira
   `qualificado`.
4. **Alguém assume.** Atribuição manual ou por rodízio. A partir daí o cartão
   tem cara e o "ninguém respondeu" fica visível.
5. **Anda no funil.** Arrastar o cartão é o gesto principal do produto. Cada
   movimento zera `entrou_na_coluna_em`, que é o que gera "parado há 6 dias".
6. **Fecha.** Ganho pede valor; perdido pede motivo. O estágio do contato
   acompanha.
7. **Continua.** Ganho abre cartão no pós-venda quando esse quadro existe.
   Perdido volta a ser alcançável por campanha.

## O quadro na tela

O que roubar de cada referência: do **Jira**, o menu de ações por cartão (o
`⋯` que faz mover, atribuir, etiquetar sem abrir nada); do **RD**, o painel
lateral rico com histórico; do **Trello**, nada além do arrastar, que já temos.
O que **não** roubar: densidade de gestor de tarefa. Nosso cartão é uma pessoa,
e pessoa tem rosto, canal e última mensagem — não sprint e story point.

### O cartão mostra, nesta ordem

Foto e nome · canal de origem · **última mensagem há quanto tempo** ·
**janela de 24h** quando aberta · valor, se houver · etiquetas · avatar do
responsável · alerta de parado quando passa do limite da etapa.

A hierarquia é essa porque a pergunta real de quem abre o quadro é "de quem
estou devendo resposta", não "em que fase está o processo".

### Ações do cartão (menu `⋯`, sem sair do quadro)

`Responder` (abre a conversa no painel) · `Atribuir a` · `Mover para` ·
`Agendar mensagem` · `Etiquetar` · `Marcar ganho` · `Marcar perdido` ·
`Pausar automação` (já existe em `automacao_ativa`) · `Abrir perfil` ·
`Tirar do quadro`.

### A coluna

Nome · quantidade · **soma dos valores abertos** · limite de dias da etapa
(é o que acende o alerta de parado) · botão de adicionar contato que já existe.

### O clique abre painel, não página

Abrir o perfil não deve tirar a pessoa do quadro. Painel lateral com:
identidade e telefone · estágio e responsável · origem (anúncio/campanha) ·
campos coletados pelo fluxo · etiquetas · cartões dele com valor e situação ·
**linha do tempo única** · notas internas · o que está agendado para ele.

## A peça que falta: linha do tempo

É o que faz uma tela parecer CRM de verdade, e é o que o RD acerta. Uma tabela
nova, `eventos_do_contato`, escrita por quem já faz as coisas: mensagem enviada
e recebida, mudança de etapa, atribuição, mudança de estágio, etiqueta,
cartão ganho ou perdido, mensagem agendada, automação pausada, nota criada.

Sem ela, "o que aconteceu com essa pessoa" só existe espalhado entre a conversa
e a memória de quem atendeu.

## O que muda no banco (migration `0058_crm_funil.sql`, aplicada em 15/set/2026)

```
contacts        + estagio text not null default 'novo'
                + estagio_mudou_em timestamptz
                + ultima_mensagem_em timestamptz   (índice: ordenar o quadro)
quadro_cartoes  + titulo text
                + valor numeric(12,2)
                + responsavel uuid -> af_usuarios
                + situacao text default 'aberta'
                + motivo text
                + fechado_em timestamptz
quadro_colunas  + limite_de_dias integer          (alerta de parado)
                + tipo text default 'normal'      ('normal' | 'ganho' | 'perdido')
quadros         + seguinte_id uuid -> quadros     (ganhar aqui abre cartão lá)
motivos_de_perda (client_id, nome, ordem)
eventos_do_contato (client_id, contact_id, tipo, dados jsonb, autor, criado_em)
```

Aplicada em 15/set/2026, com autorização, tudo em `public` e nada tocando
`app_verandi`. Ver `docs/BANCO-COMPARTILHADO.md`.

## Fontes

RD Station CRM (produto e blog de qualificação), respond.io (glossário e
Lifecycle), Kommo (WhatsApp CRM e funil de clientes), Chatwoot (comparativos de
2026), PipeRun e Agendor (funil de pós-venda).
