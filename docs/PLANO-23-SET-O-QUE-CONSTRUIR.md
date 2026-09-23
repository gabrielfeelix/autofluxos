# O que construir, e por quê

Decidido em 22/set/2026, em conversa com o Gabriel, depois do levantamento de
20 concorrentes (`CONCORRENTES-22-SET-PROFUNDIDADE.md` e
`IDEIAS-22-SET-DO-DONO.md`).

**Este documento é a fila de trabalho.** Quem for executar lê daqui. Cada item
diz o que é, por que entrou e o que precisa decidir antes de começar.

Ordem importa: o item 1 é pré-requisito do 2. O resto é independente.

**Nada aqui foi planejado em detalhe ainda.** É escopo e razão, não plano de
implementação. Cada item ainda precisa do seu próprio desenho antes de virar
código.

---

# Parte A: os quatro fechados

## 1. Preço no produto

**O que:** uma coluna de preço em `src/core/produtos.ts`. Hoje o catálogo tem
`nome` e `especie` ('produto' | 'servico'), sem preço — o preço só existe em
`vendas.ts`, no fato consumado.

**Por que:** sem preço na oferta, o bot não cobra e não recomenda. É a menor
mudança da lista e destrava o item 2.

**Não confundir com catálogo comercial.** O `MODELO-CRM.md:209-213` recusou
carrinho, estoque, proposta e contrato, e a recusa continua válida. Preço no
produto é o mínimo para o bot saber o que oferecer, não um módulo de vendas.

**Decidir antes:** se o preço é fixo ou tem variação (plano mensal vs avulso).
Sugestão: começar fixo, e `null` significa "não informado", nunca 0 — mesma
regra que `vendas.valorTotal` já usa.

---

## 2. Cobrar no chat

**O que:** o bot gera uma cobrança (link ou Pix) na conta do próprio cliente, e
o webhook do PSP registra a venda sozinho quando o dinheiro cai.

**Por que este é o item mais importante da lista:** não é pelo pagamento. É
porque **o CRM nasce vazio**. A produção tem 0 ganhos e 0 cartões com valor —
ninguém registra venda à mão. Painel, LTV, nível por faixa e régua de retomada
estão todos construídos e sem dado.

Quando o webhook marca a venda sozinho, tudo aquilo liga de uma vez. **É a peça
que liga o que já foi pago para construir.**

**Como, e por que assim:**

- **Asaas como primário.** É o único PSP que resolve o problema inteiro num
  fluxo: cria a subconta do cliente via API (`POST /v3/accounts`), devolve a
  `apiKey` dela, e emitimos cobrança em nome dele com split da nossa taxa.
  Autenticação é só header, **sem certificado**. R$ 1,99 por cobrança recebida.
- **O dinheiro vai direto para o dono da PME.** Decisão do Gabriel. Isso nos
  mantém fora do fluxo financeiro e evita virar facilitador de pagamento.
