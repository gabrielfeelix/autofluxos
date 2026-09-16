-- 0059 — os modelos aprovados da Meta, e a transmissão que eles destravam
--
-- Duas tabelas numa migration porque uma não serve para nada sem a outra: o
-- template é o que a Meta aprova, a transmissão é o que a pessoa faz com ele.
-- Separá-las custaria duas idas ao banco de produção compartilhado com a
-- Verandi (ver docs/BANCO-COMPARTILHADO.md).
--
-- Nada aqui cita `app_verandi`, e todo objeto é qualificado com `public.`.
--
-- ---------------------------------------------------------------------------
-- Por que isto existe
-- ---------------------------------------------------------------------------
--
-- Fora da janela de 24h o WhatsApp recusa qualquer texto livre. A única coisa
-- que atravessa é um **modelo aprovado antes pela Meta** — o "template". Sem
-- ele não há lembrete de véspera, não há retomada de conversa e não há
-- transmissão. É por isso que `0031_sequencias.sql` nasceu com o teto de
-- `atraso_minutos <= 1440`: um passo agendado para depois de 24h cairia numa
-- conversa fechada. Esse teto sobe quando isto aqui estiver no ar.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Os modelos aprovados
-- ---------------------------------------------------------------------------
--
-- **O mesmo modelo lógico tem um id diferente em cada WABA.** A Meta não tem
-- biblioteca compartilhada entre contas: "confirmação de agendamento" criado
-- para 40 clientes são 40 templates, 40 aprovações e 40 ids. Por isso a chave
-- natural aqui é (cliente, nome, idioma) — e `waba_template_id` é o que a Meta
-- devolveu, guardado para poder conversar com ela depois.
--
-- Guardamos `componentes` como jsonb e não em colunas porque a forma é da Meta,
-- não nossa: header de texto aceita 1 variável, body aceita várias, botões têm
-- cinco tipos com tetos diferentes, e tudo isso muda quando eles mudam. Uma
-- coluna por campo viraria migration a cada mexida deles.

create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clients (id) on delete cascade,

  -- O nome na Meta. A regra é deles: só minúsculas, números e underscore.
  -- Conferida aqui porque a recusa deles vem tarde e sem explicação boa.
  --
  -- **O teto de 512 é conferido por `length`, e não dentro da regex.** O
  -- Postgres recusa repetição acima de **255** (`invalid repetition count(s)`),
  -- e `{1,512}` é uma bomba-relógio silenciosa: o `create table` passa, a
  -- tabela nasce com o `check` aparentemente certo, e o erro só aparece no
  -- primeiro `insert` — ou seja, em produção, no dia em que alguém criar o
  -- primeiro modelo. Foi pego no replay em Docker, que é para isso que ele
  -- existe.
  nome        text not null
              check (nome ~ '^[a-z0-9_]+$' and length(nome) between 1 and 512),

  -- `pt_BR` e afins. Texto livre: a lista de locales da Meta é grande e muda.
  idioma      text not null default 'pt_BR'
              check (length(idioma) between 2 and 10),

  -- MARKETING, UTILITY ou AUTHENTICATION.
  --
  -- **Não é escolha definitiva.** A Meta reclassifica sozinha quando acha que o
  -- conteúdo é promocional, e desde abr/2025 pode fazer isso sem os 24h de
  -- aviso para quem ela julga estar abusando. Como a categoria muda o **preço**
  -- da mensagem, guardamos o que ela diz, não o que pedimos — quem lê esta
  -- coluna está lendo a verdade atual, não a intenção original.
  categoria   text not null
              check (categoria in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),

  -- A forma do template, como a Meta a descreve: header, body, footer, buttons.
  componentes jsonb not null default '[]'::jsonb,

  -- O id que a Meta devolveu. Nulo enquanto não foi submetido.
  waba_template_id text,

  -- Onde está na revisão.
  --
  -- `rascunho` é nosso, não da Meta: é o template que a pessoa está escrevendo
  -- e ainda não mandou. Os outros espelham o que vem no webhook
  -- `message_template_status_update`.
  status      text not null default 'rascunho'
              check (status in (
                'rascunho',    -- nosso: ainda não foi submetido
                'pendente',    -- PENDING — em revisão
                'aprovado',    -- APPROVED — pode enviar
                'recusado',    -- REJECTED — ver motivo_recusa
                'pausado',     -- PAUSED — qualidade baixa, volta sozinho
                'desativado'   -- DISABLED — três strikes, não volta
              )),

  -- A nota de qualidade da Meta: GREEN, YELLOW, RED, UNKNOWN.
  -- Template sem nota verde entra em "pacing" (ver tabela de destinatários).
  qualidade   text
              check (qualidade is null
                     or qualidade in ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),

  -- Por que foi recusado, **em português e acionável**.
  --
  -- Quando o motivo é INVALID_FORMAT a Meta manda `rejection_info` com
  -- explicação e recomendação — é a melhor informação que ela dá em qualquer
  -- lugar da plataforma. Guardar isso inteiro e mostrar na tela é a diferença
  -- entre "recusado" e "recusado porque falta valor de exemplo na variável 2".
  motivo_recusa text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Um nome por idioma por cliente. A Meta aceita o mesmo nome em idiomas
  -- diferentes — é assim que se faz um template bilíngue.
  unique (cliente_id, nome, idioma)
);

