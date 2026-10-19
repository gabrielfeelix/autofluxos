-- 0137, índice para a chave estrangeira `messages.session_id`.
--
-- Sem ele, procurar as mensagens de uma sessão varre a tabela inteira: 5,3 ms
-- para 20 mil mensagens em 19/out/2026, e cresce junto com a conversa. É o
-- mesmo caminho que o Postgres faz ao apagar uma sessão, porque a chave é
-- `on delete set null` e precisa achar as mensagens que apontam para ela.
--
-- Parcial, porque mensagem sem sessão é comum e nunca é buscada por aqui.
-- `sessions` e `contacts` também têm chave sem índice no aviso do painel, mas
-- respondem abaixo de 1 ms com poucas centenas de linhas: índice ali só
-- custaria escrita.
--
-- Só em `public`. Nada da Verandi é tocado.

create index if not exists messages_session_idx
  on public.messages (session_id)
  where session_id is not null;
