# Pendências levantadas em 22/09/2026

Vieram da conversa de WhatsApp entre Gabriel e Edu (contato `Gabriel Felix`,
cliente `4YU`) do dia 22/09, lida por inteiro com as imagens. Separado entre o
que é defeito, o que é decisão já tomada e o que foi avaliado e descartado.

## Feito nesta rodada

- Editor de fluxo: corredores de fio (Sugiyama com nós de apoio), realce com
  contorno, resto esmaecido, fim do piscar do ✕. Commits `fa4a65d`, `a37e666`,
  `f730b02`, `ed96eff`.
- Crachá de ligação longa: feito e **revertido** a pedido — ocupa mais espaço
  que o traço que substitui e cobre o cartão vizinho (`ed96eff`).
- "Conversa parada" deixou de ser tela própria e virou seção de **Horário de
  atendimento**. Uma tela inteira no menu para uma única opção não se paga, e o
  Edu foi procurar a mensagem de fora do expediente no horário, não achou, e
  gastou cinco mensagens perguntando. `/ajustes/retomada` redireciona.

## Defeitos confirmados no código, ainda abertos

- **`aula(s)`** em `src/exemplos/reagendamento.ts:96`. Pluralização preguiçosa
  numa frase que vai para o cliente final. Não há sintaxe de plural no
  interpolador (`src/core/engine/interpolar.ts` só troca `{{var}}`), então a
  saída é criar variável derivada no preset ou reescrever a frase.
- **Telefone cru** em `src/exemplos/agendamento.ts:87`: sai
  `5511911001414` no meio da frase. Não existe helper de formatação no repo
  (`grep formatarTelefone` = zero).
- **Passo morto no reagendamento**: com **uma** reposição o bot ainda pergunta
  "Qual delas vamos remarcar?" e mostra um botão só. Lista de um item tem que
  pular a pergunta.

Os dois primeiros estão nos **templates** (`src/exemplos/`). O fluxo vivo da
MGM é cópia e está no banco: corrigir o template não conserta a MGM. São duas
correções, e a da MGM mexe em produção — **não fazer sem autorização explícita**.

## Fluxo da MGM (conteúdo, não código)

- **Aula experimental x outras terapias**: o bot lista RPG, Drenagem, Liberação
  Miofascial etc. e emenda "Que tal conhecer o estúdio em uma aula
  experimental?" sem dizer que a experimental é só de Pilates. Decisão fechada
  às 15:24: oferece Pilates, e quem escolhe outra vai para o atendente.
- **Confirmação de número só existe no ramo de agendamento**. Se o bot
  reconhece a pessoa pelo número, "troquei de número" precisa existir em todo
  caminho que dependa da identidade.
- **Agendamento de liberação / outras modalidades**: hoje não dá pelo zap
  porque o Daniel pediu. Gabriel discorda e ia falar com ele. Sem isso, o certo
  é redirecionar para atendente, não recusar.

## Decidido e ainda não implementado

- Reagendamento **sem data livre**: semana → dia da semana → horários
  ofertados. Hoje o aluno digita a data que quiser e o bot diz que não tem.
- Fluxo para aluno **inativo / de licença**, com boas-vindas e opções próprias
  (voltar às aulas, cancelar contrato, falar com atendente).
- **Cancelamento de contrato sempre com humano**, possivelmente presencial.
- **Trilha no histórico do contato** ("acessou fluxo → agendamento → cancelou →
  reagendou"). Proposta do Edu às 15:35, a conversa desviou e nunca voltou. É o
  que permite depurar fluxo sem adivinhar.
- **Sinal de "bot pausado" no inbox.** O "não está indo" das 10:39 não era bug,
  era handoff. A retomada por inatividade trata o efeito; a causa é não haver
  sinal claro de que a conversa saiu do bot.

## Verandi (outro repositório)

- **Modalidade não aparece na ficha do aluno.** Tem que ficar ao lado do ID.
- **"Atender pedido de exclusão" está escondido** num link cinza no rodapé do
  painel direito. O Edu levou três mensagens para achar. Ação de LGPD não pode
  ser caça ao tesouro.

## Avaliado e descartado, com motivo

- **Quebrar o fluxo da MGM em vários fluxos.** O Edu cedeu no ponto que
  importava às 14:58 ("é incomum mas viável no nosso caso"); o que sobrou era
  preferência de organização, e o problema real era o desenho dos fios.
- **Horário de atendimento por fluxo.** Cada cliente teria que ligar em todo
  fluxo, com horários diferentes em cada um.
- **Personalizar a base de configurações por tipo de negócio.** O próprio Edu
  recuou: "gera mais problema do que coisa boa".
- **Transcrição automática de áudio.** Parecia defeito (0 de 25 áudios
  transcritos), não é: `src/server/acoes-transcricao.ts` explica que é sob
  demanda de propósito, porque a chave do Gemini é free tier e o áudio iria
  para treino. O clique é o consentimento.

## Fora de produto

- **Oderço**: 200 vendedores, quase fecharam com concorrente. Exige CNPJ de
  tecnologia, MEI não fatura — precisa abrir ME. Bloqueio de receita com prazo.
