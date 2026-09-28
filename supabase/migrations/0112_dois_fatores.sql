-- 0112: verificação em duas etapas (TOTP) do login (plano de segurança de
-- 28/set, P3).
--
-- O que o plugin `twoFactor` do Better Auth precisa: uma coluna em
-- `af_usuarios` e uma tabela para o segredo de cada pessoa. O segredo e os
-- códigos de recuperação são gravados **cifrados** pela biblioteca, com o
-- `BETTER_AUTH_SECRET`: trocar esse segredo invalida o 2FA de todo mundo, e
-- quem trocar precisa pedir para cada um ativar de novo.
--
-- O papel do login (`autofluxos_login`, 0111) ganha a tabela nova, com a mesma
-- política própria das outras. `anon` e `authenticated` ficam de fora pelo
-- default da 0041.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva: uma
-- coluna com default `false` (ninguém muda de comportamento) e uma tabela nova.

set search_path = public, extensions;

alter table public.af_usuarios
  add column if not exists "twoFactorEnabled" boolean default false;

create table if not exists public.af_dois_fatores (
  "id"                      uuid not null primary key default gen_random_uuid(),
  "secret"                  text not null,
  "backupCodes"             text not null,
  "userId"                  uuid not null references public.af_usuarios ("id") on delete cascade,
  "verified"                boolean default true,
  "failedVerificationCount" integer default 0,
  "lockedUntil"             timestamptz
);

create index if not exists af_dois_fatores_user_idx on public.af_dois_fatores ("userId");
create index if not exists af_dois_fatores_secret_idx on public.af_dois_fatores ("secret");

alter table public.af_dois_fatores enable row level security;

grant select, insert, update, delete on public.af_dois_fatores to autofluxos_login;
grant select, insert, update, delete on public.af_dois_fatores to service_role;

drop policy if exists login_do_autofluxos on public.af_dois_fatores;
create policy login_do_autofluxos on public.af_dois_fatores
  for all to autofluxos_login using (true) with check (true);

comment on table public.af_dois_fatores is
  'Segredo TOTP e códigos de recuperação de cada pessoa (plugin twoFactor do Better Auth). Cifrados com o BETTER_AUTH_SECRET.';

notify pgrst, 'reload schema';
