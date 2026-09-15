-- 0050 — por onde o lead já passou.
--
-- ---------------------------------------------------------------------------
-- O erro que esta migration corrige antes de existir em produção
-- ---------------------------------------------------------------------------
--
-- A primeira versão deste arquivo guardava só o **nome** dos anúncios, porque
-- o código tratava a origem como carimbo do contato: um campo gravado na
-- primeira mensagem e congelado para sempre. Havia até teste garantindo o
-- congelamento — quem chegou direto e depois clicou num anúncio continuava
-- "Direto".
--
-- Isso descarta informação verdadeira. Em tráfego pago o caso mais comum não é
-- o desconhecido que aparece: é o remarketing pegando **quem já falou com a
-- gente**. Alguém que veio pela campanha de agosto, sumiu, e voltou pela de
-- setembro passou por duas — e as duas aconteceram. Guardar uma só responde
-- "de onde veio?" e perde "por onde já passou?", que é a pergunta que explica
-- por que a pessoa está escrevendo hoje.
--
-- Então a origem deixa de ser atributo e vira **evento**: uma linha por
-- chegada. O contato continua sendo a entidade; a campanha é o meio por onde
-- ele chegou, daquela vez.
--
-- ---------------------------------------------------------------------------
-- Duas tabelas, porque são duas coisas
-- ---------------------------------------------------------------------------
--
-- `passagens` é **histórico**: aconteceu, tem data, não muda nunca. Uma linha
-- por vez que alguém chegou por um anúncio.
--
-- `anuncios` é **cache de nome**: o rótulo de agora daquele `ad_id`, buscado na
-- Marketing API. Renomear a campanha em outubro troca o rótulo e não reescreve
-- o que aconteceu em agosto — que é exatamente por que as duas não podem ser a
-- mesma tabela.
--
-- O `ad_id` liga as duas, e é a chave natural nos dois lados: `source_id` do
-- CTWA e `ad_id` do Lead Ads são o mesmo número, então o dia em que o
-- formulário nativo entrar, ele cai aqui sem tabela nova.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- O histórico
-- ---------------------------------------------------------------------------

create table if not exists public.passagens (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,

  -- **A passagem é do contato.** `cascade` porque apagar contato por LGPD tem
  -- de levar o histórico dele junto: uma linha dizendo "alguém veio da campanha
  -- X em agosto" sem dizer quem não serve a ninguém e ainda é dado pessoal por
  -- associação.
  contact_id uuid not null references public.contacts (id) on delete cascade,

  -- O anúncio da Meta. Vazio nunca: passagem sem anúncio não é passagem —
  -- quem chegou sem `referral` simplesmente não gera linha aqui.
  ad_id      text not null,

  /**
   * O que a Meta mandou **naquela** chegada, congelado.
   *
   * Parece redundante com `anuncios`, e não é: o criativo daquele dia pode ter
   * sido trocado, e o título que a pessoa de fato leu antes de clicar é este.
   * `anuncios` responde "como esse anúncio se chama hoje"; isto responde "o que
   * ela viu quando clicou". As duas perguntas têm respostas diferentes e as
   * duas importam.
   */
  titulo     text not null default '',
  texto      text not null default '',
  url        text not null default '',

  -- O id do clique (`ctwa_clid`). É o que fecha atribuição pela Conversions
  -- API. Sem uso hoje, guardado porque chega uma vez só e não volta — e porque
  -- anúncio de WhatsApp Status vem sem ele, então vazio é resposta legítima.
  clique     text not null default '',

  criado_em  timestamptz not null default now(),

  /**
   * O minuto da chegada, para a dedupe logo abaixo.
   *
   * É coluna gerada e não expressão no índice porque `date_trunc(text,
   * timestamptz)` depende do fuso da sessão e o Postgres a considera `stable`,
   * não `immutable` — índice com ela é recusado na cara dura (42P17). A versão
   * de dois argumentos com `timestamp` puro é imutável, então o `at time zone
   * 'utc'` aqui não é preciosismo de fuso: é o que torna a expressão indexável.
   */
  minuto     timestamp generated always as (date_trunc('minute', criado_em at time zone 'utc')) stored
);

comment on table public.passagens is
  'Uma linha por vez que um contato chegou por um anúncio. Histórico, não atributo: quem veio pela campanha X em agosto e pela Y em setembro tem duas. O título guardado é o que a pessoa leu naquele dia, que pode não ser o de hoje.';

-- A pergunta real é "por onde esta pessoa já passou", em ordem de chegada.
create index if not exists passagens_do_contato_idx
  on public.passagens (contact_id, criado_em desc);

-- E a de trás: "quem veio deste anúncio", para o dia em que houver relatório.
create index if not exists passagens_do_anuncio_idx
  on public.passagens (client_id, ad_id, criado_em desc);

/**
 * A mesma chegada não conta duas vezes.
 *
 * O webhook da Meta reentrega quando não recebe 200 a tempo, e `receberMensagem`
 * já deduplica por `wamid` — mas a dedupe dele protege a *mensagem*, não esta
 * tabela, e um retry que passe pelo caminho de criação gravaria a passagem de
 * novo. Sem isto, o histórico de alguém mostraria "veio da campanha X" três
 * vezes no mesmo minuto, e a tela diria que a pessoa clicou três vezes.
 *
 * A janela é o minuto da chegada: clicar duas vezes no mesmo anúncio em dias
 * diferentes **são** duas passagens e as duas devem aparecer.
 */
create unique index if not exists passagens_sem_repeticao_idx
  on public.passagens (contact_id, ad_id, minuto);

alter table public.passagens enable row level security;

-- ---------------------------------------------------------------------------
-- O cache de nome
-- ---------------------------------------------------------------------------

create table if not exists public.anuncios (
  ad_id        text not null,
  client_id    uuid not null references public.clients (id) on delete cascade,

  -- Os três níveis: o anúncio diz qual criativo, o conjunto diz qual público,
  -- a campanha diz qual objetivo. Vazio (e não nulo) porque "a Meta respondeu
  -- em branco" e "ainda não perguntei" já se distinguem pela linha existir.
  anuncio      text not null default '',
  conjunto     text not null default '',
  campanha     text not null default '',

  resolvido_em timestamptz not null default now(),
  criado_em    timestamptz not null default now(),

  primary key (client_id, ad_id)
);

comment on table public.anuncios is
  'Nome de campanha/conjunto/anúncio resolvido na Marketing API, por ad_id. É cache do rótulo de hoje; o que aconteceu está em passagens e não muda quando alguém renomeia a campanha.';

create index if not exists anuncios_frescor_idx
  on public.anuncios (client_id, resolvido_em desc);

alter table public.anuncios enable row level security;

notify pgrst, 'reload schema';
