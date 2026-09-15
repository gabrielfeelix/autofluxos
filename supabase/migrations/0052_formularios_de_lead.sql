-- 0052 — quais formulários a reconciliação precisa varrer.
--
-- ---------------------------------------------------------------------------
-- Por que a reconciliação precisa de uma lista
-- ---------------------------------------------------------------------------
--
-- A rede de segurança do webhook varre `/{form_id}/leads` de tempos em tempos,
-- porque a Meta **não reentrega depois de um 200** e a retenção dela é de 90
-- dias: lead que a gente não buscou a tempo deixa de existir em qualquer lugar.
-- Para varrer é preciso saber o quê — e a Graph não tem endpoint de "todos os
-- formulários de todas as Páginas que me interessam".
--
-- A lista se preenche sozinha: todo lead que chega traz `form_id`, e a primeira
-- chegada de cada formulário anota a linha. Não há tela para cadastrar
-- formulário, e não deve haver — formulário que nunca entregou nada não tem
-- entrega perdida a recuperar, e pedir cadastro manual seria mais uma coisa
-- para o cliente esquecer de fazer.
--
-- ---------------------------------------------------------------------------
-- `form_id` é a chave, sozinho
-- ---------------------------------------------------------------------------
--
-- Mesma razão da `0051` com `page_id`: um formulário mora numa Página, e uma
-- Página pertence a uma conta. Deixar o par `(client_id, form_id)` permitiria o
-- mesmo formulário em duas contas, e aí a varredura entregaria os leads da
-- mesma pessoa em duas bases.

set search_path = public, extensions;

create table if not exists public.formularios_de_lead (
  form_id    text primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,
  page_id    text not null,
  criado_em  timestamptz not null default now()
);

comment on table public.formularios_de_lead is
  'Formulários de Lead Ads já vistos, para a reconciliação diária varrer. Preenchida sozinha na primeira chegada de cada formulário.';

create index if not exists formularios_de_lead_da_conta_idx
  on public.formularios_de_lead (client_id);

alter table public.formularios_de_lead enable row level security;

notify pgrst, 'reload schema';
