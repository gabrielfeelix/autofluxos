-- ---------------------------------------------------------------------------
-- 0091 — preço no item do catálogo
-- ---------------------------------------------------------------------------
--
-- A 0079 recusou preço, e a recusa tinha um argumento bom: um preço de tabela
-- vira "uma segunda verdade que ninguém atualiza", enquanto o valor de uma
-- venda é o valor **daquela** venda, congelado em `venda_itens.valor_unitario`.
--
-- O que mudou não foi o argumento, foi o leitor. Quando o catálogo só era lido
-- por gente, o preço era redundante: quem registrava a venda sabia o valor. O
-- bot não sabe. Sem preço na oferta ele não consegue dizer quanto custa nem
-- recomendar, e é essa a única coisa que esta coluna existe para destravar.
--
-- A 0079 continua certa no que importa, e nada aqui a contradiz:
--
--   - `venda_itens.valor_unitario` **continua sendo a fonte do histórico**.
--     Esta coluna é a oferta de hoje, não o registro do que foi cobrado.
--     Mudar o preço aqui não reescreve venda nenhuma, pela mesma razão que
--     renomear o produto não reescreve `venda_itens.descricao`.
--   - Não é catálogo comercial. Sem estoque, sem imposto, sem SKU, sem tabela
--     por cliente. O `MODELO-CRM.md:209-213` recusou carrinho, proposta e
--     contrato, e a recusa continua valendo inteira.
--
-- `null` é "não informado", e nunca 0. É a mesma regra que `vendas.valor_total`
-- (0071) já usa, e ela é a diferença entre "o dono ainda não disse o preço" e
-- "isto é de graça". Colapsar as duas faria o bot anunciar preço zero para
-- item sem cadastro, que é o pior erro possível desta coluna.
--
-- Por isso o `check` aceita `null` **ou** `>= 0`: zero segue sendo um preço
-- válido de verdade (brinde, isca, plano gratuito), só não é o default.
--
-- `numeric(12, 2)`: o mesmo tipo de `vendas.valor_total` e de
-- `venda_itens.valor_unitario`. Tipo diferente entre colunas que se comparam é
-- defeito esperando a primeira conta.
--
-- Aditiva: uma coluna anulável, nenhuma linha reescrita, nenhum default que
-- invente dado. Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

alter table public.produtos
  add column if not exists preco numeric(12, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_preco_check') then
    alter table public.produtos
      add constraint produtos_preco_check check (preco is null or preco >= 0);
  end if;
end $$;

comment on column public.produtos.preco is
  'Preço de oferta de hoje, em BRL. `null` = não informado, e nunca 0 (0 é de '
  'graça). NÃO é fonte do histórico: o que foi cobrado numa venda mora em '
  'venda_itens.valor_unitario, congelado. Ver 0091.';
