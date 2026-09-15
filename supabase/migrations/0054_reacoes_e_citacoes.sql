-- 0054 — reagir a uma mensagem, e responder citando outra.
--
-- ---------------------------------------------------------------------------
-- Duas coisas que a conversa já recebia e não sabia mostrar
-- ---------------------------------------------------------------------------
--
-- A Meta manda as duas há tempos, e o webhook grava o payload cru inteiro em
-- `messages.payload` — então **o dado já está no banco hoje**, guardado e
-- invisível. O que falta não é capturar: é poder perguntar "quem reagiu a esta
-- mensagem?" e "qual mensagem esta aqui está citando?" sem varrer a conversa
-- inteira lendo `jsonb`.
--
-- A reação chega como uma mensagem própria, com `reaction.message_id` apontando
-- para o que foi reagido e `reaction.emoji` com o que foi escolhido (string
-- vazia quando a pessoa **remove** a reação). Hoje ela entra como linha solta
-- na conversa: aparece um "❤️" pendurado no fim do histórico, longe da frase
-- que ele comenta. Quem lê não entende a que se refere — e numa conversa de
-- atendimento isso não é detalhe, é a diferença entre "ela gostou do preço" e
-- "ela gostou de alguma coisa".
--
-- A citação chega em `context.id`, dentro da própria mensagem citante.
--
-- ---------------------------------------------------------------------------
-- Por que coluna, e não continuar lendo do `payload`
-- ---------------------------------------------------------------------------
--
-- O `payload` continua sendo a verdade crua, e nada aqui o substitui. Mas as
-- duas perguntas acima são **junções**, não leituras: desenhar a conversa exige
-- casar N reações com as mensagens reagidas, e casar cada citação com a
-- mensagem citada. Fazer isso por `payload->'reaction'->>'message_id'` obriga a
-- ler todas as linhas para descobrir quais se relacionam — e obriga de novo a
-- cada abertura de conversa.
--
-- As duas colunas guardam `wa_message_id` **da outra mensagem**, e não o `id`
-- nosso, de propósito: é o único identificador que a Meta manda, e ele pode
-- apontar para uma mensagem que nós não temos. Conversa importada pela
-- coexistência tem teto de 180 dias, e o teto de reação da Meta é 30 — então a
-- reação a uma mensagem anterior ao nosso histórico é caso real, não hipótese.
-- Uma chave estrangeira transformaria esse caso normal em erro de escrita e
-- perderia a reação inteira; sem ela, o join simplesmente não acha e a tela
-- mostra a reação sem o alvo, que é o que de fato aconteceu.
--
-- ---------------------------------------------------------------------------
-- O emoji vazio é informação, e por isso a coluna é anulável de um jeito só
-- ---------------------------------------------------------------------------
--
-- `null` = esta mensagem não é uma reação. String vazia = é uma reação que
-- **removeu** a anterior. Colapsar os dois em `null` faria a remoção ser
-- indistinguível de uma mensagem comum, e a reação removida ficaria na tela
-- para sempre.

set search_path = public, extensions;

alter table public.messages
  add column if not exists reagiu_a text,
  add column if not exists reacao   text,
  add column if not exists cita     text;

comment on column public.messages.reagiu_a is
  'wa_message_id da mensagem que esta reação comenta. Null = não é reação. Sem FK de propósito: a Meta deixa reagir a mensagem de até 30 dias, que pode ser anterior ao histórico que temos.';

comment on column public.messages.reacao is
  'O emoji escolhido. String vazia = a pessoa removeu a reação, e isso precisa ser distinguível de "não é reação" (null).';

comment on column public.messages.cita is
  'wa_message_id da mensagem citada por esta. Vem de context.id no webhook. Sem FK pelo mesmo motivo de reagiu_a.';

-- A pergunta que a tela faz é sempre "as reações desta conversa", para grudar
-- cada uma na sua mensagem ao desenhar. Parcial porque reação é minoria
-- pequena das linhas: um índice sobre a tabela inteira pagaria por todas as
-- mensagens de texto para servir a poucas.
create index if not exists messages_reagiu_a_idx
  on public.messages (contact_id, reagiu_a)
  where reagiu_a is not null;

notify pgrst, 'reload schema';
