-- 0115: um papel de Postgres para o SQL direto que não é login (conserto da P5).
--
-- A 0111 fez o `DATABASE_URL` entrar como `autofluxos_login`, que só enxerga
-- as tabelas do login. Mas relatórios, análise de vendas, a lista de
-- organizações, juntar etiquetas e remover membro também falam Postgres direto,
-- e quebraram com `permission denied`. Em vez de devolver essas consultas ao
-- `postgres` (dono de tudo, inclusive de `app_verandi`), elas ganham um papel
-- próprio, usado por `bancoDeDados()` (`src/server/banco-de-dados.ts`) pela
-- variável `DATABASE_URL_DADOS`.
--
-- O que este papel **não** tem: nada fora de `public`, nenhum DDL, nenhuma
-- tabela de segredo do login (`af_sessoes`, `af_contas`, `af_verificacoes`,
-- `af_dois_fatores`, `af_convites`). Só o que as consultas dele citam.
--
-- **Sem senha aqui, e de propósito:** o repositório é público. O papel nasce
-- `nologin`; quem aplica define a senha fora do git, na mesma sessão:
--
--   alter role autofluxos_dados with login password '<gerada, no .secrets>';
--
-- e cria na Vercel
-- `DATABASE_URL_DADOS=postgresql://autofluxos_dados.<ref>:<senha>@<pooler>:6543/postgres`.
-- Voltar atrás é apontar `DATABASE_URL_DADOS` para o `postgres`; o papel não
-- atrapalha ninguém.
--
-- RLS: como na 0111, cada tabela ganha uma política só para este papel.
-- `anon` e `authenticated` continuam sem nada. As duas views são
-- `security_invoker`, então quem consulta precisa das tabelas embaixo delas,
-- e elas estão na lista.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva.

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'autofluxos_dados') then
    create role autofluxos_dados nologin noinherit;
  end if;
end
$$;

grant usage on schema public to autofluxos_dados;

-- Leitura: relatórios, análise de vendas, lista de organizações e contas.
grant select on
  public.anuncios,
  public.avaliacoes,
  public.channels,
  public.clients,
  public.contacts,
  public.eventos_do_contato,
  public.flow_versions,
  public.flows,
  public.handoffs,
  public.messages,
  public.passagens,
  public.produtos,
  public.quadro_cartoes,
  public.quadro_colunas,
  public.sessions,
  public.af_usuarios,
  public.af_membros,
  public.membro_capacidades,
  public.equipe_membros,
  public.atividades,
  public.etiquetas,
  public.contato_etiquetas,
  public.resumo_clientes,
  public.consumo_de_conversas
to autofluxos_dados;

-- Escrita: remover membro passando o trabalho adiante (`removerComDestino`).
-- `update` em `af_membros` é o que o `select ... for update` exige.
grant update on public.contacts, public.quadro_cartoes, public.atividades, public.af_membros to autofluxos_dados;
grant delete on public.membro_capacidades, public.equipe_membros, public.af_membros to autofluxos_dados;

-- Escrita: juntar etiquetas (`juntarEtiquetas`). O `for update` pede `update`.
grant update, delete on public.etiquetas to autofluxos_dados;
grant insert on public.contato_etiquetas to autofluxos_dados;

do $$
declare
  t text;
begin
  foreach t in array array[
    'anuncios', 'avaliacoes', 'channels', 'clients', 'contacts',
    'eventos_do_contato', 'flow_versions', 'flows', 'handoffs', 'messages',
    'passagens', 'produtos', 'quadro_cartoes', 'quadro_colunas', 'sessions',
    'af_usuarios', 'af_membros', 'membro_capacidades', 'equipe_membros',
    'atividades', 'etiquetas', 'contato_etiquetas'
  ] loop
    execute format('drop policy if exists dados_do_autofluxos on public.%I', t);
    execute format(
      'create policy dados_do_autofluxos on public.%I for all to autofluxos_dados using (true) with check (true)',
      t
    );
  end loop;
end
$$;