create index if not exists templates_do_cliente
  on public.templates (cliente_id, status);

-- Achar o template pelo id da Meta quando o webhook chega. O webhook traz o id
-- dela, não o nosso.
create index if not exists templates_por_waba_id
  on public.templates (waba_template_id)
  where waba_template_id is not null;

-- ---------------------------------------------------------------------------
-- 2. As transmissões
-- ---------------------------------------------------------------------------
--
-- Uma transmissão é: um template, um público, um horário. O que ela **não** é:
-- uma fila de mensagens soltas. O público fica em `transmissao_destinatarios`
-- para que a tela possa dizer "3 de 400 entregues" sem contar linha de log.

create table if not exists public.transmissoes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clients (id) on delete cascade,

  nome         text not null check (length(trim(nome)) between 1 and 120),

  -- O template usado. `restrict` e não `cascade`: apagar um template que já foi
  -- transmitido apagaria o histórico de quem recebeu o quê, que é justamente o
  -- que se precisa guardar para responder reclamação.
  template_id  uuid not null references public.templates (id) on delete restrict,

  -- Os valores das variáveis, quando são fixos para todo o público
  -- (ex.: {{2}} = "15/10"). Variável que muda por pessoa (ex.: o nome) é
  -- resolvida na hora do envio, a partir do contato.
  parametros   jsonb not null default '{}'::jsonb,

  -- Quando disparar. Nulo = agora.
  quando       timestamptz,

  estado       text not null default 'rascunho'
               check (estado in (
                 'rascunho',
                 'agendada',
                 'enviando',
                 'concluida',
                 'cancelada',
                 'falhou'
               )),

  -- Quem mandou. Sem chave estrangeira pelo mesmo motivo de
  -- `mensagens_agendadas`: o AutoFluxos não tem login individual e
  -- `auth.users` é global ao projeto (ver docs/BANCO-COMPARTILHADO.md).
  criada_por      text,
  criada_por_nome text,

  criada_em    timestamptz not null default now(),
  comecou_em   timestamptz,
  terminou_em  timestamptz,
  erro         text
);

create index if not exists transmissoes_do_cliente
  on public.transmissoes (cliente_id, criada_em desc);

-- A fila de quem ainda tem que sair.
create index if not exists transmissoes_a_disparar
  on public.transmissoes (quando)
  where estado = 'agendada';

