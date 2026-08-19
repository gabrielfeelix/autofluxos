-- 0031 — sequências: o acompanhamento que acontece sozinho.
--
-- É a peça que o agendador (0026) existia para sustentar e que faltava desenhar
-- (docs/HANDOFF.md §8.1). O produto sabia responder e sabia cobrar um prazo de
-- pergunta; não sabia **voltar** a falar com quem parou.
--
-- ---------------------------------------------------------------------------
-- A verdade desconfortável que este arquivo grava: a janela de 24h
-- ---------------------------------------------------------------------------
--
-- A Meta só deixa mandar texto livre dentro de 24h contadas da última mensagem
-- **da pessoa**. E uma inscrição sai da sequência assim que ela responde — que
-- é a regra que impede a sequência de virar spam. Somando as duas, o prazo útil
-- de uma sequência é o que restar das 24h no instante em que ela começa.
--
-- Isso não é limitação de implementação: é a plataforma. Fingir o contrário
-- seria deixar o cliente desenhar "3 dias depois" e não entregar nada, sem
-- ninguém entender por quê. Por isso `atraso_minutos` tem teto de 1440, o mesmo
-- de `timeoutMinutos` na pergunta e pelo mesmo motivo — e o executor confere a
-- janela **de novo** na hora de entregar, porque o relógio corre entre agendar
-- e mandar. Quando os modelos aprovados da Meta existirem (Etapa C), o teto
-- sobe; até lá ele é honesto.
--
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. A sequência
-- ---------------------------------------------------------------------------

create table if not exists public.sequencias (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),

  /**
   * O que põe alguém dentro dela.
   *
   * Texto e não enum, pelo mesmo motivo de `tarefas.tipo`: a lista fechada mora
   * em `core/sequencias.ts` e cresce sem migration. O `check` aqui é o piso —
   * ele impede lixo, não substitui a lista.
   *
   * Dois eventos, e os dois são **deliberados**: alguém da equipe encerrou um
   * atendimento, ou alguém aplicou uma etiqueta. Contato criado ficou de fora
   * de propósito — quem acabou de chegar já está dentro de um fluxo de entrada,
   * e uma sequência por cima disputaria a mesma conversa.
   */
  evento    text not null check (evento in ('atendimento_encerrado', 'etiqueta_aplicada')),

  -- Qual etiqueta dispara, quando o evento é `etiqueta_aplicada`.
  -- `on delete cascade` seria apagar a sequência junto com a etiqueta; aqui a
  -- etiqueta é a condição, e sequência sem condição é sequência quebrada — por
  -- isso `restrict`, e a tela de etiquetas explica antes de recusar.
  etiqueta_id uuid references public.etiquetas (id) on delete restrict,

  /**
   * A etiqueta que **tira** alguém da sequência.
   *
   * É o "virou cliente, pode parar de cobrar". Sem ela, a única saída é a
   * pessoa responder — e há o caso em que ela fecha por telefone, por outro
   * canal, ou pessoalmente. Continuar mandando aí é o jeito mais rápido de o
   * cliente desligar a automação inteira.
   *
   * `set null` porque a sequência continua fazendo sentido sem ela.
   */
  etiqueta_de_saida_id uuid references public.etiquetas (id) on delete set null,

  ativa     boolean not null default true,
  criado_em timestamptz not null default now(),

  -- Evento de etiqueta sem etiqueta é uma sequência que nunca dispara e que a
  -- tela mostraria como ativa. O banco recusa antes de a tela precisar explicar.
  constraint sequencias_etiqueta_coerente
    check ((evento = 'etiqueta_aplicada') = (etiqueta_id is not null))
);

create index if not exists sequencias_conta_idx on public.sequencias (client_id);
create index if not exists sequencias_etiqueta_idx
  on public.sequencias (etiqueta_id) where etiqueta_id is not null;

comment on table public.sequencias is
  'Acompanhamento automático depois de um evento. Sai quem responde, quem é atendido ou quem ganha a etiqueta de saída.';

alter table public.sequencias enable row level security;
revoke all on public.sequencias from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Os passos
-- ---------------------------------------------------------------------------

