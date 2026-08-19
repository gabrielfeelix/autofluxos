-- 0030 — compartilhar fluxo por link.
--
-- A única peça da Etapa B que ficou de fora (B5, docs/HANDOFF.md §8.1). Ela
-- ficou de fora porque é **rota pública nova**, e rota pública é a superfície
-- que mais custa errar neste produto: tudo aqui dentro hoje exige sessão.
--
-- Três decisões que este arquivo grava, e que não se renegociam sem lê-las:
--
-- 1. **O link aponta para uma VERSÃO, nunca para o rascunho.** `flow_versions`
--    é imutável por gatilho, e é isso que faz o link significar sempre a mesma
--    coisa. Apontar para `flows.rascunho` faria o desenho mudar por baixo de
--    quem recebeu — a pessoa abriria amanhã um fluxo diferente do que alguém
--    lhe mandou hoje, sem nenhuma das duas partes saber.
--
-- 2. **O token fica em texto claro, e isso é diferente de guardar senha.** Ele
--    não autentica ninguém: é uma capacidade de leitura sobre uma versão
--    escolhida, com prazo e botão de revogar. Guardar só o hash impediria a
--    tela de mostrar o link de novo — e link que não dá para recopiar é link
--    que a pessoa recria cinco vezes e nunca revoga os quatro antigos. A
--    tabela tem RLS ligada e `revoke all` de `anon`/`authenticated`, como todas.
--
-- 3. **Contagem separada de abertura e importação.** São perguntas diferentes:
--    "mandei para dez pessoas e ninguém abriu" e "dez abriram e ninguém quis"
--    levam a decisões opostas, e um contador só responderia nenhuma das duas.

create table if not exists public.fluxo_links (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  flow_id   uuid not null references public.flows (id) on delete cascade,

  -- A foto imutável que este link entrega. `cascade` aqui é seguro porque
  -- versão só some junto com o fluxo dela, e link para fluxo apagado não tem
  -- o que mostrar.
  flow_version_id uuid not null references public.flow_versions (id) on delete cascade,

  -- O segredo do endereço. `base64url` de 24 bytes = 32 caracteres, gerado com
  -- `crypto.randomBytes` — adivinhar é inviável e não há enumeração possível.
  token     text not null unique check (length(token) >= 24),

  /**
   * O nome que aparece na página pública.
   *
   * Cópia, e não junção com `flows.nome`: renomear o fluxo depois de mandar o
   * link mudaria o título da página de quem recebeu. O link é um envio, e envio
   * não se reescreve à distância.
   */
  nome      text not null check (length(trim(nome)) > 0),

  -- Nulo = sem prazo. É opção de propósito: há o link que se manda para um
  -- cliente e há o que fica num material de apoio, e forçar prazo no segundo
  -- faria alguém recriá-lo todo mês.
  expira_em   timestamptz,
  revogado_em timestamptz,

  aberturas   integer not null default 0,
  importacoes integer not null default 0,

  -- Quem criou. Nulo quando quem criou entrou pela senha única do time, que é
  -- a porta principal enquanto o login por usuário não a substituir.
  criado_por uuid references public.af_usuarios (id) on delete set null,
  criado_em  timestamptz not null default now()
);

create index if not exists fluxo_links_conta_idx on public.fluxo_links (client_id);
create index if not exists fluxo_links_fluxo_idx on public.fluxo_links (flow_id);

comment on table public.fluxo_links is
  'Link público de leitura de uma versão publicada. Revogável, com prazo, e conta abertura e importação separadamente.';

alter table public.fluxo_links enable row level security;
revoke all on public.fluxo_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Os dois contadores
-- ---------------------------------------------------------------------------
--
-- Função e não `update` do PostgREST pelo mesmo motivo dos gatilhos: `x = x + 1`
-- pela API exigiria ler antes, e duas aberturas simultâneas contariam uma.

create or replace function public.contar_abertura_do_link(p_link_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  update public.fluxo_links
     set aberturas = aberturas + 1
   where id = p_link_id
  returning aberturas into total;

  return total;
end;
$$;

create or replace function public.contar_importacao_do_link(p_link_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  update public.fluxo_links
     set importacoes = importacoes + 1
   where id = p_link_id
  returning importacoes into total;

  return total;
end;
$$;

revoke execute on function public.contar_abertura_do_link(uuid) from anon, authenticated;
revoke execute on function public.contar_importacao_do_link(uuid) from anon, authenticated;

notify pgrst, 'reload schema';
