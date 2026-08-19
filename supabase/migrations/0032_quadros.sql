-- 0032 — quadros: a etapa em que cada contato está.
--
-- C1 (docs/PLANO-SISTEMA.md §3.4 e §5). É a maior superfície da Etapa C, e a
-- primeira decisão do plano é a que impede ela de virar outro produto:
--
-- > **cartão sempre aponta para um contato. Não existe cartão avulso** — senão
-- > em três meses temos duas listas de gente que divergem.
--
-- Este arquivo grava isso como chave estrangeira obrigatória, e não como
-- disciplina de quem for escrever a tela depois.
--
-- ---------------------------------------------------------------------------
-- Por que isto não é etiqueta com outro nome
-- ---------------------------------------------------------------------------
--
-- Etiqueta é **conjunto**: um contato tem zero ou muitas, sem ordem. Etapa é
-- **exclusiva e ordenada**: o contato está em uma, e as etapas têm um sentido de
-- avanço. É essa diferença que responde "quantos estão parados em Aula
-- agendada?", que a etiqueta não responde — e é ela que justifica a tela.
--
-- As duas convivem, e devem: "orçamento enviado" é um fato sobre a pessoa,
-- "aula agendada" é onde ela está no funil.

-- ---------------------------------------------------------------------------
-- 1. O quadro
-- ---------------------------------------------------------------------------

create table if not exists public.quadros (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);

create index if not exists quadros_conta_idx on public.quadros (client_id);

-- Dois quadros com o mesmo nome são dois seletores idênticos na tela e metade
-- dos contatos em cada um.
create unique index if not exists quadros_nome_unico_idx
  on public.quadros (client_id, lower(trim(nome)));

comment on table public.quadros is
  'Um funil desenhado. Vários por conta; o seletor só aparece quando há mais de um.';

alter table public.quadros enable row level security;
revoke all on public.quadros from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. As etapas
-- ---------------------------------------------------------------------------

create table if not exists public.quadro_colunas (
  id        uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),

  /**
   * A posição na tela.
   *
   * **Sem índice único**, de propósito. Trocar duas etapas de lugar é escrever
   * duas linhas, e com `unique` a primeira escrita já colide com a segunda
   * enquanto a transação não termina — o clássico "swap não passa sem valor
   * temporário". Empate é desempatado por `criado_em`, que é determinístico e
   * não exige coreografia nenhuma.
   */
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists quadro_colunas_idx on public.quadro_colunas (quadro_id, ordem);

-- Duas etapas com o mesmo nome no mesmo quadro são duas colunas idênticas, e
-- ninguém sabe para qual arrastar.
create unique index if not exists quadro_colunas_nome_unico_idx
  on public.quadro_colunas (quadro_id, lower(trim(nome)));

alter table public.quadro_colunas enable row level security;
revoke all on public.quadro_colunas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Os cartões
-- ---------------------------------------------------------------------------

create table if not exists public.quadro_cartoes (
  id         uuid primary key default gen_random_uuid(),
  quadro_id  uuid not null references public.quadros (id) on delete cascade,

  /**
   * `restrict`, e não `cascade`.
   *
   * Apagar uma etapa com gente dentro faria os cartões sumirem em silêncio, e
   * com eles a posição de cada pessoa no funil. É a mesma decisão de
   * `apagarFluxo` recusando fluxo ligado a um número: o caminho honesto é mover
   * os cartões primeiro, um ato deliberado, em vez de um efeito colateral de
   * "apagar aquela coluna ali".
   */
  coluna_id  uuid not null references public.quadro_colunas (id) on delete restrict,

  -- **O cartão É um contato.** Sem isto o quadro vira um CRM paralelo.
  contact_id uuid not null references public.contacts (id) on delete cascade,

  -- Redundante com o quadro, e de propósito: toda leitura por aqui filtra por
  -- conta, e a junção só para conferir o dono seria paga em toda abertura.
  client_id  uuid not null references public.clients (id) on delete cascade,

  /**
   * Desde quando este cartão está nesta etapa.
   *
   * É o campo que transforma o quadro de foto em ferramenta: "parado há 6 dias
   * em Aula agendada" é a única informação que faz alguém agir. Sem ele o
   * quadro mostra onde as pessoas estão e esconde quem foi esquecido, que é a
   * pergunta que importa.
   */
  entrou_na_coluna_em timestamptz not null default now(),
  criado_em  timestamptz not null default now()
);

create index if not exists quadro_cartoes_coluna_idx
  on public.quadro_cartoes (coluna_id, entrou_na_coluna_em);
create index if not exists quadro_cartoes_conta_idx on public.quadro_cartoes (client_id);
create index if not exists quadro_cartoes_contato_idx on public.quadro_cartoes (contact_id);

-- **Um cartão por contato em cada quadro.** A mesma pessoa em duas etapas ao
-- mesmo tempo é a ambiguidade que o quadro existe para não ter — e sem este
-- índice, dois cliques em "pôr no quadro" a criam.
create unique index if not exists quadro_cartoes_unico_idx
  on public.quadro_cartoes (quadro_id, contact_id);

comment on table public.quadro_cartoes is
  'Um contato numa etapa. `entrou_na_coluna_em` é o que responde quem está parado.';

alter table public.quadro_cartoes enable row level security;
revoke all on public.quadro_cartoes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mover o cartão
-- ---------------------------------------------------------------------------
--
-- Função porque **mover é duas escritas que não podem se separar**: a coluna e
-- o relógio da etapa. Feito em duas idas pelo PostgREST, uma falha no meio
-- deixaria o cartão na etapa nova com o relógio da antiga — e o quadro diria
-- "parado há 6 dias" sobre alguém que acabou de chegar ali.
--
-- O relógio **só reinicia quando a etapa muda de verdade**. Arrastar o cartão
-- de volta para onde ele já estava é um engano de mão, e zerar a espera por
-- causa dele apagaria justamente o número que denuncia o esquecimento.

create or replace function public.mover_cartao(
  p_cartao_id uuid,
  p_coluna_id uuid,
  p_client_id uuid
)
returns public.quadro_cartoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.quadro_cartoes;
begin
  -- A etapa de destino precisa ser **do mesmo quadro** do cartão. O id chega da
  -- tela, e sem esta conferência arrastar para o id de uma coluna de outro
  -- quadro moveria o cartão para fora do próprio funil.
  update public.quadro_cartoes c
     set coluna_id = p_coluna_id,
         entrou_na_coluna_em =
           case when c.coluna_id = p_coluna_id then c.entrou_na_coluna_em else now() end
   where c.id = p_cartao_id
     and c.client_id = p_client_id
     and exists (
       select 1 from public.quadro_colunas k
        where k.id = p_coluna_id and k.quadro_id = c.quadro_id
     )
  returning c.* into resultado;

  return resultado;
end;
$$;

revoke execute on function public.mover_cartao(uuid, uuid, uuid) from anon, authenticated;

notify pgrst, 'reload schema';
