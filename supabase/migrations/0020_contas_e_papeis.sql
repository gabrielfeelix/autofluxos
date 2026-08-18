-- 0020 — `clients` vira a conta, com membros e papéis.
--
-- **A decisão central: `clients` É a organização do Better Auth, não uma tabela
-- ao lado dela.** O plugin criaria uma `organization` própria, e aceitar isso
-- deixaria duas tabelas para o mesmo conceito — a nossa, para onde apontam
-- `flows`, `contacts`, `channels`, `connections` e `messages`, e a dele, para
-- onde apontariam membros e convites. Duas listas de conta que divergem em três
-- meses é exatamente o problema que a 0018 acabou de resolver com o nome do
-- contato. `modelName` aponta o plugin para cá e o assunto se encerra.
--
-- O preço é acrescentar duas colunas que são dele (`slug`, `metadata`) numa
-- tabela nossa. É barato perto de manter um mapa entre duas identidades.
--
-- **Multi-companhia entra aqui, não depois** (print 24, `+ Adicionar nova
-- companhia`): `af_membros` é usuário × conta, então um usuário em duas contas
-- é duas linhas, e `af_sessoes."activeOrganizationId"` guarda em qual ele está
-- agora. Adaptar isso depois seria refazer o modelo.
--
-- Ver docs/PLANO-SISTEMA.md §4 e §2.1.

-- ---------------------------------------------------------------------------
-- 1. `clients` ganha o que o plugin espera
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists slug     text,
  add column if not exists metadata text;

-- Preenche o slug de quem já existe antes de exigir que ele exista. Sem acento,
-- sem espaço, minúsculo — é o que vai virar endereço.
update public.clients
set slug = regexp_replace(
      lower(translate(
        nome,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
where slug is null;

-- Desempate para nomes que colidem depois de normalizados ("MGM Pilates" e
-- "mgm-pilates" viram o mesmo slug). O sufixo é o começo do id, que já é único.
update public.clients c
set slug = c.slug || '-' || left(c.id::text, 4)
where exists (
  select 1 from public.clients outro
  where outro.slug = c.slug and outro.id <> c.id
);

update public.clients set slug = 'conta-' || left(id::text, 8) where slug is null or slug = '';

alter table public.clients alter column slug set not null;

create unique index if not exists clients_slug_idx on public.clients (slug);

-- O slug se preenche sozinho quando ninguém manda um.
--
-- Existem **dois** caminhos que criam conta: o Better Auth (que manda slug,
-- porque o plugin exige) e o nosso `criarCliente` (que não sabia da coluna e
-- passou a estourar `not-null` no instante em que ela nasceu — 33 testes caíram
-- de uma vez). Resolver só no repositório deixaria o próximo caminho quebrar do
-- mesmo jeito; a garantia mora aqui, onde nenhum chamador escapa dela.
--
-- `security definer` com `search_path` fixo é a regra da casa para função que o
-- banco executa sozinho (ver BANCO-COMPARTILHADO.md).
create or replace function public.preencher_slug_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base text;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  base := regexp_replace(
    lower(translate(
      coalesce(new.nome, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )),
    '[^a-z0-9]+', '-', 'g'
  );
  base := trim(both '-' from base);
  if base = '' then base := 'conta'; end if;

  -- Sufixo sempre, e não só na colisão: descobrir se colidiu exigiria consultar
  -- a tabela dentro do gatilho, e duas contas criadas no mesmo instante
  -- passariam as duas pela consulta antes de qualquer uma gravar.
  new.slug := left(base, 40) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6);
  return new;
end;
$$;

revoke all on function public.preencher_slug_do_cliente() from public, anon, authenticated;

drop trigger if exists clients_slug on public.clients;
create trigger clients_slug
  before insert on public.clients
  for each row execute function public.preencher_slug_do_cliente();

comment on column public.clients.slug is
  'Identificador legível da conta, usado em endereço. Único. Preenchido a partir do nome na 0020.';
comment on column public.clients.metadata is
  'Campo livre do plugin de organização do Better Auth. Não usar para dado de domínio — para isso existem colunas.';

-- ---------------------------------------------------------------------------
-- 2. Quem pertence a qual conta, e com qual papel
-- ---------------------------------------------------------------------------

-- Tudo em uuid, e por dois motivos que se somam. `"organizationId"` aponta para
-- `clients.id`, que é uuid desde a 0001, então text quebraria no casamento de
-- tipos. E `src/server/auth.ts` usa `generateId: 'uuid'`, que significa **o
-- banco gera** — daí o `default gen_random_uuid()` em cada chave.
create table if not exists public.af_membros (
  "id"             uuid not null primary key default gen_random_uuid(),
  "organizationId" uuid not null references public.clients ("id") on delete cascade,
  "userId"         uuid not null references public.af_usuarios ("id") on delete cascade,
  -- `owner` (dono da conta), `admin`, `member`. O papel de **plataforma** — quem
  -- é administrador da 4YU — mora em `af_usuarios.role` e não se confunde com
  -- este: um dono é `owner` da conta dele e não administra o sistema.
  "role"           text not null,
  "createdAt"      timestamptz not null default current_timestamp
);

-- Uma pessoa não entra duas vezes na mesma conta. Sem isto, convidar de novo
-- alguém que já é membro cria uma segunda linha e o papel dela vira sorteio.
create unique index if not exists af_membros_conta_usuario_idx
  on public.af_membros ("organizationId", "userId");
create index if not exists af_membros_usuario_idx on public.af_membros ("userId");

create table if not exists public.af_convites (
  "id"             uuid not null primary key default gen_random_uuid(),
  "organizationId" uuid not null references public.clients ("id") on delete cascade,
  "email"          text not null,
  "role"           text,
  "status"         text not null,
  "expiresAt"      timestamptz not null,
  "createdAt"      timestamptz not null default current_timestamp,
  "inviterId"      uuid not null references public.af_usuarios ("id") on delete cascade
);

create index if not exists af_convites_conta_idx on public.af_convites ("organizationId");
create index if not exists af_convites_email_idx on public.af_convites ("email");

-- ---------------------------------------------------------------------------
-- 3. A sessão passa a saber em qual conta a pessoa está
-- ---------------------------------------------------------------------------

-- Guardar a conta ativa **na sessão** e não num cookie próprio é o que faz o
-- "entrar como" e a troca de companhia serem a mesma mecânica: trocar de conta
-- é escrever aqui, e o servidor nunca precisa acreditar no navegador.
alter table public.af_sessoes
  add column if not exists "activeOrganizationId" uuid
    references public.clients ("id") on delete set null;

comment on column public.af_sessoes."activeOrganizationId" is
  'Conta que esta sessão está vendo agora. Nulo = nenhuma escolhida ainda.';

-- ---------------------------------------------------------------------------
-- 4. Fechamento
-- ---------------------------------------------------------------------------

alter table public.af_membros  enable row level security;
alter table public.af_convites enable row level security;

revoke all on public.af_membros  from anon, authenticated;
revoke all on public.af_convites from anon, authenticated;

notify pgrst, 'reload schema';
