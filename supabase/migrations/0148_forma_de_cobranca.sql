-- 0148, como a 4YU cobra cada organização (controle interno da mensalidade;
-- docs/PLANO-MENSALIDADE-ASAAS.md).
--
-- Tudo aditivo e em `public`; nada da Verandi é tocado. Só colunas novas em
-- `clients`, com default: nenhuma linha existente muda de comportamento,
-- porque `asaas` é o que o código já fazia.
--
-- * `asaas`: assina pelo app (0147). É o padrão.
-- * `por_fora`: paga por Pix ou transferência, combinado com a 4YU. Não vê o
--   botão Assinar e não entra na régua de atraso. Valor, dia e anotação são
--   para a 4YU conferir; o sistema não cobra nada sozinho.
-- * `cortesia`: não paga (organização de teste, parceiro). Não vê Assinar.
--
-- RLS de `clients` continua como está; nenhuma função nova.

set search_path = public, extensions;

alter table public.clients
  add column if not exists cobranca_forma text not null default 'asaas'
  check (cobranca_forma in ('asaas', 'por_fora', 'cortesia'));

alter table public.clients
  add column if not exists cobranca_valor numeric(10, 2)
  check (cobranca_valor is null or cobranca_valor between 0 and 1000000);

alter table public.clients
  add column if not exists cobranca_dia smallint
  check (cobranca_dia is null or cobranca_dia between 1 and 31);

alter table public.clients
  add column if not exists cobranca_nota text
  check (cobranca_nota is null or length(cobranca_nota) <= 500);

comment on column public.clients.cobranca_forma is
  'Como a 4YU cobra: asaas (assina pelo app), por_fora (Pix combinado) ou cortesia (0148).';
comment on column public.clients.cobranca_valor is
  'Reais por mês combinados, quando a cobrança é por fora. Só para conferência (0148).';
comment on column public.clients.cobranca_dia is
  'Dia do mês em que o pagamento por fora é esperado (0148).';
comment on column public.clients.cobranca_nota is
  'Anotação interna da 4YU sobre a cobrança: chave Pix, combinado, até quando vale a cortesia (0148).';

notify pgrst, 'reload schema';