-- ---------------------------------------------------------------------------
-- 3. Quem recebeu, e o que aconteceu com cada um
-- ---------------------------------------------------------------------------
--
-- **A tabela mais importante desta migration, e a razão é o `retida`.**
--
-- A Meta responde 200 ao envio e devolve `message_status`, que tem três
-- valores: `accepted`, `held_for_quality_assessment` e `paused`. O segundo
-- significa que ela **segurou a mensagem** para avaliar a qualidade — de
-- template novo, de template sem nota verde, ou (desde 2026) de portfólio novo
-- com pouco histórico. Se o veredito for ruim, o template é pausado e **cada
-- mensagem retida é descartada**, com webhook `messages` trazendo
-- `status: failed` e `code: 132015`.
--
-- Quem olha só o 200 do POST mostra "campanha enviada" para o cliente e nada
-- saiu. Por isso `retida` é um estado de primeira classe aqui, e a tela tem
-- que saber dizê-lo: não é "enviado", é "a Meta está decidindo".
--
-- Mesma lição do contêiner GTM errado em 4yu-apps/CLAUDE.md: o console dizer
-- "publicado" não é evidência de que foi ao ar.

create table if not exists public.transmissao_destinatarios (
  id             uuid primary key default gen_random_uuid(),
  transmissao_id uuid not null references public.transmissoes (id) on delete cascade,
  contato_id     uuid not null references public.contacts (id) on delete cascade,

  estado         text not null default 'na_fila'
                 check (estado in (
                   'na_fila',   -- ainda não tentamos
                   'aceita',    -- a Meta aceitou: accepted
                   'retida',    -- held_for_quality_assessment — NÃO é entregue
                   'entregue',  -- webhook: delivered
                   'lida',      -- webhook: read (implica entregue, ver abaixo)
                   'falhou'     -- webhook: failed, com codigo_erro
                 )),

  -- O id da Meta para esta mensagem. É a chave que liga o webhook de status a
  -- esta linha — o webhook não sabe nada de transmissão.
  wamid          text,

  -- O código de erro da Meta, quando falhou. Guardado cru porque a política de
  -- retry depende dele e as classes são incompatíveis entre si:
  --
  --   130429, 80007, 131057 → transitório, vale tentar de novo com backoff
  --   131026                → terminal para este contato, nunca repetir
  --   131049                → limite por usuário, esperar 24h (repetir antes
  --                           suspende o destinatário por mais 24h)
  --   132000, 132012        → bug nosso no payload, retry só repete o erro
  --   132015                → o template foi pausado e esta mensagem morreu
  codigo_erro    integer,
  erro           text,

  enviada_em     timestamptz,
  atualizada_em  timestamptz not null default now(),

  -- Ninguém recebe a mesma transmissão duas vezes.
  unique (transmissao_id, contato_id)
);

create index if not exists destinatarios_da_transmissao
  on public.transmissao_destinatarios (transmissao_id, estado);

-- O webhook de status chega com o wamid e mais nada. Sem este índice, cada
-- confirmação de entrega varreria a tabela inteira.
create index if not exists destinatarios_por_wamid
  on public.transmissao_destinatarios (wamid)
  where wamid is not null;

-- ---------------------------------------------------------------------------
-- 4. O consentimento
-- ---------------------------------------------------------------------------
--
-- A Meta exige opt-in antes de marketing, e desde nov/2024 ele **pode ser
-- genérico** — não precisa mencionar o WhatsApp, desde que cumpra a lei local.
-- O opt-out precisa ser **por categoria**, não um "parar tudo" só.
--
-- **Guardamos o texto exibido, e não um booleano**, porque a LGPD cobra prova e
-- um booleano não prova nada. O texto do aceite muda com o tempo; sem gravar
-- qual estava na tela naquele dia, não há como demonstrar o que a pessoa leu.

