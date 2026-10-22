-- 0142, a cobrança criada pela API pública (`POST /api/v1/cobrancas`, frente 4
-- do handoff de 22/out).
--
-- Só alarga o `check` de `public.cobrancas.origem` (0141) para aceitar
-- `api`. Nenhuma linha muda, nada da Verandi é tocado. A 0141 já está em
-- produção e não é editada no lugar.

set search_path = public, extensions;

alter table public.cobrancas drop constraint if exists cobrancas_origem_check;
alter table public.cobrancas
  add constraint cobrancas_origem_check check (origem in ('inbox', 'fluxo', 'ia', 'api'));
