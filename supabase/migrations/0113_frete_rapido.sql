-- 0113: token da Frete Rápido na loja integrada, para o "cadê meu pedido?"
-- responder onde a entrega está (ver `src/loja/frete-rapido.ts`).
--
-- A coluna guarda só a **referência** do segredo no Vault (`criar_segredo`,
-- 0006), nunca o token: a tabela é lida pelo servidor a cada consulta de
-- pedido, e o valor só sai do cofre na hora da chamada.
--
-- Nula para todo mundo: sem token, a consulta de pedido segue só com o
-- Magento, como antes.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva:
-- uma coluna nula, sem default que mude comportamento.

set search_path = public, extensions;

alter table public.lojas_integradas
  add column if not exists frete_rapido_ref uuid;

comment on column public.lojas_integradas.frete_rapido_ref is
  'Id do segredo no Vault com o token da Frete Rápido (só leitura de ocorrências no código).';

notify pgrst, 'reload schema';
