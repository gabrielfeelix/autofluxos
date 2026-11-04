-- 0166: o canal por onde o contato fala, gravado no contato.
--
-- Era deduzido da sessão, e conta com canal sem fluxo nunca abre sessão: o
-- contato caía no selo do WhatsApp. O palpite pelo tamanho do id (16 dígitos
-- ou mais = Instagram) deixou de servir quando o Messenger chegou, com ids do
-- mesmo tamanho. Preenchido na primeira mensagem por Instagram e Messenger;
-- o que existe vem das sessões. A view `leads` ganha a coluna no fim.
--
-- Objetos só do AutoFluxos (`public`); nada da Verandi é tocado.

alter table public.contacts
  add column canal text check (canal is null or canal in ('whatsapp', 'instagram', 'messenger', 'telegram', 'site'));

update public.contacts k set canal = d.canal
from (
  select distinct on (s.contact_id) s.contact_id,
    case h.provider when 'cloud-api' then 'whatsapp' else h.provider end canal
  from public.sessions s join public.channels h on h.id = s.channel_id
  where h.provider in ('cloud-api', 'instagram', 'messenger', 'telegram', 'site')
  order by s.contact_id, s.criado_em desc
) d
where k.id = d.contact_id and k.canal is null;

update public.contacts set canal = 'site' where canal is null and wa_id like 'site:%';

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
    c.foto_url,
    c.canal
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
