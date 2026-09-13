-- 0046 — a lista de automações na ordem que a pessoa escolheu
--
-- A lista sai por `criado_em`, que é a ordem em que as automações nasceram e
-- não tem relação nenhuma com a ordem em que elas são lidas. Quem opera uma
-- conta com dez fluxos ("Atendimento", "Agendamento", "Reagendamento", mais os
-- testes) procura pelo nome toda vez, e o fluxo principal vai para o fim da
-- lista só porque foi feito primeiro.
--
-- O pedido veio assim: *"também deixa possível reordenar a ordem dos fluxos"*.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- A posição na lista
-- ---------------------------------------------------------------------------
--
-- **Anulável, e é o ponto.** `null` significa "nunca foi arrastado", e essas
-- continuam ordenadas por `criado_em` no fim da lista — que é exatamente o
-- comportamento de hoje. Um `not null default 0` faria toda automação que já
-- existe empatar em zero, e o desempate voltaria a ser arbitrário: a conta
-- inteira embaralharia no dia da migration, sem ninguém ter pedido.
--
-- `integer` e não `numeric`: reordenar reescreve a coluna inteira da conta
-- numa transação só (são dezenas de linhas, não milhares), e isso dispensa o
-- truque de gravar a média entre dois vizinhos para não renumerar.
alter table public.flows
  add column if not exists ordem integer;

comment on column public.flows.ordem is
  'Posição na lista do painel. null = nunca reordenada; essas vão para o fim, '
  'por criado_em, que é como a lista sempre saiu.';

-- O índice serve o `order by` da listagem, que é por cliente e roda em toda
-- abertura da tela de automações.
create index if not exists flows_ordem_idx
  on public.flows (client_id, ordem nulls last, criado_em);