create table if not exists public.consentimentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clients (id) on delete cascade,
  contato_id  uuid not null references public.contacts (id) on delete cascade,

  -- Que tipo de mensagem foi aceito. Espelha as categorias da Meta, porque é
  -- por elas que o opt-out tem que ser granular.
  categoria   text not null default 'MARKETING'
              check (categoria in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),

  aceito      boolean not null,

  -- Onde a pessoa disse sim (ou não): 'fluxo', 'importacao', 'site', 'manual'.
  origem      text not null,

  -- **O texto exato que estava na tela.** É isto que transforma o registro em
  -- prova. Nulo quando a origem é importação de base antiga — e nesse caso o
  -- cliente é quem responde pela legalidade do que importou.
  texto_exibido text,

  criado_em   timestamptz not null default now()
);

-- A pergunta que o disparo faz antes de cada envio: "esta pessoa aceitou esta
-- categoria?". A resposta é a linha mais recente.
create index if not exists consentimento_do_contato
  on public.consentimentos (contato_id, categoria, criado_em desc);

-- ---------------------------------------------------------------------------
-- 6. RLS e permissões
-- ---------------------------------------------------------------------------
--
-- **Ligar RLS aqui não é enfeite, é a camada que as outras 40 tabelas já têm.**
-- O schema `public` está exposto na Data API (o `db_schema` do PostgREST é
-- `public,graphql_public,app_verandi`), então "exposto" nunca foi teórico — ver
-- docs/BANCO-COMPARTILHADO.md, §6.
--
-- RLS ligada e **zero políticas** é o desenho do AutoFluxos inteiro: só o
-- servidor acessa, com a chave secreta, que ignora RLS. Sem política, qualquer
-- outro papel não lê nem escreve nada.
--
-- O `revoke` é a segunda camada, e é a que fecha de verdade — o default da
-- `0041` já faz objeto novo nascer fechado, mas escrever aqui é o que mantém a
-- migration verdadeira se ela for replayada num banco sem aquele default.
--
-- `transmissao_destinatarios` guarda telefone de gente por tabelagem, e
-- `consentimentos` guarda prova de LGPD: são as duas que mais doeriam abertas.

alter table public.templates enable row level security;
revoke all on public.templates from anon, authenticated;

alter table public.transmissoes enable row level security;
revoke all on public.transmissoes from anon, authenticated;

alter table public.transmissao_destinatarios enable row level security;
revoke all on public.transmissao_destinatarios from anon, authenticated;

alter table public.consentimentos enable row level security;
revoke all on public.consentimentos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. O cache do PostgREST
-- ---------------------------------------------------------------------------
--
-- Quatro tabelas novas em `public`, que é schema exposto na Data API, e o
-- servidor fala com elas pelo PostgREST: sem recarregar o cache,
-- `from('templates')` responde **404** até a próxima reinicialização.
--
-- O cache é o mesmo dos dois produtos. O reload é breve, mas depois dele vale
-- conferir que `app_verandi` continua respondendo — recarregá-lo sem olhar o
-- outro lado é apostar a API da Verandi num movimento nosso.

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. `atualizado_em` que se mantém sozinho
-- ---------------------------------------------------------------------------

-- **Não redefinir `tocar_atualizado_em`.** Ela já existe desde a 0001, com
-- `security invoker` e `set search_path = ''`, e é usada por gatilho em quase
-- toda tabela do banco. Um `create or replace` aqui sem essas duas cláusulas
-- não daria erro nenhum — ele **apagaria a proteção em silêncio**, para todas
-- as tabelas de uma vez, e num banco de produção compartilhado com a Verandi
-- (ver docs/BANCO-COMPARTILHADO.md).
--
-- Function sem `search_path` fixo é o vetor clássico de escalonamento no
-- Postgres: quem consegue criar objeto num schema que esteja à frente no
-- caminho de busca faz a function chamar o código dele. Por isso aqui só se
-- **usa** a função que já está lá.

drop trigger if exists templates_tocar on public.templates;
create trigger templates_tocar
  before update on public.templates
  for each row execute function public.tocar_atualizado_em();
