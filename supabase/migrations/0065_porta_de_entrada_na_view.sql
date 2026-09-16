-- 0065: a janela de 72h de quem chegou por anúncio, na view.
--
-- ---------------------------------------------------------------------------
-- O que estava errado
-- ---------------------------------------------------------------------------
--
-- Todo o produto tratava a janela do WhatsApp como 24h, sempre. Não é: quem
-- clica num anúncio Click to WhatsApp ou no botão da Página do Facebook abre
-- uma janela de **72h**, e ela é gratuita. É o que a Meta chama de *free entry
-- point conversation*.
--
-- O efeito do erro tinha as duas caras, e as duas custam dinheiro:
--
--   * a tela fechava a caixa de resposta no segundo dia e mandava retomar com
--     modelo **pago** alguém que ainda tinha um dia inteiro de conversa livre e
--     gratuita pela frente;
--   * e o contrário, quando as 72h venciam e a conversa seguia aberta pelas
--     24h de uma mensagem nova: continua dando para responder, só que agora
--     pago, e nada na tela dizia isso.
--
-- ---------------------------------------------------------------------------
-- Por que nenhuma coluna nova, e nenhuma escrita nova
-- ---------------------------------------------------------------------------
--
-- O dado já existe e já é gravado. A chegada por anúncio vira uma linha em
-- `passagens` (0050), escrita por `atribuirOrigem` no exato momento em que a
-- Meta manda o objeto `referral` no webhook, que é exatamente o evento que
-- abre a janela de 72h. Um `porta_de_entrada_em` em `contacts` seria uma cópia
-- do `criado_em` de lá, com todo o risco de cópia: divergir.
--
-- Então é só mais um lateral join, como os três que a view já faz. O índice
-- `passagens_do_contato_idx (contact_id, criado_em desc)` é exatamente o que
-- ele precisa, e já existe desde a 0050.
--
-- `create or replace view` que acrescenta **uma** coluna ao fim da lista: as
-- anteriores seguem na mesma ordem, com o mesmo nome e o mesmo tipo, porque é
-- a única forma que o Postgres aceita.
--
-- Contato que nunca veio de anúncio devolve `null`, e `null` quer dizer "vale
-- 24h e é pago". É o caso da maioria, e é o que o código já fazia.

set search_path = public, extensions;

create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em,
  ultima.entregue  as ultima_entregue,
  c.automacao_ativa,
  c.nome_real,
  c.notas,
  entrada.ts       as ultima_entrada_em,
  c.atribuido_a,
  ultima.tipo      as ultimo_tipo,
  c.estado,
  c.adiada_ate,
  c.adiada_nota,
  c.resolvida_em,
  case
    when c.estado = 'adiada' and c.adiada_ate is not null and c.adiada_ate <= now()
      then 'aberta'
    else c.estado
  end              as estado_efetivo,
  ultima.autor_tipo as ultimo_autor_tipo,
  ultima.autor_nome as ultimo_autor_nome,

  -- A última chegada por anúncio. A conta das 72h é feita em TypeScript, em
  -- `channels/janela.ts`, junto com a das 24h: são regras de produto, mudam
  -- quando a Meta muda, e precisam ser testáveis sem subir banco.
  porta.criado_em  as porta_de_entrada_em
from public.contacts c
left join lateral (
  select
    m.ts,
    m.direcao,
    m.texto,
    m.entregue,
    m.payload->>'type' as tipo,
    -- O mesmo `payload` que já era lido acima. Ler o autor aqui não custa
    -- leitura nenhuma a mais: a linha já estava carregada.
    m.payload->'autor'->>'tipo' as autor_tipo,
    m.payload->'autor'->>'nome' as autor_nome
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true
left join lateral (
  select m.ts
  from public.messages m
  where m.contact_id = c.id
    and m.direcao = 'entrada'
  order by m.ts desc
  limit 1
) entrada on true
/*
 * A mais nova, e só ela. Quem passou por três anúncios em meses diferentes tem
 * três linhas, e a janela aberta é a da última: as outras já venceram, e
 * `restaDaJanela` devolveria zero para elas de qualquer jeito.
 */
left join lateral (
  select p.criado_em
  from public.passagens p
  where p.contact_id = c.id
  order by p.criado_em desc
  limit 1
) porta on true;

-- Recriar a view **devolve os grants ao default do schema**, e desde a `0041`
-- esse default é fechado. Repetir o revoke aqui é o que a `0049` e a `0062`
-- fizeram, e pelo mesmo motivo: sem ele, uma view recriada pode voltar
-- alcançável por `anon`/`authenticated` se o default do projeto mudar de novo.
revoke all on public.leads from anon, authenticated;
grant select on public.leads to service_role;

notify pgrst, 'reload schema';
