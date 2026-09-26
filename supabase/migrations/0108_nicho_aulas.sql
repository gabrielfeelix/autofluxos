-- 0108: a frente de aulas e serviços com horário (docs/HANDOFF-26-SET-NICHOS.md, 4.1).
--
-- Só troca o check de `clients.nicho` para aceitar `aulas`. Nenhuma conta muda
-- de ramo aqui: pôr a MGM (ou qualquer outra) na frente é decisão à parte, com
-- confirmação do Gabriel.
--
-- Objeto só do AutoFluxos (`public.clients`); nada da Verandi é tocado
-- (docs/BANCO-COMPARTILHADO.md). Idempotente: derruba o check pelo nome e
-- recria com a lista nova.

alter table public.clients drop constraint if exists clients_nicho_check;

alter table public.clients
  add constraint clients_nicho_check check (nicho in ('aulas', 'ecommerce', 'restaurante', 'comercio'));

comment on column public.clients.nicho is
  'O ramo da conta (src/core/nichos.ts): aulas, ecommerce, restaurante, comercio. Nulo = sem ramo, o sistema de antes. Muda palavras e sugestões, nunca permissão ou cobrança.';
