-- 0131: o que vai em cada lacuna do modelo de um passo de sequência (06/out/2026).
--
-- Antes toda lacuna do modelo virava o nome do contato, e "seu pedido {{2}}
-- saiu" chegava como "seu pedido Ana saiu". Agora o passo guarda um valor por
-- lacuna, no mesmo contrato de `transmissoes.parametros`: `{"1": "{nome}",
-- "2": "texto fixo"}`, onde `{nome}` vira o nome de cada contato no envio.
--
-- **Tem que estar no ar antes do código**: a leitura dos passos pede esta
-- coluna. Vazio (`{}`) é o comportamento antigo, o nome em todas.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão.

set search_path = public, extensions;

alter table public.sequencia_passos
  add column if not exists template_parametros jsonb not null default '{}'::jsonb;
