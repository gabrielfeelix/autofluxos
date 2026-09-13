-- 0047 — coexistência: o número que o cliente já usa no celular
--
-- Atender no número que ele **já tem** no WhatsApp Business App, sem tirar o
-- celular da mão dele: ele continua respondendo à mão, a gente manda em escala
-- pela Cloud API, e os dois lados enxergam a mesma conversa.
--
-- O que esta migration resolve é o "enxergar a mesma conversa". Sem ela, ele
-- responde pelo celular, o nosso banco não sabe, e o bot atropela uma conversa
-- que um humano já estava tendo.
--
-- Nada aqui encosta em `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O estado de coexistência do número
-- ---------------------------------------------------------------------------
--
-- **A janela de 24 horas é o motivo desta tabela existir assim.**
--
-- Depois que o cliente embarca, temos 24h para sincronizar contatos e
-- histórico. Passou, ele precisa ser desembarcado e refazer o Embedded Signup
-- inteiro. E **cada sync só pode ser disparado uma vez** — não há segunda
-- tentativa, nem forma de perguntar à Meta se já gastamos a nossa.
--
-- Por isso o `request_id` de cada disparo é coluna, e não log: ele é a prova de
-- que o disparo aconteceu (é o que o suporte da Meta pede) e é o que impede o
-- segundo disparo de queimar a chance. Guardar isso só no log significaria que
-- um redeploy no meio da janela nos faz perder a informação de que já
-- disparamos — e disparar de novo não dá erro, só não faz nada.
alter table public.channels
  -- O que a Graph API responde em `is_on_biz_app`. `null` = nunca perguntamos;
  -- `false` = número nosso, da Cloud API pura; `true` = coexistente.
  --
  -- Anulável de propósito: `false` por padrão afirmaria sobre todo canal que já
  -- existe uma coisa que ninguém verificou. O produto precisa distinguir "não é
  -- coexistente" de "não sei", porque a segunda é a que pede uma consulta.
  add column if not exists is_on_biz_app boolean,

  -- Quando o Embedded Signup terminou. É **o relógio da janela de 24h**: todo
  -- prazo desta funcionalidade se conta a partir daqui, não de `criado_em` (que
  -- é de quando a linha nasceu, possivelmente muito antes).
  add column if not exists coexistencia_em timestamptz,

  -- Os dois syncs. Cada par (quando, request_id) é gravado no instante do
  -- disparo, **antes** de saber se deu certo — a mesma postura de
  -- `registrarSaida`: gravar depois deixa uma janela em que o disparo
  -- aconteceu e o banco não sabe, e aqui essa janela custa a chance inteira.
  add column if not exists contatos_sync_em timestamptz,
  add column if not exists contatos_sync_request_id text,
  add column if not exists historico_sync_em timestamptz,
  add column if not exists historico_sync_request_id text,

  -- `ACCOUNT_OFFBOARDED` chegou: o cliente trocou de celular ou reinstalou o
  -- WhatsApp Business, e o companion da Cloud API foi desembarcado sozinho.
  -- Enquanto isto estiver preenchido, os envios daquele cliente falham — então
  -- é o que o envio consulta antes de tentar. `ACCOUNT_RECONNECTED` limpa.
  --
  -- Normalmente reconecta sozinho em minutos. Sem esta coluna, a troca de
  -- aparelho de um cliente vira uma fila de envios falhando em silêncio.
  add column if not exists desembarcado_em timestamptz;

comment on column public.channels.is_on_biz_app is
  'O número também está no WhatsApp Business App do cliente (coexistência). null = nunca verificado.';
comment on column public.channels.coexistencia_em is
  'Quando o Embedded Signup terminou. Marca o início da janela de 24h para os dois syncs.';
comment on column public.channels.contatos_sync_request_id is
  'request_id do smb_app_state_sync. Preenchido = o disparo já foi gasto e não se repete.';
comment on column public.channels.historico_sync_request_id is
  'request_id do sync de history. Preenchido = o disparo já foi gasto e não se repete.';
comment on column public.channels.desembarcado_em is
  'ACCOUNT_OFFBOARDED chegou e ACCOUNT_RECONNECTED ainda não. Envios falham enquanto estiver preenchido.';

-- ---------------------------------------------------------------------------
-- 2. Os contatos da agenda do celular dele
-- ---------------------------------------------------------------------------
--
-- **Tabela separada, e essa é a decisão inteira.**
--
-- `smb_app_state_sync` traz a agenda do celular do cliente: o dentista dele, a
-- mãe dele, o fornecedor. Não é gente que conversou com o negócio — é a lista
-- de contatos do aparelho. Despejar isso em `contacts` faria a tela de leads
-- mostrar centenas de pessoas que nunca escreveram para ninguém, e cada uma
-- contaria como lead na métrica.
--
-- Separado, a agenda serve para o que ela é boa: dar **nome** a quem escrever
-- depois. Quem estava na agenda e manda mensagem vira contato de verdade pelo
-- caminho de sempre, já sabendo como se chama.
create table if not exists public.contatos_da_agenda (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,

  -- O telefone como a Meta manda. É a chave junto do cliente: a mesma agenda
  -- sincronizada duas vezes não pode virar duas linhas.
  phone_number text not null,
  full_name    text,
  first_name   text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Por cliente, não por canal: o mesmo telefone na agenda de dois números do
  -- mesmo cliente é a mesma pessoa, e duplicá-la só daria duas respostas
  -- diferentes para "como ela se chama?".
  unique (client_id, phone_number)
);

comment on table public.contatos_da_agenda is
  'A agenda do celular do cliente, vinda de smb_app_state_sync. NÃO é lead: quem escrever vira contacts pelo caminho normal.';

create index if not exists contatos_da_agenda_cliente_idx
  on public.contatos_da_agenda (client_id, phone_number);

drop trigger if exists contatos_da_agenda_atualizado_em on public.contatos_da_agenda;
create trigger contatos_da_agenda_atualizado_em
  before update on public.contatos_da_agenda
  for each row execute function public.tocar_atualizado_em();

-- Mesma postura das outras: ligada, sem política. Só o servidor entra.
alter table public.contatos_da_agenda enable row level security;

-- ---------------------------------------------------------------------------
-- 3. O histórico importado precisa de data própria
-- ---------------------------------------------------------------------------
--
-- `messages.ts` tem `default now()`, que é certo para mensagem que chega ao
-- vivo e **errado** para histórico: importar seis meses de conversa carimbaria
-- tudo com o instante da importação, e a conversa apareceria na tela como se
-- tivesse acontecido toda de uma vez, hoje, fora de ordem.
--
-- A coluna não ganha default: quem não é histórico não a preenche, e `null`
-- significa "a data é `ts` mesmo".
alter table public.messages
  add column if not exists historico boolean not null default false;

comment on column public.messages.historico is
  'Veio da importação de history, não ao vivo. A tela usa para não contar conversa antiga como atividade de hoje.';

-- O `ts` do histórico é o `timestamp` que a Meta mandou, não o `now()` da
-- importação. Quem escreve preenche explicitamente — ver `receber-coexistencia.ts`.
create index if not exists messages_historico_idx
  on public.messages (contact_id, ts desc)
  where historico = true;
