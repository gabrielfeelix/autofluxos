-- 0006 — Conexões: credencial de cliente, sem ela nunca encostar no fluxo.
--
-- O nó de API já alcança Sheets (Apps Script) e qualquer webhook, porque neles
-- a chave vem embutida na URL que o cliente gera. O que faltava era CRM, que
-- exige cabeçalho `Authorization` — e não havia onde guardar esse token.
--
-- A saída provisória era mandar o cliente passar por n8n. Isso é errado como
-- produto: se ele precisa do n8n, ele não precisa da gente.
--
-- **O valor nunca mora aqui.** Ele vai para o Supabase Vault, cuja chave de
-- criptografia fica fora do banco; esta tabela guarda só a referência. Um dump
-- completo do banco entrega ciphertext e id de chave, nunca o segredo.
--
-- Por que uma tabela e não `{{segredo.x}}` escrito no grafo: o grafo vira
-- `flow_versions.grafo`, que é imutável por gatilho. Um token que entrasse ali
-- ficaria gravado para sempre numa linha que o banco se recusa a alterar, e
-- revogar depois não desfaria. Com referência, rotacionar é trocar o valor no
-- cofre — os fluxos apontam para o id e não precisam ser republicados.

create table if not exists public.connections (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,

  -- O que aparece na tela: "CRM", "Planilha de pedidos".
  nome        text not null,

  -- Como a credencial entra na requisição.
  --   bearer     → Authorization: Bearer <valor>
  --   cabecalho  → <campo>: <valor>
  --   query      → acrescenta ?<campo>=<valor> na URL
  -- `oauth2` entra quando houver cliente que exija, trazendo refresh e
  -- expiração junto. É por isso que isto é um tipo e não um booleano.
  tipo        text not null check (tipo in ('bearer', 'cabecalho', 'query')),

  -- Nome do cabeçalho ou do parâmetro. Só para `cabecalho` e `query`.
  campo       text,

  -- A referência no Vault. NUNCA o valor.
  secret_id   uuid not null,

  criado_em   timestamptz not null default now(),

  -- Dois nomes iguais no mesmo cliente confundem na hora de escolher no editor.
  unique (client_id, nome),

  -- `bearer` não usa campo; os outros dois não funcionam sem ele.
  constraint campo_quando_precisa check (
    (tipo = 'bearer' and campo is null) or
    (tipo in ('cabecalho', 'query') and campo is not null and length(trim(campo)) > 0)
  )
);

create index if not exists connections_client_id_idx on public.connections (client_id);

-- Mesmo estado das outras tabelas: RLS ligada e sem política nenhuma. A chave
-- `publishable` (que pode chegar ao navegador) não lê nem escreve nada; todo
-- acesso passa pelo servidor com a chave `secret`. As políticas entram junto
-- com o login, e não antes.
alter table public.connections enable row level security;

comment on table public.connections is
  'Credencial nomeada de um cliente. O valor mora no Vault; aqui fica só a referência.';
comment on column public.connections.secret_id is
  'Aponta para vault.secrets. O valor NUNCA é gravado nesta tabela.';

-- ---------------------------------------------------------------------------
-- O Vault não é alcançável pelo PostgREST: `vault.decrypted_secrets` está fora
-- do schema exposto, e é assim que tem que ser. Estas três funções são a única
-- porta, e ela é `security definer` com permissão só do `service_role` — a
-- chave que existe apenas no servidor.
-- ---------------------------------------------------------------------------

create or replace function public.criar_segredo(valor text, apelido text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select vault.create_secret(valor, apelido);
$$;

create or replace function public.trocar_segredo(alvo uuid, valor text)
returns void
language sql
security definer
set search_path = ''
as $$
  select vault.update_secret(alvo, valor);
$$;

-- A única função que devolve texto em claro. Ela é chamada uma vez por
-- requisição do nó de API, no servidor, e o retorno morre no fim dela.
create or replace function public.ler_segredo(alvo uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = alvo;
$$;

create or replace function public.apagar_segredo(alvo uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where id = alvo;
$$;

-- Fechar a porta para todo mundo, e abrir só para o servidor. Sem isto, a
-- chave `publishable` que vai ao navegador conseguiria chamar `ler_segredo` e
-- o cofre inteiro seria decoração.
revoke all on function public.criar_segredo(text, text) from public, anon, authenticated;
revoke all on function public.trocar_segredo(uuid, text) from public, anon, authenticated;
revoke all on function public.ler_segredo(uuid) from public, anon, authenticated;
revoke all on function public.apagar_segredo(uuid) from public, anon, authenticated;

grant execute on function public.criar_segredo(text, text) to service_role;
grant execute on function public.trocar_segredo(uuid, text) to service_role;
grant execute on function public.ler_segredo(uuid) to service_role;
grant execute on function public.apagar_segredo(uuid) to service_role;

-- Apagar a conexão tem que apagar o segredo junto. Sem isto, o Vault vira um
-- cemitério de credenciais que ninguém sabe mais de quem eram — e credencial
-- órfã é credencial que ninguém percebe sendo usada.
create or replace function public.limpar_segredo_da_conexao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;

drop trigger if exists connections_limpar_segredo on public.connections;
create trigger connections_limpar_segredo
  after delete on public.connections
  for each row execute function public.limpar_segredo_da_conexao();
