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

## Defeitos confirmados no código, ainda abertos

- **`aula(s)`** em `src/exemplos/reagendamento.ts:96`. Pluralização preguiçosa
  numa frase que vai para o cliente final. Não há sintaxe de plural no
  interpolador (`src/core/engine/interpolar.ts` só troca `{{var}}`), então a
  saída é criar variável derivada no preset ou reescrever a frase.
- **Telefone cru** em `src/exemplos/agendamento.ts:87`: sai
  `5511911001414` no meio da frase. Não existe helper de formatação no repo
  (`grep formatarTelefone` = zero).
- **Botão único num menu de uma opção só**, em `src/exemplos/lembrete.ts:73`.
  O nó `qual-aula` abre `proximas` como menu e pergunta *"É sobre qual delas?"*
  mesmo quando a lista tem um item: o WhatsApp mostra um botão sozinho e a
  pergunta não tem escolha nenhuma a fazer.

  **Correção ao que este doc dizia antes:** isto foi registrado como "passo
  morto no reagendamento", com a pergunta *"Qual delas vamos remarcar?"*. Essa
  pergunta não existe no repo. `reagendamento.ts` já trata a contagem: o nó
  `tem-reposicao` manda zero para outro assunto, `mais-de-uma` manda duas ou
  mais para a recepção, e **uma** segue direto para `qual-dia`, sem perguntar
  qual. O fluxo com o defeito é o do lembrete.

Os dois primeiros estão nos **templates** (`src/exemplos/`). O fluxo vivo da
MGM é cópia e está no banco: corrigir o template não conserta a MGM. São duas
correções, e a da MGM mexe em produção — **não fazer sem autorização explícita**.

## Decidido e ainda não implementado

- **"Já atendi" vira "Atendimento finalizado".** Proposta do Edu às 16:06
  (*"aí tem um botão de já atendi mas q da pra mudar pra atendimento
  finalizado"*), fechada pelo Gabriel às 17:41: *"faz sentido faz sentido,
  podemos manter assim"*. O rótulo está em dois lugares, os dois chamando
  `acaoEncerrarAtendimento`: `inbox/page.tsx:1330` e
  `leads/[contatoId]/page.tsx:294`. O par já existe e é o que dá sentido ao
  novo nome: "Assumir atendimento" tira do bot, "Atendimento finalizado"
  devolve.
- Reagendamento **sem data livre**: semana → dia da semana → horários
  ofertados. Hoje o aluno digita a data que quiser e o bot diz que não tem.
  Proposta do Edu às 13:15: *"nunca deixando o aluno sair digitando a data q
  quiser, aí sim a gente começa a evitar dor de cabeça nos fluxos"*.
- Fluxo para aluno **inativo / de licença**, com boas-vindas e opções próprias
  (voltar às aulas, cancelar contrato, falar com atendente). Edu, 13:16. Todas
  as opções terminam num humano: *"de qualquer forma, cada uma delas leva pro
  atendente, mas já resolve a maior dúvida do pq entrou em contato"*.
- **Trilha no histórico do contato** ("acessou fluxo → agendamento → cancelou →
  reagendou"). Proposta do **Edu** às 15:35. O Gabriel respondeu a outra coisa
  na mesma janela e a conversa desviou; ninguém voltou. É o que permite depurar
  fluxo sem adivinhar.
- **Sinal de "bot pausado" no inbox.** O "não está indo" das 10:39 não era bug,
  era handoff: às 11:26 o Gabriel explicou *"é que eu ou vc assumimos a
  conversa, então tirou do bot"*. A retomada por inatividade trata o efeito; a
  causa é não haver sinal claro de que a conversa saiu do bot.

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

## Fora de produto

- **Oderço**: 200 funcionários em vendas, quase fecharam com concorrente que
  cobrava R$1,5k por fluxo. O Edu falou com o gestor dele (14:27) e vai montar
  teste gratuito com um funcionário por pouco mais de um mês. Exige CNPJ de
  tecnologia, MEI não fatura — precisa abrir ME. Bloqueio de receita com prazo.
