-- 0162, lembrete de pagamento pendente (pedido da Magento que ficou "pending").
--
-- A passada dos pedidos (`src/server/lembrar-pagamentos.ts`, a cada 10 minutos)
-- procura pedidos que continuam pendentes depois da espera configurada e manda
-- o modelo `pagamento_pendente_cupom` (ou `pagamento_pendente`, sem cupom). A
-- trava de "uma vez por pedido" reaproveita `status_de_pedido_avisados`, com o
-- status `lembrete_pagamento`.
--
-- Aditiva, nada da Verandi é tocado:
--   - `lojas_integradas.lembrete_pagamento`: nulo é desligado; o objeto guarda
--     `{ ativo, esperaHoras, cupom, exigirAceite }`.
set search_path = public, extensions;

alter table public.lojas_integradas
  add column if not exists lembrete_pagamento jsonb;

comment on column public.lojas_integradas.lembrete_pagamento is
  'Lembrete de pagamento pendente: { ativo, esperaHoras, cupom, exigirAceite }. Nulo = nunca configurado (0162).';
