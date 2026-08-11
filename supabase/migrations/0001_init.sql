-- 0001 — clientes e fluxos.
--
-- Só as duas tabelas que o passo 3 precisa. `flow_versions`, `contacts`,
-- `sessions` e `messages` entram nas migrations dos passos 5 e 6, quando a
-- gente souber o formato real do que o WhatsApp manda. Tabela criada "por
-- garantia" e nunca usada só acumula divergência entre o desenho e o código.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) > 0),
  -- O que a IA pode dizer sobre o negócio. Vazio enquanto for Etapa 1.
  contexto_negocio text not null default '',
  -- Etapa 2 é plano à parte: sem isto, o validador recusa fluxo com nó de IA.
  ia_habilitada    boolean not null default false,
  ia_provider      text,
  ia_modelo        text,
  -- Ponteiro para o Supabase Vault. A chave do cliente NUNCA fica nesta linha.
  ia_chave_ref     text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table if not exists public.flows (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  nome       text not null check (length(trim(nome)) > 0),
  -- O grafo no formato do React Flow, validado pelo Zod antes de entrar.
  -- Este é o RASCUNHO: mutável, é o que o editor salva a cada mudança.
  -- O publicado vira linha imutável em `flow_versions` (passo 5).
  rascunho   jsonb not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists flows_client_id_idx on public.flows (client_id);

-- `atualizado_em` no gatilho, não na aplicação: quem esquece de setar é sempre
-- o código novo, e aí a coluna mente justo quando você precisa dela.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists clients_atualizado_em on public.clients;
create trigger clients_atualizado_em
  before update on public.clients
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists flows_atualizado_em on public.flows;
create trigger flows_atualizado_em
  before update on public.flows
  for each row execute function public.tocar_atualizado_em();

-- RLS ligada e SEM NENHUMA POLÍTICA, de propósito.
--
-- Efeito prático: a chave publishable (que pode chegar ao navegador) não lê nem
-- escreve nada. Todo acesso passa pelo servidor com a chave secreta, que ignora
-- RLS. Enquanto não existir login, este é o estado seguro — e é o oposto do
-- acidente clássico de deixar tabela aberta achando que "só o meu app acessa".
--
-- Quando o login entrar, as políticas entram junto, e não antes.
alter table public.clients enable row level security;
alter table public.flows   enable row level security;
