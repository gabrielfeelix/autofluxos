-- 0098: o contato do WhatsApp sem telefone (usernames da Meta, 2026).
--
-- A Meta está liberando nomes de usuário no WhatsApp. Quem adota um some com o
-- telefone dos webhooks (`from` e `contacts[].wa_id` **omitidos**, não vazios)
-- a menos que o número da conta tenha falado com ele nos últimos 30 dias, ou
-- que ele esteja na lista de contatos da Meta, que não é retroativa. No lugar
-- vem o BSUID (`from_user_id`, `contacts[].user_id`), um id por par pessoa e
-- portfólio, no formato `BR.1234...`, presente em todo webhook desde abril.
--
-- Duas colunas anuláveis:
--
-- - `bsuid`: guardado em toda mensagem que chega, com ou sem telefone. É ele
--   que reencontra o contato antigo no dia em que o telefone parar de vir: sem
--   isso, a volta de um cliente de meses atrás abriria uma ficha nova, vazia.
-- - `username`: o `@` que a pessoa escolheu, para a tela ter o que mostrar
--   quando não há número.
--
-- O índice único é parcial: os contatos do Instagram e os importados não têm
-- BSUID, e `null` não conflita com `null`. Quando não há telefone, o próprio
-- BSUID vai para `wa_id` (é o endereço de envio, como o IGSID no Instagram), e
-- o formato com letras e ponto nunca colide com um número.
--
-- Só `public.contacts`, sem default e sem reescrever dado: não toca
-- `app_verandi`, Auth nem Storage. A tabela tinha 44 linhas em 24/set/2026,
-- então o índice é criado sem `concurrently`.

set search_path = public, extensions;

alter table public.contacts
  add column if not exists bsuid text,
  add column if not exists username text;

create unique index if not exists contacts_client_bsuid_key
  on public.contacts (client_id, bsuid)
  where bsuid is not null;

notify pgrst, 'reload schema';
