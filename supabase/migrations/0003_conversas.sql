-- 0003 — canal, contatos e conversas.
--
-- Aqui o desenho encosta na realidade: um número de WhatsApp ligado a um
-- cliente, as pessoas que escrevem para ele, e o estado de cada conversa.

create table if not exists public.channels (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  provider        text not null default 'cloud-api',
  -- Id do número na Cloud API. É por ele que o webhook descobre de quem é a
  -- mensagem que chegou, então é único no sistema inteiro.
  phone_number_id text not null unique,
  waba_id         text,
  -- Qual fluxo este número executa. A conversa usa a versão PUBLICADA dele.
  flow_id         uuid references public.flows (id) on delete set null,
  status          text not null default 'ativo',
  criado_em       timestamptz not null default now()
);

create table if not exists public.contacts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  -- Telefone no formato que o WhatsApp usa (5511999999999).
  wa_id            text not null,
  nome             text,
  -- O que o fluxo coletou. É isto que vira a linha na tela de leads.
  campos           jsonb not null default '{}'::jsonb,
  consentimento_em timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (client_id, wa_id)
);

create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts (id) on delete cascade,
  channel_id      uuid not null references public.channels (id) on delete cascade,
  -- §5 da arquitetura, a metade que faltava: a conversa fica presa na versão
  -- que estava no ar quando ela começou. Publicar de novo no meio do dia não
  -- move ninguém para um bloco que não existia quando a pessoa entrou.
  flow_version_id uuid not null references public.flow_versions (id),
  no_atual        text,
  vars            jsonb not null default '{}'::jsonb,
  tentativas      integer not null default 0,
  status          text not null default 'ativa',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- A busca mais quente do webhook: a conversa viva daquele contato naquele número.
create index if not exists sessions_conversa_viva_idx
  on public.sessions (contact_id, channel_id, criado_em desc);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.sessions (id) on delete set null,
  contact_id    uuid not null references public.contacts (id) on delete cascade,
  direcao       text not null check (direcao in ('entrada', 'saida')),
  -- Deduplicação de graça, garantida pelo banco.
  --
  -- A Meta reenvia o webhook quando não recebe 200 a tempo. Sem isto, uma
  -- lentidão nossa vira mensagem repetida e conversa andando duas vezes. Com
  -- isto, a segunda entrega bate na constraint e a gente ignora — não depende
  -- de ninguém lembrar de escrever a checagem.
  wa_message_id text unique,
  texto         text,
  payload       jsonb,
  ts            timestamptz not null default now()
);

create index if not exists messages_contact_idx on public.messages (contact_id, ts desc);

create table if not exists public.handoffs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  motivo       text not null,
  criado_em    timestamptz not null default now(),
  resolvido_em timestamptz
);

drop trigger if exists contacts_atualizado_em on public.contacts;
create trigger contacts_atualizado_em
  before update on public.contacts
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists sessions_atualizado_em on public.sessions;
create trigger sessions_atualizado_em
  before update on public.sessions
  for each row execute function public.tocar_atualizado_em();

-- Mesma postura das outras: ligada, sem política. Só o servidor entra.
alter table public.channels enable row level security;
alter table public.contacts enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.handoffs enable row level security;
