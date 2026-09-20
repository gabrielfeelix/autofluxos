-- 0078: os critérios de qualificação, versionados, e a avaliação que guarda o que usou.
--
-- ---------------------------------------------------------------------------
-- Por que a avaliação guarda a versão, e não só o resultado
-- ---------------------------------------------------------------------------
--
-- Porque "alterar critérios não reescreve avaliações passadas" (7.3). Uma
-- avaliação é o que a regra **daquele dia** respondeu sobre os dados **daquele
-- dia**. Guardar só "não atende" faria o histórico passar a mentir no instante
-- em que alguém mudasse o critério: ninguém teria como explicar por que um lead
-- foi recusado em março, e a conclusão natural de quem olhasse seria que o
-- sistema errou.
--
-- Por isso a tabela guarda três coisas que normalmente se considera
-- redundância: a versão dos critérios, **os valores que foram considerados**, e
-- o resultado. Os valores são cópia do que estava em `contacts.campos` naquele
-- instante, e é cópia de propósito: o campo pode ser corrigido depois, e a
-- avaliação antiga continua explicável.
--
-- É a mesma decisão da `conclusoes_de_processo` da 0072, que guarda os nomes da
-- época, e pelo mesmo motivo.
--
-- ---------------------------------------------------------------------------
-- Uma avaliação por objetivo, e não uma por pessoa
-- ---------------------------------------------------------------------------
--
-- A mesma pessoa pode atender ao Plano Básico e não ao Premium, e as duas
-- respostas são verdadeiras ao mesmo tempo. Uma coluna `qualificado` em
-- `contacts` obrigaria a escolher uma delas, e rotularia a pessoa
-- permanentemente como desqualificada para tudo, que é o que a 7.3 proíbe
-- explicitamente.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Os critérios
-- ---------------------------------------------------------------------------

create table if not exists public.criterios_de_qualificacao (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  /** O objetivo a que estes critérios servem: um por processo/finalidade. */
  objetivo  text not null,

  /**
   * Sobe a cada publicação.
   *
   * A avaliação guarda este número, e é o que permite dizer "isto foi avaliado
   * pela regra v3" quando a conta já está na v7.
   */
  versao    integer not null default 1,

  modo      text not null default 'todas' check (modo in ('todas', 'qualquer')),

  /**
   * As condições, como `[{campo, operador, valor}]`.
   *
   * `jsonb` e não tabela filha: a regra é lida e escrita sempre inteira, nunca
   * condição a condição, e uma tabela filha tornaria "publicar a versão 4" uma
   * transação com N linhas para ganhar uma normalização que ninguém consulta.
   */
  condicoes jsonb not null default '[]'::jsonb,

  /**
   * Publicado, ou rascunho.
   *
   * A RB-22 exige que campos e valores estejam preenchidos **antes** de
   * publicar, e a conferência mora em `core/qualificacao.ts`
   * (`prontoParaPublicar`), porque é regra de produto e precisa ser testável
   * sem subir banco. Esta coluna é o efeito dela.
   */
  publicado boolean not null default false,

  criado_em timestamptz not null default now()
);

comment on table public.criterios_de_qualificacao is
  'Os criterios por objetivo. `versao` sobe a cada publicacao e viaja junto da avaliacao: alterar criterio nao reescreve avaliacao passada (7.3).';

create unique index if not exists criterios_objetivo_idx
  on public.criterios_de_qualificacao (client_id, objetivo);

alter table public.criterios_de_qualificacao enable row level security;

-- ---------------------------------------------------------------------------
-- As avaliações
-- ---------------------------------------------------------------------------

create table if not exists public.avaliacoes_de_qualificacao (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  contact_id  uuid not null references public.contacts (id) on delete cascade,

  /*
   * Sem chave estrangeira para `criterios_de_qualificacao`, e é decisão.
   *
   * Apagar um conjunto de critérios não pode apagar o histórico de quem foi
   * avaliado por ele: a avaliação continua sendo um fato que aconteceu, e
   * `objetivo` mais `criterios_versao` a explicam sem a linha original existir.
   * Mesma decisão do `template_id` da 0067.
   */
  criterios_id     uuid,
  criterios_versao integer not null,
  objetivo         text not null,

  resultado text not null check (resultado in (
    'nao_avaliado', 'incompleto', 'atende', 'nao_atende'
  )),

  /** Os motivos, em texto que a equipe lê. Vazio quando atende. */
  motivos   jsonb not null default '[]'::jsonb,
  /** As chaves que faltavam, e só as que podiam mudar o resultado. */
  faltam    jsonb not null default '[]'::jsonb,

  /**
   * Os valores considerados, congelados.
   *
   * Cópia do que estava em `contacts.campos` naquele instante, de propósito: o
   * campo pode ser corrigido depois, e sem isto a avaliação antiga passaria a
   * parecer errada. É o mesmo raciocínio do `titulo` congelado em `passagens`.
   */
  valores   jsonb not null default '{}'::jsonb,

  /** Quem pediu. `null` = foi o bot. */
  autor_id  uuid,
  criado_em timestamptz not null default now()
);

comment on table public.avaliacoes_de_qualificacao is
  'Uma linha por avaliacao. Reavaliar gera linha nova, nunca reescreve: a anterior e o que a regra da epoca respondeu. Uma pessoa pode atender a um objetivo e nao a outro, e as duas linhas convivem.';

/*
 * A pergunta real é "qual a última avaliação desta pessoa para este objetivo".
 * `objetivo` na chave, e não só o contato: sem ele, ler a última avaliação de
 * alguém traria a de outro objetivo e diria que a pessoa não atende a algo que
 * ninguém avaliou.
 */
create index if not exists avaliacoes_do_contato_idx
  on public.avaliacoes_de_qualificacao (contact_id, objetivo, criado_em desc);

alter table public.avaliacoes_de_qualificacao enable row level security;

-- As duas tabelas vivem em `public`, exposto na Data API, e o servidor as
-- alcança pelo PostgREST. Sem o reload, respondem 404 até a próxima
-- reinicialização. O cache é o mesmo dos dois produtos: quem aplicar em
-- produção confere a Verandi depois.
notify pgrst, 'reload schema';
