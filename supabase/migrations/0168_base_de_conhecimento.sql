-- 0168, a base de conhecimento da IA (docs/BASE-DE-CONHECIMENTO.md).
--
-- Aditiva, só em `public`; nada da Verandi é tocado e nenhuma extensão nova.
--
-- O "Sobre a empresa" cabe 6.000 caracteres. Material grande (manual, apostila,
-- regulamento) não cabe e não deve ir inteiro em cada resposta: vai em
-- trechos para cá, e a IA pesquisa com a consulta `consultar_material`
-- (`core/ferramentas.ts`), trazendo só os poucos trechos que importam.
--
-- A busca é a de texto do próprio Postgres, em português (radical das
-- palavras: "baterias" acha "bateria"). Sem `unaccent`, que é extensão global
-- do projeto dividido: `busca` já chega sem acento e em minúsculas, feita por
-- `core/conhecimento.ts`, que também limpa a consulta. A consulta que chega
-- aqui é só palavra [a-z0-9] unida por `|`, montada no servidor, nunca texto
-- do modelo ou do contato.

set search_path = public, extensions;

create table if not exists public.conhecimento_trechos (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  fonte      text not null check (length(fonte) between 1 and 120),
  secao      text not null default '' check (length(secao) <= 200),
  pagina     integer check (pagina is null or pagina between 1 and 5000),
  ordem      integer not null default 0,
  texto      text not null check (length(texto) between 1 and 4000),
  busca      text not null check (length(busca) <= 4400),
  tsv        tsvector generated always as (to_tsvector('portuguese'::regconfig, busca)) stored,
  criado_em  timestamptz not null default now()
);

create index if not exists conhecimento_trechos_client_id_idx
  on public.conhecimento_trechos (client_id, fonte, ordem);
create index if not exists conhecimento_trechos_tsv_idx
  on public.conhecimento_trechos using gin (tsv);

comment on table public.conhecimento_trechos is
  'Base de conhecimento da IA (0168): material grande em trechos, pesquisado por consultar_material.';

-- Só o servidor lê e escreve, como todo o AutoFluxos (0041).
alter table public.conhecimento_trechos enable row level security;
revoke all on public.conhecimento_trechos from public, anon, authenticated;
grant select, insert, update, delete on public.conhecimento_trechos to service_role;

create or replace function public.buscar_conhecimento(p_cliente uuid, p_consulta text, p_limite integer default 4)
returns table (fonte text, secao text, pagina integer, texto text, nota real)
language sql
stable
set search_path to ''
as $function$
  select t.fonte, t.secao, t.pagina, t.texto, ts_rank_cd(t.tsv, q)::real as nota
  from public.conhecimento_trechos t,
       to_tsquery('portuguese'::regconfig, p_consulta) q
  where t.client_id = p_cliente
    and t.tsv @@ q
  order by nota desc, t.ordem
  limit least(greatest(coalesce(p_limite, 4), 1), 8);
$function$;

revoke execute on function public.buscar_conhecimento(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.buscar_conhecimento(uuid, text, integer) to service_role;
