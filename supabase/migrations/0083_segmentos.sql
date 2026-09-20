-- ---------------------------------------------------------------------------
-- 0083 — o segmento salvo, que não é visão e não é lista de envio
-- ---------------------------------------------------------------------------
--
-- RB-38: três objetos diferentes, e confundi-los é o erro clássico
-- ---------------------------------------------------------------------------
--
--   1. **visão salva**  — filtros e colunas do trabalho **pessoal** de alguém.
--      Não existe ainda, e não é criada aqui.
--   2. **segmento**     — regra reutilizável e **dinâmica**, compartilhada na
--      conta. É esta tabela. "Clientes sem comprar há 90 dias" hoje devolve um
--      conjunto, e amanhã devolve outro, porque a regra é a mesma e o mundo
--      mudou.
--   3. **lista materializada do envio** — `transmissao_destinatarios` (0059),
--      congelada no instante da confirmação, para rastreabilidade.
--
-- A confusão que custa caro é entre 2 e 3: se a transmissão guardasse o
-- **segmento** em vez da lista, editar a regra depois de confirmar mudaria
-- quem recebe. A RB-38 é explícita: "editar o segmento depois de confirmar não
-- aumenta o lote". Por isso `transmissoes` ganha `segmento_id` apenas como
-- **procedência** (de onde esta lista saiu), e nunca como fonte do público no
-- momento do envio.
--
-- O que NÃO está aqui
-- ---------------------------------------------------------------------------
--
-- Nenhuma coluna de "quem pode receber". Estar no segmento **não autoriza
-- mensagem** (RB-39): a elegibilidade é do canal, da janela e dos bloqueios, e
-- é revalidada pelo worker no instante do envio. Guardá-la aqui a congelaria
-- num instante em que ela ainda era verdadeira.
--
-- A regra mora em `jsonb` porque ela é uma árvore validada por
-- `core/segmentos.ts` antes de entrar, e porque colunas fixas obrigariam uma
-- migration a cada operador novo. O que impede lixo ali não é o banco: é a
-- validação, que recusa campo e operador fora da lista.
--
-- Aditiva. Roda em `public`, qualificado, sem tocar `app_verandi`.

set search_path = public, extensions;

create table if not exists public.segmentos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  nome text not null,
  descricao text,

  -- A árvore validada por core/segmentos.ts. Ver o comentário acima sobre por
  -- que jsonb e não colunas.
  regra jsonb not null default '{"juncao":"todas","condicoes":[]}'::jsonb,

  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'segmentos_nome_check') then
    alter table public.segmentos
      add constraint segmentos_nome_check check (length(trim(nome)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'segmentos_regra_check') then
    alter table public.segmentos
      add constraint segmentos_regra_check check (jsonb_typeof(regra) = 'object');
  end if;
end $$;

create unique index if not exists segmentos_nome_unico_idx
  on public.segmentos (client_id, lower(trim(nome)));

comment on table public.segmentos is
  'Regra dinamica e compartilhada (RB-38). NAO e visao pessoal e NAO e lista de envio: a lista '
  'do envio e transmissao_destinatarios, congelada na confirmacao. Estar no segmento nao '
  'autoriza mensagem (RB-39).';

alter table public.segmentos enable row level security;
revoke all on public.segmentos from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A procedência da transmissão
-- ---------------------------------------------------------------------------
--
-- `on delete set null`: apagar o segmento não pode apagar nem alterar uma
-- transmissão que já saiu. A lista dela continua sendo a verdade do que foi
-- enviado, e perder a procedência é aceitável; perder o registro não é.

alter table public.transmissoes
  add column if not exists segmento_id uuid references public.segmentos (id) on delete set null;

comment on column public.transmissoes.segmento_id is
  'De onde a lista saiu, para leitura. NUNCA a fonte do publico no envio: o publico e '
  'transmissao_destinatarios, congelado na confirmacao (RB-38).';

-- ---------------------------------------------------------------------------
-- Por que o destinatário ganha motivo de exclusão
-- ---------------------------------------------------------------------------
--
-- A RB-39 pede que a prévia separe "total correspondente, elegível e excluído
-- **por motivo**", e que o worker revalide no instante do envio. Quando a
-- revalidação recusa alguém que já estava na lista, o motivo precisa sobrar
-- escrito: sem ele, a transmissão termina com 40 enviados e 12 sumidos, e
-- ninguém sabe se foi bloqueio, janela ou defeito.

alter table public.transmissao_destinatarios
  add column if not exists motivo_da_exclusao text;

comment on column public.transmissao_destinatarios.motivo_da_exclusao is
  'Por que este destinatario nao recebeu, quando a revalidacao do envio o recusou (RB-39).';

notify pgrst, 'reload schema';
