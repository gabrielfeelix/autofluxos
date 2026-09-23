-- ---------------------------------------------------------------------------
-- 0092: a loja do cliente, para o bot consultar catálogo ao vivo
-- ---------------------------------------------------------------------------
--
-- Uma linha por conta e plataforma. Hoje só `magento`; o check existe para o
-- dia de Nuvemshop ou Tray entrar sem reinterpretar linha antiga.
--
-- Aditiva: tabela nova, nenhuma coluna de tabela existente alterada, nenhum
-- dado reescrito. Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.
--
-- `ativa` nasce `false`: aplicar esta migration não muda o comportamento de
-- conta nenhuma. Quem liga é o dono, na tela, depois de um teste que deu certo.
--
-- As colunas da fase 2 (token de administrador) nascem aqui, desligadas, pelo
-- motivo da 0066: mexer uma vez em produção em vez de duas.
--
--   - `conexao_id` aponta para `public.connections`, que já guarda o valor no
--     Vault e apaga o segredo por gatilho (0006). `on delete set null`:
--     apagar a Conexão desliga o estoque exato, não apaga a loja.
--   - `estoque_exato` diz qual caminho da REST respondeu no teste: `msi`
--     (Inventory, 2.3+) ou `legado` (CatalogInventory). `desligado` é o padrão
--     e é o que o bot usa sempre que o token falha.
--
-- Nenhum segredo mora nesta tabela. Endereço de loja é público.

set search_path = public, extensions;

create table if not exists public.lojas_integradas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  plataforma text not null check (plataforma in ('magento')),
  endereco text not null check (endereco ~ '^https://' and length(endereco) <= 300),
  codigo_da_loja text check (codigo_da_loja is null or codigo_da_loja ~ '^[a-z0-9_]{1,64}$'),
  sufixo_da_url text not null default '.html' check (length(sufixo_da_url) <= 20),
  ativa boolean not null default false,
  conexao_id uuid references public.connections (id) on delete set null,
  estoque_exato text not null default 'desligado'
    check (estoque_exato in ('desligado', 'msi', 'legado')),
  estoque_id integer check (estoque_id is null or estoque_id > 0),
  verificada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (client_id, plataforma),
  -- Estoque exato ligado sem token é estado impossível; o banco recusa.
  constraint lojas_estoque_exige_token check (estoque_exato = 'desligado' or conexao_id is not null)
);

-- RLS ligada e zero políticas, o padrão da casa: só o servidor acessa.
-- Revoke com `public` na lista, ver docs/BANCO-COMPARTILHADO.md §6.
alter table public.lojas_integradas enable row level security;
revoke all on public.lojas_integradas from public, anon, authenticated;

notify pgrst, 'reload schema';
