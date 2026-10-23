-- 0151, os gateways do plano (docs/gateways/PLANO-GATEWAYS.md, "Base 1").
--
-- Aceita de uma vez todos os nomes do plano, para cada gateway novo não pedir
-- uma migration e uma autorização: woovi, paghiper, stripe, efi, iugu e
-- pagarme (ondas 1 e 2) e inter, sicoob, cielo e cora (onda 3). Nome aceito
-- sem código não faz nada: quem oferece o gateway é a tela.
--
-- Só recria `<tabela>_gateway_check` em três tabelas, no molde da 0149 e da
-- 0150; nenhuma linha muda e nada da Verandi é tocado. O `drop ... if exists`
-- deixa rodar de novo sem erro.

set search_path = public, extensions;

alter table public.conexoes_de_pagamento drop constraint if exists conexoes_de_pagamento_gateway_check;
alter table public.conexoes_de_pagamento
  add constraint conexoes_de_pagamento_gateway_check check (gateway in (
    'mercado_pago', 'asaas', 'infinitepay', 'pagbank',
    'woovi', 'paghiper', 'stripe', 'efi', 'iugu', 'pagarme',
    'inter', 'sicoob', 'cielo', 'cora'
  ));

alter table public.cobrancas drop constraint if exists cobrancas_gateway_check;
alter table public.cobrancas
  add constraint cobrancas_gateway_check check (gateway in (
    'mercado_pago', 'asaas', 'infinitepay', 'pagbank',
    'woovi', 'paghiper', 'stripe', 'efi', 'iugu', 'pagarme',
    'inter', 'sicoob', 'cielo', 'cora'
  ));

alter table public.assinaturas drop constraint if exists assinaturas_gateway_check;
alter table public.assinaturas
  add constraint assinaturas_gateway_check check (gateway in (
    'mercado_pago', 'asaas', 'infinitepay', 'pagbank',
    'woovi', 'paghiper', 'stripe', 'efi', 'iugu', 'pagarme',
    'inter', 'sicoob', 'cielo', 'cora'
  ));

notify pgrst, 'reload schema';
