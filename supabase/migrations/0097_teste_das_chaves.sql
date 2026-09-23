-- 0097: quando cada chave de API foi testada pela última vez (tarefa 6.7 do
-- plano de UX de 23/09).
--
-- A tela de Chaves não sabia dizer se uma credencial guardada funciona. Só a
-- da agenda dá para testar daqui (é a única cujo endereço conhecemos; testar
-- URL arbitrária continua proibido, regra C08). O teste grava a data e se
-- passou; trocar o segredo apaga as duas, porque o valor novo nunca foi
-- testado.
--
-- Só `public.connections`, duas colunas anuláveis, sem default que reescreva
-- a tabela: não toca `app_verandi`, Auth, Storage nem dado existente. O código
-- tolera a coluna ausente (42703). Aplicar só no Supabase local; produção
-- fica pendente para o Gabriel autorizar.

set search_path = public, extensions;

alter table public.connections
  add column if not exists testada_em timestamptz,
  add column if not exists teste_ok boolean;

notify pgrst, 'reload schema';
