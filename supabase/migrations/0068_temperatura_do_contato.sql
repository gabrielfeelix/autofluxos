-- 0068, a temperatura do contato.
--
-- O que ela é, e por que não é o estágio
-- ---------------------------------------------------------------------------
--
-- O estágio (`0058`) diz **em que pé o processo está**: novo, qualificado,
-- negociando, cliente. Ele é consequência, anda sozinho pelos fatos, e o ajuste
-- na mão é exceção.
--
-- Temperatura é a outra pergunta, e ela não tem como ser medida: **o quanto
-- quem atendeu acredita nessa venda**. Duas pessoas na mesma etapa do mesmo
-- funil, com a mesma última mensagem, podem ser uma quase fechada e uma que
-- só pediu preço por educação — e quem sabe a diferença é quem conversou.
-- Derivar isso de tempo parado ou de estágio seria inventar um número e chamá-lo
-- de opinião de alguém.
--
-- Então, ao contrário do estágio, temperatura é **formulário e não
-- consequência**: nada no sistema a muda sozinha. Quem não opinar fica em
-- `morno`, que é o default honesto para "ninguém disse".
--
-- `text` com `check` e não `enum`, pelo mesmo motivo da `0058`: acrescentar
-- valor a enum é migration nova e trava de catálogo. Quem conhece os valores de
-- verdade é `core/crm.ts`, que recusa o que não conhece.
--
-- Aditiva: uma coluna nova com default válido em toda linha e um índice. Nenhuma
-- coluna existente muda, nada é reescrito, nenhuma linha é apagada, e nada aqui
-- cita `app_verandi`. Todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- `add column ... default` não reescreve a tabela desde o Postgres 11: o valor
-- fica no catálogo e as linhas existentes só o materializam quando forem
-- atualizadas por outro motivo. É o que torna seguro fazer isto numa tabela com
-- dado de produção, e é o mesmo caminho da 0058 e da 0066.
alter table public.contacts
  add column if not exists temperatura text not null default 'morno'
    check (temperatura in ('frio', 'morno', 'quente'));

comment on column public.contacts.temperatura is
  'Quanto quem atendeu acredita nesta venda: frio, morno, quente. Ao contrário de estagio, NÃO muda sozinha - é opinião de humano. Ver core/crm.ts.';

-- Filtrar o funil por "mostre só os quentes" é a leitura que justifica a coluna.
create index if not exists contacts_temperatura_idx
  on public.contacts (client_id, temperatura);
