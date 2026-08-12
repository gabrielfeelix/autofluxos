-- 0004 — a visão de leads.
--
-- A tela de leads faz três perguntas por contato: o que o fluxo coletou, se
-- tem alguém esperando atendimento humano, e quando foi a última mensagem.
-- As duas últimas são agregações — "a última linha de `messages`", "o handoff
-- aberto mais recente" — e agregação não existe no PostgREST.
--
-- Dava para fazer no TypeScript: puxar os contatos, puxar TODAS as mensagens
-- deles e reduzir na memória. Funciona com dez leads e cai sozinho com dez
-- mil. Pior: ordenar por "última mensagem" exigiria ter todas em mãos antes de
-- desenhar a primeira linha da tabela. O banco resolve isso com o índice que
-- já existe (`messages_contact_idx`), lendo uma linha por contato.
--
-- `security_invoker = true` não é detalhe. Sem ele a view roda com os direitos
-- de quem a criou e passa por cima da RLS das tabelas de baixo — a chave
-- `publishable`, que vai para o navegador, leria a conversa de todo mundo. Uma
-- view é o jeito clássico de furar RLS sem perceber. Com ele, a view obedece a
-- mesma RLS de sempre: ligada, sem política, ninguém entra. O `revoke` embaixo
-- é a segunda tranca.

-- O handoff aberto é a busca da tela; o índice parcial só indexa o que ela lê.
create index if not exists handoffs_abertos_idx
  on public.handoffs (session_id, criado_em desc)
  where resolvido_em is null;

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
  aberto.criado_em as handoff_em
from public.contacts c
-- `lateral ... limit 1` em vez de `group by`: é o que deixa o Postgres parar na
-- primeira linha do índice em vez de varrer a conversa inteira para descartar.
left join lateral (
  select m.ts, m.direcao, m.texto
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
) aberto on true;

-- Leads são dados de cliente. Só o servidor, com a chave secreta.
revoke all on public.leads from anon, authenticated;

-- O PostgREST guarda o desenho do schema em cache; sem isto a view só aparece
-- no próximo restart do projeto.
notify pgrst, 'reload schema';
