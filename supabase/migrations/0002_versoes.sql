-- 0002 — versões publicadas.
--
-- O rascunho (`flows.rascunho`) é mutável e é o que o editor salva. Publicar
-- tira uma foto dele e guarda numa linha que nunca mais muda.
--
-- Sem isso: você edita o fluxo às 15h e a conversa que começou às 14h se vê num
-- nó que não existe mais. Quebra silenciosa, difícil de reproduzir, e quem
-- descobre é o cliente. Com isso: quem já estava conversando termina na versão
-- antiga; quem chegar depois pega a nova (o vínculo da sessão entra no passo 6,
-- junto com a tabela `sessions`).

create table if not exists public.flow_versions (
  id           uuid primary key default gen_random_uuid(),
  flow_id      uuid not null references public.flows (id) on delete cascade,
  versao       integer not null,
  grafo        jsonb not null,
  publicado_em timestamptz not null default now(),
  unique (flow_id, versao)
);

create index if not exists flow_versions_flow_id_idx on public.flow_versions (flow_id);

alter table public.flows
  add column if not exists versao_publicada_id uuid
  references public.flow_versions (id) on delete set null;

-- "Imutável" como regra do banco, não como intenção de quem escreve o código.
-- Um `update` distraído aqui reescreveria a versão debaixo de conversas que
-- estão acontecendo — exatamente o problema que a tabela existe para evitar.
create or replace function public.versao_e_imutavel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'versão publicada não pode ser alterada (flow_id=%, versao=%)',
    old.flow_id, old.versao;
end;
$$;

drop trigger if exists flow_versions_imutavel on public.flow_versions;
create trigger flow_versions_imutavel
  before update on public.flow_versions
  for each row execute function public.versao_e_imutavel();

-- Publicar em uma transação só.
--
-- Numerar com `max(versao)+1` do lado da aplicação abriria corrida entre duas
-- publicações simultâneas. Aqui a numeração e o apontamento acontecem juntos, e
-- a constraint `unique (flow_id, versao)` é a rede embaixo.
create or replace function public.publicar_fluxo(p_flow_id uuid, p_grafo jsonb)
returns public.flow_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nova public.flow_versions;
begin
  insert into public.flow_versions (flow_id, versao, grafo)
  values (
    p_flow_id,
    coalesce((select max(v.versao) from public.flow_versions v where v.flow_id = p_flow_id), 0) + 1,
    p_grafo
  )
  returning * into nova;

  update public.flows set versao_publicada_id = nova.id where id = p_flow_id;

  return nova;
end;
$$;

-- Publicar é ação de servidor, com a chave secreta. Ninguém publica do navegador.
revoke execute on function public.publicar_fluxo(uuid, jsonb) from anon, authenticated;

alter table public.flow_versions enable row level security;
