-- 0147, a mensalidade do AutoFluxos pelo Asaas da 4YU (fase 1 de
-- docs/PLANO-MENSALIDADE-ASAAS.md).
--
-- Tudo aditivo e em `public`; nada da Verandi é tocado. Não confundir com a
-- 0145: aquela é a mensalidade que o cliente cobra do aluno dele, na conta
-- Asaas do cliente. Esta é a que a 4YU cobra do cliente, na conta da 4YU.
--
-- * `clients.assinatura_plano` e `assinatura_ciclo`: qual plano a assinatura
--   do gateway paga. O plano da conta (`clients.plano`) só muda quando o
--   pagamento entra, pelo aviso, nunca pelo clique em Assinar. Enquanto não
--   entra, os dois podem divergir, e é assim que se sabe que há troca pendente.
-- * `faturas_da_conta`: cada cobrança que o Asaas gerou para a conta, espelho
--   do que ele diz. A fonte de verdade é o Asaas; esta tabela existe para a
--   tela listar sem chamar a API a cada abertura e para a suspensão por atraso
--   (fase 3) ter onde olhar.
--
-- RLS ligada e sem política; o `revoke` fecha (docs/BANCO-COMPARTILHADO.md,
-- regra 6). Nenhuma função nova.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Qual plano a assinatura paga
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists assinatura_plano text;

alter table public.clients
  add column if not exists assinatura_ciclo text
  check (assinatura_ciclo is null or assinatura_ciclo in ('mensal', 'anual'));

comment on column public.clients.assinatura_plano is
  'O plano que a assinatura do Asaas da 4YU paga. Vira `plano` quando o pagamento entra (0147).';

comment on column public.clients.assinatura_ciclo is
  'Mensal ou anual, o ciclo da assinatura do Asaas da 4YU (0147).';

-- ---------------------------------------------------------------------------
-- 2. As faturas
-- ---------------------------------------------------------------------------

create table if not exists public.faturas_da_conta (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clients (id) on delete cascade,
  -- O `pay_...` do Asaas. Único: o aviso chega mais de uma vez.
  asaas_id          text not null unique check (length(asaas_id) between 1 and 100),
  -- O `sub_...` de onde a fatura veio. Nulo na cobrança avulsa (excedente).
  assinatura_ref    text,
  tipo              text not null default 'mensalidade'
                    check (tipo in ('mensalidade', 'excedente')),
  valor_centavos    integer not null check (valor_centavos between 0 and 100000000),
  vencimento        date not null,
  estado            text not null default 'pendente'
                    check (estado in ('pendente', 'vencida', 'paga', 'estornada', 'cancelada')),
  -- A página de pagamento do Asaas. Os dados do cartão nunca passam por nós.
  link              text check (link is null or length(link) <= 500),
  nota_fiscal_url   text check (nota_fiscal_url is null or length(nota_fiscal_url) <= 500),
  paga_em           timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

comment on table public.faturas_da_conta is
  'Faturas da mensalidade que a 4YU cobra do cliente, espelho do Asaas da 4YU (0147).';

create index if not exists faturas_da_conta_da_conta
  on public.faturas_da_conta (cliente_id, vencimento desc);

drop trigger if exists faturas_da_conta_tocar on public.faturas_da_conta;
create trigger faturas_da_conta_tocar
  before update on public.faturas_da_conta
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 3. RLS e permissões
-- ---------------------------------------------------------------------------

alter table public.faturas_da_conta enable row level security;
revoke all on public.faturas_da_conta from public, anon, authenticated;

notify pgrst, 'reload schema';
