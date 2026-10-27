-- 0156, a Foody Delivery como fonte de pedidos (docs/superpowers/plans/2026-10-27-foody.md).
--
-- A Foody é o sistema de entregas da loja: recebe o pedido do cardápio (ou
-- de quem a loja digitar) e traz o link de rastreio do entregador. Decisão do
-- Gabriel em 27/out/2026: ela entra como mais uma plataforma de pedidos, e a
-- tela orienta conectar só ela quando a loja já despacha tudo por lá.
--
-- Aditiva: os dois checks só ganham 'foody'; nenhuma linha muda. Nada da
-- Verandi é tocado.

set search_path = public, extensions;

alter table public.pedidos drop constraint if exists pedidos_plataforma_check;
alter table public.pedidos
  add constraint pedidos_plataforma_check check (plataforma is null or plataforma in
    ('cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'neemo', 'foody', 'entregador'));

alter table public.cardapios_conectados drop constraint if exists cardapios_conectados_plataforma_check;
alter table public.cardapios_conectados
  add constraint cardapios_conectados_plataforma_check check (plataforma in
    ('cardapio_web', 'olaclick', 'opendelivery', 'goomer', 'delivery_direto', 'neemo', 'foody'));
