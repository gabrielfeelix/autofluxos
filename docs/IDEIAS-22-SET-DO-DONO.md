# O que o Gabriel curtiu, e o que ele recusou

Anotado em 22/set/2026, durante a leitura de `CONCORRENTES-22-SET-PROFUNDIDADE.md`.

**Isto não é plano e não é fila de trabalho.** É registro de conversa: o que
agradou, o que foi recusado e por quê. Nada aqui está aprovado para construir.

A razão de existir: numa conversa longa, o que o dono recusou some junto com o
que ele gostou. Recusa some mais rápido, e volta à pauta seis semanas depois
como ideia nova.

---

## Curtiu

### Resumo no início e no fim do atendimento (Blip)

Reação literal: *"ADOREI a ideia de resumo no início e no final"*.

O resumo inicial aparece **no momento da transferência** e lê o pré-transbordo
mais tickets anteriores: o atendente pega a conversa sem repetir pergunta que o
bot já fez. O final fecha o atendimento.

Por que casa com o que já existe: a fila do inbox já diz quando o bot está
calado num contato (`cc3082e`), e a trilha do fluxo já entra na linha do tempo
(`db0ca42`). O resumo é a leitura disso no momento em que alguém assume.

### Modo espião do gestor (ChatGuru)

Reação literal: *"ADOREI a ideia do gestor, importantíssima o modo espião"*.

O gestor acompanha a conversa ao vivo sem aparecer para o cliente.

### Carteirização com prazo (ChatGuru, melhorado pelo caso real)

O ChatGuru tem carteira simples: cliente tem dono fixo. O caso da Oderço é
melhor: **o lead volta para o rodízio se o vendedor não fechou em 3 meses.**
Carteira com prazo de validade, não carteira eterna.

**Já existe metade.** `core/rodizio.ts` é **balanceado, não rodízio por ordem
fixa** — quem tem mão livre recebe o próximo. Falta o oposto: dono fixo, e o
prazo que devolve o lead à fila.

O comentário do próprio arquivo já previu a direção: *"teto, presença, papel e
pausa são quatro eixos que o dono ainda vai querer mexer depois de ver o
primeiro mês"*. Dono e prazo seriam o quinto.

### Coluna "Conexões" na lista de fluxos (BotConversa)

*"acho interessante a ideia de conexao"*. Diz quantos fluxos chamam aquele
fluxo, e com isso revela fluxo órfão: o que ninguém aciona e ninguém sabe que
existe.

### Scanner de cartão de visita (Kommo) — com bloqueio conhecido

Gostou, e apontou o bloqueio na mesma frase: **não temos app**. Fica registrado
como ideia que depende de uma decisão maior (ter ou não app nativo), não como
item solto.

---

## Recusou, e a recusa vale

### Garantir taxa de resolução (Tidio)

Reação literal: *"jamais iremos garantir resoluçao, é tiro no pé pra gente"*.

O Tidio garante 50% de resolução com dinheiro de volta no plano Premium.
**Recusado.** Não voltar com isso.

### CSAT gerado por IA (Digisac)

Reação literal: *"nem sei se é moralmente ético, vamos botar uma IA pra captar
as vezes conversas de 5 palavras e esperar uma nota, acho nada a ver agora"*.

O argumento é bom e vale registrar como princípio, não só como recusa deste
item: **inferir nota de conversa curta é fabricar dado**, e dado fabricado
contamina o relatório que deveria informar decisão.

O número que a Digisac usa para justificar (94% não respondem pesquisa) é real.
A resposta deles é que não convence.

### Não faturar quando a conversa vai para humano (Intercom/Fin)

Não é recusa por discordar do princípio, é por **incompatibilidade de modelo**.
Observação dele: *"iremos tbm ser um chatbot empresarial com inbox, iremos
tambem CENTRALIZAR TODOS OS WHATSAPPS em um unico numero"*.

