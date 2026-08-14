-- 0013 — pausa persistente da automação por contato
--
-- "Humano" é estado de uma sessão. Ele resolve uma conversa que foi passada
-- para alguém, mas não serve para desligar um contato: quando outra conversa
-- começa, o motor criaria uma sessão nova e voltaria a responder. A escolha
-- precisa morar no contato, que sobrevive às sessões.
--
-- Este arquivo é exclusivamente do AutoFluxos: todos os objetos permanecem em
-- `public`. Não há leitura, FK ou função que toque `app_verandi`.

alter table public.contacts
  add column if not exists automacao_ativa boolean not null default true;

comment on column public.contacts.automacao_ativa is
  'Quando falso, registra as mensagens recebidas mas não deixa o motor responder este contato.';

-- Coluna nova de view sempre vai no fim. `create or replace view` compara as
-- colunas existentes por posição e inserir no meio daria 42P16; ver 0008.
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
  c.automacao_ativa
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

-- `contacts` já tem RLS ligada e sem políticas (0003); uma coluna não abre
-- permissão nova. A view continua invocadora e mantém o revoke explícito.
revoke all on public.leads from anon, authenticated;

notify pgrst, 'reload schema';
