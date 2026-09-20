-- ---------------------------------------------------------------------------
-- 0086 — transferência prevista não é transferência por falha
-- ---------------------------------------------------------------------------
--
-- O defeito medido, e ele está na tela de início de todo cliente
-- ---------------------------------------------------------------------------
--
-- O painel diz "o bot resolveu 26% das conversas", e esse número sai de
-- `src/server/repos/metricas.ts`, em quatro linhas:
--
--     medidas.conversas += total
--     if (status = 'encerrada') medidas.resolvidasPeloBot += total
--     if (status = 'humano')    medidas.esperandoPessoa   += total
--
-- Três coisas erradas ao mesmo tempo:
--
--  1. **toda transferência conta igual.** Um fluxo que termina em "falar com a
--     recepção" porque foi desenhado assim, e uma conversa que caiu no colo de
--     alguém porque a integração da agenda estava fora, somam no mesmo lugar. O
--     primeiro é o produto funcionando; o segundo é defeito de produção. Juntos,
--     o número não responde nem "a automação está boa?" nem "o que quebrou?";
--  2. **`atendida_por_pessoa` some.** A view já classifica esse desfecho desde a
--     0011, e o TypeScript o ignora: ele entra em `conversas` e em fatia
--     nenhuma. As partes não fecham com o todo, e ninguém percebe;
--  3. **`esperandoPessoa` conta quem espera AGORA**, ao lado de "conversas do
--     mês". É somar estoque com fluxo: no dia 1º o número é sempre quase zero.
--
-- A RB-06 amarra os três: "o bot resolveu 26%" afirma um fato sobre os outros
-- 74%, e afirmar isso sem saber é o que a T8.2 veio impedir.
--
-- Por que precisa de coluna, e não dá para deduzir do `motivo`
-- ---------------------------------------------------------------------------
--
-- `handoffs.motivo` é **texto livre escrito para gente ler**, e os três pontos
-- que gravam handoff hoje escrevem frases:
--
--     receber-mensagem.ts:582   'a conversa ficou presa e a mensagem não foi processada'
--     receber-mensagem.ts:1308  o motivo da falha de entrega, ou 'o fluxo pediu IA e não há modelo'
--     receber-mensagem.ts:1563  o motivo que QUEM MONTOU O FLUXO escreveu no bloco
--
-- Só o terceiro é transferência prevista, e ele é justamente o único cujo texto
-- é arbitrário: quem monta o fluxo escreve o que quiser. Classificar por
-- palavra-chave erraria nos dois sentidos, e o exemplo é real: "a integração não
-- chegou a ser executada" (falha nossa) e "o cliente quer falar sobre a
-- integração" (bloco previsto) casariam no mesmo `like`.
--
-- A lista fechada vive em `src/core/desfecho-da-conversa.ts`, e o `check` aqui é
-- a mesma lista no banco: campo de classificação sem `check` vira campo com
-- cinco grafias da mesma coisa em seis meses.
--
-- O que acontece com o que já está gravado
-- ---------------------------------------------------------------------------
--
-- A coluna nasce **anulável, sem default e sem backfill**, e isso é decisão e
-- não preguiça.
--
-- Um default (`'falha'` ou `'prevista'`) escreveria uma classificação inventada
-- em cima de registro histórico, e a primeira coisa que este produto não faz é
-- afirmar o que não sabe. Nulo quer dizer **"gravado antes de o produto saber
-- distinguir"**, que é a verdade.
--
-- Quem lê trata nulo como `falha`, e a escolha está explicada no core: chamar de
-- prevista inflaria "está tudo funcionando" com o que pode ter sido defeito, e
-- esconder defeito de produção é o erro caro. Contar como falha, no pior caso,
-- gasta o tempo de quem vai investigar. A fatia só encolhe a partir daqui.
--
-- Aditiva: uma coluna anulável e uma view nova. Nenhuma tabela reescrita,
-- nenhum dado alterado. Roda em `public`, qualificado, sem tocar `app_verandi`.
-- Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. De onde veio a transferência
-- ---------------------------------------------------------------------------

alter table public.handoffs
  add column if not exists origem text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'handoffs_origem_check'
  ) then
    alter table public.handoffs
      add constraint handoffs_origem_check
      check (origem is null or origem in ('prevista', 'falha'));
  end if;
