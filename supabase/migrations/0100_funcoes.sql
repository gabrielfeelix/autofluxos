-- 0100: funções de verdade (A7 do plano da administração de 24/09).
--
-- Cria `public.funcoes` (Proprietário, Administrador, Gestor, Atendente), com
-- nível e capacidades editáveis pela administração, e `af_membros.funcao_id`,
-- que diz a função de cada pessoa em cada organização.
--
-- **Ninguém ganha nem perde acesso nesta migration.** A política de cada
-- pessoa depois dela é igual à de antes, capacidade por capacidade:
--
--   - `owner` vira Proprietário e `admin` vira Administrador (as duas funções
--     têm a mesma política dos dois papéis);
--   - `member` é classificado pelo que ele de fato alcança (a mesma regra de
--     `funcaoDerivada` em `src/core/funcoes.ts`): cabe no Atendente, é
--     Atendente; cabe no Gestor, é Gestor; passa disso, é Administrador (o
--     plano decidiu assim para o `member` sem exceção);
--   - onde a política da função nova difere do que o `member` tinha, a
--     diferença vira **exceção** em `membro_capacidades` (as mesmas exceções
--     que a tela "Ajustar acesso desta pessoa" já edita). O caso comum é o
--     `member` que vira Administrador e mantém "não configura a organização"
--     e "não corrige venda".
--
-- O código funciona sem esta migration (as funções caem para os papéis de
-- hoje, `server/repos/funcoes.ts`) e com ela. Só `public`; não toca
-- `app_verandi`, Auth nem Storage. `af_membros` é tabela nossa (plugin de
-- organização do Better Auth, prefixo af_) e ganha uma coluna anulável.

set search_path = public, extensions;

create table if not exists public.funcoes (
  id text primary key check (id in ('proprietario', 'administrador', 'gestor', 'atendente')),
  nome text not null check (length(trim(nome)) between 1 and 40),
  nivel integer not null unique check (nivel between 1 and 4),
  descricao text not null default '',
  capacidades jsonb not null check (jsonb_typeof(capacidades) = 'object'),
  atualizado_em timestamptz not null default now()
);

comment on table public.funcoes is
  'As funções das organizações e o que cada uma pode. O nível decide a hierarquia (quem mexe em quem) e não é editável. Sem esta tabela o código usa src/core/funcoes.ts.';

alter table public.funcoes enable row level security;
revoke all on table public.funcoes from public, anon, authenticated;
grant select, insert, update, delete on table public.funcoes to service_role;

insert into public.funcoes (id, nome, nivel, descricao, capacidades) values
  ('proprietario', 'Proprietário', 4, 'Dono da organização. Faz tudo, inclusive passar a posse adiante.',
   '{"configurar_empresa":"todos","configurar_operacao":"todos","atender":"todos","criar_oportunidade":"todos","registrar_venda":"todos","corrigir_venda":"todos","ler_valores":"todos","exportar":"todos"}'),
  ('administrador', 'Administrador', 3, 'Faz tudo na organização, menos mexer no proprietário.',
   '{"configurar_empresa":"todos","configurar_operacao":"todos","atender":"todos","criar_oportunidade":"todos","registrar_venda":"todos","corrigir_venda":"todos","ler_valores":"todos","exportar":"todos"}'),
  ('gestor', 'Gestor', 2, 'Cuida da equipe dele: vê e atende as conversas da equipe e promove atendentes.',
   '{"configurar_empresa":"nenhum","configurar_operacao":"todos","atender":"equipe","criar_oportunidade":"equipe","registrar_venda":"equipe","corrigir_venda":"nenhum","ler_valores":"equipe","exportar":"nenhum"}'),
  ('atendente', 'Atendente', 1, 'Atende as conversas dele e as que estão sem dono.',
   '{"configurar_empresa":"nenhum","configurar_operacao":"nenhum","atender":"proprios","criar_oportunidade":"proprios","registrar_venda":"nenhum","corrigir_venda":"nenhum","ler_valores":"nenhum","exportar":"nenhum"}')
on conflict (id) do nothing;

alter table public.af_membros
  add column if not exists funcao_id text references public.funcoes(id) on delete set null;

comment on column public.af_membros.funcao_id is
  'A função da pessoa nesta organização (public.funcoes). Nula = derivada do role e das exceções, como antes da 0100.';

-- A classificação e as exceções, numa passada só, para quem ainda não tem função.
with
  ordem(escopo, alcance) as (values ('nenhum', 0), ('proprios', 1), ('equipe', 2), ('todos', 3)),
  politica_member(capacidade, escopo) as (values
    ('configurar_empresa', 'nenhum'), ('configurar_operacao', 'todos'), ('atender', 'todos'),
    ('criar_oportunidade', 'todos'), ('registrar_venda', 'todos'), ('corrigir_venda', 'nenhum'),
    ('ler_valores', 'todos'), ('exportar', 'todos')),
  efetiva as (
    select m."organizationId" as client_id, m."userId" as usuario_id, p.capacidade,
           coalesce(mc.escopo, p.escopo) as escopo
      from public.af_membros m
      cross join politica_member p
      left join public.membro_capacidades mc
        on mc.client_id = m."organizationId" and mc.usuario_id = m."userId" and mc.capacidade = p.capacidade
     where m."role" = 'member' and m.funcao_id is null
  ),
  cabe as (
    select e.client_id, e.usuario_id,
           bool_and(oe.alcance <= oa.alcance) as no_atendente,
           bool_and(oe.alcance <= og.alcance) as no_gestor
      from efetiva e
      join ordem oe on oe.escopo = e.escopo
      join public.funcoes fa on fa.id = 'atendente'
      join ordem oa on oa.escopo = fa.capacidades ->> e.capacidade
      join public.funcoes fg on fg.id = 'gestor'
      join ordem og on og.escopo = fg.capacidades ->> e.capacidade
     group by e.client_id, e.usuario_id
  ),
  classificado as (
    select client_id, usuario_id,
           case when no_atendente then 'atendente' when no_gestor then 'gestor' else 'administrador' end as funcao
      from cabe
  ),
  excecoes as (
    insert into public.membro_capacidades (client_id, usuario_id, capacidade, escopo)
    select e.client_id, e.usuario_id, e.capacidade, e.escopo
      from efetiva e
      join classificado c on c.client_id = e.client_id and c.usuario_id = e.usuario_id
      join public.funcoes f on f.id = c.funcao
     where f.capacidades ->> e.capacidade <> e.escopo
    on conflict (client_id, usuario_id, capacidade) do nothing
    returning 1
  )
update public.af_membros m
   set funcao_id = c.funcao
  from classificado c
 where m."organizationId" = c.client_id and m."userId" = c.usuario_id and m.funcao_id is null;

update public.af_membros set funcao_id = 'proprietario' where "role" = 'owner' and funcao_id is null;
update public.af_membros set funcao_id = 'administrador' where "role" = 'admin' and funcao_id is null;

notify pgrst, 'reload schema';
