-- 0023 — não lidas, e o tipo da última mensagem na fila.
--
-- Fecha as duas peças da A5 (docs/PLANO-SISTEMA.md §3.6) que a fila não tem
-- como resolver sem banco.
--
-- **NÃO APLICADA.** Ver docs/PENDENCIAS-DO-DONO.md — banco de produção
-- compartilhado com a Verandi, e nada entra lá sem autorização explícita.

-- ---------------------------------------------------------------------------
-- 1. O tipo da última mensagem
-- ---------------------------------------------------------------------------

-- Hoje a prévia da fila diz "mídia ou mensagem sem texto" para **tudo** que
-- não é texto — foto, áudio, figurinha, PDF. É a mesma frase para quatro
-- coisas que pedem reações diferentes: áudio de um minuto e figurinha de
-- "obrigado" não têm a mesma urgência, e quem decide o que abrir primeiro
-- decide no escuro.
--
-- O tipo já está no `payload` que a Meta manda; só nunca subiu para a view.
-- `->>` devolve texto e nulo quando a chave não existe, que é o certo para
-- mensagem nossa (saída), onde não há `type` da Meta nenhum.
--
-- **As colunas novas vão no fim.** `create or replace view` não reordena nem
-- remove: só aceita acrescentar, e recusa o resto com `cannot change name of
-- view column`. Esta ordem vem da 0022, que é a última que mexeu aqui.
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
  ultima.entregue  as ultima_entregue,
  c.automacao_ativa,
  c.nome_real,
  c.notas,
  entrada.ts       as ultima_entrada_em,
  c.atribuido_a,
  ultima.tipo      as ultimo_tipo
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue, m.payload->>'type' as tipo
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
) aberto on true
left join lateral (
  select m.ts
  from public.messages m
  where m.contact_id = c.id
    and m.direcao = 'entrada'
  order by m.ts desc
  limit 1
) entrada on true;

revoke all on public.leads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. O que cada pessoa já leu
-- ---------------------------------------------------------------------------

-- **"Não lida" é por pessoa, não por conversa**, e essa é a única modelagem
-- que sobrevive a um time. Uma coluna `lida_em` no contato diria que a
-- conversa foi lida porque *alguém* abriu — e "alguém leu" é exatamente a
-- informação que não ajuda ninguém a decidir o que abrir.
--
-- Tabela própria, e não coluna, pelo mesmo motivo: são N leituras por contato,
-- uma por atendente.
create table if not exists public.af_leituras (
  usuario_id uuid not null references public.af_usuarios (id) on delete cascade,
  contato_id uuid not null references public.contacts (id)    on delete cascade,
  -- Quando a pessoa abriu a conversa pela última vez. O que conta como "não
  -- lida" é mensagem de entrada com `ts` maior que isto — assim a conta é
  -- sempre sobre o estado atual, e não um contador que pode dessincronizar.
  lida_em    timestamptz not null default now(),
  primary key (usuario_id, contato_id)
);

-- A consulta real é "o que eu não li", sempre por pessoa.
create index if not exists af_leituras_usuario_idx on public.af_leituras (usuario_id);

comment on table public.af_leituras is
  'Quando cada pessoa abriu cada conversa pela última vez. Não lida = entrada mais nova que isto.';

alter table public.af_leituras enable row level security;
revoke all on public.af_leituras from anon, authenticated;

notify pgrst, 'reload schema';