- **Link/Pix como texto ou botão, NÃO `order_details` do WhatsApp.** O
  `order_details` é mais bonito (o cliente paga sem sair do chat) mas soma uma
  fila da Meta a um trabalho de PSP que precisa ser feito igual: a Meta **não
  gera o Pix e não concilia** (*"WhatsApp does not support payment
  reconciliations"*). A confirmação automática, que é o que importa, funciona
  igual nos dois. Fica para depois do ciclo funcionar.

**Duas armadilhas conhecidas do Asaas, planejar antes:**

1. **Período de avaliação regulatória de até 60 dias**, limitado a **10
   subcontas e R$ 2.000 de emissão por subconta**. Estourou qualquer um,
   bloqueia criação e emissão. **Nos primeiros dois meses não se escala.**
2. **Conta-pai tem que ser CNPJ.**

**Alternativa registrada:** Mercado Pago por OAuth, para o cliente que já tem
conta e não quer abrir outra. Contra: não controlamos a taxa que ele paga, e
**o token expira em 6 meses** — sem rotina de refresh, a cobrança para de
funcionar num dia qualquer.

**Custo por ticket, para escolher depois:** R$ 1,99 fixo é 1,3% numa
mensalidade de R$ 150 e **4% numa aula avulsa de R$ 50**. Se o ticket médio da
base for baixo, o Woovi (0,80%, teto R$ 5, split grátis) fica melhor — mas é
casa menor, e isso pesa quando se trata de dinheiro de terceiro.

**Decidir antes:** qual PSP, e se vale suportar mais de um desde o início.

---

## 3. Resumo no momento do transbordo

**O que:** quando o atendente assume a conversa, vê em poucas linhas o que já
aconteceu — o que o cliente pediu, o que o bot respondeu, onde parou.

**Por que:** é o item mais barato da lista que o atendente sente no primeiro
dia. Hoje ele pega a conversa e precisa rolar para cima.

**A matéria-prima já existe:** a trilha do fluxo entra na linha do tempo do
contato (`db0ca42`) e a fila do inbox já sabe quando o bot está calado num
contato (`cc3082e`). Falta juntar e mostrar **no momento em que alguém
assume**.

**De onde veio:** Blip. É o único que faz resumo **inicial e final** bem
desenhado — o inicial lê o pré-transbordo e tickets anteriores, e aparece na
transferência, para o atendente não repetir pergunta que o bot já fez.

**Decidir antes:** se o resumo é gerado por IA ou montado das respostas já
colhidas. O segundo é mais barato, mais previsível e não gasta token. Começar
por ele.

---

## 4. Modo espião do gestor

**O que:** o gestor acompanha a conversa ao vivo sem aparecer.

**Escopo exato, e isto importa:** no ChatGuru — o único dos 20 que tem — a
invisibilidade é **perante os colegas, não perante o cliente**. A doc é
literal: *"acompanhar atendimentos sem que os outros usuários da plataforma
saibam"*, e o mecanismo é **não remover a marcação de não lido** ao abrir o
chat. O cliente nunca veria o supervisor de qualquer forma.

**Por que entrou:** para quem vende a agência ("eu cuido do seu WhatsApp"), é a
tela da demonstração. E é barato: o gestor já pode ver a conversa; o que muda é
não marcar como lida e não registrar presença.

**Decidir antes:** se o atendente fica sabendo depois (log) ou nunca. Tem
implicação trabalhista — vale registrar a decisão, não só implementar.

---

# Parte B: as cinco recomendadas

Escolhidas por um critério só: **ninguém tem, ou quase ninguém tem, e faz
sentido para agência.** Não estão aprovadas — são recomendação.

## 5. Relatório para o cliente da agência (white-label)

**Ninguém tem. Zero em 14 documentações.** O mais perto é o PDF de gráficos do
ChatGuru, descrito como *"compartilhar com pessoas que não tem acesso ao seu
ChatGuru"*.

**O que:** uma página por link, com a marca do cliente da agência, mostrando o
que aconteceu no período: quantas conversas, quantas viraram venda, quanto
vendeu, o que o bot resolveu sozinho, o que foi para humano.

**Por que vale mais do que parece:** o `CONCORRENTES-15-SET.md` já tinha
registrado o problema como "truque do Chatfuel" — **a agência precisa provar
ROI para renovar contrato**. Todo mês o dono da agência tem que justificar a
mensalidade, e hoje ele faz isso na base do "confia". Um link resolve.

E o dado já existe: conversas, vendas (depois do item 2), desfecho da
automação. É empacotamento, não coleta.

**Cuidado:** nasce depois do item 2, senão o relatório mostra atividade e não
resultado — que é exatamente o que não convence ninguém a renovar.

**Já temos a peça de segurança:** o fluxo compartilhável por link com token,
prazo e revogação. Mesmo mecanismo.

## 6. Tempo com o bot vs tempo com o agente

**Só o Octadesk separa, e no plano de R$ 2.499/mês.**

**O que:** medir separadamente quanto tempo a conversa passou com o bot e
quanto passou com gente. E, no mesmo espírito, "tempo até a primeira resposta"
separado de "tempo até a primeira resposta **de humano**".

**Por que:** é o único número que responde **se o bot está ajudando ou
represando fila**. Sem separar, um bot ruim e um bot bom dão a mesma média.

**Por que agora, e não depois:** é barato instrumentar e **caro retroagir**. Se
o carimbo não for gravado desde já, o histórico não volta.

Vale junto: a Huggy mede em **quartis**, não média — média esconde a cauda, e o
cliente que esperou muito é justamente o que reclama.

## 7. O bot não limpa a fila fingindo que atendeu

**Da Kommo, e o nome deles é "Leave messages unanswered".**

**O que:** o bot responde, mas a mensagem **continua marcada como não
respondida** para o humano.

**Por que:** sem isso, o bot responde qualquer coisa, a conversa some da fila, e
ninguém mais olha. O cliente perguntou, recebeu uma resposta que não resolve, e
o sistema conta como atendido.

É quase de graça e evita uma classe inteira de problema silencioso. Combina com
o item 6: os dois medem a mesma coisa por ângulos diferentes.

## 8. Carteira com prazo, contada do fato comercial

**O mercado inteiro erra isto, e erra igual.**

**O caso real (Oderço):** o lead volta para o rodízio se o vendedor não fechou
em 3 meses.

**Quem tentou e como falhou:**
- **Zenvia** (Radar / Tempo de exclusividade): *"funciona somente quando o
  consultor fecha a conversa e utiliza o motivo de fechamento"* — **vendedor que
  nunca fecha trava o lead para sempre**
- **Nectar**: granularidade **só em dias**, e uma automação não dispara outra
- **Kommo**: o relógio conta **da mensagem do cliente** — o vendedor manda
  qualquer coisa e nunca reinicia
- **ChatGuru**: *"os gatilhos só se aplicam a ações dos clientes"* — o lead só
  volta se ele próprio insistir
- **Intercom**: a doc admite *"This requires custom code on your end"*, e é
  US$ 132/assento
- **respond.io**: impossível por arquitetura — sem trigger de atribuição, sem
  trigger agendado

**O erro comum: o gatilho depende de uma ação do vendedor.** Quem quer travar
o lead, trava.

**O desenho certo:** contar do último **fato comercial** — uma venda registrada,
uma resposta do cliente — e não de algo que o dono do lead possa fabricar.

**Evitar também o gatilho por presença.** Três ferramentas erram nisso de
formas diferentes: no Umbler *"aba minimizada não conta como offline"*; no RD o
app minimizado no celular faz o operador **aparecer offline**; a Wati admite que
o Chrome recuperando memória de aba ociosa derruba o status. **Detectar presença
é difícil e todo mundo erra.** Tempo decorrido desde um fato é confiável.

**Já temos metade:** `core/rodizio.ts` é **balanceado** (quem tem mão livre
recebe), não rodízio por ordem fixa. Falta o oposto — dono fixo — e o prazo que
devolve à fila. O comentário do próprio arquivo já previa: *"teto, presença,
papel e pausa são quatro eixos que o dono ainda vai querer mexer"*. Dono e prazo
seriam o quinto.

## 9. "Perguntar ao cliente"

**Do Octadesk. Ninguém mais tem no WhatsApp.**

**O que:** ao lado de **cada campo vazio** do perfil do contato, um botão que
dispara *"Por favor, informe seu/sua [campo]"* — e **a resposta grava sozinha
no perfil**, sem ninguém copiar e colar.

**Por que:** a ficha do contato vive incompleta porque preencher é trabalho
manual que ninguém faz. Isto transforma um campo vazio num clique.

Já temos `campos.ts`, a ficha do contato e o envio por id. A peça que falta é
amarrar a resposta seguinte ao campo que a originou.

---

# Fora de escopo, e por quê

Registrado para não voltar à pauta como ideia nova:

- **E-mail marketing.** Nenhuma das 20 tem de verdade. BotConversa, ChatGuru e
  Leadster só têm aviso interno de equipe; a Kommo é IMAP/SMTP e a doc dela
  manda usar terceiro acima de 2–3 mil/dia; o ManyChat tem canal real mas **o
  corpo não aparece no inbox**. Não é lacuna competitiva. Decidido cortar, com
  prova.
- **Catálogo comercial completo** (carrinho, estoque, proposta, contrato).
  Recusado no `MODELO-CRM.md` e a recusa continua certa. O que falta é preço no
  produto, item 1, e nada além.
- **CSAT gerado por IA.** Recusado pelo dono: *"vamos botar uma IA pra captar às
  vezes conversas de 5 palavras e esperar uma nota, acho nada a ver"*. O
  princípio vale além deste item: **inferir nota de conversa curta é fabricar
  dado**, e dado fabricado contamina o relatório que deveria informar decisão.
- **Garantir taxa de resolução** (o SLA do Tidio, com dinheiro de volta).
  Recusado: *"jamais iremos garantir resolução, é tiro no pé"*.
- **Não faturar quando a conversa vai para humano** (modelo do Fin). Incompatível
  com o produto: vamos centralizar vários WhatsApps num número, com inbox — se o
  humano atender muito, o modelo pune justamente o uso que vendemos. O preço já
  decidido (faixa de conversa, atendentes ilimitados) é o oposto e é coerente.
- **`order_details` do WhatsApp como primeiro passo.** Ver item 2.
- **Scanner de cartão de visita** (Kommo). Depende de ter app nativo, que é
  outra decisão.

---

# Em aberto, e que trava coisa

## Disparo em massa: decisão do dono, e é de contrato

A Meta **permite**: template aprovado, com opt-in, é o produto que ela vende
(~R$ 0,38 por mensagem de marketing no Brasil). O que ela proíbe é template não
aprovado e lista de quem nunca procurou a empresa.

**Os nossos Termos é que proíbem**, em dois lugares de
`src/app/termos/page.tsx`:
- linha 128: *"**Mandar mensagem para quem não pediu.** Disparo em massa para
  lista..."*
- linha 283: *"Nada de disparo em massa"*

E a tela de **Transmissões já existe**. Construímos a tela e proibimos o uso
dela no contrato.

**Três saídas:**
1. Manter a proibição, e não construir disparo nem contagem de público.
2. Reescrever os Termos distinguindo **disparo para lista comprada** (proibir, e
   é o que o texto queria dizer) de **campanha para quem já conversou e deu
   opt-in** (permitir).
3. Permitir só a régua automática (Sequências e Campanhas, que já existem) e
   nunca o disparo manual.

A contagem de público antes do disparo (ideia do BotConversa que o dono gostou)
só faz sentido depois desta decisão.

## Outras

- **Qual PSP** para o item 2, e se mais de um.
- **Cross-sell**: ler o catálogo do cliente por API, ao vivo, para o bot
  recomendar com estoque real e avisar o sistema dele quando vender. A
  arquitetura de ferramentas já suporta (seria uma sexta ferramenta, com
  `injetados` para não cruzar catálogo entre clientes), mas **`integracao` em
  `core/ferramentas.ts` está fixo em `'verandi'`** — virar catálogo por cliente
  é a mudança real. Depende de saber qual sistema o cliente usa (Bling, Tiny,
  Nuvemshop, Shopify). Se for Nuvemshop, atenção: o **Nuvem Chat** já monta
  carrinho na conversa — a dona do dado está comendo essa camada.
- **App nativo**: nada na lista depende, exceto o cartão de visita.

---

# O que já temos e vale defender

Conferido no código em 22/set/2026. Nenhum dos 20 concorrentes tem tudo isto:

- **`core/rodizio.ts` é balanceado**, não rodízio cego. A maioria do mercado
  distribui por ordem fixa (a Poli é **ordem alfabética**).
- **Versão publicada imutável, com histórico e rollback.** O Blip — a maior
  plataforma conversacional do Brasil — **não tem homologação nem
  versionamento**: publicar fluxo é mudar produção, e o padrão de facto deles é
  manter um bot separado.
- **Validador que recusa publicar fluxo sem caminho até humano.** Ninguém mais
  faz.
- **`injetados` e `soDeResultadoAnterior`** em `core/ferramentas.ts`: trava de
  identidade e defesa contra injeção de prompt. **Não apareceu em nenhuma das
  20.** A respond.io, que tem o melhor no-code documentado, autentica com API
  key estática.
- **Atendentes ilimitados, setup zero, repasse do custo Meta a custo.** O
  mercado faz o contrário: a Kommo exige mínimo de 3 usuários e 6 meses
  pré-pagos; o Octadesk exige consultoria de onboarding; o BotConversa revende
  template da Meta a R$ 0,50 (a Meta cobra ~R$ 0,38).
