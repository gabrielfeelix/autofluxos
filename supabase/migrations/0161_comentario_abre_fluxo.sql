-- 0161: a resposta a comentário pode abrir um fluxo próprio (0160).
--
-- O direct do comentário é uma mensagem só (regra da Meta). Quando a pessoa
-- responde, em vez de cair no fluxo padrão do Instagram, a conversa abre o
-- fluxo da regra: cada post com a sua jornada.
--
-- 1. `respostas_a_comentarios.flow_id`: o fluxo, opcional.
-- 2. `comentarios_respondidos.contato_id` e `consumido_em`: a primeira resposta
--    da pessoa consome a marca, e as seguintes seguem a conversa normal.
--
-- Objetos só do AutoFluxos (`public`); nada da Verandi é tocado.

alter table public.respostas_a_comentarios
  add column flow_id uuid references public.flows(id) on delete set null;

alter table public.comentarios_respondidos
  add column contato_id uuid references public.contacts(id) on delete cascade,
  add column consumido_em timestamptz;

create index comentarios_respondidos_pendentes_idx
  on public.comentarios_respondidos (contato_id, criado_em desc)
  where consumido_em is null and ok;
