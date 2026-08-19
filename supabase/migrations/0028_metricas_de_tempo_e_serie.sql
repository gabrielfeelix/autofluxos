-- 0028 — quanto tempo alguém esperou, e quantos chegaram por dia.
--
-- B3 (docs/PLANO-SISTEMA.md §3.1). O painel hoje entrega o funil do mês: quantas
-- conversas, quantas o bot resolveu, quantas esperam pessoa. Faltam as três
-- coisas que o print mostra e nós não temos: **métricas de tempo**,
-- **desempenho por pessoa** e **série diária**.
--
-- Tudo em view, e nenhuma tabela nova: os dados já existem em `messages`,
-- `handoffs` e `contacts`. Uma tabela de resumo seria uma segunda verdade que
-- diverge no dia em que um recálculo falhar no meio.

-- ---------------------------------------------------------------------------
-- 1. Quanto tempo até alguém responder, e até fechar
-- ---------------------------------------------------------------------------

-- **A mediana antes da média, e a tela mostra as duas.**
--
-- Média de tempo de resposta é a métrica que mente com mais frequência em
-- atendimento: uma conversa esquecida no fim de semana, sozinha, empurra a
-- média do mês inteiro para cima e faz parecer que o time é lento. A mediana
-- responde "quanto esperou o atendimento típico"; a média mostra que existe
-- cauda. Guardar só uma seria escolher entre esconder o problema e inventá-lo.
--
-- O relógio conta do **handoff** — o instante em que a conversa entrou na fila
-- — até a **primeira saída registrada depois dele**. Não conta da mensagem da
-- pessoa: o bot pode ter conversado dez minutos legitimamente antes de desistir,
-- e cobrar isso do time seria cobrar por trabalho que não era dele.
create or replace view public.metricas_de_tempo
with (security_invoker = true) as
with fila as (
  select
    c.client_id,
    h.id                                       as handoff_id,
    h.criado_em                                as entrou_em,
    h.resolvido_em,
    date_trunc('month', h.criado_em at time zone 'America/Sao_Paulo')::date as mes,
    (
      -- A primeira saída **depois** de a fila começar. `sessions` não serve de
      -- corte aqui porque a resposta pelo painel grava com a mesma sessão.
      select min(m.ts)
        from public.messages m
       where m.contact_id = c.id
         and m.direcao = 'saida'
         and m.ts > h.criado_em
    ) as respondida_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  join public.contacts c on c.id = s.contact_id
)
select
  client_id,
  mes,
  count(*)::bigint as entraram_na_fila,
  count(respondida_em)::bigint as responderam,
  count(resolvido_em)::bigint as fecharam,
  -- Em segundos, e inteiro: quem lê a tela quer "4 min", não uma fração.
  percentile_cont(0.5) within group (
    order by extract(epoch from (respondida_em - entrou_em))
  )::bigint as mediana_ate_responder,
  avg(extract(epoch from (respondida_em - entrou_em)))::bigint as media_ate_responder,
  percentile_cont(0.5) within group (
    order by extract(epoch from (resolvido_em - entrou_em))
  )::bigint as mediana_ate_fechar,
  avg(extract(epoch from (resolvido_em - entrou_em)))::bigint as media_ate_fechar
from fila
group by client_id, mes;

comment on view public.metricas_de_tempo is
  'Por mês: quantos entraram na fila e quanto esperaram até a primeira resposta e até o fechamento.';

revoke all on public.metricas_de_tempo from anon, authenticated;

-- O `min(m.ts)` acima varre as saídas do contato a partir de um instante. Sem
-- índice isso é varredura por handoff, e a tela do painel abre a cada visita.
create index if not exists messages_contato_saida_idx
  on public.messages (contact_id, ts)
  where direcao = 'saida';

-- ---------------------------------------------------------------------------
-- 2. A série diária
-- ---------------------------------------------------------------------------

-- O gráfico do print: contatos novos e conversas por dia. Duas perguntas, uma
-- view — elas aparecem no mesmo gráfico com um seletor, e separar em duas faria
-- a tela buscar duas vezes para desenhar um eixo só.
--
-- **O dia é o de São Paulo**, como em toda métrica daqui: uma conversa das 22h
-- de quinta não pode aparecer na sexta porque o servidor está em UTC.
create or replace view public.metricas_diarias
with (security_invoker = true) as
with contatos as (
  select
    c.client_id,
    (c.criado_em at time zone 'America/Sao_Paulo')::date as dia,
    count(*)::bigint as total
  from public.contacts c
  group by 1, 2
),
conversas as (
  select
    f.client_id,
    (s.criado_em at time zone 'America/Sao_Paulo')::date as dia,
    count(*)::bigint as total
  from public.sessions s
  join public.flow_versions fv on fv.id = s.flow_version_id
  join public.flows f on f.id = fv.flow_id
  group by 1, 2
),
filas as (
  select
    c.client_id,
    (h.criado_em at time zone 'America/Sao_Paulo')::date as dia,
    count(*)::bigint as total
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  join public.contacts c on c.id = s.contact_id
  group by 1, 2
)
select
  coalesce(ct.client_id, cv.client_id, fl.client_id) as client_id,
  coalesce(ct.dia, cv.dia, fl.dia)                   as dia,
  coalesce(ct.total, 0)                              as contatos_novos,
  coalesce(cv.total, 0)                              as conversas,
  coalesce(fl.total, 0)                              as foram_para_pessoa
from contatos ct
full outer join conversas cv on cv.client_id = ct.client_id and cv.dia = ct.dia
full outer join filas    fl on fl.client_id = coalesce(ct.client_id, cv.client_id)
                            and fl.dia      = coalesce(ct.dia, cv.dia);

comment on view public.metricas_diarias is
  'Contatos novos, conversas e idas para pessoa por dia de São Paulo. É a série do gráfico do painel.';

revoke all on public.metricas_diarias from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Desempenho por pessoa
-- ---------------------------------------------------------------------------

-- **Quem atendeu, e não quem estava logado.** A atribuição mora no contato
-- (`contacts.atribuido_a`, 0022), então "meus atendimentos" é uma pergunta que
-- o banco responde direto.
--
-- O que **não** entra aqui: tempo médio por pessoa. A responsabilidade pode
-- trocar de mãos no meio, e dividir a espera entre quem assumiu depois seria
-- cobrar de alguém o atraso de outro. O tempo é da conta; o volume é da pessoa.
create or replace view public.metricas_por_pessoa
with (security_invoker = true) as
select
  c.client_id,
  c.atribuido_a as usuario_id,
  date_trunc('month', h.criado_em at time zone 'America/Sao_Paulo')::date as mes,
  count(*)::bigint as atendimentos,
  count(h.resolvido_em)::bigint as fechados
from public.handoffs h
join public.sessions s on s.id = h.session_id
join public.contacts c on c.id = s.contact_id
where c.atribuido_a is not null
group by c.client_id, c.atribuido_a, mes;

comment on view public.metricas_por_pessoa is
  'Atendimentos e fechamentos por pessoa e mês. Volume é da pessoa; tempo é da conta.';

revoke all on public.metricas_por_pessoa from anon, authenticated;

notify pgrst, 'reload schema';
