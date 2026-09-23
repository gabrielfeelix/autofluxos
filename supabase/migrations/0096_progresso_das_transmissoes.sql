-- 0096: o progresso das transmissões da lista numa consulta só (tarefa 6.2 do
-- plano de UX de 23/09).
--
-- A lista de transmissões fazia uma leitura por linha, e cada leitura trazia
-- todos os destinatários para contar em memória. Além de N consultas, isso
-- **mentia acima de 1.000**: o PostgREST corta em `max_rows`, então uma
-- campanha de 5.000 aparecia como "1.000 no total".
--
-- A função devolve só as contagens, agrupadas no banco. `security invoker`
-- com `search_path` vazio: ela lê como quem chama (o servidor, `service_role`),
-- e nasce fechada para `anon` e `authenticated` pelo default da 0041. O revoke
-- explícito fica mesmo assim, porque função herda `EXECUTE` de `public`.
--
-- Só `public`, só leitura: não toca `app_verandi`, Auth, Storage nem dado
-- existente. Aplicar só no Supabase local; produção fica pendente para o
-- Gabriel autorizar. Sem ela o código cai na leitura antiga (ver
-- `progressoDas`).

set search_path = public, extensions;

create or replace function public.progresso_das_transmissoes(p_ids uuid[])
returns table (transmissao_id uuid, estado text, quantos bigint)
language sql stable security invoker set search_path = '' as $$
  select d.transmissao_id, d.estado, count(*)
  from public.transmissao_destinatarios d
  where d.transmissao_id = any (p_ids)
  group by d.transmissao_id, d.estado
$$;

revoke all on function public.progresso_das_transmissoes(uuid[]) from public, anon, authenticated;
grant execute on function public.progresso_das_transmissoes(uuid[]) to service_role;

notify pgrst, 'reload schema';
