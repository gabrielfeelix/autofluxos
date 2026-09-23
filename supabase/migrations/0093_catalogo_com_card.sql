-- ---------------------------------------------------------------------------
-- 0093: o catálogo aguenta o card do produto
-- ---------------------------------------------------------------------------
--
-- A 0079 fez o catálogo mínimo para o CRM (nome, espécie, arquivado) e a 0091
-- pôs o preço para o bot poder dizer quanto custa. Esta acrescenta o que falta
-- para o bot e a equipe mandarem o mesmo card que a loja Magento manda
-- (plano docs/superpowers/plans/2026-09-23-catalogo-de-produtos.md):
--
--   - `sku`: o código que quem atende digita para achar o item, e a chave que
--     a importação de planilha usa para atualizar em vez de duplicar;
--   - `descricao`: o que a busca do bot lê além do nome;
--   - `link`: a página do item, que vira o botão do card;
--   - `foto`: URL `https` da imagem. Upload fica fora; só endereço.
--
-- Todas anuláveis, sem default: item antigo continua exatamente como está, e
-- `null` é "não informado". Serviço sem foto sai como texto com link, que é o
-- caminho que já existe.
--
-- `sku` único por conta **entre os ativos e só quando preenchido**, pelo mesmo
-- motivo do índice de nome da 0079: arquivar libera o código para reuso, e
-- item sem código não compete com ninguém. Comparação sem caixa e sem espaço
-- nas pontas, porque planilha traz " ab-12" e "AB-12" para o mesmo item.
--
-- Os checks de `link` e `foto` exigem `https://`: o card do WhatsApp recusa
-- imagem por `http`, e link sem esquema vira texto morto no botão.
--
-- Aditiva: quatro colunas anuláveis e um índice, nenhuma linha reescrita.
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

alter table public.produtos
  add column if not exists sku text,
  add column if not exists descricao text,
  add column if not exists link text,
  add column if not exists foto text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_sku_check') then
    alter table public.produtos
      add constraint produtos_sku_check
      check (sku is null or (length(trim(sku)) between 1 and 64));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_descricao_check') then
    alter table public.produtos
      add constraint produtos_descricao_check
      check (descricao is null or length(descricao) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_link_check') then
    alter table public.produtos
      add constraint produtos_link_check
      check (link is null or (link ~ '^https://' and length(link) <= 1000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_foto_check') then
    alter table public.produtos
      add constraint produtos_foto_check
      check (foto is null or (foto ~ '^https://' and length(foto) <= 1000));
  end if;
end $$;

create unique index if not exists produtos_sku_ativo_unico_idx
  on public.produtos (client_id, lower(trim(sku)))
  where arquivado_em is null and sku is not null;

comment on column public.produtos.sku is
  'Código do item. Único por conta entre ativos, sem caixa. Chave da importação de planilha. Ver 0093.';
comment on column public.produtos.link is
  'Página do item, só https. Vira o botão do card. Ver 0093.';
comment on column public.produtos.foto is
  'URL https da imagem do card. Sem upload. Ver 0093.';

notify pgrst, 'reload schema';
