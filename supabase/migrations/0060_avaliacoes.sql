-- 0060 — a nota vira histórico: pesquisa de satisfação (NPS/CSAT).
--
-- O fluxo de exemplo `src/exemplos/pesquisa-nps.ts` já pergunta a nota hoje, e
-- hoje ela cai em `contacts.campos` — um JSONB sem data, **sobrescrito na
-- segunda resposta**. Dá para perguntar; não dá para ter o número. Quem
-- respondeu 9 em março e 3 em setembro tem uma linha só dizendo 3, e a pergunta
-- que a pesquisa existe para responder — "estamos melhorando?" — não tem como
-- ser feita a um campo que só guarda a última vez.
--
-- Uma tabela resolve as três coisas que faltavam: a segunda resposta não apaga
-- a primeira, cada nota tem data própria, e a nota deixa de disputar espaço com
-- os campos que a equipe usa para outra coisa.
--
-- Aditivo como o 0058: nenhuma coluna existente muda, nada é reescrito, e
-- `contacts.campos` continua intacto — o bloco novo escreve aqui, e o fluxo
-- antigo que escreve lá continua funcionando como sempre funcionou. Nada aqui
-- cita `app_verandi`, e todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A tabela
-- ---------------------------------------------------------------------------
--
-- `nota` é `smallint` com `check 0..10`, e a faixa é a do NPS de propósito:
-- CSAT (1 a 5) cabe dentro dela, e o cálculo é que decide como ler. Duas
-- colunas — uma para NPS, outra para CSAT — fariam toda leitura começar
-- perguntando qual das duas olhar.
--
-- `comentario` separado da nota porque são dois fatos: quem dá 3 e não explica
-- ainda é um detrator, e o relatório precisa contá-lo. Nota sem comentário é o
-- caso comum, não a exceção.
--
-- `origem` distingue a pesquisa que saiu de um fluxo da que saiu quando alguém
-- clicou em "resolver" no Inbox. Sem isso, a média mistura quem foi atendido
-- por uma pessoa com quem só falou com o bot, e as duas notas não respondem a
-- mesma pergunta.
--
-- `atendente_id` sem chave estrangeira, pelo mesmo motivo de
-- `mensagens_agendadas.criada_por`: o AutoFluxos ainda não tem login individual
-- e `auth.users` é global ao projeto — apontar para lá amarraria esta tabela a
-- um usuário que pode ser da Verandi. Fica nulo quando a pesquisa saiu de um
-- fluxo, que é o caso em que não houve atendente nenhum.

create table if not exists public.avaliacoes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clients (id) on delete cascade,
  contato_id   uuid not null references public.contacts (id) on delete cascade,

  nota         smallint not null check (nota between 0 and 10),
  comentario   text,

  -- 'fluxo'       a pesquisa rodou dentro de uma automação
  -- 'atendimento' saiu quando alguém encerrou o atendimento no Inbox
  origem       text not null default 'fluxo'
               check (origem in ('fluxo', 'atendimento')),

  -- Quem atendeu, quando houve alguém. Ver a nota sobre `auth.users` acima.
  atendente_id uuid,

  -- De onde a nota veio, para a tela poder voltar à conversa que a gerou.
  -- Sem chave estrangeira para `sessions`: sessão é estado de execução e pode
  -- ser limpa, e perder a sessão não pode apagar a avaliação — ela é o
  -- registro, não a conversa.
  sessao_id    uuid,

  criada_em    timestamptz not null default now()
);

-- A leitura principal é "as notas deste cliente no período", que é o que o
-- cálculo de NPS e a série mensal fazem. O índice cobre as duas.
create index if not exists avaliacoes_cliente_idx
  on public.avaliacoes (cliente_id, criada_em desc);

-- A segunda leitura é a ficha: "o que essa pessoa já respondeu". É ela que
-- torna o histórico visível — o motivo desta tabela existir.
create index if not exists avaliacoes_contato_idx
  on public.avaliacoes (contato_id, criada_em desc);

alter table public.avaliacoes enable row level security;
revoke all on public.avaliacoes from anon, authenticated;

comment on table public.avaliacoes is
  'Notas de satisfação, com histórico. Substitui o contacts.campos como lugar da nota: a segunda resposta não apaga a primeira.';

comment on column public.avaliacoes.nota is
  'Faixa do NPS (0 a 10). CSAT (1 a 5) cabe aqui dentro; quem decide como ler é o cálculo.';

-- ---------------------------------------------------------------------------
-- 2. A visão mensal
-- ---------------------------------------------------------------------------
--
-- Segue o formato das outras `metricas_*` (0028): view com `security_invoker`,
-- agregada por mês no fuso de São Paulo, para o repo só ler e somar. O cálculo
-- do NPS fica **fora** daqui, em `repos/metricas.ts`, por uma razão prática:
-- promotor e detrator são definição de produto, e mudar uma definição num
-- arquivo TypeScript é um deploy — mudá-la numa view é uma migration contra o
-- banco que a Verandi divide.
--
-- O que a view entrega são as contagens cruas; quem as transforma em
-- "% promotores − % detratores" é o TypeScript.
--
-- `promotores`, `neutros` e `detratores` são os cortes oficiais do NPS:
-- 9–10, 7–8 e 0–6. Eles não são simétricos, e é assim mesmo — quem dá 7 não
-- está satisfeito, está apenas não reclamando.

create or replace view public.metricas_de_satisfacao
with (security_invoker = true) as
select
  a.cliente_id                                                  as client_id,
  date_trunc('month', a.criada_em at time zone 'America/Sao_Paulo')::date as mes,
  a.origem,
  count(*)::bigint                                              as respostas,
  count(*) filter (where a.nota >= 9)::bigint                    as promotores,
  count(*) filter (where a.nota between 7 and 8)::bigint         as neutros,
  count(*) filter (where a.nota <= 6)::bigint                    as detratores,
  -- A média entra junto porque é o CSAT quando a escala usada é a de
  -- satisfação. Numérica e não arredondada: quem formata é a tela.
  avg(a.nota)::numeric                                          as media,
  count(*) filter (where a.comentario is not null
                     and length(trim(a.comentario)) > 0)::bigint as comentarios
from public.avaliacoes a
group by 1, 2, 3;

comment on view public.metricas_de_satisfacao is
  'Notas por mês, cliente e origem. As contagens são cruas: quem calcula NPS e CSAT é repos/metricas.ts.';

-- A tabela e a view vivem em `public`, que é schema exposto na Data API, e o
-- servidor fala com elas pelo PostgREST. Sem recarregar o cache,
-- `from('avaliacoes')` responde 404 até a próxima reinicialização — e o cache é
-- o mesmo dos dois produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
