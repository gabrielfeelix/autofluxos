-- API pública, fase 2: enviar modelo aprovado (docs/HANDOFF-02-OUT-API-PUBLICA.md).
--
-- Duas peças, as duas aditivas:
--
-- 1. `api_idempotencia`: a resposta de cada envio guardada pela
--    `Idempotency-Key` que o sistema de fora mandou, por 24h. Sem ela, a nova
--    tentativa depois de um tempo esgotado vira mensagem em dobro, e desde
--    01/out/2026 a Meta cobra cada uma.
-- 2. `clients.teto_api_diario`: quantos modelos a organização manda pela API
--    por dia. Nulo vale o padrão do código (500). Ajustável na administração.
--
-- Só o servidor lê e escreve (RLS ligada, sem políticas), como o resto de
-- `public`. Nada da Verandi é tocado.

set search_path = public, extensions;

create table if not exists public.api_idempotencia (
  client_id    uuid not null references public.clients (id) on delete cascade,
  -- O valor do cabeçalho Idempotency-Key, como veio (até 120 caracteres).
  chave        text not null check (char_length(chave) between 1 and 120),
  -- Qual chave de API fez a chamada. Some com a chave, a resposta fica.
  chave_api_id uuid references public.chaves_de_api (id) on delete set null,
  rota         text not null,
  -- SHA-256 do corpo: a mesma Idempotency-Key com outro corpo é erro do cliente.
  impressao    text not null check (impressao ~ '^[0-9a-f]{64}$'),
  -- Nulo enquanto a primeira chamada ainda está em andamento.
  status       integer,
  resposta     jsonb,
  criado_em    timestamptz not null default now(),
  primary key (client_id, chave)
);

comment on table public.api_idempotencia is
  'Respostas da API pública guardadas pela Idempotency-Key por 24h, para a nova tentativa não enviar de novo.';

create index if not exists api_idempotencia_criado_idx
  on public.api_idempotencia (criado_em);

alter table public.api_idempotencia enable row level security;

grant select, insert, update, delete on public.api_idempotencia to service_role;

alter table public.clients
  add column if not exists teto_api_diario integer
  check (teto_api_diario is null or teto_api_diario between 0 and 100000);

comment on column public.clients.teto_api_diario is
  'Modelos enviados pela API por dia. Nulo = padrão do código (500).';

notify pgrst, 'reload schema';
