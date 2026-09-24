-- ---------------------------------------------------------------------------
-- 0103: Loja > Conectar loja (plano de navegação e CRM, 5.6, F4)
-- ---------------------------------------------------------------------------
--
-- Três coisas, todas aditivas. Roda em `public`, qualificado, sem tocar
-- `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.
--
-- 1. `lojas_integradas.plataforma` passa a aceitar `nuvemshop` e
--    `woocommerce`, as duas próximas do plano. `check` não tem `alter`: é drop
--    e recria, como na 0034 e na 0070. Toda linha existente é `magento`, que
--    continua aceita, então a recriação não recusa nada.
--
-- 2. `public.pedidos_de_loja`: o "Quero esta" dos cartões "Em breve". Uma
--    linha por conta e plataforma (o `unique` é o "grava uma vez por conta"; o
--    segundo clique não vira segundo voto). É a medida de demanda para decidir
--    a ordem das próximas plataformas, e por isso guarda só o fato e a data.
--    O `check` fecha a lista em `core/plataformas-de-loja.ts`.
--
-- 3. `clients.loja_ativa`: o interruptor de Loja em Objetivo e recursos.
--    **Anulável e sem default, e o nulo é a decisão**: `null` quer dizer "a
--    conta nunca escolheu", e aí vale a regra de hoje (`lojaVisivel`: objetivo
--    vender, loja conectada ou catálogo com item). Um default `true` mostraria
--    Loja ao estúdio de pilates; um `false` esconderia Catálogo de quem já usa.
--    Nenhuma conta muda de menu no dia em que isto roda.

set search_path = public, extensions;

alter table public.lojas_integradas drop constraint if exists lojas_integradas_plataforma_check;
alter table public.lojas_integradas
  add constraint lojas_integradas_plataforma_check
  check (plataforma in ('magento', 'nuvemshop', 'woocommerce'));

create table if not exists public.pedidos_de_loja (
  client_id uuid not null references public.clients (id) on delete cascade,
  plataforma text not null check (
    plataforma in ('magento', 'nuvemshop', 'woocommerce', 'shopify', 'vtex', 'tray', 'loja_integrada')
  ),
  criado_em timestamptz not null default now(),
  primary key (client_id, plataforma)
);

-- RLS ligada e zero políticas, o padrão da casa: só o servidor acessa.
-- Revoke com `public` na lista, ver docs/BANCO-COMPARTILHADO.md §6.
alter table public.pedidos_de_loja enable row level security;
revoke all on public.pedidos_de_loja from public, anon, authenticated;

alter table public.clients add column if not exists loja_ativa boolean;

notify pgrst, 'reload schema';
