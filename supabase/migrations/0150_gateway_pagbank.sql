-- 0150, o PagBank como gateway da cobrança no chat (docs/MERCADO-COBRANCA-NO-CHAT.md,
-- seção "Pesquisa a fundo"), conectado por OAuth (PagBank Connect).
--
-- Só alarga a lista de gateways aceitos em três tabelas; nenhuma linha muda e
-- nada da Verandi é tocado. Os nomes das restrições são os da 0149
-- (`<tabela>_gateway_check`); o `drop ... if exists` deixa rodar de novo sem
-- erro. Depende da 0149: aplicar as duas em ordem.

set search_path = public, extensions;

alter table public.conexoes_de_pagamento drop constraint if exists conexoes_de_pagamento_gateway_check;
alter table public.conexoes_de_pagamento
  add constraint conexoes_de_pagamento_gateway_check check (gateway in ('mercado_pago', 'asaas', 'infinitepay', 'pagbank'));

alter table public.cobrancas drop constraint if exists cobrancas_gateway_check;
alter table public.cobrancas
  add constraint cobrancas_gateway_check check (gateway in ('mercado_pago', 'asaas', 'infinitepay', 'pagbank'));

alter table public.assinaturas drop constraint if exists assinaturas_gateway_check;
alter table public.assinaturas
  add constraint assinaturas_gateway_check check (gateway in ('mercado_pago', 'asaas', 'infinitepay', 'pagbank'));

notify pgrst, 'reload schema';
