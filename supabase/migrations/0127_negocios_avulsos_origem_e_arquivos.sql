-- Vários negócios do mesmo contato no mesmo funil, origem por negócio e
-- arquivos guardados no negócio.
--
-- Só `public` e um bucket novo com o nome do produto. Não toca `app_verandi`
-- nem bucket existente (ver docs/BANCO-COMPARTILHADO.md).
--
-- 1. **Negócio avulso.** A 0071 deixou um cartão ABERTO por contato em cada
--    quadro (`quadro_cartoes_aberto_unico_idx`). Ela continua valendo para o
--    caminho automático (fluxo, seleção em lote, "pôr na etapa"), que procura
--    "o cartão deste contato neste quadro" e precisa achar um só. O que a
--    equipe cria à mão na ficha ("vendi a cadeira, agora estou vendendo a
--    mesa") nasce `avulso = true` e fica fora do índice: pode haver quantos
--    forem precisos, e nenhuma automação os move.
--
-- 2. **Origem por negócio.** A do contato é a primeira chegada; cada negócio
--    pode ter vindo de um lugar (um pelo Instagram, outro pelo site). Texto
--    livre curto, nulo enquanto ninguém disse.
--
-- 3. **Arquivos do negócio.** PDF e imagem que a equipe guarda (proposta,
--    contrato, foto do produto). O bucket é PRIVADO: a tela pede URL assinada
--    de validade curta. Quem sobe e apaga é o servidor, com a `service_role`,
--    depois de conferir a sessão; sem policy para `anon`/`authenticated`.
--    10 MB por arquivo: a cota de 1 GB do plano gratuito é dividida com a
--    Verandi.

set search_path = public, extensions;

-- 1. Avulso -----------------------------------------------------------------

alter table public.quadro_cartoes
  add column if not exists avulso boolean not null default false;

comment on column public.quadro_cartoes.avulso is
  'Criado à mão pela equipe (ficha: "+ Nova negociação"). Fica fora do índice de um aberto por contato e quadro, e nenhuma automação procura por ele.';

drop index if exists public.quadro_cartoes_aberto_unico_idx;

create unique index if not exists quadro_cartoes_aberto_unico_idx
  on public.quadro_cartoes (quadro_id, contact_id)
  where situacao = 'aberta' and not avulso;

comment on index public.quadro_cartoes_aberto_unico_idx is
  'Um cartão ABERTO e não avulso por contato em cada quadro (0071, ajustado na 0127). Negócio avulso, criado à mão, pode repetir.';

-- 2. Origem -----------------------------------------------------------------

alter table public.quadro_cartoes
  add column if not exists origem text;

alter table public.quadro_cartoes
  drop constraint if exists quadro_cartoes_origem_tamanho;
alter table public.quadro_cartoes
  add constraint quadro_cartoes_origem_tamanho check (origem is null or char_length(origem) between 1 and 60);

comment on column public.quadro_cartoes.origem is
  'De onde veio ESTE negócio (Instagram, Site, WhatsApp, Indicação...). Nulo = não informado. A origem do contato fica em contacts.campos.';

-- 3. Arquivos ---------------------------------------------------------------

create table if not exists public.negocio_arquivos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  cartao_id   uuid not null references public.quadro_cartoes (id) on delete cascade,
  caminho     text not null unique,
  nome        text not null check (char_length(nome) between 1 and 200),
  mime        text not null,
  bytes       integer not null check (bytes > 0 and bytes <= 10485760),
  autor_id    text,
  autor_nome  text,
  criado_em   timestamptz not null default now()
);

comment on table public.negocio_arquivos is
  'Arquivos guardados num negócio. `caminho` é a chave no bucket privado autofluxos-negocios, NUNCA uma URL. Apagar o negócio apaga a linha; o objeto do bucket é apagado pelo servidor.';

create index if not exists negocio_arquivos_cartao_idx
  on public.negocio_arquivos (cartao_id, criado_em desc);

alter table public.negocio_arquivos enable row level security;

revoke all on public.negocio_arquivos from anon, authenticated;
grant select, insert, delete on public.negocio_arquivos to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autofluxos-negocios',
  'autofluxos-negocios',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
