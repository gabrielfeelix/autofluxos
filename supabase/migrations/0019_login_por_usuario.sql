-- 0019 — as tabelas de login do Better Auth.
--
-- Primeira migration da Etapa A (docs/PLANO-SISTEMA.md §5). Ela não muda nada
-- do que já existe: só cria as quatro tabelas que o Better Auth precisa, mais
-- os campos do plugin `admin`. A senha única do painel continua funcionando até
-- a 0020 ligar usuário a conta.
--
-- **Por que Better Auth e não Supabase Auth** (§4.1): `auth.users`, SMTP e URLs
-- de redirect são **globais** ao projeto compartilhado com a Verandi. Toda
-- mudança de login do AutoFluxos viraria mudança a avaliar nos dois produtos.
-- Estas tabelas moram em `public`, que é território nosso, e nunca encostam em
-- `auth.users`.
--
-- **Por que o prefixo `af_`:** Storage e Postgres são compartilhados, e `user`
-- ou `session` soltos em `public` são convite a colisão. O bucket `logos`
-- nasceu sem prefixo e hoje não dá para renomear sem quebrar toda `logo_url`
-- gravada — aqui a gente não repete o erro.
--
-- **Por que as colunas estão em camelCase**, ao contrário de todo o resto do
-- banco: são o contrato do Better Auth, e ele monta as consultas sozinho.
-- Renomear cada uma com `fields` seria manter um mapa inteiro para ganhar
-- consistência cosmética e perder toda atualização da biblioteca. A fronteira
-- do estilo é a mesma que já existe em `core/flow/schema.ts` com o React Flow.
--
-- O schema sai de `scripts/schema-do-auth.mjs`, que lê o runtime instalado, e
-- depois é ajustado à mão para qualificar com `public.`, ligar RLS e revogar
-- acesso — a biblioteca não conhece nossas regras.

create table if not exists public.af_usuarios (
  "id"            text not null primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" boolean not null,
  "image"         text,
  "createdAt"     timestamptz not null default current_timestamp,
  "updatedAt"     timestamptz not null default current_timestamp,
  -- Campos do plugin `admin`. `role` aqui é o papel **de plataforma**
  -- (administrador da 4YU); o papel dentro de uma conta de cliente é outra
  -- coisa e entra na 0020, com o plugin de organização.
  "role"          text,
  "banned"        boolean,
  "banReason"     text,
  "banExpires"    timestamptz
);

create table if not exists public.af_sessoes (
  "id"        text not null primary key,
  "expiresAt" timestamptz not null,
  "token"     text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references public.af_usuarios ("id") on delete cascade,
  -- O "entrar como". Preenchido = esta sessão é de um administrador vendo a
  -- conta de outra pessoa, e é o que a faixa no topo da tela lê para avisar.
  -- Guardar isto **na sessão** é o que torna a auditoria confiável: não existe
  -- caminho para agir na conta de alguém sem a linha existir.
  "impersonatedBy" text
);

create table if not exists public.af_contas (
  "id"                    text not null primary key,
  -- `issuer` não estava aqui na primeira escrita desta migration, e o motivo
  -- vale registrar: o schema veio do `@better-auth/cli`, que na data era 1.4.21
  -- enquanto o runtime instalado é 1.7.0. O CLI é publicado à parte e fica para
  -- trás. **A fonte da verdade é o runtime**, e `scripts/schema-do-auth.mjs`
  -- extrai o schema direto dele com `getAuthTables` — use aquilo ao atualizar a
  -- biblioteca, não o CLI.
  "issuer"                text not null,
  "accountId"             text not null,
  "providerId"            text not null,
  "userId"                text not null references public.af_usuarios ("id") on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  -- Hash da senha, não a senha. Quem grava é o Better Auth.
  "password"              text,
  "createdAt"             timestamptz not null default current_timestamp,
  "updatedAt"             timestamptz not null
);

create table if not exists public.af_verificacoes (
  "id"         text not null primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default current_timestamp,
  "updatedAt"  timestamptz not null default current_timestamp
);

create index if not exists af_sessoes_user_idx on public.af_sessoes ("userId");
create index if not exists af_contas_user_idx on public.af_contas ("userId");
create index if not exists af_verificacoes_identifier_idx
  on public.af_verificacoes ("identifier");

-- Sessão expirada precisa ser varrida, e sem índice a limpeza vira varredura.
create index if not exists af_sessoes_expira_idx on public.af_sessoes ("expiresAt");

comment on table public.af_usuarios is
  'Usuários do AutoFluxos (Better Auth). Não confundir com auth.users, que é global ao projeto e usado pela Verandi.';
comment on column public.af_sessoes."impersonatedBy" is
  'Id do administrador que abriu esta sessão como outra pessoa. Nulo em sessão normal.';
comment on column public.af_contas."password" is
  'Hash da senha, gerado pelo Better Auth. Nunca a senha.';

-- RLS ligada e sem política, que é o padrão do AutoFluxos: só o servidor
-- alcança estas tabelas. O Better Auth conecta como `postgres`, que é dono das
-- tabelas e por isso não é barrado; `anon` e `authenticated` — as chaves que
-- poderiam ir ao navegador — não têm acesso nenhum.
--
-- Isto importa mais aqui do que no resto do banco: `af_contas` guarda hash de
-- senha e `af_sessoes` guarda token de sessão. Uma tabela dessas exposta pela
-- Data API é o pior tipo de vazamento que este projeto poderia ter.
alter table public.af_usuarios     enable row level security;
alter table public.af_sessoes      enable row level security;
alter table public.af_contas       enable row level security;
alter table public.af_verificacoes enable row level security;

revoke all on public.af_usuarios     from anon, authenticated;
revoke all on public.af_sessoes      from anon, authenticated;
revoke all on public.af_contas       from anon, authenticated;
revoke all on public.af_verificacoes from anon, authenticated;

notify pgrst, 'reload schema';
