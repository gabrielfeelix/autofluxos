-- 0029 — pastas de fluxo.
--
-- B5 (docs/PLANO-SISTEMA.md §3.8). Com três fluxos não faz falta; com trinta,
-- faz — e a conta que tem quatro papéis por número, gatilhos e campanhas chega
-- em trinta rápido.
--
-- **Só pastas.** O plano lista "pastas, auto-organizar, compartilhar, modelos"
-- na mesma frente. Compartilhar fluxo por link é rota pública nova, com token,
-- escopo e uma superfície de segurança que não cabe junto de uma coluna de
-- organização — ela fica para uma frente própria, e está dito no HANDOFF.
-- Modelos entram sem banco: são fluxos em código (`src/exemplos/`).

create table if not exists public.pastas (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);

create index if not exists pastas_conta_idx on public.pastas (client_id);

-- Duas pastas com o mesmo nome na mesma conta são duas gavetas idênticas na
-- tela, e metade dos fluxos em cada uma.
create unique index if not exists pastas_nome_unico_idx
  on public.pastas (client_id, lower(trim(nome)));

comment on table public.pastas is 'Gavetas para organizar fluxos. Só isso — não têm permissão nem herdam nada.';

alter table public.pastas enable row level security;
revoke all on public.pastas from anon, authenticated;

-- **`on delete set null`, e nunca `cascade`.** Apagar uma pasta não pode apagar
-- os fluxos dentro dela: pasta é organização, e organização apagada devolve os
-- fluxos para a raiz. `cascade` aqui seria a pior perda de dados possível
-- neste produto — um clique de arrumação levando junto o desenho publicado que
-- está atendendo gente.
alter table public.flows
  add column if not exists pasta_id uuid references public.pastas (id) on delete set null;

create index if not exists flows_pasta_idx on public.flows (pasta_id) where pasta_id is not null;

comment on column public.flows.pasta_id is
  'A gaveta onde este fluxo aparece. Nulo = na raiz. Apagar a pasta devolve o fluxo para cá.';

notify pgrst, 'reload schema';
