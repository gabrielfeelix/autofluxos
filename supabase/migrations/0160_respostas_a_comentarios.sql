-- 0160: resposta automática a comentário do Instagram (Automações → Gatilhos → Comentários).
--
-- Quem comenta uma palavra num post recebe uma mensagem no direct, e, se a
-- conta quiser, uma resposta pública curta no próprio comentário. A Meta chama
-- a primeira de "private reply": uma mensagem por comentário, em até 7 dias.
-- Quando a pessoa responde o direct, a conversa segue pelo caminho normal do
-- Instagram (fluxo do canal, Inbox), e esta tabela não participa mais.
--
-- 1. `respostas_a_comentarios`: a regra. `palavras` vazia é "qualquer
--    comentário"; `post_id` nulo é "todos os posts". Legenda, imagem e link do
--    post são cópia para a lista não depender da Meta para se desenhar.
-- 2. `comentarios_respondidos`: um registro por comentário tratado. A chave é
--    o id do comentário porque a Meta reenvia webhook, e a mesma pessoa não
--    pode receber o mesmo direct duas vezes.
--
-- Objetos só do AutoFluxos (`public`); nada da Verandi é tocado. Tabelas novas
-- nascem fechadas para `anon` e `authenticated` (0041); só `service_role` usa.

create table public.respostas_a_comentarios (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  palavras text[] not null default '{}',
  post_id text,
  post_legenda text,
  post_imagem text,
  post_link text,
  mensagem text not null check (char_length(mensagem) between 1 and 1000),
  resposta_publica text check (resposta_publica is null or char_length(resposta_publica) between 1 and 300),
  ativo boolean not null default true,
  execucoes integer not null default 0,
  criado_em timestamptz not null default now()
);

create index respostas_a_comentarios_canal_idx
  on public.respostas_a_comentarios (channel_id) where ativo;
create index respostas_a_comentarios_cliente_idx
  on public.respostas_a_comentarios (client_id);

alter table public.respostas_a_comentarios enable row level security;

create table public.comentarios_respondidos (
  comentario_id text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  resposta_id uuid references public.respostas_a_comentarios(id) on delete set null,
  autor_igsid text,
  ok boolean not null default false,
  detalhe text,
  criado_em timestamptz not null default now()
);

create index comentarios_respondidos_cliente_idx
  on public.comentarios_respondidos (client_id, criado_em desc);

alter table public.comentarios_respondidos enable row level security;

revoke all on public.respostas_a_comentarios from anon, authenticated;
revoke all on public.comentarios_respondidos from anon, authenticated;
grant all on public.respostas_a_comentarios to service_role;
grant all on public.comentarios_respondidos to service_role;
