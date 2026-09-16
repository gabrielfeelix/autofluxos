-- 0063 — o alfinete e a estrela: o que cada atendente marca para si.
--
-- Duas tabelas, e as duas respondem a mesma pergunta que `af_leituras` (0023)
-- já respondia para "não lidas": **o que ESTA pessoa marcou?** Não é a conta que
-- fixa uma conversa nem que guarda uma mensagem; é o atendente. Quatro pessoas
-- dividindo a mesma fila têm quatro conjuntos de urgências, e uma coluna em
-- `contacts` diria que a conversa está no topo porque *alguém* a colocou lá —
-- que é exatamente a informação que não ajuda ninguém a decidir o que abrir.
--
-- Por isso o desenho é copiado de `af_leituras` de propósito: mesma
-- cardinalidade, mesma chave primária composta, mesmo `revoke`. Quem já
-- entendeu aquela tabela entendeu estas duas.
--
-- **O que a Meta NÃO dá, para ninguém perder tempo procurando.** Fixar conversa
-- é estado local do aparelho: a Cloud API não expõe isso em campo nenhum, nem
-- no webhook nem em endpoint de leitura. As conversas fixadas no celular do
-- dono não podem ser espelhadas aqui, e o que existir nestas tabelas é nosso,
-- do zero. Favoritar mensagem é o mesmo caso.
--
-- Aditivo: nenhuma coluna existente muda, nada é reescrito, e nada aqui cita
-- `app_verandi`. Todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. As conversas que esta pessoa grudou no topo
-- ---------------------------------------------------------------------------
--
-- `fixada_em` não é auditoria: é a ordem do bloco fixado. Sem ela, fixar a
-- quarta conversa embaralharia as três que já estavam lá, e um bloco que se
-- reordena sozinho é pior que nenhum — a pessoa fixa justamente para o alvo
-- parar de se mexer.
--
-- Não há teto aqui dentro, e é decisão consciente: um `check` contando linhas
-- exigiria gatilho, e o teto é regra de produto (ver `TETO_DE_FIXADAS` em
-- `core/marcadores.ts`), do tipo que muda por conversa com o dono e não por
-- migration contra o banco que a Verandi divide.

create table if not exists public.af_fixadas (
  usuario_id uuid not null references public.af_usuarios (id) on delete cascade,
  contato_id uuid not null references public.contacts (id)    on delete cascade,
  fixada_em  timestamptz not null default now(),
  primary key (usuario_id, contato_id)
);

-- A consulta real é "o que eu fixei, na minha ordem", sempre por pessoa.
create index if not exists af_fixadas_usuario_idx
  on public.af_fixadas (usuario_id, fixada_em desc);

comment on table public.af_fixadas is
  'Conversas que cada pessoa grudou no topo da fila. É por atendente: o colega não vê as suas.';

alter table public.af_fixadas enable row level security;
revoke all on public.af_fixadas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. As mensagens que esta pessoa guardou
-- ---------------------------------------------------------------------------
--
-- Aponta para `messages (id)`, e não para o `wa_message_id`: o id da Meta é
-- texto, pode faltar (saída ainda não confirmada não tem) e não tem chave
-- estrangeira para nada. O id interno existe em toda mensagem gravada e leva o
-- `on delete cascade` de graça — apagar o contato leva a conversa, que leva as
-- favoritas, sem sobrar linha órfã apontando para mensagem que não existe mais.
--
-- Não guarda `contato_id` nem `cliente_id`: os dois se alcançam por `messages`,
-- e copiá-los aqui criaria dois lugares para a mesma verdade. A lista de
-- favoritas é uma tela rara — pagar um join nela é mais barato que manter uma
-- cópia que pode divergir.

create table if not exists public.af_favoritas (
  usuario_id    uuid not null references public.af_usuarios (id) on delete cascade,
  mensagem_id   uuid not null references public.messages (id)    on delete cascade,
  favoritada_em timestamptz not null default now(),
  primary key (usuario_id, mensagem_id)
);

-- A tela é "as minhas favoritas, a mais recente primeiro".
create index if not exists af_favoritas_usuario_idx
  on public.af_favoritas (usuario_id, favoritada_em desc);

-- A segunda leitura é por conversa: "quais bolhas desta conversa estão com
-- estrela", que é o que pinta a estrela cheia ao abrir o Inbox.
create index if not exists af_favoritas_mensagem_idx
  on public.af_favoritas (mensagem_id);

comment on table public.af_favoritas is
  'Mensagens que cada pessoa guardou. Aponta para messages(id), e não para o id da Meta, que pode faltar.';

alter table public.af_favoritas enable row level security;
revoke all on public.af_favoritas from anon, authenticated;

-- As duas vivem em `public`, que é schema exposto na Data API, e o servidor
-- fala com elas pelo PostgREST. Sem recarregar o cache, `from('af_fixadas')`
-- responde 404 até a próxima reinicialização — e o cache é o mesmo dos dois
-- produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
