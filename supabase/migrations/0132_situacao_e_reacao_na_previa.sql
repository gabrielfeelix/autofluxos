-- A prévia da fila da Inbox como no WhatsApp: os tiques da última mensagem
-- nossa (enviada, entregue, lida) e "reagiu com ❤️" em vez de "Gabriel: ❤️".
--
-- Só acrescenta duas colunas no fim da view, que é o que `create or replace
-- view` permite sem derrubar nada: nenhuma coluna existente muda de nome,
-- tipo ou ordem. O corpo é o de produção lido em 07/out/2026
-- (`pg_get_viewdef`), não o da 0074, com os nomes qualificados por `public.`.

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
    ultima.reagiu_a IS NOT NULL AS ultima_e_reacao
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