create table if not exists public.sequencia_passos (
  id           uuid primary key default gen_random_uuid(),
  sequencia_id uuid not null references public.sequencias (id) on delete cascade,

  /**
   * Quanto tempo **depois do evento**, e não depois do passo anterior.
   *
   * Offset absoluto porque é o que dá para conferir contra a janela de 24h sem
   * somar nada: "20h depois" ou cabe ou não cabe. Encadeado, o mesmo desenho
   * exigiria somar a régua inteira para descobrir que o último passo é
   * inalcançável — e o erro só apareceria com gente de verdade esperando.
   */
  atraso_minutos integer not null check (atraso_minutos between 1 and 1440),

  -- O fluxo que este passo abre. `cascade` seria apagar o passo junto com o
  -- fluxo em silêncio; `apagarFluxo` já recusa apagar fluxo em uso, e passa a
  -- olhar aqui também.
  flow_id      uuid not null references public.flows (id) on delete restrict,
  criado_em    timestamptz not null default now()
);

create index if not exists sequencia_passos_idx
  on public.sequencia_passos (sequencia_id, atraso_minutos);

-- Dois passos no mesmo minuto são duas mensagens ao mesmo tempo no WhatsApp de
-- alguém, e nenhuma ordem definida entre elas.
create unique index if not exists sequencia_passos_unicos_idx
  on public.sequencia_passos (sequencia_id, atraso_minutos);

alter table public.sequencia_passos enable row level security;
revoke all on public.sequencia_passos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Quem está dentro
-- ---------------------------------------------------------------------------

create table if not exists public.sequencia_inscricoes (
  id           uuid primary key default gen_random_uuid(),
  sequencia_id uuid not null references public.sequencias (id) on delete cascade,
  contact_id   uuid not null references public.contacts (id) on delete cascade,

  -- Redundante com a sequência, e de propósito: toda leitura por aqui filtra
  -- por conta, e a junção só para conferir o dono seria paga em toda passada
  -- do agendador.
  client_id    uuid not null references public.clients (id) on delete cascade,

  /**
   * `ativa` é quem ainda vai receber; `concluida` percorreu tudo; `saiu` foi
   * embora por um dos motivos previstos; `bloqueada` é a janela de 24h fechada.
   *
   * `bloqueada` é estado próprio e não um `saiu` com motivo, porque responde a
   * uma pergunta diferente na tela: `saiu` é a sequência funcionando (a pessoa
   * respondeu, alguém atendeu), `bloqueada` é a sequência **não entregando**.
   * Misturar os dois esconderia o número que diz se vale a pena encurtar os
   * prazos.
   */
  estado       text not null default 'ativa'
               check (estado in ('ativa', 'concluida', 'saiu', 'bloqueada')),
  motivo       text,

  -- Quantos passos já saíram. É o índice do próximo na lista ordenada.
  passo_atual  integer not null default 0,

  entrou_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists sequencia_inscricoes_conta_idx
  on public.sequencia_inscricoes (client_id, sequencia_id);
create index if not exists sequencia_inscricoes_contato_idx
  on public.sequencia_inscricoes (contact_id) where estado = 'ativa';

-- **Uma inscrição ativa por (sequência, contato).** Sem isto, aplicar a mesma
-- etiqueta duas vezes na mesma pessoa a inscreveria duas vezes, e ela receberia
-- a sequência inteira em dobro — defeito que só aparece com gente de verdade.
-- Parcial porque o histórico precisa poder ter várias passagens da mesma
-- pessoa pela mesma sequência ao longo do tempo.
create unique index if not exists sequencia_inscricoes_unica_idx
  on public.sequencia_inscricoes (sequencia_id, contact_id) where estado = 'ativa';

comment on table public.sequencia_inscricoes is
  'Quem está percorrendo uma sequência. `bloqueada` = a janela de 24h da Meta fechou antes do passo.';

alter table public.sequencia_inscricoes enable row level security;
revoke all on public.sequencia_inscricoes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sair da sequência
-- ---------------------------------------------------------------------------
--
-- Função e não `update` do PostgREST porque a saída acontece no caminho quente
-- — toda mensagem que chega tira o remetente das sequências dele — e ali cada
-- viagem ao banco custa. Uma chamada resolve todas as inscrições do contato.
--
-- Devolve os ids para quem chama poder cancelar as tarefas agendadas de cada
-- uma. Se não cancelasse, a tarefa acordaria, leria a inscrição já morta e
-- seria ignorada — correto, mas ao custo de uma passada do agendador por
-- inscrição, todo dia, para nada.

create or replace function public.sair_das_sequencias(
  p_contato_id uuid,
  p_motivo text
)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.sequencia_inscricoes
     set estado = 'saiu',
         motivo = p_motivo,
         atualizado_em = now()
   where contact_id = p_contato_id
     and estado = 'ativa'
  returning id;
$$;

revoke execute on function public.sair_das_sequencias(uuid, text) from anon, authenticated;

notify pgrst, 'reload schema';
