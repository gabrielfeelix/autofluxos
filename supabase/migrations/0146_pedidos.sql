-- 0146, os pedidos (cobrança camada 2, parte a; docs/PLANO-COBRANCA-CAMADA-2.md).
--
-- Tudo aditivo e em `public`; nada da Verandi é tocado.
--
-- * `pedidos` e `pedido_itens`: o que a pessoa pediu pela conversa, com
--   entrega ou retirada e o andamento (novo, pago, em preparo, saiu,
--   entregue, cancelado). O nome `pedidos_de_loja` (0103) já é do voto
--   "Quero esta" e não tem relação com isto.
-- * `produtos.estoque`: quantos há. Nulo é "não controla", que é o caso de
--   todo item que existe hoje: nenhum catálogo muda de comportamento no dia
--   em que isto roda.
--
-- A baixa de estoque é feita pela aplicação numa transação (update
-- condicional), sem função nova. RLS ligada e sem política; o `revoke` fecha
-- (docs/BANCO-COMPARTILHADO.md, regra 6).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Estoque no catálogo
-- ---------------------------------------------------------------------------

alter table public.produtos
  add column if not exists estoque integer check (estoque is null or estoque >= 0);

comment on column public.produtos.estoque is
  'Quantos há para vender. Nulo = não controla estoque (0146).';

-- ---------------------------------------------------------------------------
-- 2. O pedido
-- ---------------------------------------------------------------------------

create table if not exists public.pedidos (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references public.clients (id) on delete cascade,
  -- O número que a equipe fala: "pedido 12". Por conta, dado pela aplicação.
  numero                 integer not null check (numero > 0),
  -- `set null`: apagar o contato não apaga o histórico de vendas.
  contato_id             uuid references public.contacts (id) on delete set null,
  cobranca_id            uuid references public.cobrancas (id) on delete set null,

  entrega                text not null default 'retirada'
                         check (entrega in ('entrega', 'retirada', 'local')),
  endereco               text check (endereco is null or length(endereco) <= 300),
  observacao             text check (observacao is null or length(observacao) <= 500),
  total_centavos         integer not null check (total_centavos between 0 and 100000000),

  status                 text not null default 'novo'
                         check (status in ('novo', 'pago', 'em_preparo', 'saiu', 'entregue', 'cancelado')),
  origem                 text not null check (origem in ('inbox', 'fluxo', 'ia')),
  criado_por             text,

  -- Quando entrou em cada etapa: é daqui que saem os tempos de preparo e de entrega.
  pago_em                timestamptz,
  em_preparo_em          timestamptz,
  saiu_em                timestamptz,
  entregue_em            timestamptz,
  cancelado_em           timestamptz,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),

  unique (cliente_id, numero)
);

comment on table public.pedidos is
  'Pedido feito pela conversa: itens, entrega e andamento. A cobrança paga move para pago (0146).';

create index if not exists pedidos_da_conta
  on public.pedidos (cliente_id, status, criado_em desc);
create index if not exists pedidos_contato_id_fk_idx
  on public.pedidos (contato_id);
-- Uma cobrança é de um pedido só.
create unique index if not exists pedidos_cobranca
  on public.pedidos (cobranca_id)
  where cobranca_id is not null;

drop trigger if exists pedidos_tocar on public.pedidos;
create trigger pedidos_tocar
  before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 3. Os itens
-- ---------------------------------------------------------------------------

create table if not exists public.pedido_itens (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references public.pedidos (id) on delete cascade,
  -- O produto do catálogo próprio, quando veio dele: é por ele que o estoque
  -- volta no cancelamento. Item da loja on-line guarda só o id de lá.
  produto_id        uuid references public.produtos (id) on delete set null,
  produto_externo   text,
  nome              text not null check (length(trim(nome)) between 1 and 200),
  quantidade        integer not null check (quantidade between 1 and 50),
  -- Preço de cada um, na hora do pedido.
  valor_centavos    integer not null check (valor_centavos between 0 and 100000000)
);

create index if not exists pedido_itens_pedido_id_fk_idx
  on public.pedido_itens (pedido_id);
create index if not exists pedido_itens_produto_id_fk_idx
  on public.pedido_itens (produto_id);

-- ---------------------------------------------------------------------------
-- 4. RLS e permissões
-- ---------------------------------------------------------------------------

alter table public.pedidos enable row level security;
revoke all on public.pedidos from public, anon, authenticated;

alter table public.pedido_itens enable row level security;
revoke all on public.pedido_itens from public, anon, authenticated;

notify pgrst, 'reload schema';
