-- 0057 — mensagens agendadas, e a transcrição do áudio que chega
--
-- Duas coisas numa migration porque as duas são aditivas, nenhuma toca dado que
-- já existe, e as duas nascem do mesmo handoff de 15/set. Separá-las custaria
-- duas idas ao banco de produção compartilhado com a Verandi, que é justamente
-- o que se quer fazer menos vezes (ver docs/BANCO-COMPARTILHADO.md).
--
-- Nada aqui cita `app_verandi`, e todo objeto é qualificado com `public.`.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A fila de mensagens agendadas
-- ---------------------------------------------------------------------------
--
-- Tabela própria, e não mais um tipo em `public.tarefas`.
--
-- `tarefas` é fila de máquina: linha opaca, executada e esquecida. Isto aqui é
-- dado que a **pessoa** vê, lista, cancela e de quem cobra explicação quando
-- falha. Precisa de estado nomeado, do motivo do erro guardado, e de ser
-- contável por conta ("quantas agendadas temos?"). Enfiar isso num `dados jsonb`
-- de tarefa faria a tela ler o que ninguém deveria ler.
--
-- O disparo é o mesmo das tarefas — carona no webhook, cron como piso — porque
-- a Vercel no plano Hobby dispara cron uma vez por dia. Ver
-- `app/api/webhook/whatsapp/route.ts`.

create table if not exists public.mensagens_agendadas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clients (id) on delete cascade,
  contato_id  uuid not null references public.contacts (id) on delete cascade,
  texto       text not null,
  -- Quando mandar. `timestamptz` e não `timestamp`: quem agenda pode estar num
  -- fuso e o servidor em outro, e "amanhã às 9h" sem fuso é uma hora qualquer.
  quando      timestamptz not null,

  -- Quem agendou. Sem chave estrangeira de propósito: o AutoFluxos ainda não
  -- tem login individual (ver docs/BANCO-COMPARTILHADO.md), e `auth.users` é
  -- global ao projeto — apontar para lá amarraria esta tabela a um usuário que
  -- pode ser da Verandi. O nome fica junto para a bolha poder dizer quem
  -- mandou, sem depender de o usuário ainda existir quando ela sair.
  criada_por       uuid,
  criada_por_nome  text,
  criada_em        timestamptz not null default now(),

  -- 'agendada'  esperando a hora
  -- 'enviando'  alguém pegou e está mandando agora
  -- 'enviada'   saiu
  -- 'cancelada' a pessoa desistiu antes da hora
  -- 'falhou'    a Meta recusou; o motivo está em `erro`
  --
  -- `enviando` existe para duas passadas simultâneas não mandarem a mesma
  -- mensagem duas vezes: quem consegue mudar o estado é dono da linha, e isso é
  -- decidido pelo próprio `update` — não por uma leitura anterior, que sempre
  -- perde a corrida.
  estado      text not null default 'agendada'
              check (estado in ('agendada', 'enviando', 'enviada', 'cancelada', 'falhou')),
  pegada_em   timestamptz,
  enviada_em  timestamptz,

  -- O motivo da recusa, escrito como a Meta escreveu.
  --
  -- Quase toda falha aqui vai ser a mesma: a janela de 24h fechou entre o
  -- agendamento e a hora marcada, e texto livre passou a exigir modelo
  -- aprovado. Guardar o texto dela é o que faz a tela explicar em vez de dizer
  -- "não deu".
  erro        text
);

comment on table public.mensagens_agendadas is
  'Mensagens marcadas para sair depois. Dado de tela: a pessoa lista, cancela e lê o erro. O disparo pega carona no webhook, com o cron diário como piso.';

-- O índice do disparo: quem varre pergunta sempre "o que venceu e ainda não
-- saiu?". Parcial porque `enviada` e `cancelada` são a maioria das linhas com o
-- tempo, e nenhuma delas volta a ser olhada por esta consulta.
create index if not exists mensagens_agendadas_fila_idx
  on public.mensagens_agendadas (quando)
  where estado in ('agendada', 'enviando');

-- O índice da tela: o contador da barra de filtros conta por conta, não por
-- contato — e é ele que abre a lista de todas as agendadas.
create index if not exists mensagens_agendadas_da_conta_idx
  on public.mensagens_agendadas (cliente_id, estado, quando);

-- RLS ligada e sem política nenhuma, como o resto de `public` neste produto: só
-- o servidor toca, com a chave secreta. Ver a regra 6 de BANCO-COMPARTILHADO.md
-- — desde a 0041, objeto novo em `public` também nasce sem grant para `anon` e
-- `authenticated`, então isto aqui é a segunda camada e não a única.
alter table public.mensagens_agendadas enable row level security;

-- ---------------------------------------------------------------------------
-- 2. A transcrição do áudio recebido
-- ---------------------------------------------------------------------------
--
-- Coluna e não `payload`: a transcrição é **derivada**, cara de produzir e
-- pedida sob demanda. Guardá-la é o que impede cada rolagem da conversa de
-- virar uma linha na fatura do Gemini.
--
-- Anulável, e o `null` quer dizer "ninguém pediu ainda" — não "não deu". Áudio
-- sem cópia guardada nunca chega aqui: não há o que transcrever.

alter table public.messages
  add column if not exists transcricao text;

comment on column public.messages.transcricao is
  'O que o áudio diz, transcrito sob demanda pelo Gemini e guardado para não transcrever de novo. Null = ninguém pediu.';

-- O `notify` é necessário aqui, ao contrário da 0056: esta migration cria uma
-- tabela nova em `public`, que é schema exposto na Data API, e o servidor fala
-- com ela pelo PostgREST. Sem recarregar o cache, `from('mensagens_agendadas')`
-- responde 404 até a próxima reinicialização.
--
-- O cache é o mesmo dos dois produtos, e o reload é breve. É o mesmo movimento
-- que a 0052 fez.
notify pgrst, 'reload schema';
