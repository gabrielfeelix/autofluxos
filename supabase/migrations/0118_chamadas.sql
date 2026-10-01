-- Ligação de voz pelo chat do site.
--
-- O visitante clica em "Ligar" no balão e o Inbox toca. O áudio vai direto de
-- navegador para navegador (WebRTC); o servidor só guarda a sinalização: a
-- oferta do visitante, a resposta do atendente e em que pé a chamada está.
-- Sem ICE em pedaços: cada lado só manda a descrição depois de juntar todos os
-- candidatos, então uma linha com duas colunas basta, sem fila de mensagens.
--
-- Aditiva: tabela nova, nada existente muda. Só o servidor lê e escreve, como
-- o resto de `public` (RLS ligada, sem políticas).

set search_path = public, extensions;

create table if not exists public.chamadas (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  contact_id    uuid not null references public.contacts (id) on delete cascade,
  channel_id    uuid not null references public.channels (id) on delete cascade,
  -- Quem ligou. Hoje só o visitante; a ligação de saída do WhatsApp vem depois.
  origem        text not null default 'visitante' check (origem in ('visitante', 'empresa')),
  status        text not null default 'chamando'
                check (status in ('chamando', 'em_andamento', 'encerrada', 'perdida', 'recusada')),
  -- SDP completos, com os candidatos dentro. Nunca vão para o Inbox inteiro:
  -- só para quem atende esta chamada.
  oferta        text not null,
  resposta      text,
  atendente_id  text,
  criada_em     timestamptz not null default now(),
  atendida_em   timestamptz,
  encerrada_em  timestamptz
);

comment on table public.chamadas is
  'Ligações de voz (chat do site). Guarda só a sinalização WebRTC e o status; o áudio vai de navegador para navegador e não passa nem fica aqui.';

-- O Inbox pergunta "tem alguma tocando nesta conta?" a cada segundo.
create index if not exists chamadas_tocando_idx
  on public.chamadas (client_id) where status = 'chamando';
create index if not exists chamadas_contato_idx
  on public.chamadas (contact_id, criada_em desc);

alter table public.chamadas enable row level security;

grant select, insert, update, delete on public.chamadas to service_role;

notify pgrst, 'reload schema';