Se o humano atender muito, o modelo do Fin pune justamente o uso que a gente
vende. E o preço já decidido — **por faixa de conversa, atendentes ilimitados**
(`PLANO-16-SET`) — é o modelo oposto e coerente com inbox.

### Chatfuel inteiro

*"nem entendi nem parece interessante"*. As 20 regras de handoff não
despertaram nada. Sem volta.

---

## A tensão que ele nomeou, e que não se resolve sozinha

Frase dele: *"se pa to virando um pato q faz de tudo, ou tambem alguem q
resolve varias pendencias diferentes em um unico produto"*.

Ele mesmo deu as duas leituras, e as duas são defensáveis. O que dá para
registrar com alguma segurança:

- **Centralizar vários WhatsApps num número, com inbox e bot, é um produto só.**
  É o que Kommo e Blip vendem, e ninguém chama de pato.
- **O que faz virar pato é canal novo**: e-mail, SMS, landing page. Os três já
  foram cortados nesta mesma conversa, o e-mail com prova de que nenhum dos
  cinco concorrentes tem de verdade.

Ou seja: a fronteira já foi desenhada, e por acaso na direção certa. Vale manter
a frase por perto como teste de cada ideia nova: **isto é mais um jeito de
resolver a conversa do cliente, ou é um canal novo para manter?**

---

## Disparo em massa: a resposta é dos nossos Termos, não da Meta

Pergunta dele: *"mas o meta deixa? n é contra as politicas deles?"*

**A Meta deixa.** Template aprovado, com opt-in, é o produto que ela vende
(mensagem de marketing, ~R$ 0,38 por entrega no Brasil). O que ela proíbe é
template não aprovado e lista de quem nunca procurou a empresa.

**Os nossos Termos é que proíbem.** `src/app/termos/page.tsx`, em dois lugares:

- linha 128: *"**Mandar mensagem para quem não pediu.** Disparo em massa para
  lista..."*
- linha 283: *"Nada de disparo em massa"*

E a tela de Transmissões **existe** (`app/clientes/[clienteId]/transmissoes/`).
Ou seja: construímos a tela e proibimos o uso dela no contrato. Não é bug, é
decisão que ficou pela metade — e `EXPANSAO.md` já registrava como "em aberto
por decisão de produto".

**Três saídas, e é decisão do dono:**

1. Manter a proibição, e então não construir disparo nem contagem de público.
2. Reescrever os Termos distinguindo **disparo para lista comprada** (proibir,
   e é o que o texto queria dizer) de **campanha para quem já conversou e deu
   opt-in** (permitir, é legítimo e é o que a Meta vende).
3. Permitir só a régua automática (que já existe em Sequências e Campanhas) e
   nunca o disparo manual para lista.

**A contagem de público antes do disparo (BotConversa) só faz sentido depois
desta decisão.** Ele gostou da ideia e fez a pergunta certa junto: *"disparar o
que? a gente vai disparar algo?"*

---

## Em aberto, e não decidido

- Disparo em massa: qual das três saídas acima.
- App nativo: o cartão de visita depende disso, e nada mais na lista depende.
- Onde o copiloto do atendente entra na ordem, contra o ciclo de cobrança.

---

# Parte 2: a camada de gestão e supervisão

Levantamento de 22/set/2026, 20 ferramentas, documentação oficial.

Esta parte cobre o que as três primeiras pesquisas tinham deixado de fora:
**gestão de equipe, supervisão, roteamento, escalas, relatórios e
encerramento.** É a camada que separa "ferramenta de dono atendendo sozinho" de
"ferramenta de operação com supervisor" — e, como se vê abaixo, é onde há mais
espaço vazio.

Fonte por afirmação. **Doc** é central de ajuda ou referência de API.
**Landing** é página de vendas. Onde os dois divergem, a divergência é o achado.

---

## Os três espaços livres

Confirmados por ausência em 14 documentações:

### 1. Expiração de carteira por tempo, granular e confiável

Quem tem, tem com furo:

