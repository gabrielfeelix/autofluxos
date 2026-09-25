-- 0104: o que a Meta mediu e cobrou de cada número de WhatsApp, por dia.
--
-- A partir de 1º/out/2026 a resposta dentro da janela de 24h (mensagem de
-- serviço) deixa de ser grátis: cada número tem 1.000 por mês, sem acúmulo, e
-- depois disso paga a tarifa de utilidade do país (no Brasil, R$ 0,035 pela
-- tabela oficial em BRL de 1/out/2026).
--
-- A fonte é o `pricing_analytics` da própria WABA, e não uma contagem nossa de
-- mensagens: é o número que vira fatura, com a régua da Meta (o que ela conta
-- como serviço, o que ela deixou grátis pela janela de anúncio). Uma cópia
-- diária, feita pela manutenção, porque a tela não pode esperar a Graph API.
--
-- Chave é (número, dia, categoria, tipo): a mesma passada roda todo dia sobre o
-- mês inteiro e sobrescreve, então reprocessar é idempotente.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem dado existente.
-- Objeto novo em `public` nasce fechado para `anon`/`authenticated` pelo
-- default da 0041; o grant de `service_role` é escrito por clareza.

set search_path = public, extensions;

create table if not exists public.consumo_da_meta (
  client_id uuid not null references public.clients (id) on delete cascade,
  waba_id text not null,
  -- O número como a Meta devolve no `pricing_analytics`: só dígitos, com DDI.
  telefone text not null,
  -- O dia da Meta (o `start` do ponto), em São Paulo.
  dia date not null,
  -- SERVICE, UTILITY, MARKETING, AUTHENTICATION...
  categoria text not null,
  -- REGULAR, FREE_CUSTOMER_SERVICE, FREE_ENTRY_POINT...
  tipo text not null,
  volume integer not null default 0 check (volume >= 0),
  -- Na moeda da WABA. Pode ser nulo quando a Meta não devolve.
  custo numeric(12, 4),
  atualizado_em timestamptz not null default now(),
  primary key (telefone, dia, categoria, tipo)
);

create index if not exists consumo_da_meta_por_cliente_e_dia
  on public.consumo_da_meta (client_id, dia);

comment on table public.consumo_da_meta is
  'Cópia diária do pricing_analytics de cada WABA: volume e custo por número, dia, categoria e tipo. Base da franquia de 1.000 mensagens de serviço por número por mês (Meta, 1/out/2026).';

alter table public.consumo_da_meta enable row level security;

revoke all on table public.consumo_da_meta from public, anon, authenticated;
grant select, insert, update, delete on table public.consumo_da_meta to service_role;

notify pgrst, 'reload schema';
