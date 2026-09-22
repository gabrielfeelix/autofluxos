# Pendências levantadas em 22/09/2026

Vieram da conversa de WhatsApp do dia 22/09, no contato `Gabriel Felix` da
conta `4YU`, relida por inteiro direto do banco em 22/09 à noite.

**Quem é quem, porque a primeira versão deste doc trocou os dois.** No banco, o
número `554498775978` é o **Edu**, e chega como `direcao = 'entrada'`; o
`5511911001414` é o **Gabriel**, e sai como `direcao = 'saida'`. O contato leva
o nome "Gabriel Felix" por ser a agenda de quem cadastrou, não por ser quem
escreve dali. Quem testa o produto e traz os defeitos é o Edu; quem constrói e
decide é o Gabriel. Errar isso inverte a autoria de quase toda decisão abaixo,
e foi o que aconteceu.

Separado entre o que é defeito, o que é decisão já tomada e o que foi avaliado
e descartado.

## Feito nesta rodada

- Editor de fluxo: corredores de fio (Sugiyama com nós de apoio), realce com
  contorno, resto esmaecido, fim do piscar do ✕. Commits `fa4a65d`, `a37e666`,
  `f730b02`, `ed96eff`. Veio do diagnóstico do Gabriel às 14:59: *"não é com o
  tamanho, é com as flechas e setas"*, aceito pelo Edu na hora.
- Crachá de ligação longa: feito e **revertido** a pedido — ocupa mais espaço
  que o traço que substitui e cobre o cartão vizinho (`ed96eff`).
- "Conversa parada" deixou de ser tela própria e virou seção de **Horário de
  atendimento**. O Edu procurou a mensagem de fora do expediente no Horário,
  não achou, e perguntou às 15:45; o Gabriel respondeu às 15:47 *"clica ali em
  conversa parada / acho q meu titulo foi bosta / da pra colocar em horario de
  atendimento se pa"*. **A fusão foi decisão do Gabriel**, tomada na hora, e
  não conclusão tirada depois do erro do Edu. `/ajustes/retomada` redireciona.
- **Os três defeitos de template, corrigidos** (`1391718`, `6616560`,
  `065a77d`), e o botão renomeado (`c3a62ea`). Detalhe de cada um abaixo.
- **Os quatro itens decididos e não implementados saíram** (`7b8f0c9`,
  `63cc24f`, `db0ca42`, `cc3082e`). Sobrou o que depende de decisão sua: o
  conteúdo do fluxo da MGM, o que é da Verandi, e o que está em aberto.

## Defeitos de template, corrigidos

Os três eram de `src/exemplos/`. **O fluxo vivo da MGM é cópia e está no
banco: nada aqui o conserta.** Repetir a correção lá mexe em produção e
depende de autorização explícita.

- **`aula(s)`** no reagendamento (`1391718`). O parêntese era o sintoma; o
  defeito é que a frase rodava em `ola`, **antes** de `tem-reposicao`, onde o
  número ainda pode ser zero: quem não tinha nada para repor lia *"você tem 0
  aula(s) para repor:"* com lista vazia, e era desmentido na mensagem seguinte.
  A contagem saiu da saudação e foi para os ramos, onde já é certa. O mesmo
  parêntese existia no motivo do handoff (`reposição(ões)`), onde o número é
  mesmo variável; virou "em aberto", que serve a qualquer número.
- **Telefone cru** no agendamento (`6616560`). Formatar na origem quebraria as
  integrações: `{{telefone}}` vai no corpo JSON dos presets e é por ele que a
  agenda acha a pessoa. Então são dois, como `hoje` e `hoje_br`:
  `{{telefone_br}}` é o legível, derivado do telefone que venceu a precedência.

  **O doc dizia que não havia helper de formatação. Havia:** `telefoneLegivel`,
  no módulo que já resolve o nono dígito. O grep procurou `formatarTelefone`,
  que é outro nome.

  E cobrir o caso estrangeiro revelou um defeito que já estava em **oito telas
  de contato**: `12025550123`, um número americano, tem os mesmos onze dígitos
  de um celular com DDD e saía como `+55 (12) 02555-0123`. O teste de
  estrangeiro que existia usava um número de Portugal, de doze dígitos,
  recusado pelo comprimento: este caminho nunca tinha sido conferido.
