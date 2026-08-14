-- 0011 — métricas de execução sem puxar sessões para a aplicação.
--
-- O painel precisa responder duas perguntas: quantas conversas aconteceram em
-- cada mês, por desfecho, e quantas vezes cada fluxo rodou. Buscar todas as
-- sessões e reduzir no Next funcionaria agora e ficaria mais caro a cada lead.
-- A view reduz no Postgres e entrega uma linha por fluxo, mês e status.

create index if not exists sessions_versao_criado_idx
  on public.sessions (flow_version_id, criado_em);

-- O índice parcial de handoffs abertos serve a Inbox; a métrica precisa saber
-- também dos já resolvidos para não dar o atendimento humano como mérito do bot.
create index if not exists handoffs_session_idx
  on public.handoffs (session_id);

create or replace view public.metricas_sessoes
with (security_invoker = true) as
with sessoes_classificadas as (
  select
    s.id,
    s.flow_version_id,
    s.criado_em,
    case
      -- "Já atendi" encerra a sessão depois de uma pessoa assumir. Sem olhar
      -- o handoff histórico, ela pareceria resolvida pelo bot na renovação.
      when exists (select 1 from public.handoffs h where h.session_id = s.id)
        then case when s.status = 'humano' then 'humano' else 'atendida_por_pessoa' end
      else s.status
    end as desfecho
  from public.sessions s
)
select
  f.client_id,
  fv.flow_id,
  date_trunc('month', s.criado_em at time zone 'America/Sao_Paulo')::date as mes,
  s.desfecho as status,
  count(*)::bigint as total
from sessoes_classificadas s
join public.flow_versions fv on fv.id = s.flow_version_id
join public.flows f on f.id = fv.flow_id
group by f.client_id, fv.flow_id, mes, s.desfecho;

comment on view public.metricas_sessoes is
  'Sessões agrupadas por cliente, fluxo, mês de São Paulo e desfecho para o funil e a lista de automações.';

-- Métrica continua sendo dado de cliente. A view obedece a RLS das tabelas de
-- baixo e nem anon nem authenticated podem consultá-la diretamente.
revoke all on public.metricas_sessoes from anon, authenticated;

notify pgrst, 'reload schema';
