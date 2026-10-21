-- 0141, a cobrança no chat, camada 1 (docs/PLANO-COBRANCA-CAMADA-1.md).
--
-- Duas tabelas, as duas novas, em `public`. Nenhuma linha existente muda e
-- nada da Verandi é tocado.
--
-- * `conexoes_de_pagamento`: a conta do dono no gateway (Mercado Pago, por
--   enquanto). O token **não** mora aqui: vai para o Vault, e a linha guarda só
--   a referência, como `channels.token_ref` (0040). Fica fora de
--   `connections` (0006) de propósito: as Conexões aparecem para os blocos
--   HTTP do fluxo, e o token de pagamento ali deixaria um bloco fazer estorno
--   ou ler o extrato do dono.
-- * `cobrancas`: cada cobrança feita pela conversa. O dinheiro vai direto para
--   a conta do dono; aqui só fica o que foi pedido e o que o gateway disse.
--   Valor sempre em centavos, inteiro, como em `core/cobranca.ts`.
--
-- RLS ligada e sem política, como o resto de `public`: só o servidor acessa,
-- com a chave secreta. O `revoke` é a camada que fecha (ver
-- docs/BANCO-COMPARTILHADO.md, regra 6).

-- ---------------------------------------------------------------------------
-- 1. A conta do dono no gateway
-- ---------------------------------------------------------------------------

create table if not exists public.conexoes_de_pagamento (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clients (id) on delete cascade,
  gateway           text not null check (gateway in ('mercado_pago')),

  -- O `user_id` da conta no Mercado Pago. Único: a mesma conta ligada em duas
  -- contas do AutoFluxos faria o aviso de pagamento de uma cair na outra.
  conta_no_gateway  text not null,
  -- Só para a tela: "conectado como loja@exemplo.com".
  apelido           text,

  -- Vault. `renovacao_ref` é o refresh token: o de acesso vence em 180 dias.
  token_ref         uuid not null,
  renovacao_ref     uuid,
  expira_em         timestamptz,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  unique (cliente_id, gateway),
  unique (gateway, conta_no_gateway)
);

comment on table public.conexoes_de_pagamento is
  'A conta do dono no gateway de pagamento. Token no Vault (token_ref), nunca aqui (0141).';

-- ---------------------------------------------------------------------------
-- 2. As cobranças
-- ---------------------------------------------------------------------------

create table if not exists public.cobrancas (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references public.clients (id) on delete cascade,
  -- `set null` e não `cascade`: apagar o contato não pode apagar a prova de
  -- que uma cobrança paga existiu.
  contato_id             uuid references public.contacts (id) on delete set null,
  gateway                text not null check (gateway in ('mercado_pago')),

  valor_centavos         integer not null check (valor_centavos between 1 and 100000000),
  descricao              text not null check (length(trim(descricao)) between 1 and 200),
  -- Os itens quando a cobrança veio do pedido montado pela IA (`core/cobranca.ts`).
  itens                  jsonb,

  status                 text not null default 'pendente'
                         check (status in ('pendente', 'paga', 'vencida', 'cancelada')),

  -- O pagamento Pix e a preferência do link, como o Mercado Pago os chama.
  pagamento_no_gateway   text,
  preferencia_no_gateway text,
  pix_copia_cola         text,
  link                   text,

  vence_em               timestamptz not null,
  paga_em                timestamptz,
  cancelada_em           timestamptz,

  origem                 text not null check (origem in ('inbox', 'fluxo', 'ia')),
  -- Quem criou, pelo nome, como `autor` da linha do tempo. Nulo quando foi o
  -- fluxo ou a IA.
  criada_por             text,
  -- A conversa que espera o pagamento para seguir (bloco Cobrar, etapa D).
  sessao_id              uuid references public.sessions (id) on delete set null,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

comment on table public.cobrancas is
  'Cobrança feita pela conversa. O dinheiro vai direto ao dono; aqui fica o pedido e o status (0141).';

-- A tela Cobranças: as da conta, por status, mais novas primeiro.
create index if not exists cobrancas_da_conta
  on public.cobrancas (cliente_id, status, criado_em desc);
create index if not exists cobrancas_contato_id_fk_idx
  on public.cobrancas (contato_id);
create index if not exists cobrancas_sessao_id_fk_idx
  on public.cobrancas (sessao_id);
-- O webhook acha a cobrança pelo id do pagamento no gateway.
create unique index if not exists cobrancas_pagamento_no_gateway
  on public.cobrancas (gateway, pagamento_no_gateway)
  where pagamento_no_gateway is not null;

-- ---------------------------------------------------------------------------
-- 3. `atualizado_em` que se mantém sozinho
-- ---------------------------------------------------------------------------
--
-- Só **usa** `tocar_atualizado_em` (0001). Não redefinir: ver o aviso da 0059.

drop trigger if exists conexoes_de_pagamento_tocar on public.conexoes_de_pagamento;
create trigger conexoes_de_pagamento_tocar
  before update on public.conexoes_de_pagamento
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists cobrancas_tocar on public.cobrancas;
create trigger cobrancas_tocar
  before update on public.cobrancas
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 4. O segredo sai junto da linha
-- ---------------------------------------------------------------------------
--
-- O mesmo gatilho da 0040, para os dois segredos desta tabela: token de
-- pagamento órfão no Vault é o pior tipo de órfão.

create or replace function public.apagar_segredos_do_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
begin
  if old.token_ref is not null then
    delete from vault.secrets where id = old.token_ref;
  end if;
  if old.renovacao_ref is not null then
    delete from vault.secrets where id = old.renovacao_ref;
  end if;
  return old;
end;
$$;

revoke all on function public.apagar_segredos_do_pagamento() from public, anon, authenticated;

drop trigger if exists conexoes_de_pagamento_apagar_segredos on public.conexoes_de_pagamento;
create trigger conexoes_de_pagamento_apagar_segredos
  after delete on public.conexoes_de_pagamento
  for each row execute function public.apagar_segredos_do_pagamento();

-- ---------------------------------------------------------------------------
-- 5. RLS e permissões
-- ---------------------------------------------------------------------------

alter table public.conexoes_de_pagamento enable row level security;
revoke all on public.conexoes_de_pagamento from anon, authenticated;

alter table public.cobrancas enable row level security;
revoke all on public.cobrancas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. O cache do PostgREST
-- ---------------------------------------------------------------------------
--
-- Tabelas novas em schema exposto. O cache é o mesmo dos dois produtos:
-- depois do reload, conferir que `app_verandi` continua respondendo.

notify pgrst, 'reload schema';
