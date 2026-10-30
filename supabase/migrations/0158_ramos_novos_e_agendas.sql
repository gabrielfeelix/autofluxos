-- 0158, os ramos novos e a agenda de fora (docs/SEGMENTOS-NOVOS.md).
--
-- Aditiva, só em `public`; nada da Verandi é tocado.
--
--   1. `clients.nicho` aceita os ramos novos: saúde, laboratório, farmácia,
--      beleza, pet, imobiliária e hospedagem (`src/core/nichos.ts`).
--   2. `agendas_conectadas`: a agenda de fora ligada à conta (Feegow, Clínica
--      nas Nuvens, Trinks, AgendaPro, EVO). Uma linha por plataforma, como
--      `cardapios_conectados` (0154). A credencial mora em `connections`
--      (cofre); o que não é segredo (local padrão, estabelecimento, tipo de
--      consulta) fica em `ajustes`.
--   3. `pedidos_de_loja` aceita os sistemas dos ramos novos, para o
--      "Solicitar integração" dos que ainda não têm conector
--      (`src/core/sistemas-dos-ramos.ts`).

set search_path = public, extensions;

alter table public.clients drop constraint if exists clients_nicho_check;
alter table public.clients
  add constraint clients_nicho_check check (nicho in (
    'aulas', 'ecommerce', 'restaurante', 'comercio',
    'saude', 'laboratorio', 'farmacia', 'beleza', 'pet', 'imobiliaria', 'hospedagem'
  ));

create table if not exists public.agendas_conectadas (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  plataforma  text not null
                check (plataforma in ('feegow', 'clinica_nas_nuvens', 'trinks', 'agendapro', 'evo')),
  conexao_id  uuid references public.connections (id) on delete set null,
  ajustes     jsonb not null default '{}'::jsonb
                check (jsonb_typeof(ajustes) = 'object' and length(ajustes::text) <= 2000),
  ativo       boolean not null default true,
  conferido_em timestamptz,
  criado_em   timestamptz not null default now(),
  unique (client_id, plataforma)
);

create index if not exists agendas_conectadas_conexao_id_fk_idx
  on public.agendas_conectadas (conexao_id);

comment on table public.agendas_conectadas is
  'Agenda de fora ligada à conta (0158). Credencial em connections; ajustes sem segredo em jsonb.';

-- Só o servidor lê e escreve, como todo o AutoFluxos (0041).
alter table public.agendas_conectadas enable row level security;
revoke all on public.agendas_conectadas from public, anon, authenticated;
grant select, insert, update, delete on public.agendas_conectadas to service_role;

alter table public.pedidos_de_loja drop constraint if exists pedidos_de_loja_plataforma_check;
alter table public.pedidos_de_loja
  add constraint pedidos_de_loja_plataforma_check check (plataforma in (
    'magento', 'nuvemshop', 'woocommerce', 'shopify', 'vtex', 'tray', 'loja_integrada',
    'cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'foody', 'neemo',
    'feegow', 'clinica_nas_nuvens', 'trinks', 'agendapro', 'evo',
    'ninsaude', 'clinicorp', 'iclinic', 'amigo', 'simples_dental',
    'tecnofit', 'next_fit', 'cloudgym', 'booksy', 'avec', 'simplesvet',
    'shift', 'pixeon', 'trier', 'linx_farma',
    'vista', 'jetimob', 'kenlo', 'stays', 'cloudbeds', 'omnibees'
  ));
