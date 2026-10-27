-- 0155, "Solicitar integração" vale também para cardápio digital e delivery
-- (docs/PLANO-INTEGRACOES-CARDAPIO.md, Fase 0).
--
-- A tela Comércio > Integrações > Cardápio e delivery mostra cada plataforma
-- ainda sem conector como "Em breve", com o "Solicitar integração" que já existe para
-- loja on-line (0103). A lista fechada do check passa a incluir as
-- plataformas de cardápio (`src/core/plataformas-de-cardapio.ts`).
--
-- Aditiva: só amplia a lista; nenhuma linha muda. Nada da Verandi é tocado.

set search_path = public, extensions;

alter table public.pedidos_de_loja drop constraint if exists pedidos_de_loja_plataforma_check;
alter table public.pedidos_de_loja
  add constraint pedidos_de_loja_plataforma_check check (plataforma in (
    'magento', 'nuvemshop', 'woocommerce', 'shopify', 'vtex', 'tray', 'loja_integrada',
    'cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'foody', 'neemo'
  ));
