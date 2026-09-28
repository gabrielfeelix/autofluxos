-- 0111: um papel de Postgres só para o login (plano de segurança de 28/set, P5).
--
-- Hoje o `DATABASE_URL`, que o Better Auth usa, entra como `postgres`: o dono
-- de tudo no projeto, inclusive do schema `app_verandi`. Vazou essa variável,
-- vazaram os dois produtos. Este papel alcança só as tabelas do login e da
-- organização, e nada fora de `public`.
--
-- **Sem senha aqui, e de propósito:** o repositório é público. O papel nasce
-- `nologin`; quem aplica define a senha fora do git, na mesma sessão:
--
--   alter role autofluxos_login with login password '<gerada, no .secrets>';
--
-- e só depois troca o `DATABASE_URL` da Vercel para
-- `postgresql://autofluxos_login.<ref>:<senha>@<pooler>:6543/postgres`.
-- Voltar atrás é trocar a variável de volta; o papel não atrapalha ninguém.
--
-- RLS: as tabelas têm RLS ligada e nenhuma política, e é assim que `anon` e
-- `authenticated` ficam de fora. Um papel novo sem `bypassrls` também ficaria,
-- então cada tabela ganha uma política **só para este papel**. `anon` e
-- `authenticated` continuam sem nada.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Não mexe em
-- `af_auditoria`: ela continua append-only e é escrita pela chave da API.

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'autofluxos_login') then
    create role autofluxos_login nologin noinherit;
  end if;
end
$$;

-- Só `public`. O papel não recebe nada em nenhum outro schema.
grant usage on schema public to autofluxos_login;

-- O que o Better Auth e as consultas de `bancoDoLogin()` leem e escrevem.
grant select, insert, update, delete on
  public.af_usuarios,
  public.af_sessoes,
  public.af_contas,
  public.af_verificacoes,
  public.af_membros,
  public.af_convites,
  public.clients
to autofluxos_login;

-- O que as mesmas consultas só leem.
grant select on
  public.funcoes,
  public.planos,
  public.membro_capacidades
to autofluxos_login;

do $$
declare
  t text;
begin
  foreach t in array array[
    'af_usuarios', 'af_sessoes', 'af_contas', 'af_verificacoes',
    'af_membros', 'af_convites', 'clients',
    'funcoes', 'planos', 'membro_capacidades'
  ] loop
    execute format('drop policy if exists login_do_autofluxos on public.%I', t);
    execute format(
      'create policy login_do_autofluxos on public.%I for all to autofluxos_login using (true) with check (true)',
      t
    );
  end loop;
end
$$;
