-- 0153, o status do pedido da loja vira evento, sem desenvolvedor
-- (docs/HANDOFF-26-OUT-PESQUISA-POS-COMPRA-PRODUTO.md, recurso 2).
--
-- O AutoFluxos consulta os pedidos da Magento conectada a cada 10 minutos
-- (`src/server/acompanhar-pedidos.ts`) e cada mudança de status vira o evento
-- `pedido.<status>`, o mesmo caminho do webhook de entrada.
--
-- Aditiva, nada da Verandi é tocado:
--   - `lojas_integradas.pedidos_lidos_ate`: nulo é acompanhamento desligado;
--     com data, ligado, e é até onde os pedidos já foram lidos (`updated_at`
--     da loja). Ligar grava agora: o histórico não vira aviso.
--   - `status_de_pedido_avisados`: cada par pedido + status avisa uma vez só,
--     mesmo que a consulta leia o pedido de novo. A chave primária é a trava.

set search_path = public, extensions;

alter table public.lojas_integradas add column if not exists pedidos_lidos_ate timestamptz;

comment on column public.lojas_integradas.pedidos_lidos_ate is
  'Acompanhamento de status dos pedidos: nulo desligado; com data, até onde os pedidos foram lidos (updated_at da loja, UTC).';

create table if not exists public.status_de_pedido_avisados (
  client_id  uuid not null references public.clients (id) on delete cascade,
  pedido     text not null check (length(pedido) between 1 and 64),
  status     text not null check (length(status) between 1 and 64),
  avisado_em timestamptz not null default now(),
  primary key (client_id, pedido, status)
);

comment on table public.status_de_pedido_avisados is
  'Pedido + status já avisado como evento (0153). A chave primária impede o segundo aviso.';

-- Só o servidor lê e escreve, como todo o AutoFluxos (0041).
alter table public.status_de_pedido_avisados enable row level security;
revoke all on public.status_de_pedido_avisados from public, anon, authenticated;
grant select, insert, delete on public.status_de_pedido_avisados to service_role;
