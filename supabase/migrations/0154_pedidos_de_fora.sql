-- 0154, pedido de cardápio digital e delivery próprio no quadro de Pedidos
-- (docs/PLANO-INTEGRACOES-CARDAPIO.md, Fase 0).
--
-- Todo pedido de fora (Cardápio Web, OlaClick, Goomer, link do entregador...)
-- vira linha de `pedidos` (0146), e todo produto de fora vira linha de
-- `produtos`. Cada plataforma é só um conector (`src/cardapios/`).
--
-- Aditiva, nada da Verandi é tocado:
--   - `pedidos`: de onde veio (`plataforma`, `id_externo`), o número que o
--     cliente vê lá, telefone e nome como vieram (o pedido pode não ter
--     contato), link de rastreio e quando o cliente foi avisado da última
--     etapa. `origem` passa a aceitar `externo`. O índice único parcial é a
--     trava: o mesmo pedido chegando por webhook e por consulta é uma linha só.
--   - `cardapios_conectados`: a conta ligada a cada plataforma, uma por
--     plataforma. A credencial mora em `connections` (cofre); o segredo do
--     webhook, quando a plataforma assina, no Vault (`segredo_id`).
--   - `produtos`: `origem` e `id_externo` do item importado, com a mesma
--     trava parcial. Item feito à mão continua com os dois nulos.

set search_path = public, extensions;

alter table public.pedidos
  add column if not exists plataforma text
    check (plataforma is null or plataforma in
      ('cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'neemo', 'entregador')),
  add column if not exists id_externo text check (id_externo is null or length(id_externo) between 1 and 128),
  add column if not exists numero_exibido text check (numero_exibido is null or length(numero_exibido) between 1 and 40),
  add column if not exists telefone text check (telefone is null or length(telefone) between 8 and 20),
  add column if not exists nome_cliente text check (nome_cliente is null or length(nome_cliente) <= 120),
  add column if not exists rastreio_url text check (rastreio_url is null or (rastreio_url ~ '^https://' and length(rastreio_url) <= 1000)),
  add column if not exists cliente_avisado_em timestamptz;

alter table public.pedidos drop constraint if exists pedidos_origem_check;
alter table public.pedidos
  add constraint pedidos_origem_check check (origem in ('inbox', 'fluxo', 'ia', 'externo'));

create unique index if not exists pedidos_de_fora
  on public.pedidos (cliente_id, plataforma, id_externo)
  where id_externo is not null;

comment on column public.pedidos.plataforma is
  'Pedido de fora (0154): a plataforma de onde veio. Nulo no pedido feito no AutoFluxos.';
comment on column public.pedidos.cliente_avisado_em is
  'Quando o cliente recebeu o aviso da etapa atual (na conversa ou por modelo). Nulo: não avisado.';

create table if not exists public.cardapios_conectados (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  plataforma         text not null
                       check (plataforma in ('cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'neemo')),
  conexao_id         uuid references public.connections (id) on delete set null,
  id_na_plataforma   text check (id_na_plataforma is null or length(id_na_plataforma) between 1 and 128),
  segredo_id         uuid,
  avisar_cliente     boolean not null default false,
  importar_catalogo  boolean not null default true,
  catalogo_em        timestamptz,
  pedidos_lidos_ate  timestamptz,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  unique (client_id, plataforma)
);

create index if not exists cardapios_conectados_conexao_id_fk_idx
  on public.cardapios_conectados (conexao_id);

comment on table public.cardapios_conectados is
  'Cardápio digital ou delivery ligado à conta (0154). Credencial em connections; segredo do webhook no Vault.';

-- Só o servidor lê e escreve, como todo o AutoFluxos (0041).
alter table public.cardapios_conectados enable row level security;
revoke all on public.cardapios_conectados from public, anon, authenticated;
grant select, insert, update, delete on public.cardapios_conectados to service_role;

alter table public.produtos
  add column if not exists origem text
    check (origem is null or origem in ('cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'neemo')),
  add column if not exists id_externo text check (id_externo is null or length(id_externo) between 1 and 128);

create unique index if not exists produtos_de_fora
  on public.produtos (client_id, origem, id_externo)
  where id_externo is not null;

comment on column public.produtos.origem is
  'Item importado de cardápio de fora (0154): edite na plataforma. Nulo no item feito aqui.';
