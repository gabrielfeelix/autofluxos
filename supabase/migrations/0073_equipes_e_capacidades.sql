-- ---------------------------------------------------------------------------
-- 0073 — equipes e capacidades: o que cada um pode, dentro da empresa
-- ---------------------------------------------------------------------------
--
-- O buraco que esta migration começa a fechar
-- ---------------------------------------------------------------------------
--
-- O sistema tem **uma** fronteira de autorização: `sessao.ts` responde "esta
-- pessoa alcança esta empresa?", e ela está aplicada em 126 lugares. Funciona.
--
-- A pergunta seguinte não existia: **dentro da empresa, o que cada um pode?**
-- `acoes-crm.ts` tem dezoito ações e zero conferências de papel — medido, não
-- suposto. Qualquer `member` fecha negócio, lê receita e apaga funil igual ao
-- dono. É a RB-40, e o A19/A27 são os aceites.
--
-- Duas tabelas, e nenhuma coluna alterada
-- ---------------------------------------------------------------------------
--
--   1. `equipes` + `equipe_membros` — o escopo "da equipe" da RB-40
--   2. `membro_capacidades` — a sobrescrita por pessoa, que é o que deixa
--      "operador que também registra venda" existir sem inventar papel
--
-- `af_membros.role` **não muda**. Ela é do plugin de organização do Better
-- Auth, e mexer nela quebraria a biblioteca; o que passa a existir é uma
-- política por papel (em `core/permissoes.ts`) e a diferença por pessoa aqui.
--
-- O acesso de hoje é preservado
-- ---------------------------------------------------------------------------
--
-- Nenhuma linha nasce em `membro_capacidades`, e ausência quer dizer "usa a
-- política do papel". Como a política de `member` preserva o que ele faz hoje
-- (ver o comentário em `core/permissoes.ts`), **ninguém perde acesso neste
-- deploy** — que é a exigência literal da proposta: "não retirar acesso de
-- operadores em massa sem prévia".
--
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. As equipes
-- ---------------------------------------------------------------------------

create table if not exists public.equipes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome text not null,

  /**
   * Arquivada, e não apagada.
   *
   * Equipe some da escolha mas continua legível: há oportunidade, atividade e
   * histórico apontando para ela, e apagar em cascata transformaria "a equipe
   * Norte fechou isso" em "ninguém fechou isso" (RB-24).
   */
  arquivada_em timestamptz,

  criado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipes_nome_check') then
    alter table public.equipes
      add constraint equipes_nome_check check (length(trim(nome)) > 0);
  end if;
end $$;

-- Nome único **entre as ativas**: arquivar libera o nome, e duas equipes
-- "Vendas" vivas ao mesmo tempo é erro de digitação, não intenção.
create unique index if not exists equipes_nome_unico_idx
  on public.equipes (client_id, lower(trim(nome)))
  where arquivada_em is null;

create index if not exists equipes_da_conta_idx
  on public.equipes (client_id)
  where arquivada_em is null;

comment on table public.equipes is
  'Agrupamento de pessoas dentro de uma empresa. É o escopo "da equipe" da RB-40. Arquivada some da escolha e continua legível.';

-- ---------------------------------------------------------------------------
-- 2. Quem está em qual equipe
-- ---------------------------------------------------------------------------
--
-- Uma pessoa pode estar em mais de uma: o vendedor que cobre duas praças é
-- caso comum, e resolvê-lo com "crie um papel Norte-e-Sul" multiplicaria
-- papéis por combinação.

create table if not exists public.equipe_membros (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  usuario_id uuid not null references public.af_usuarios (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create unique index if not exists equipe_membros_unico_idx
  on public.equipe_membros (equipe_id, usuario_id);

create index if not exists equipe_membros_do_usuario_idx
  on public.equipe_membros (client_id, usuario_id);

comment on table public.equipe_membros is
  'Quem faz parte de qual equipe. Uma pessoa pode estar em mais de uma: o vendedor que cobre duas praças é caso comum.';

-- ---------------------------------------------------------------------------
-- 3. A sobrescrita por pessoa
-- ---------------------------------------------------------------------------
--
-- **Ausência é "usa a política do papel", e não "nenhum".**
--
-- É a decisão que faz esta migration não tirar acesso de ninguém: sem linha
-- aqui, a pessoa continua com exatamente o que o papel dela dá hoje. Se
-- ausência significasse negação, o deploy trancaria toda conta existente.

create table if not exists public.membro_capacidades (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  usuario_id uuid not null references public.af_usuarios (id) on delete cascade,

  /**
   * A capacidade e o escopo, como texto.
   *
   * Texto e não enum, pela mesma razão de `tarefas.tipo`: enum exigiria
   * migration a cada capacidade nova, e a lista fechada mora em
   * `core/permissoes.ts`, onde o TypeScript a cobra. O `check` aqui é a
   * segunda barreira — ele recusa lixo, sem pretender ser a fonte da verdade.
   */
  capacidade text not null,
  escopo text not null,

  /** Quem concedeu, e quando. Dar poder é ato auditável (RB-42). */
  autor uuid references public.af_usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'membro_capacidades_escopo_check') then
    alter table public.membro_capacidades
      add constraint membro_capacidades_escopo_check
      check (escopo in ('nenhum', 'proprios', 'equipe', 'todos'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'membro_capacidades_capacidade_check') then
    alter table public.membro_capacidades
      add constraint membro_capacidades_capacidade_check
      check (capacidade in (
        'configurar_empresa', 'configurar_operacao', 'atender',
        'criar_oportunidade', 'registrar_venda', 'corrigir_venda',
        'ler_valores', 'exportar'
      ));
  end if;
end $$;

-- Uma linha por (pessoa, capacidade) em cada empresa: a mesma capacidade com
-- dois escopos seria uma pergunta sem resposta.
create unique index if not exists membro_capacidades_unico_idx
  on public.membro_capacidades (client_id, usuario_id, capacidade);

comment on table public.membro_capacidades is
  'A diferença entre o que o papel dá e o que esta pessoa tem. AUSÊNCIA = usa a política do papel, nunca "nenhum" — é o que preserva o acesso atual (RB-40).';

drop trigger if exists membro_capacidades_tocar_atualizado_em on public.membro_capacidades;
create trigger membro_capacidades_tocar_atualizado_em
  before update on public.membro_capacidades
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- 4. Fechamento de acesso
-- ---------------------------------------------------------------------------
--
-- `public` está exposto na Data API e o projeto é dividido com a Verandi. Ver
-- docs/BANCO-COMPARTILHADO.md §6.

alter table public.equipes enable row level security;
revoke all on public.equipes from public, anon, authenticated;

alter table public.equipe_membros enable row level security;
revoke all on public.equipe_membros from public, anon, authenticated;

alter table public.membro_capacidades enable row level security;
revoke all on public.membro_capacidades from public, anon, authenticated;

notify pgrst, 'reload schema';
