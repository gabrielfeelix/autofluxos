-- 0026 — o agendador: fazer alguma coisa acontecer **depois**.
--
-- B1 (docs/PLANO-SISTEMA.md §5). Hoje o produto inteiro é reativo: tudo que
-- acontece acontece porque uma mensagem chegou. Sequência, transmissão e
-- timeout de pergunta são a mesma peça faltando — alguém precisa acordar
-- sozinho e continuar uma conversa que ninguém tocou.
--
-- Uma tabela e uma função. O resto — quem executa cada tipo de tarefa — é
-- código, e mora em `server/tarefas/`.

-- ---------------------------------------------------------------------------
-- 1. A fila
-- ---------------------------------------------------------------------------

create table if not exists public.tarefas (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- O que fazer. Texto e não enum: enum no Postgres exige migration para cada
  -- tipo novo, e tipo de tarefa é justamente o que mais vai crescer. Quem sabe
  -- os valores válidos é `core/tarefas.ts`, e o executor recusa o que não
  -- conhece em vez de estourar.
  tipo      text not null check (length(trim(tipo)) > 0),
  -- A partir de quando ela pode rodar. Não é "vai rodar exatamente às";
  -- o cron passa de tempos em tempos e pega o que já venceu.
  quando    timestamptz not null,
  dados     jsonb not null default '{}'::jsonb,

  /**
   * A chave que impede a mesma tarefa duas vezes.
   *
   * Sem ela, um fluxo que repergunta agendaria um segundo timeout e a pessoa
   * receberia a cobrança duas vezes — e o defeito só apareceria com uma pessoa
   * de verdade do outro lado. Com ela, agendar de novo **substitui**: é sempre
   * a última intenção que vale.
   *
   * Nula é permitida de propósito: nem toda tarefa tem identidade natural, e
   * um índice único parcial (`where chave is not null`) deixa as duas coisas
   * conviverem sem inventar chave falsa.
   */
  chave     text,

  estado    text not null default 'pendente'
            check (estado in ('pendente', 'rodando', 'feita', 'falhou', 'cancelada')),
  tentativas integer not null default 0,
  -- O que deu errado da última vez. É o que responde "por que essa fila parou"
  -- sem precisar do log da Vercel, que expira.
  erro      text,
  criado_em timestamptz not null default now(),
  rodou_em  timestamptz
);

-- A consulta do cron: o que já venceu, mais antigo primeiro. Parcial porque
-- tarefa feita é a esmagadora maioria das linhas depois de uma semana, e ela
-- nunca mais entra em consulta nenhuma.
create index if not exists tarefas_pendentes_idx
  on public.tarefas (quando)
  where estado = 'pendente';

create unique index if not exists tarefas_chave_unica_idx
  on public.tarefas (chave)
  where chave is not null and estado = 'pendente';

create index if not exists tarefas_conta_idx on public.tarefas (client_id);

comment on table public.tarefas is
  'Fila de coisas para fazer depois. O cron de /api/manutencao/tarefas a consome.';

alter table public.tarefas enable row level security;
revoke all on public.tarefas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pegar a vez sem duas execuções
-- ---------------------------------------------------------------------------

-- **`for update skip locked` é o ponto inteiro desta função.**
--
-- Ler as pendentes e depois marcá-las como `rodando` em duas idas ao banco é
-- correto exatamente até duas invocações do cron se sobreporem — o que
-- acontece sozinho quando uma passada demora mais que o intervalo, e é
-- justamente a passada grande, a que tem mais tarefa para executar. As duas
-- leriam a mesma fila, e a pessoa receberia a mesma mensagem duas vezes.
--
-- `skip locked` faz a segunda invocação **pular** o que a primeira já pegou em
-- vez de esperar por ele. Esperar seria a outra forma de errar: o cron da
-- Vercel tem teto de tempo, e uma passada bloqueada morre sem fazer nada.
create or replace function public.pegar_tarefas(p_limite integer)
returns setof public.tarefas
language sql
security invoker
set search_path = ''
as $$
  update public.tarefas t
     set estado = 'rodando',
         tentativas = t.tentativas + 1,
         rodou_em = now()
   where t.id in (
     select f.id
       from public.tarefas f
      where f.estado = 'pendente'
        and f.quando <= now()
      order by f.quando
      limit greatest(p_limite, 0)
      for update skip locked
   )
  returning t.*;
$$;

revoke execute on function public.pegar_tarefas(integer) from anon, authenticated;

notify pgrst, 'reload schema';