| | O que tem | O furo |
|---|---|---|
| **Zenvia** | **Radar / Tempo de exclusividade** + Reatribuição | *"funciona somente quando o consultor fecha a conversa e utiliza o motivo de fechamento. Enquanto a conversa estiver aberta ela não é reatribuída"* — **vendedor que nunca fecha trava o lead para sempre** |
| **Nectar CRM** | gatilho Inatividade/Estagnação/Atraso + ação Rotacionar | granularidade **só em dias**; *"uma automação não ativará o gatilho de outra"* (sem cascata) |
| **Intercom** | SLA estourado → Workflow → reatribuir | a doc admite: *"This requires custom code on your end."* E só no **Expert, US$ 132/assento** |
| **RD Station** | "Distribuição de atendimento sequencial" | expira a **fila**, não a posse |
| **Kommo** | gatilho de X horas + "Change lead's user" | o relógio conta **da mensagem do cliente** — vendedor manda qualquer coisa e nunca reinicia |
| **Digisac** | "Redistribuir somente chamados não respondidos" | gatilho é **offline**, não tempo decorrido |
| **ChatGuru** | — | *"Os gatilhos só se aplicam a ações dos clientes!"* — o lead só volta **se ele próprio insistir** |
| **respond.io** | — | **impossibilidade arquitetural**: sem trigger "Assignee Updated", *"Time-based or scheduled triggers are not supported"*, Workflow morre em 7 dias. [Pedido aberto no Canny](https://respond.canny.io/feature-request/p/workflows-time-since-conversation-started-trigger) |
| Wati, Poli, Huggy, BotConversa, Sellflux | nada | — |

**O erro comum a todos que tentam: o gatilho depende de uma ação do vendedor**
(fechar a conversa) **ou do cliente** (mandar mensagem). Quem quer travar o
lead, trava.

O desenho que o caso da Oderço pede é o contrário: contar do último **fato
comercial** — uma venda, uma resposta do cliente — e não de algo que o dono do
lead possa fabricar. Isso, ninguém faz.

### 2. Relatório white-label para o cliente final da agência

**Zero em 14 documentações.** O mais perto é o PDF de gráficos do ChatGuru,
descrito como *"compartilhar com pessoas que não tem acesso ao seu ChatGuru"*.

O `CONCORRENTES-15-SET.md` já registrava isso como "truque do Chatfuel": a
agência precisa provar ROI para renovar contrato. Continua sem dono.

### 3. Pausa com motivo + capacidade máxima juntos, em ferramenta brasileira acessível

A Zenvia tem pausa, a Digisac tem capacidade. A combinação padrão call center
só aparece em ferramenta cara ou estrangeira.

---

## Supervisão

### Modo espião: só o ChatGuru, e o escopo não é o que parece

Doc literal: *"O modo espião permite que o usuário não remova a notificação de
mensagem não lida ao acessar chats, podendo assim acompanhar atendimentos **sem
que os outros usuários da plataforma saibam**"*
([wiki](https://wiki.chatguru.com.br/sobre-o-sistema/usuarios.md#modo-espiao)).

**É invisibilidade perante os colegas, não perante o cliente.** Faz sentido: o
gestor não quer que o *atendente* saiba que está sendo observado. O cliente
nunca veria o supervisor de qualquer forma.

Nas outras 19: não existe, ou é só permissão de "ver todos os chats". A **Wati
faz o inverso** (`Chat Visibility` restringe o operador a ver só o que é dele).
**Nenhuma das 20 documenta barge-in ou whisper.**

### Painel ao vivo

**Blip Monitoramento** é o melhor: fila com tempo máximo de espera, status dos
agentes contados por estado, **refresh a cada 30s**, **modo tela cheia para
telão**, e **desconectar agente inativo**. O Novo Monitoramento (abr/2025)
trouxe **chat gestor-atendente** de dentro da tela.
Limites: **só o dia corrente**, e os filtros salvos ficam no navegador.

Também têm: Digisac **"Agora"** (com Saúde WABA; aplicar filtro **desliga** o
tempo real), Poli **Manager**, Huggy **Dashboard**, RD **Monitoramento** (com
**TMI, tempo de inatividade por operador**), Zenvia, Intercom **Real-time
Dashboard** (só Expert, com **Idle** e **SLA miss rate**), Sellflux.

**respond.io tem Dashboard, mas "tempo real" só aparece em landing page.**
**Octadesk não tem tela equivalente.**

### SLA com alarme: só três

- **Intercom** — 4 alvos, semáforo vermelho/laranja/cinza, e **SLA estourado
  desfaz o snooze**. Trigger de breach em beta. Só **Expert**.
- **Zenvia** — 4 SLAs (documentados no legado).
- **Poli** — **"Filtro Rápido de Criticidade"**, com limiar de espera
  **configurável pelo gestor**, mais Insights de IA que alertam sobre
  **sobrecarga de atendente**. É o melhor custo-benefício da faixa brasileira.

**A pegadinha do Octadesk:** ele tem "Tempo máximo de resposta" e filtro "Tempo
excedido" — mas o artigo diz que vale **só para chat de website**. Idem o
encerramento por inatividade. **Os dois recursos de disciplina operacional não
cobrem o WhatsApp**, que é o canal que sustenta o mercado brasileiro.

### Metas por atendente: Kommo e Nectar

Kommo: **Goal report** por usuário e time, ano/trimestre/mês, por quantidade ou
valor (Advanced+). Nectar é mais desenvolvida: 7 tipos, **periodicidade
diária**, "Distribuir macro meta", forecast, e "Responsável pela supervisão".

Nas outras 18, não existe.

### Monitoria de qualidade (QA)

**Só o Intercom tem de verdade**: Monitors + **Custom Scorecards** com peso
0–100, limiar de aprovação e **critérios críticos**. Mas é **add-on Pro pago por
volume** — time de 5 com QA passa de US$ 760/mês.

Substitutos automáticos: Digisac **IA CSAT** e Wati **CX Score**. Os dois medem
**satisfação**, não resolução. (Ver a recusa do dono na Parte 1.)

---

## Roteamento

### Algoritmos, e por que o do Blip é melhor

**Blip** ([doc](https://help.blip.ai/hc/en-us/articles/18694892640791-How-ticket-distribution-works)):
elegibilidade = na equipe + **Online** + slot livre. Desempate = **menor carga
agora**, depois **quem recebeu há mais tempo**. Isso é **least-busy com fallback
round-robin por recência**.

**Octadesk**: a roleta manda os próximos *"conforme quem for encerrando mais
conversas"* — fila puxada por liberação de capacidade.

**O nosso `core/rodizio.ts` já é balanceado**, com o argumento escrito no
arquivo: *"Rodízio puro ignora carga: o vendedor com onze conversas abertas
recebe a décima segunda porque 'era a vez dele'."* Estamos no grupo certo.

**Rodízio cego (pior):** Poli é **ordem alfabética**; ChatGuru pondera
**repetindo o nome na lista**; Kommo "Round Robin" **não é distribuidor de
fila** — é rotação de passos do bot, e **reinicia se você adicionar ou remover
um vendedor**.

### Herança de prioridade na transferência (Blip) — regra pequena, efeito grande

Ao transferir, o ticket é fechado como `Transferido` e **um ticket novo herda a
prioridade do original**. O exemplo da doc é literal: tickets A e B; A
transferido vira C; **C é distribuído antes de B**.

**Transferir não joga o cliente para o fim da fila.** É o tipo de regra de três
linhas que separa fila justa de fila que pune quem foi transferido.

### Roteamento por habilidade e por prioridade

**Skill: só o Intercom** (Expert). **Prioridade: Intercom e Zenvia** (peso
0–10). Todos os outros usam departamento como proxy.

### Carteirização (dono fixo)

Têm: **Octadesk** ("Responsável pelo contato", com **transferência em massa** e
obrigatoriedade de escolher herdeiro ao excluir um usuário), **respond.io** (é o
**padrão** — configura-se o oposto), **Poli** (*"Deseja prender o contato apenas
aos atendentes da carteira?"*, e a regra fina de **não perder a vez** no rodízio
quando é cliente retornando), **Digisac** ("Fidelização", aplicável em lote),
**RD** (Carteira de Clientes, com expediente próprio), ChatGuru, Nectar,
Sellflux.

**Wati tem o tijolo e não a parede:** existe `Contact Owner` e o toggle *"Make
assignee as contact owner"*, mas **a doc não diz que o roteamento usa esse
campo**. É rastreabilidade, não distribuição. Para carteirizar, o caminho
oficial deles é **webhook contra CRM externo**.

**Não têm:** Huggy, BotConversa, Umbler, Blip.

**Ceticismo devido:** o ChatGuru vende "Carteira de Clientes" e "Rodízio
Avançado" **só na página de preços, sem doc técnica**, e a tabela desktop
contradiz a mobile. O changelog da wiki deles para em **10/06/2025**.

---

## Escalas e disponibilidade

### Pausa com motivo: três, e a Zenvia ganha

- **Zenvia** — **Disponível / Indisponível / Pré-pausa / Pausa**, motivo
  escolhido pelo agente e tela de admin para gerenciar os motivos.
  **Pré-pausa** (gerenciar a fila no período que antecede o almoço) não existe
  em mais nenhuma das 20. Vocabulário de call center de verdade.
- **Intercom** — **Away reasons**, 9 padrão, até 100, com o toggle **"Make away
  reasons mandatory"**.
- **Blip** — **Custom Breaks**, com "Nome da pausa" e "Duração em minutos",
  justificado pela **NR-17** (a norma de ergonomia que rege pausa de
  teleatendimento). **Mede** no relatório Attendant Status. Ressalva: estourado
  o tempo, **não volta sozinho**.

**Octadesk deixa rotular e não mede** — tem status personalizados ("Pausa
Almoço"), sem relatório de tempo em cada status.

### Capacidade máxima simultânea

Têm por atendente: **Digisac** (por atendente **e** departamento), **Poli**
(varia por departamento), **Huggy**, **Zenvia**, **Intercom** (dois níveis;
⚠️ **sem Workload Management o limite é fixo em 3 e não editável**),
**Octadesk** (com a fila "Não atribuídas" e a permissão dedicada "Transferir
conversas acima do limite"), **Blip** (slots).

**respond.io: o teto é do Workflow, não do usuário** — não dá teto 5 ao júnior e
15 ao sênior.

**Não têm:** Wati, RD, Umbler, Nectar, Kommo, BotConversa, ChatGuru.

### Turno por atendente

**Só ChatGuru** ("Horário de acesso", dois períodos por dia, e **desconecta o
usuário automaticamente** no limite). Nos outros, o horário é da conta, do setor
ou do fluxo.

**O buraco do Blip:** não existe tela de horário de atendimento. A doc é
literal: *"toda a configuração do horário de atendimento é feita pela ação de
executar script"* — dois JavaScripts (`SetWorkSchedule`, `CheckWorkTime`) dentro
de um bloco do Builder. **Mudar o horário de sábado exige editar código.** A
própria Blip oferece um gerador hospedado em Netlify como contorno.

### Quando o atendente sai: buraco quase universal

**Digisac é a única com política explícita**: três opções (redistribuir tudo / só
não respondidos / não redistribuir) + "tempo máximo de chamados na fila
offline".

Na maioria (Huggy, ChatGuru, BotConversa, respond.io, Wati, Intercom), **as
conversas já atribuídas ficam paradas com o ausente** — só param de chegar
novas. O Octadesk admite que em tickets *"é necessário atribuir para um novo
responsável"*.

### Três armadilhas de presença, e a lição que elas dão

- **Umbler**: aba minimizada **não conta como offline**. Quem foi almoçar com a
  aba aberta não dispara reatribuição nenhuma.
- **RD**: operador com o app minimizado no celular **aparece offline** — o
  supervisor vê equipe fantasma.
- **Wati**: a doc admite que o Chrome recuperando memória de aba ociosa faz o
  agente aparecer offline.

**Detectar presença de verdade é difícil, e todo mundo erra.** Se formos fazer
carteira com prazo, o gatilho por presença é frágil; tempo decorrido desde um
fato é mais confiável.

---

## Relatórios

### Os mais completos

- **respond.io — 11 abas**: Lifecycle, Calls, Conversations, Responses,
  Resolutions, Messages, Contacts, **Assignments**, Leaderboard, Users,
  Broadcasts. ⚠️ Responses conta **só conversas fechadas** e **ignora resposta
  de bot**; tem aba "Resolutions" **sem resolution rate**; export CSV com teto
  de **10.000 linhas** e **sem API de export**.
- **Intercom — 12 templates**, com Custom Reports (100+ gráficos) do Advanced
  para cima. ⚠️ **as durações da API excluem office hours**, o que explica
  divergência com o dashboard.
- **Nectar** — 9 rankings, Win/Loss, **B.I. com fórmulas**. ⚠️ **filtro de data
  relativa vira data fixa ao salvar** — o painel "ao vivo" congela sem avisar.
- **Huggy — 8 nomeados**, e o mais rigoroso metodologicamente: **quartis** em
  tempo de atendimento e espera (média esconde a cauda, quartil mostra quem
  esperou muito), **Camadas** (humana/automática/inteligente) como dimensão
  transversal, e **conta o chat uma vez só apesar de várias reaberturas**.
- **Blip — 7 nomeados**: Active Messages, Event Tracking, Chatbot and User
  Metrics, Full Conversation History (PDF), Attendant Metrics, Service History,
  **Attendant Status**. ⚠️ **defasagem D-1** (não há relatório de hoje), máximo
  90 dias por extração, **sem agendamento nativo** (o que o material comercial
  vende é a extensão Analytics Reports Scheduler).
- **Octadesk** — as **sete métricas de tempo** são o diferencial real:
  **tempo médio com o bot**, **com o agente**, até primeira resposta, **até
  primeira resposta de humano**, **até humano assumir**.

### Métricas raras que valem conhecer

- **Digisac: "Média do 1º tempo de espera após finalização do bot"** — separa a
  espera causada pelo bot da causada pela equipe.
- **respond.io: "Average Number of Assignments to Close"** — mede lead jogado de
  mão em mão.
- **Kommo: "Longest awaiting reply"** (o pior caso agora, não a média) e
  **"Leads without task"** (o lead com dono e sem próximo passo).
- **RD: T.M.E. dentro e fora do expediente, separados.**
- **ChatGuru: "Chats × Horas"** — mapa de calor dia × hora. Dimensionamento de
  escala de graça.
- **Zenvia usa mediana em vez de média e declara o porquê**, e mostra tempo de
  fechamento **com e sem horário comercial lado a lado**: um número para cobrar
  da equipe, outro para saber o que o cliente sentiu.

### O pior caso

**BotConversa não tem aba de relatórios — e o problema é mais fundo: o dado de
atendimento humano não é coletado.** As três métricas do painel medem interação
com o robô. Sem carimbo de "atendente respondeu às HH:MM", **não há como
construir TMA nem pela API**. O líder de volume brasileiro não mede atendimento.

**Taxa de resolução: ninguém calcula.**

---

## Encerramento

### Motivo obrigatório

Têm trava real: **Digisac** ("Assunto obrigatório"), **respond.io** (três modos:
opcional / categoria obrigatória / **categoria e resumo obrigatórios**), **RD**
(Tabulação, que vira dimensão de relatório), **Zenvia** (*"todas as conversas
devem estar vinculadas a um ticket para poderem ser encerradas"*), **Sellflux**
(**configurável por atendente**, não global), **Nectar**.

⚠️ Contraintuitivo: **a recomendação oficial da respond.io é deixar o
preenchimento manual DESLIGADO** e a IA gerar o resumo.

**Não têm:** Kommo, Wati, BotConversa, ChatGuru (*"Não é possível impedir que um
usuário altere os status"*), Umbler, Poli, **Intercom**.

### Motivo como árvore, não como tag (Octadesk)

O campo **"Lista com níveis"** permite **árvore de motivos** hierárquica,
obrigatória no encerramento, e **mais de uma classificação no mesmo
atendimento** (para quando o cliente traz mais de um assunto). A Octadesk
posiciona explicitamente como substituto do *"excesso de tags"*.

No Blip, o campo obrigatório de fechamento **é a tag**, cadastrada por fila.

**Tag vira lixo em três meses; árvore de motivos vira relatório.**

### Protocolo

**Só a Digisac tem formato configurável** (`AAAAMMDD` + contador, ex.
`20250101-000007`), com filtro por protocolo. RD tem protocolo consultável.
**Umbler é o pior caso: `{{Conversa.Id}}` em Base64, ilegível ao telefone.**

### Reabertura

**Huggy é a mais rigorosa** (conta o chat uma vez só apesar de reaberturas).
**ChatGuru** reabre com carência (padrão 30s, para que um "obrigado" não polua o
relatório). **Octadesk** tem regra com prazo em dias e **escolha do que é
herdado**. **Blip não tem reabertura** — cada retorno vira ticket novo, por
decisão de arquitetura.

⚠️ **Sellflux**: a reabertura devolve o cliente ao **primeiro bloco do robô**,
não ao atendente anterior.

---

## Governança e segurança

**Auditoria consultável pelo cliente: nenhuma das 20 entrega.** O Blip tem Log
de mensagens (tráfego, não acesso) e cita logs retidos 5 anos — mas é
infraestrutura da empresa, não tela do cliente. No Octadesk, confirmado ausente
em três artigos distintos.

**Mascaramento de dado sensível: quase ninguém.**
- **Wati — Phone Number Masking**: esconde o telefone do cliente **do próprio
  atendente**. Anti-vazamento de base.
- **RD — ocultação LGPD (beta)**: e-mail/telefone ocultos, e **a exportação sai
  anonimizada**.
- **respond.io — Restrict Contact Visibility** em três níveis.
- **Nectar — limite mensal de exportação de contatos** (anti-vazamento quando o
  vendedor sai).
- Blip e Octadesk: **não têm**. No Blip, o content type "Sensitive information"
  é primitivo de protocolo, não painel de DLP.

**Segurança:** Blip tem SSO/ADFS, MFA e **ISO 27001:2022**. Digisac tem SSO
Azure AD, 2FA e **restrição por IP**. **Octadesk tem 2FA só por e-mail** (sem
TOTP), ativado por conta, e **a desativação é irreversível**.

**Lock-in do Octadesk:** o **backup de conversas leva 15 a 30 dias úteis**,
pedido por chamado, informando conta do Google Drive e **print da tela de gestão
de usuários**. E **não é possível excluir contatos, apenas inativar** — problema
real para pedido de eliminação sob LGPD.

**Ambiente de homologação:** o Blip **não tem**. Publicar fluxo é mudar
produção; o padrão de facto é um bot separado. Só existe Ctrl+Z.

**Aqui temos vantagem real:** versão publicada **imutável**, com histórico e
rollback, e uma conversa iniciada às 14h continua rodando o grafo de 14h.
Contra a maior plataforma conversacional do Brasil.

---

## Produtividade: duas ideias que valem

**Octadesk — "Perguntar ao cliente".** Ao lado de **cada campo** do perfil há um
botão que dispara *"Por favor, informe seu/sua [campo]"*, e **a resposta grava
sozinha no perfil**. Funciona no WhatsApp, dentro da janela. É enriquecimento de
cadastro sem copiar e colar.

**Intercom — "por que a conversa está parada".** Um ícone com o motivo em
linguagem clara: *All teammates are at capacity · All teammates are away · No
eligible teammates*. E **posição na fila** para o cliente ("#3 na fila").

Outras, menores: Kommo **"Leave messages unanswered"** (o bot responde e a
mensagem **continua marcada como não respondida** — impede o bot de limpar a
fila fingindo atendimento); ChatGuru **histórico de delegações** dizendo se foi
automática ou manual (resolve briga de comissão) e **relatório agendado
entregue no WhatsApp do gestor**; Blip **Spintax** (texto rotativo, para o bot
não repetir a mesma frase); Octadesk **vinculação de tickets pai/filho**
(resposta replica para todos os filhos — cem clientes na mesma queda, uma
resposta).

---

## Armadilhas de leitura de número

Valem para qualquer comparação futura. Todas documentadas pelas próprias
empresas:

- **Blip: "Perdido" e "Abandonado" ficam zerados por padrão** — dependem de uma
  chamada de API que o cliente precisa implementar. Quem comemora abandono zero
  está lendo campo nunca preenchido.
- **Blip: transferido conta como "Atendido"**, e **TMA começa na primeira
  resposta**, não na abertura.
- **Wati: FRT é contado a partir da atribuição**, não da mensagem do cliente.
  Quem manipula a atribuição manipula a métrica.
- **Wati: "Tickets Expirados" é a janela de 24h do WhatsApp**, não devolução de
  lead. Falso positivo fácil de cometer.
- **Kommo: no Report by activities, "New" conta quem criou o lead e "Won/Lost"
  contam quem é o responsável agora** — em time com reatribuição, distorce
  comissão. A própria Kommo documenta.
- **Octadesk: alerta de tempo excedido e encerramento por inatividade não valem
  para WhatsApp.**
- **BotConversa: `[Atribuir e abrir atendimento]` não transfere** — se já tem
  dono, permanece. Menu de setores sem bloco de remoção = o cliente escolhe
  "Financeiro" e continua com o vendedor da semana passada. E se todos
  estiverem ausentes, **o chat fica sem atribuição e ninguém é avisado**.

---

## Onde os planos travam o recurso

Isto decide compra, e é o padrão do mercado: **o plano de entrada não faz
gestão.**

- **Wati Growth**: sem roteamento nenhum, só manual. Round robin **só no
  Business**.
- **respond.io Starter**: **sem Workflows** — sem round-robin, sem CSAT, e você
  **não sabe o tempo de primeira resposta dos seus vendedores**. Destrava no
  Growth, **US$ 159/mês**.
- **Intercom**: SLA, Balanced, Skill routing e Real-time Dashboard **só no
  Expert, US$ 132/assento**. Com QA, time de 5 passa de **US$ 760/mês**.
- **Umbler Essencial (R$ 99,90/atendente)**: Espera, Inatividade, Logs, API e
  Notificar atendente são todos "Não".
- **Kommo Base**: sem Salesbot, sem broadcast, sem agente de IA.
- **Sellflux**: os três planos vêm com **só 2 usuários**; adicional R$ 29 cada.

**Nossa posição é o oposto:** faixa de conversa, atendentes ilimitados, setup
zero.

---

## O que temos, e não sabíamos que era diferencial

Conferido no código em 22/set/2026:

- **`core/rodizio.ts` é balanceado, não rodízio fixo** — com o argumento escrito
  no arquivo. A maioria do mercado é rodízio cego.
- **Versão publicada imutável com rollback** — o Blip não tem homologação nem
  versionamento.
- **Validador que recusa publicar fluxo sem caminho até humano** — nenhum
  concorrente faz.
- **`injetados` e `soDeResultadoAnterior` em `core/ferramentas.ts`** — trava de
  identidade e defesa contra injeção de prompt, que **não apareceu em nenhuma
  das 20**.

---

## Em aberto (Parte 2)

- Se carteira com prazo entra, e com qual gatilho (o erro do mercado é depender
  de ação do vendedor).
- Se o resumo no transbordo entra antes ou depois do ciclo de cobrança.
- Se relatório white-label vale como diferencial de agência — está livre, e é a
  única das três lacunas que ninguém sequer tentou.
