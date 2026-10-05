-- As dúvidas do atendimento (Relatórios › Atendimento, "Principais dúvidas").
--
-- O que o cliente final pergunta, em que categoria do ramo, com que tema, e
-- quem respondeu. Quem escreve é a passada diária `/api/manutencao/duvidas`,
-- que lê as conversas novas e pede a classificação ao modelo. Ver
-- `src/core/duvidas.ts`.
--
-- Três tabelas, todas novas e aditivas: nenhuma coluna de tabela existente é
-- tocada, nenhum dado é reescrito. Tudo em `public`, nada da Verandi.
--
-- `pergunta` guarda a dúvida **reescrita pelo modelo, sem nome, telefone,
-- documento ou endereço**. A mensagem original continua só em `messages`, sob
-- a retenção de sempre; aqui fica o resumo que o relatório mostra.

set search_path = public, extensions;

create table if not exists public.duvidas (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  contact_id    uuid not null references public.contacts (id) on delete cascade,
  categoria     text not null check (char_length(categoria) between 1 and 60),
  tema          text not null check (char_length(tema) between 1 and 120),
  pergunta      text not null check (char_length(pergunta) between 1 and 300),
  resolvida_por text not null check (resolvida_por in ('ia', 'equipe', 'ninguem')),
  perguntada_em timestamptz not null,
  criado_em     timestamptz not null default now()
);

create index if not exists duvidas_por_cliente_e_data
  on public.duvidas (client_id, perguntada_em);

comment on table public.duvidas is
  'Dúvidas do cliente final extraídas das conversas pela passada diária: categoria do ramo, tema, pergunta reescrita sem dado pessoal e quem respondeu. Base do card "Principais dúvidas".';

-- Até onde cada conversa já foi lida, para a passada não classificar a mesma
-- mensagem duas vezes e retomar de onde parou.
create table if not exists public.duvidas_lidas (
  contact_id uuid primary key references public.contacts (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  ate        timestamptz not null
);

comment on table public.duvidas_lidas is
  'Marca, por contato, até que instante as mensagens já passaram pela classificação de dúvidas.';

-- Juntar e renomear temas à mão. A passada aplica o apelido ao gravar, e o
-- relatório ao ler, então a correção vale para o passado e para o futuro.
create table if not exists public.apelidos_de_tema (
  client_id uuid not null references public.clients (id) on delete cascade,
  categoria text not null,
  de        text not null,
  para      text not null check (char_length(para) between 1 and 120),
  primary key (client_id, categoria, de)
);

comment on table public.apelidos_de_tema is
  'Tema renomeado ou juntado a outro pelo dono da conta: dúvida com tema `de` passa a contar como `para`.';

alter table public.duvidas enable row level security;
alter table public.duvidas_lidas enable row level security;
alter table public.apelidos_de_tema enable row level security;

revoke all on table public.duvidas, public.duvidas_lidas, public.apelidos_de_tema from public, anon, authenticated;
grant select, insert, update, delete on table public.duvidas, public.duvidas_lidas, public.apelidos_de_tema to service_role;

notify pgrst, 'reload schema';
