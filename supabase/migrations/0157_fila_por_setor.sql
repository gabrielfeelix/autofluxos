-- 0157, fila por setor (docs/HANDOFF-29-OUT-FILA-POR-SETOR-E-COPILOTO.md).
--
-- O setor é a equipe da 0073: não nasce tabela "departamentos" paralela. O que
-- muda é que a conversa passa a dizer de qual setor ela está esperando gente.
--
-- Por que no contato, e não na sessão
-- ---------------------------------------------------------------------------
--
-- A fila do Inbox é por contato (`atribuido_a` mora em `contacts` pelo mesmo
-- motivo), e a transferência para um setor acontece pela tela, numa conversa
-- que já está com gente, sem sessão nova nem handoff novo. O setor ficar ao
-- lado do dono é o que deixa "esta conversa é do Suporte" ser um filtro só.
--
-- O handoff também guarda o setor pedido: é o retrato do momento, e é o que o
-- relatório usa para medir espera e volume por setor sem depender do setor que
-- o contato tem hoje.
--
-- `on delete set null` nas duas: equipe é arquivada, e não apagada (0073), mas
-- se um dia uma sumir, a conversa volta para a fila geral em vez de travar.
--
-- Aditiva: duas colunas anuláveis, sem default, sem reescrever linha. A view
-- `leads` ganha a coluna no fim, então `create or replace view` basta. Nada da
-- Verandi é tocado.

set search_path = public, extensions;

alter table public.contacts
  add column if not exists equipe_id uuid references public.equipes (id) on delete set null;

alter table public.handoffs
  add column if not exists equipe_id uuid references public.equipes (id) on delete set null;

create index if not exists contacts_setor_idx
  on public.contacts (client_id, equipe_id)
  where equipe_id is not null;

create index if not exists handoffs_setor_idx
  on public.handoffs (equipe_id)
  where equipe_id is not null;

comment on column public.contacts.equipe_id is
  'Setor (equipe) em cuja fila a conversa está. Nulo = fila geral.';
comment on column public.handoffs.equipe_id is
  'Setor pedido no momento do handoff. Retrato para relatório, não muda depois.';

create or replace view public.leads
with (security_invoker = true) as
SELECT c.id AS contact_id,
    c.client_id,
    c.wa_id,
    c.nome,
    c.campos,
    c.criado_em,
    ultima.ts AS ultima_em,
    ultima.direcao AS ultima_direcao,
    ultima.texto AS ultimo_texto,
    aberto.motivo AS handoff_motivo,
    aberto.criado_em AS handoff_em,
    ultima.entregue AS ultima_entregue,
    c.automacao_ativa,
    c.nome_real,
    c.notas,
    entrada.ts AS ultima_entrada_em,
    c.atribuido_a,
    ultima.tipo AS ultimo_tipo,
    c.estado,
    c.adiada_ate,
    c.adiada_nota,
    c.resolvida_em,
        CASE
            WHEN c.estado = 'adiada'::text AND c.adiada_ate IS NOT NULL AND c.adiada_ate <= now() THEN 'aberta'::text
            ELSE c.estado
        END AS estado_efetivo,
    ultima.autor_tipo AS ultimo_autor_tipo,
    ultima.autor_nome AS ultimo_autor_nome,
    porta.criado_em AS porta_de_entrada_em,
    ultima.situacao AS ultima_situacao,
    ultima.reagiu_a IS NOT NULL AS ultima_e_reacao,
    c.equipe_id
   FROM public.contacts c
     LEFT JOIN LATERAL ( SELECT m.ts,
            m.direcao,
            m.texto,
            m.entregue,
            m.payload ->> 'type'::text AS tipo,
            (m.payload -> 'autor'::text) ->> 'tipo'::text AS autor_tipo,
            (m.payload -> 'autor'::text) ->> 'nome'::text AS autor_nome,
            m.situacao,
            m.reagiu_a
           FROM public.messages m
          WHERE m.contact_id = c.id
            AND (m.payload ->> 'type'::text) IS DISTINCT FROM 'edit'::text
          ORDER BY m.ts DESC
         LIMIT 1) ultima ON true
     LEFT JOIN LATERAL ( SELECT h.motivo,
            h.criado_em
           FROM public.handoffs h
             JOIN public.sessions s ON s.id = h.session_id
          WHERE s.contact_id = c.id AND h.resolvido_em IS NULL
          ORDER BY h.criado_em DESC
         LIMIT 1) aberto ON true
     LEFT JOIN LATERAL ( SELECT m.ts
           FROM public.messages m
          WHERE m.contact_id = c.id AND m.direcao = 'entrada'::text
          ORDER BY m.ts DESC
         LIMIT 1) entrada ON true
     LEFT JOIN LATERAL ( SELECT p.criado_em
           FROM public.passagens p
          WHERE p.contact_id = c.id AND (p.tipo = ANY (ARRAY['anuncio_whatsapp'::text, 'botao_pagina'::text]))
          ORDER BY p.criado_em DESC
         LIMIT 1) porta ON true;

revoke all on public.leads from anon, authenticated;

notify pgrst, 'reload schema';