- **Botão único num menu de uma opção só**, em `lembrete.ts` (`065a77d`).
  `qual-aula` perguntava *"É sobre qual delas?"* com uma aula marcada, e o
  WhatsApp mostrava um botão sozinho — o caso mais comum de todos. Agora
  `quantas_proximas` decide antes de falar: uma aula é dita, duas ou mais são
  perguntadas, zero continua em `nada-marcado`.

  **Correção ao que este doc dizia antes:** isto foi registrado como "passo
  morto no reagendamento", com a pergunta *"Qual delas vamos remarcar?"*. Essa
  pergunta não existe no repo — `reagendamento.ts` já tratava a contagem. O
  fluxo com o defeito era o do lembrete.

  E rodar a conversa de verdade achou um terceiro defeito que nenhum teste
  cobria: o rótulo do menu usava `{data}`, que emite a data como a API guarda,
  e saía `2026-08-21 07:00 · P`. O ano gastava cinco dos 20 caracteres da Cloud
  API e o corte comia o nome da aula, justamente o que separa uma opção da
  outra. Agora é `{data:dia_semana}`: *"sexta 21/08 07:00 · Pilates solo"*.

**O que isso ensinou sobre os testes daqui:** os do lembrete olhavam arestas e
nenhum rodava a conversa. O desenho estava certo e a conversa é que não fazia
sentido, e por isso o botão único sobreviveu a todos eles. `lembrete.test.ts`
agora roda os três casos de ponta a ponta.

## Feito também

- **"Já atendi" virou "Atendimento finalizado"** (`c3a62ea`). Proposta do Edu
  às 16:06, fechada pelo Gabriel às 17:41. O rótulo estava em duas telas, e
  mais quatro textos de interface citavam o botão pelo nome antigo — trocar só
  o botão deixaria a interface mandando procurar um botão que não existe mais.

## Decidido, e agora implementado

- **Reagendamento sem data livre** (`7b8f0c9`). Eram duas perguntas erradas
  numa: a data aberta oferecia 365 respostas das quais meia dúzia funciona.
  Agora são faixa (esta semana / a que vem / mais pra frente) e dia, vindo de
  um menu com só os dias que têm vaga. As datas já existiam prontas em
  `core/datas.ts`, com um comentário dizendo que existiam "para o menu de
  agendamento poder oferecer dia sem ninguém digitar data": estavam escritas e
  não usadas.
- **Fluxo de aluno inativo / de licença** (`63cc24f`), em
  `src/exemplos/aluno-inativo.ts`, registrado no catálogo de modelos. Voltar às
  aulas, falar do contrato, cancelar, outro assunto — todas terminam numa
  pessoa, com o motivo já escrito, que é o produto do fluxo.
- **Trilha no histórico do contato** (`db0ca42`). Dois eventos, e não um por
  nó: `entrou-no-fluxo` diz por onde a conversa começou, `escolheu-no-fluxo`
  por onde ela foi. Um evento por bloco viraria log, e log ninguém lê.
- **Sinal de "bot pausado" no inbox** (`cc3082e`). O dado já chegava na fila,
  só não era mostrado. Separado de `aguardando`: aquilo é a fila formal com
  relógio correndo, este é o estado silencioso em que ninguém espera e o robô
  também não responde.

## Fluxo da MGM (conteúdo, não código)

- **Aula experimental x outras terapias**: o bot lista RPG, Drenagem, Liberação
  Miofascial etc. e emenda "Que tal conhecer o estúdio em uma aula
  experimental?" sem dizer que a experimental é só de Pilates. Decisão do
  **Gabriel** às 15:24: *"oferece só pilates aula experimental e se a pessoa
  seleciona os outros transfere"*.
