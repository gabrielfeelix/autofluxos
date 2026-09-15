-- 0051 — de qual conta é a Página que mandou o lead.
--
-- ---------------------------------------------------------------------------
-- O problema
-- ---------------------------------------------------------------------------
--
-- O webhook `leadgen` chega numa URL só, para todos os clientes. O corpo diz
-- `page_id` — a Página do Facebook onde o formulário está — e mais nada sobre
-- de quem é. Sem uma tradução de Página para conta, o lead não tem onde entrar.
--
-- **E ela não pode vir do corpo.** A assinatura do webhook prova que foi a Meta
-- que mandou; não prova de quem é o lead. Se a rota aceitasse um `cliente_id`
-- informado no payload, qualquer um que descobrisse a URL escreveria na conta
-- alheia — e a assinatura continuaria conferindo, porque quem assina é a Meta.
-- A ligação precisa ser cadastrada deste lado, uma vez, por quem tem acesso.
--
-- ---------------------------------------------------------------------------
-- Uma Página pertence a uma conta só
-- ---------------------------------------------------------------------------
--
-- `page_id` é a chave primária, sem `client_id` junto — de propósito, e é o
-- contrário da `0050`. Lá o mesmo `ad_id` em duas contas é impossível mas o par
-- custa nada; aqui a unicidade é a **regra**: a mesma Página em duas contas
-- significaria o mesmo lead entrando duas vezes, em bases diferentes, sem que
-- ninguém percebesse. O banco recusa antes.

set search_path = public, extensions;

create table if not exists public.paginas_de_lead (
  page_id    text primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,

  -- Só para a tela: quem cadastrou precisa reconhecer a Página depois, e
  -- `page_id` é um número de quinze dígitos.
  nome       text not null default '',

  criado_em  timestamptz not null default now()
);

comment on table public.paginas_de_lead is
  'Traduz page_id do webhook leadgen para a conta dona. Cadastrada deste lado porque a assinatura da Meta prova quem mandou, não de quem é o lead.';

create index if not exists paginas_de_lead_da_conta_idx
  on public.paginas_de_lead (client_id);

alter table public.paginas_de_lead enable row level security;

notify pgrst, 'reload schema';
