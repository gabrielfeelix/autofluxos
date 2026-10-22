-- 0145, a mensalidade (cobrança camada 2, parte c; docs/PLANO-COBRANCA-CAMADA-2.md).
--
-- Tudo aditivo e em `public`. Nenhuma linha existente muda e nada da Verandi
-- é tocado: conta que usa a Verandi continua tendo a mensalidade nascendo lá,
-- e o AutoFluxos só a manda pela conversa (ponte, mais adiante).
--
-- * `assinaturas`: a regra que se repete. Quem, quanto, que dia vence e como
--   paga. O relógio (passada diária do cron de tarefas) lê esta tabela e cria a
--   cobrança do mês em `cobrancas`, que continua sendo a única fonte do que
--   foi pedido e pago.
-- * `cobrancas.assinatura_id` e `cobrancas.competencia`: a cobrança sabe de
--   qual mensalidade e de qual mês ela é. O índice único é o que faz a
--   passada repetida, ou duas passadas ao mesmo tempo, cobrarem uma vez só.
-- * `cobrancas.origem` aceita `mensalidade`.
--
-- RLS ligada e sem política, como o resto de `public`; o `revoke` é a camada
-- que fecha (docs/BANCO-COMPARTILHADO.md, regra 6). Nenhuma função nova.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A regra que se repete
-- ---------------------------------------------------------------------------

create table if not exists public.assinaturas (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clients (id) on delete cascade,
  -- `cascade`: sem o contato não há para quem cobrar. As cobranças já feitas
  -- ficam (a delas é `set null`), e é nelas que mora a prova do que foi pago.
  contato_id         uuid not null references public.contacts (id) on delete cascade,
  -- O plano do catálogo, quando veio de lá. Arquivar o produto não para a
  -- mensalidade; apagar perde só o vínculo.
  produto_id         uuid references public.produtos (id) on delete set null,

  descricao          text not null check (length(trim(descricao)) between 1 and 200),
  valor_centavos     integer not null check (valor_centavos between 1 and 100000000),
  -- Até 28: todo mês tem o dia, e fevereiro não vira exceção.
  dia_do_vencimento  smallint not null check (dia_do_vencimento between 1 and 28),
  -- Quantos dias antes do vencimento a cobrança sai na conversa.
  antecedencia_dias  smallint not null default 3 check (antecedencia_dias between 0 and 15),

  -- `pix_do_mes`: o relógio gera e manda o Pix todo mês, por qualquer gateway.
  -- `cartao`: assinatura no cartão pelo gateway. `pix_automatico`: o pagador
  -- autoriza uma vez no banco (Asaas).
  modo               text not null default 'pix_do_mes'
                     check (modo in ('pix_do_mes', 'cartao', 'pix_automatico')),
  -- `aguardando`: cartão ou Pix Automático esperando a adesão do pagador.
  status             text not null default 'ativa'
                     check (status in ('ativa', 'aguardando', 'pausada', 'cancelada')),

  -- A assinatura ou autorização no gateway, nos modos que têm uma.
  gateway            text check (gateway in ('mercado_pago', 'asaas')),
  id_no_gateway      text,
  -- O link que o pagador abre para aderir (cartão ou QR do Pix Automático).
  link_de_adesao     text,

  -- Primeiro mês cobrado (dia 1 do mês) e, se houver, o último.
  inicio             date not null,
  fim                date,

  criada_por         text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  cancelada_em       timestamptz,

  check (fim is null or fim >= inicio),
  check (extract(day from inicio) = 1)
);

comment on table public.assinaturas is
  'Mensalidade: a regra que o relógio usa para criar a cobrança de cada mês em cobrancas (0145).';

create index if not exists assinaturas_da_conta
  on public.assinaturas (cliente_id, status);
create index if not exists assinaturas_contato_id_fk_idx
  on public.assinaturas (contato_id);
create index if not exists assinaturas_produto_id_fk_idx
  on public.assinaturas (produto_id);
create unique index if not exists assinaturas_no_gateway
  on public.assinaturas (gateway, id_no_gateway)
  where id_no_gateway is not null;

drop trigger if exists assinaturas_tocar on public.assinaturas;
create trigger assinaturas_tocar
  before update on public.assinaturas
  for each row execute function public.tocar_atualizado_em();

alter table public.assinaturas enable row level security;
revoke all on public.assinaturas from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. A cobrança sabe de qual mensalidade e de qual mês
-- ---------------------------------------------------------------------------

alter table public.cobrancas
  add column if not exists assinatura_id uuid references public.assinaturas (id) on delete set null,
  add column if not exists competencia   date;

comment on column public.cobrancas.competencia is
  'O mês da mensalidade (dia 1). Nulo fora de mensalidade (0145).';

-- Uma cobrança por mensalidade e mês: a passada repetida não cobra duas vezes.
create unique index if not exists cobrancas_da_competencia
  on public.cobrancas (assinatura_id, competencia)
  where assinatura_id is not null;

alter table public.cobrancas drop constraint if exists cobrancas_origem_check;
alter table public.cobrancas
  add constraint cobrancas_origem_check check (origem in ('inbox', 'fluxo', 'ia', 'api', 'mensalidade'));

notify pgrst, 'reload schema';
