-- 0012 — respostas reutilizáveis de atendimento, por cliente.
--
-- Esta é uma tabela do AutoFluxos: fica explicitamente em public e não tem
-- relação, consulta ou chave estrangeira com app_verandi.

create table if not exists public.quick_replies (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  -- O atalho é mostrado como /orcamento no Inbox. Restrito para continuar
  -- curto, previsível e utilizável no teclado.
  atalho      text not null check (atalho ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  texto       text not null check (length(trim(texto)) between 1 and 4096),
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (client_id, atalho)
);

create index if not exists quick_replies_client_criado_em_idx
  on public.quick_replies (client_id, criado_em asc);

drop trigger if exists quick_replies_atualizado_em on public.quick_replies;
create trigger quick_replies_atualizado_em
  before update on public.quick_replies
  for each row execute function public.tocar_atualizado_em();

-- A chave publishable não lê nem escreve esta tabela. Enquanto o painel tiver
-- senha única, toda operação passa pelo servidor com a chave secreta; quando
-- entrar login individual, as políticas vêm junto da fase de papéis.
alter table public.quick_replies enable row level security;
revoke all on table public.quick_replies from public, anon, authenticated;
grant select, insert, update, delete on table public.quick_replies to service_role;
