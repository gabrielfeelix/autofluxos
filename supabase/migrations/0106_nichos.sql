-- ---------------------------------------------------------------------------
-- 0106: o ramo da conta, e o que a demo da pizzaria precisa no banco
-- ---------------------------------------------------------------------------
--
-- Etapa 2 de docs/PLANO-NICHOS.md. Quatro coisas, todas aditivas:
--
--   1. `clients.nicho`: o ramo (restaurante, ecommerce, comercio). Nulo é
--      "sem ramo", que é o sistema de antes: nenhuma conta muda. A lista vive
--      em `src/core/nichos.ts`; o check aqui só impede lixo.
--   2. `clients.ia_limite_contato_dia`: quantas chamadas de IA um mesmo
--      contato pode gastar em 24 h. Nulo é "sem limite", o de hoje. Existe
--      para a conta de demonstração, aberta a quem ler o QR de um flyer.
--   3. `produtos.categoria` e `produtos.ordem`: o cardápio agrupa pizza,
--      bebida e sobremesa, e o dono decide a ordem. Nulas: item antigo fica
--      como está, sem categoria e na ordem de antes.
--   4. `materiais`: o cardápio da conta em PDF e em imagem, que o bot manda
--      quando pedem "o cardápio". Um de cada por conta. Só URL `https`; o
--      envio do arquivo é outra etapa.
--
-- Não toca `app_verandi`, Auth, Storage nem linha existente. Objeto novo em
-- `public` nasce fechado para `anon`/`authenticated` pelo default da 0041; o
-- revoke e o grant de `service_role` são escritos por clareza.
-- Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- 1 e 2. A conta ---------------------------------------------------------------

alter table public.clients
  add column if not exists nicho text,
  add column if not exists ia_limite_contato_dia integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_nicho_check') then
    alter table public.clients
      add constraint clients_nicho_check check (nicho in ('restaurante', 'ecommerce', 'comercio'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_ia_limite_contato_dia_check') then
    alter table public.clients
      add constraint clients_ia_limite_contato_dia_check check (ia_limite_contato_dia > 0);
  end if;
end $$;

comment on column public.clients.nicho is
  'O ramo da conta (src/core/nichos.ts). Nulo = sem ramo, o sistema de antes. Muda palavras e sugestões, nunca permissão ou cobrança.';

comment on column public.clients.ia_limite_contato_dia is
  'Máximo de chamadas de IA por contato em 24 h. Nulo = sem limite. Pensado para a conta de demonstração.';

-- 3. O catálogo por categoria ------------------------------------------------

alter table public.produtos
  add column if not exists categoria text,
  add column if not exists ordem integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_categoria_check') then
    alter table public.produtos
      add constraint produtos_categoria_check check (char_length(btrim(categoria)) between 1 and 60);
  end if;
end $$;

comment on column public.produtos.categoria is
  'Grupo do item no cardápio ou catálogo (Pizzas, Bebidas). Nulo = sem categoria.';

comment on column public.produtos.ordem is
  'Posição escolhida pelo dono dentro da categoria. Nulo = depois dos ordenados, pelo nome.';

-- 4. Os materiais da conta ----------------------------------------------------

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tipo text not null check (tipo in ('cardapio-pdf', 'cardapio-imagem')),
  url text not null check (url like 'https://%'),
  -- O nome que o cliente vê no WhatsApp ao receber o documento.
  nome_arquivo text check (char_length(nome_arquivo) between 1 and 120),
  atualizado_em timestamptz not null default now(),
  unique (client_id, tipo)
);

comment on table public.materiais is
  'Arquivos da conta que o bot envia inteiros: o cardápio em PDF e em imagem. Um de cada tipo por conta.';

alter table public.materiais enable row level security;

revoke all on table public.materiais from public, anon, authenticated;
grant select, insert, update, delete on table public.materiais to service_role;

notify pgrst, 'reload schema';
