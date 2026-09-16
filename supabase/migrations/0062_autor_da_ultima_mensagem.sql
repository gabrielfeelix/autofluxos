-- Quem falou por último, na lista de conversas
-- ============================================================================
--
-- A lista do Inbox mostrava "atendimento: Beleza" em toda linha cuja última
-- mensagem saiu daqui. "Atendimento" não é ninguém: numa conta com quatro
-- pessoas respondendo, a linha não diz qual delas falou, e é justamente essa a
-- pergunta de quem abre a lista para saber se já cuidaram do cliente.
--
-- O nome já é gravado. Toda saída registra o autor dentro de `payload`, em
-- `{ autor: { tipo: 'pessoa' | 'automacao', nome, id } }`, ver
-- `core/autor-da-mensagem.ts`. O que faltava era a view expor isso: ela já lia
-- `payload->>'type'` no mesmo lateral join, e passa a ler o autor ao lado.
--
-- ----------------------------------------------------------------------------
-- Por que duas colunas, e não uma frase pronta
-- ----------------------------------------------------------------------------
--
-- Sai `ultimo_autor_tipo` e `ultimo_autor_nome`, e não um "Gabriel Felix: " já
-- montado. Montar aqui poria texto de tela dentro do banco: a tela quer o nome
-- curto ("Gabriel"), numa cor diferente do resto da linha, e nada disso é
-- decisão de SQL. Com as duas colunas cruas, `comoChamarOAutor()` continua
-- sendo o único lugar que decide como um autor se chama.
--
-- `tipo` vem separado do nome porque automação não tem nome de gente: ela é
-- "automação", e a tela precisa saber a diferença para não escrever
-- "automação: Beleza" com a mesma cor de uma pessoa.
--
-- ----------------------------------------------------------------------------
-- O que esta migration NÃO faz
-- ----------------------------------------------------------------------------
--
-- Não toca em tabela, não move dado e não altera nenhuma coluna existente. É um
-- `create or replace view` que acrescenta duas colunas ao fim da lista, as
-- anteriores seguem na mesma ordem, com o mesmo nome e o mesmo tipo, porque
-- `create or replace view` recusa mudar o que já existe.
--
-- Mensagem antiga, gravada antes de o autor existir, devolve `null` nas duas.
-- A tela já trata esse caso: `autorDoPayload` devolve `null` e a linha volta a
-- ser só o texto, como era antes desta migration.

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
  ultima.autor_nome as ultimo_autor_nome
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
) entrada on true;

-- Recriar a view **devolve os grants ao default do schema**, e desde a `0041`
-- esse default é fechado. Repetir o revoke aqui é o que a `0049` fez, e pelo
-- mesmo motivo: sem ele, uma view recriada pode voltar alcançável por
-- `anon`/`authenticated` se o default do projeto mudar de novo.
revoke all on public.leads from anon, authenticated;
grant select on public.leads to service_role;
