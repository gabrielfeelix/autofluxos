-- 0116: a situação de entrega de cada mensagem que saiu (os tiques da Inbox).
--
-- O webhook `statuses` da Meta diz, para cada mensagem enviada, quando ela saiu
-- (`sent`), chegou no aparelho (`delivered`) e foi lida (`read`). Até aqui isso
-- só era gravado para transmissão; na conversa era descartado, e a Inbox não
-- tinha como mostrar os dois tiques azuis do WhatsApp (pedido de 30/set/2026).
--
-- Aditiva e anulável: linha antiga fica `null` e a tela mostra só o tique de
-- "saiu", que é o que `entregue` já dizia.

alter table public.messages
  add column if not exists situacao text
  check (situacao in ('enviada', 'entregue', 'lida', 'falhou'));

comment on column public.messages.situacao is
  'Entrega da mensagem de saída pelo webhook statuses da Meta: enviada, entregue, lida ou falhou. Só avança.';