end $$;

comment on column public.handoffs.origem is
  'De quem foi a decisao de chamar gente: prevista (o bloco do fluxo mandou) ou '
  'falha (o bot nao conseguiu seguir). NULO quer dizer gravado antes da 0086, e '
  'nao "nao se aplica": quem le trata como falha, e o porque esta em '
  'src/core/desfecho-da-conversa.ts.';

-- ---------------------------------------------------------------------------
-- 2. A conversa com o desfecho dela
-- ---------------------------------------------------------------------------
--
-- Uma view nova em vez de mexer na `metricas_sessoes` da 0011, por dois
-- motivos. O primeiro é de escopo: a `metricas_sessoes` alimenta também a lista
-- de automações (`contarExecucoesPorFluxo`), que quer contagem por fluxo e não
-- tem nada com desfecho; trocar a forma dela mexeria nos dois de uma vez. O
-- segundo é de segurança do deploy: enquanto esta migration e o push não se
-- encontram, a view antiga continua respondendo o que o código publicado espera.
--
-- `security_invoker = true` porque a view encosta em dado de conta, como a
-- `metricas_sessoes`, a `contatos_comerciais` (0082) e a `leads` (0065): sem
-- isso ela rodaria com os direitos de quem a criou, e o isolamento passaria a
-- depender de quem escreveu a consulta em vez do `client_id` dela.

create or replace view public.metricas_de_desfecho
with (security_invoker = true)
as
with com_handoff as (
  select
    s.id,
    s.flow_version_id,
    s.criado_em,
    s.status,
    -- O **primeiro** handoff da sessão manda, e não o último.
    --
    -- Uma conversa pode ter mais de um: o fluxo transfere para a recepção
    -- (prevista), a pessoa devolve para o bot, e depois a entrega falha
    -- (falha). O que a métrica quer saber é por que o bot parou de resolver
    -- sozinho, e isso aconteceu da primeira vez.
    (
      select h.origem
      from public.handoffs h
      where h.session_id = s.id
      order by h.criado_em asc
      limit 1
    ) as origem,
    exists (select 1 from public.handoffs h where h.session_id = s.id) as teve_handoff
  from public.sessions s
)
select
  f.client_id,
  fv.flow_id,
  date_trunc('month', s.criado_em at time zone 'America/Sao_Paulo')::date as mes,
  case
    -- Encerrada sem nunca ter passado por gente: o bot resolveu sozinho.
    when s.status = 'encerrada' and not s.teve_handoff then 'bot'
    -- Passou por gente. A origem decide a fatia, e nulo cai em `falha`: e a
    -- mesma regra de `desfechoDe`, escrita aqui porque a view tambem e lida
    -- por quem consulta o banco direto.
    when s.teve_handoff or s.status = 'humano' then
      case when s.origem = 'prevista' then 'prevista' else 'falha' end
    -- `ativa`, e qualquer status que venha a existir: nao terminou, e contar
    -- um desfecho desconhecido como resolvido e afirmar o que nao se sabe.
    else 'aberta'
  end as desfecho,
  count(*)::bigint as total
from com_handoff s
join public.flow_versions fv on fv.id = s.flow_version_id
join public.flows f on f.id = fv.flow_id
group by f.client_id, fv.flow_id, mes, 4;

comment on view public.metricas_de_desfecho is
  'Conversas por cliente, fluxo, mes de Sao Paulo e desfecho (bot, prevista, falha, aberta). '
  'As quatro fatias SOMAM o total, de proposito: painel cujas partes nao fecham com o todo e '
  'painel que ninguem consegue conferir. Ver src/core/desfecho-da-conversa.ts.';

revoke all on public.metricas_de_desfecho from public, anon, authenticated;
grant select on public.metricas_de_desfecho to service_role;

-- ---------------------------------------------------------------------------
-- O cache do PostgREST
-- ---------------------------------------------------------------------------
--
-- `public` e schema exposto na Data API e o servidor le pelo PostgREST: sem o
-- reload, `from('metricas_de_desfecho')` responde 404 e
-- `handoffs.select('origem')` responde 400 ate a proxima reinicializacao. O
-- cache e o mesmo dos dois produtos: conferir a Verandi depois.

notify pgrst, 'reload schema';
