-- 0008 — a mensagem foi mesmo entregue?
--
-- Até aqui, uma saída era gravada **depois** de sair: `enviarTexto` e então
-- `registrarSaida`. Entre uma coisa e outra existe uma janela — curta, mas real
-- num `after()` que pode bater no `maxDuration` de 60s no meio de um fluxo
-- lento. A função morre ali e a mensagem foi entregue à pessoa sem existir no
-- histórico. Quem abre a tela do lead vê uma conversa com um buraco, e é
-- justamente quando ela mais precisa saber o que o bot disse.
--
-- A ordem inverte: grava primeiro como não confirmada, manda, e confirma. As
-- duas mortes possíveis passam a ser honestas — morreu antes de mandar, fica
-- "não confirmado" e não foi; morreu depois, fica "não confirmado" e foi. A
-- tela nunca afirma o que não sabe, e nunca esconde o que existiu.
--
-- `default true` porque tudo que já está na tabela foi gravado sob a regra
-- antiga (só depois de sair), e porque mensagem de **entrada** nunca precisa
-- de confirmação — ela chegou, é o webhook contando que chegou.

alter table public.messages
  add column if not exists entregue boolean not null default true;

comment on column public.messages.entregue is
  'Falso enquanto o envio não é confirmado. Sempre verdadeiro para direcao = entrada.';

-- A view de leads mostra a última mensagem da conversa na lista. Sem carregar
-- a confirmação junto, a tela mostraria como dita uma mensagem que talvez não
-- tenha saído — que é exatamente o que esta migration existe para evitar.
--
-- `ultima_entregue` entra **no fim** da lista, e não ao lado das outras colunas
-- de `ultima`, porque `create or replace view` não deixa inserir coluna no
-- meio: ele casa as colunas por posição e recusa com 42P16. Coluna nova em view
-- existente vai para o fim, ou a view tem que ser derrubada — e derrubar aqui
-- exigiria refazer o `revoke`, com uma janela em que ela existe sem ele.
create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em,
  ultima.entregue  as ultima_entregue
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true;

revoke all on public.leads from anon, authenticated;

notify pgrst, 'reload schema';
