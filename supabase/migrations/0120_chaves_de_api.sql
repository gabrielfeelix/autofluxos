-- Chaves da API pública (fase 1 de docs/HANDOFF-02-OUT-API-PUBLICA.md).
--
-- Um sistema de fora fala com o AutoFluxos por `Authorization: Bearer
-- af_live_<publico>_<segredo>`. `publico` acha a linha; o segredo nunca é
-- guardado, só o SHA-256 dele. Ele tem 32 bytes aleatórios, então hash rápido
-- basta: bcrypt existe para senha que gente escolhe, não para segredo sorteado.
-- Não usa o Vault porque a chave é conferida a cada chamada e nunca precisa
-- ser lida de volta.
--
-- Aditiva: tabela nova e uma função nova, nada existente muda. Só o servidor
-- lê e escreve (RLS ligada, sem políticas), como o resto de `public`.

set search_path = public, extensions;

create table if not exists public.chaves_de_api (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  nome             text not null check (char_length(nome) between 1 and 80),
  -- O <publico> de af_live_<publico>_<segredo>. Aparece na tela e no log.
  publico          text not null unique check (publico ~ '^[A-Za-z0-9]{12}$'),
  -- SHA-256 do segredo, em hex. O segredo em si não existe em lugar nenhum.
  hash             text not null check (hash ~ '^[0-9a-f]{64}$'),
  -- Os 4 últimos caracteres do segredo, para a pessoa reconhecer a chave.
  final            text not null check (char_length(final) = 4),
  escopos          text[] not null check (cardinality(escopos) > 0),
  -- Quem criou. Nome guardado à parte porque a pessoa pode sair da conta.
  criada_por       uuid references public.af_usuarios (id) on delete set null,
  criada_por_nome  text,
  criada_em        timestamptz not null default now(),
  ultima_em        timestamptz,
  chamadas         bigint not null default 0,
  revogada_em      timestamptz
);

comment on table public.chaves_de_api is
  'Chaves da API pública (/api/v1). Guarda só o SHA-256 do segredo; a chave inteira aparece uma vez, na criação.';

create index if not exists chaves_de_api_cliente_idx
  on public.chaves_de_api (client_id, criada_em desc);

alter table public.chaves_de_api enable row level security;

grant select, insert, update, delete on public.chaves_de_api to service_role;

-- O uso da chave: um incremento atômico por chamada. Ler e regravar pelo
-- PostgREST perderia contagem com duas chamadas ao mesmo tempo.
create or replace function public.registrar_uso_da_chave(p_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.chaves_de_api
     set chamadas = chamadas + 1,
         ultima_em = now()
   where id = p_id
     and revogada_em is null;
$$;

revoke all on function public.registrar_uso_da_chave(uuid) from public, anon, authenticated;
grant execute on function public.registrar_uso_da_chave(uuid) to service_role;

notify pgrst, 'reload schema';