- **Confirmação de número só existe no ramo de agendamento** (Edu, 15:18). Se o
  bot reconhece a pessoa pelo número, "troquei de número" precisa existir em
  todo caminho que dependa da identidade — o próprio Gabriel levantou o caso às
  14:47.
- **Agendamento de liberação / outras modalidades**: hoje não dá pelo zap
  porque o Daniel pediu. O **Edu** discorda e vai falar com ele (15:23: *"nesses
  casos, o certo é redirecionar pra um atendente"*). Sem isso, o certo é
  redirecionar, não recusar.

## Em aberto, não decidido

- **Cancelamento de contrato pelo bot.** Este doc registrava "sempre com
  humano, possivelmente presencial" como decidido. A conversa não fecha isso: o
  Edu levantou às 15:35 o risco de marcar aula para quem não pode fazer
  (*"o cara tem algum problema de saúde e eu marco pra ele a aula, ele se
  fode"*), e o Gabriel respondeu *"hmmm ta blzz, pode ser um problema"*. A
  inclinação é essa, a decisão não foi tomada.
- **Preço para fluxo grande.** O Gabriel perguntou às 14:54 se um fluxo dessa
  complexidade ainda cabe em R$200; o Edu devolveu que a mensalidade não deveria
  mudar em função do número de fluxos, e a conversa terminou em oferecer
  templates (um inteiro e outros quebrados). Nada fechado. A manutenção da MGM
  é R$800/mês.

## Verandi (outro repositório)

- **Modalidade não aparece na ficha do aluno.** Levantado pelo Edu às 10:18,
  com print. Tem que ficar ao lado do ID, na ficha: *"modalidade tem q ser ali
  do lado do ID, na ficha mesmo"* (Gabriel, 10:39).
- **"Atender pedido de exclusão" está escondido.** O Edu levou três mensagens
  para achar, às 15:04: *"não tem opção de excluir aluno / pera / escondido /
  achei"*. Ação de LGPD não pode ser caça ao tesouro.

## Avaliado e descartado, com motivo

- **Quebrar o fluxo da MGM em vários fluxos.** Discussão longa, das 14:40 às
  15:00. O Gabriel cedeu no ponto que importava às 14:58 (*"é incomum mas
  viável no nosso caso"*); o que sobrou era preferência de organização, e o
  problema real era o desenho dos fios. O argumento que virou a discussão foi o
  do Edu: fluxo quebrado obriga quem opera a descobrir **em qual** fluxo deu
  erro, sem o bot dizer.
- **Horário de atendimento por fluxo.** Cada cliente teria que ligar em todo
  fluxo, com horários diferentes em cada um (Gabriel, 15:41: *"dá, mas acho q
  pode dar mt problema pra cliente"*).
- **Personalizar a base de configurações por tipo de negócio.** O **Edu** é quem
  recuou, às 15:45: *"não vale a pena mudar até isso, gera mais problema do que
  coisa boa"*.
- **Transcrição automática de áudio.** Parecia defeito (0 de 25 áudios
  transcritos), não é: `src/server/acoes-transcricao.ts` explica que é sob
  demanda de propósito, porque a chave do Gemini é free tier e o áudio iria
  para treino. O clique é o consentimento.

## Fora de escopo

- **Oderço**: saiu por decisão do Gabriel em 22/09. Ficava registrado aqui como
  bloqueio de receita (200 vendedores, exige CNPJ de tecnologia e MEI não
  fatura); não é mais trabalho deste time.

## Continuação

O que sobrou não se resolve neste repositório: o conteúdo do fluxo da MGM vive
no banco de produção, e os dois itens de interface são da Verandi. Ver
`docs/HANDOFF-22-SET-MGM-E-VERANDI.md`, que mapeia cada um com o arquivo e o
`flow_id` correspondente.
