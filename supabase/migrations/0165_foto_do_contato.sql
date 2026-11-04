-- 0165: foto de perfil do contato (Messenger e Instagram).
--
-- A Cloud API do WhatsApp não entrega foto de contato; Messenger e Instagram
-- entregam pela API de perfil, com um link que expira em dias. A foto é
-- baixada e guardada no bucket público `autofluxos-avatares`
-- (`contatos/<cliente>/<contato>.jpg`), e o endereço fica aqui.
-- `foto_em` diz quando foi buscada, para renovar sem consultar a Meta a cada
-- mensagem. A view `leads` ganha a coluna no fim (create or replace exige).
--
-- Objetos só do AutoFluxos (`public`); nada da Verandi é tocado.

alter table public.contacts
  add column foto_url text,
  add column foto_em timestamptz;

create or replace view public.leads with (security_invoker = true) as
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
    c.equipe_id,
    c.foto_url
   FROM contacts c
     LEFT JOIN LATERAL ( SELECT m.ts,
            m.direcao,
            m.texto,
            m.entregue,
            m.payload ->> 'type'::text AS tipo,
            (m.payload -> 'autor'::text) ->> 'tipo'::text AS autor_tipo,
            (m.payload -> 'autor'::text) ->> 'nome'::text AS autor_nome,
            m.situacao,
            m.reagiu_a
           FROM messages m
          WHERE m.contact_id = c.id AND (m.payload ->> 'type'::text) IS DISTINCT FROM 'edit'::text
          ORDER BY m.ts DESC
         LIMIT 1) ultima ON true
     LEFT JOIN LATERAL ( SELECT h.motivo,
            h.criado_em
           FROM handoffs h
             JOIN sessions s ON s.id = h.session_id
          WHERE s.contact_id = c.id AND h.resolvido_em IS NULL
          ORDER BY h.criado_em DESC
         LIMIT 1) aberto ON true
     LEFT JOIN LATERAL ( SELECT m.ts
           FROM messages m
          WHERE m.contact_id = c.id AND m.direcao = 'entrada'::text
          ORDER BY m.ts DESC
         LIMIT 1) entrada ON true
     LEFT JOIN LATERAL ( SELECT p.criado_em
           FROM passagens p
          WHERE p.contact_id = c.id AND (p.tipo = ANY (ARRAY['anuncio_whatsapp'::text, 'botao_pagina'::text]))
          ORDER BY p.criado_em DESC
         LIMIT 1) porta ON true;
