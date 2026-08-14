-- 0014 — contador atômico para as entradas que podem custar acesso ou dinheiro.
--
-- É exclusivo do AutoFluxos: tabela e função vivem explicitamente em public e
-- não consultam nem referenciam app_verandi. A função é chamada apenas pelo
-- servidor com service_role; a chave publishable não recebe acesso à tabela ou
-- ao RPC.

create table if not exists public.limites_de_requisicao (
  chave text primary key,
  inicio_da_janela timestamptz not null default now(),
  tentativas integer not null default 1 check (tentativas >= 1)
);

alter table public.limites_de_requisicao enable row level security;
revoke all on table public.limites_de_requisicao from public, anon, authenticated;
grant select, insert, update, delete on table public.limites_de_requisicao to service_role;

create or replace function public.consumir_limite(
  p_chave text,
  p_teto integer,
  p_janela_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  permitido boolean;
begin
  if p_chave = '' or p_teto < 1 or p_janela_segundos < 1 then
    raise exception 'parâmetros de limite inválidos';
  end if;

  insert into public.limites_de_requisicao as limite (chave, inicio_da_janela, tentativas)
  values (p_chave, clock_timestamp(), 1)
  on conflict (chave) do update
  set
    inicio_da_janela = case
      when limite.inicio_da_janela <= clock_timestamp() - make_interval(secs => p_janela_segundos)
        then clock_timestamp()
      else limite.inicio_da_janela
    end,
    tentativas = case
      when limite.inicio_da_janela <= clock_timestamp() - make_interval(secs => p_janela_segundos)
        then 1
      else limite.tentativas + 1
    end
  returning tentativas <= p_teto into permitido;

  return permitido;
end;
$$;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;
