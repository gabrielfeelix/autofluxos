-- Distribuição "um de cada vez, em ordem" (rodízio), ao lado do balanceado.
--
-- Duas peças, as duas aditivas:
--
-- 1. `clients.distribuicao` aceita `rodizio`. O check da 0064 só conhecia
--    `manual` e `balanceado`.
-- 2. `af_atendentes.ultimo_lead_em`: quando a pessoa recebeu o último lead pela
--    distribuição. O rodízio entrega para quem recebeu há mais tempo, e sem
--    essa data a ordem não sobrevive entre uma mensagem e outra.
--
-- Nada da Verandi é tocado.

set search_path = public, extensions;

alter table public.clients drop constraint if exists clients_distribuicao_check;
alter table public.clients
  add constraint clients_distribuicao_check
  check (distribuicao in ('manual', 'balanceado', 'rodizio'));

alter table public.af_atendentes
  add column if not exists ultimo_lead_em timestamptz;
