-- 0018 — o contato passa a ter nome de gente.
--
-- Hoje `contacts.nome` guarda o nome do perfil do WhatsApp, que é o que a
-- pessoa escolheu para si. Numa lista de atendimento isso vira "Rodrigão
-- comedor delas" onde deveria estar "Rodrigo", e o dono do negócio não
-- reconhece o próprio aluno. Foi a observação mais afiada da análise do
-- concorrente (docs/PLANO-PRODUTO.md §2, print 13).
--
-- **Duas colunas em vez de uma corrigida.** A tentação é sobrescrever `nome` e
-- acabar com o assunto; o preço é perder a informação de qual conta do WhatsApp
-- é aquela — que é o que identifica a pessoa quando ela troca de número, e o
-- que quem atende reconhece na notificação do celular. As duas ficam, com
-- precedência explícita: mostra-se `nome_real` quando existe, `nome` quando não.
--
-- A precedência mora na leitura e **não** num gatilho ou numa terceira coluna
-- calculada: gatilho tornaria a próxima mensagem do WhatsApp capaz de desfazer
-- a correção de uma pessoa, que é exatamente o defeito que estamos consertando.

alter table public.contacts
  add column if not exists nome_real text not null default '',
  add column if not exists notas     text not null default '';

comment on column public.contacts.nome is
  'Nome do perfil do WhatsApp, escrito pela própria pessoa. Sobrescrito a cada mensagem que chega.';
comment on column public.contacts.nome_real is
  'Nome corrigido por uma pessoa ou vindo da planilha do cliente. Vence o do perfil na exibição. Vazio = usar `nome`.';
comment on column public.contacts.notas is
  'Anotação livre de quem atende. Não vai para o WhatsApp e não entra em nenhuma automação.';

-- A view de leads precisa entregar as duas para a tela decidir.
--
-- **As colunas novas vão no fim, e a ordem das antigas é copiada da view que
-- está no ar** — não da migration 0004, que já não descreve o estado atual.
-- `create or replace view` não reordena nem remove coluna: ele só aceita
-- acrescentar no fim, e recusa qualquer outra diferença com
-- `cannot change name of view column`. As migrations 0008 e 0013 anexaram
-- `ultima_entregue` e `automacao_ativa` depois de `handoff_em`, então é essa a
-- ordem verdadeira. Foi conferido com `pg_get_viewdef` antes de escrever isto.
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
  c.notas
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue
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

revoke all on public.leads from anon, authenticated;

-- Busca por nome passa a ter que olhar os dois campos. Sem este índice, a busca
-- da tela de contatos vira varredura assim que o cliente tiver alguns milhares.
create index if not exists contacts_nome_real_idx
  on public.contacts (client_id, nome_real)
  where nome_real <> '';

notify pgrst, 'reload schema';
