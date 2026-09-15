-- 0053 — quando cada formulário foi varrido pela última vez.
--
-- ---------------------------------------------------------------------------
-- O limite da Meta é ao contrário do que a intuição diz
-- ---------------------------------------------------------------------------
--
-- A conta é `200 × 24 × leads criados nos últimos 90 dias`, **por Página**.
-- Quem tem volume tem teto folgado; quem está começando tem teto apertado — e
-- uma Página com zero leads tem teto **zero**. É exatamente no onboarding,
-- quando mais se testa e mais se varre, que o limite mais dói.
--
-- Por isso a reconciliação passou a varrer só alguns formulários por execução.
-- Mas "alguns" sem ordem faria os primeiros da lista serem varridos todo dia e
-- os demais nunca — a rede de segurança deixaria de cobrir justamente as contas
-- do fim da fila, e ninguém perceberia, porque falha de rede de segurança só
-- aparece quando ela era necessária.
--
-- Esta coluna é o que faz a fila girar: ordena por quem esperou mais, e
-- `null` (nunca varrido) vai na frente de todos.

set search_path = public, extensions;

alter table public.formularios_de_lead
  add column if not exists varrido_em timestamptz;

comment on column public.formularios_de_lead.varrido_em is
  'Última varredura da reconciliação. Null = nunca varrido, e vai primeiro na fila. Ordenar por isto é o que impede os mesmos formulários de serem varridos todo dia enquanto outros nunca são.';

create index if not exists formularios_de_lead_varredura_idx
  on public.formularios_de_lead (varrido_em nulls first);

notify pgrst, 'reload schema';
