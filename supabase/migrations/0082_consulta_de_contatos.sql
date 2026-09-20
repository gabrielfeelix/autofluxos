-- ---------------------------------------------------------------------------
-- 0082 — uma consulta para todas as superfícies
-- ---------------------------------------------------------------------------
--
-- O defeito medido, e por que ele precisa do Postgres
-- ---------------------------------------------------------------------------
--
-- Hoje a tela de contatos filtra por nível **em memória, sobre a página já
-- carregada** (`leads/page.tsx`, o `leads.filter(...)` depois de
-- `relacionamentoDeMuitos`), e o CSV é outro caminho que nem conhece esse
-- filtro. Duas superfícies, duas definições: quem filtra por Ouro e exporta
-- recebe todo mundo, e a contagem "3 de 50" é 3 daquela página, não da base.
--
-- A RB-37 exige lista, contagem, paginação e exportação com a **mesma**
-- definição, e os filtros calculados **antes** de paginar. Isso não é
-- alcançável em TypeScript: ordenar por valor gasto exige o total por contato,
-- que sai de um `group by` sobre `vendas`, e paginar sobre ele exige que o
-- Postgres saiba o valor antes do `limit`.
--
-- Esta migration cria a **view** que dá ao contato os números comerciais, e a
-- consulta passa a ser feita em cima dela.
--
-- RB-36: a mesma ocorrência
-- ---------------------------------------------------------------------------
--
-- "Oportunidade fria E aberta no processo X" tem que ser satisfeito pela
-- **mesma** negociação. A view NÃO resolve isso sozinha, e é importante dizer:
-- ela agrega por contato, então juntar temperatura e situação nela misturaria
-- negociações diferentes. Quem resolve é o `exists` correlacionado que
-- `server/consultas/contatos.ts` monta — uma subconsulta por grupo de
-- condições da mesma ocorrência, e não uma condição por coluna.
--
-- RB-35: o nulo é informação
-- ---------------------------------------------------------------------------
--
-- `ultima_compra_em` nula quer dizer **sem compra registrada com data
-- conhecida**, e isso é diferente de "faz muito tempo". "Cliente sem comprar
-- há 90 dias" não pode arrastar junto o importado que nunca teve histórico: a
-- view mantém o nulo, e a compilação de `ha_mais_de_dias` exige `is not null`
-- explicitamente.
--
-- Aditiva: uma view nova, nenhuma tabela alterada. Roda em `public`,
-- qualificado, sem tocar `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- A visão comercial de cada contato
-- ---------------------------------------------------------------------------
--
-- `security_invoker = true` porque a view encosta em dado de conta: sem isso
-- ela rodaria com os direitos de quem a criou, e o isolamento passaria a
-- depender de quem escreveu a consulta em vez do `client_id` dela. Mesma
-- decisão da `metricas_de_satisfacao` (0060) e da `leads` (0065).

create or replace view public.contatos_comerciais
with (security_invoker = true)
as
select
  c.id                as contact_id,
  c.client_id,
  c.wa_id             as telefone,
  coalesce(nullif(btrim(c.nome_real), ''), c.nome) as nome,
  c.nome              as nome_do_perfil,
  c.estagio,
  c.atribuido_a       as responsavel,
  c.ultima_mensagem_em,
  c.criado_em,
  c.campos,

  -- Só venda **válida** conta. Cancelada sai dos indicadores sem sumir do
  -- registro, que é a RB-31.
  coalesce(v.compras, 0)   as compras,
  -- O total **do que se sabe**. Não é "a receita": ver `vendas_sem_valor`.
  v.valor_conhecido,
  -- Quantas válidas não têm valor informado. A tela precisa poder dizer "há
  -- vendas sem valor informado" em vez de apresentar o total como se fosse
  -- tudo (RB-06).
  coalesce(v.sem_valor, 0) as vendas_sem_valor,
  -- Nula = sem compra com data conhecida. NÃO é "faz muito tempo" (RB-35).
  v.ultima_compra_em

from public.contacts c
left join lateral (
  select
    count(*)                             as compras,
    sum(vd.valor_total)                  as valor_conhecido,
    count(*) filter (where vd.valor_total is null) as sem_valor,
    max(vd.data_da_venda)                as ultima_compra_em
  from public.vendas vd
  where vd.contact_id = c.id
    and vd.client_id = c.client_id
    and vd.situacao = 'valida'
) v on true;

comment on view public.contatos_comerciais is
  'O contato com os numeros comerciais dele (T6.1). Uma linha por contato, para a lista, a '
  'contagem e o CSV usarem a mesma definicao (RB-37). valor_conhecido e ultima_compra_em nulos '
  'querem dizer NAO INFORMADO, e nao zero nem "faz muito tempo" (RB-35).';

-- `create or replace view` não redefine grants como um drop/create faria, mas
-- o revoke explícito fica aqui pelo mesmo motivo da 0065: é a linha que alguém
-- lê ao auditar, e não custa nada.
revoke all on public.contatos_comerciais from public, anon, authenticated;
grant select on public.contatos_comerciais to service_role;

-- ---------------------------------------------------------------------------
-- O PostgREST precisa enxergar a view nova
-- ---------------------------------------------------------------------------
--
-- `public` e schema exposto na Data API e o servidor le esta view pelo
-- PostgREST: sem recarregar, `from('contatos_comerciais')` responde 404. O
-- cache e o mesmo dos dois produtos, entao quem aplicar isto em producao
-- confere a Verandi depois, como a 0057, a 0060 e a 0065 registraram.

notify pgrst, 'reload schema';
