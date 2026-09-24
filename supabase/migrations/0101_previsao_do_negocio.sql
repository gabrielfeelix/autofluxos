-- 0101: previsão de fechamento do negócio (F2 do plano de navegação e CRM de
-- 24/09, seção 5.1).
--
-- A página do negócio mostra "Previsão de fechamento" em Informações, e a lista
-- de negócios tem a coluna. Não havia onde guardar: `quadro_cartoes` tinha
-- valor, título e produto, mas nenhuma data prometida.
--
-- `date`, e não `timestamptz`: previsão é "fecha dia 30", ninguém promete a
-- hora. Anulável e sem default, porque a maioria dos negócios nunca vai ter
-- uma, e default escreveria uma previsão que ninguém fez.
--
-- Só `public.quadro_cartoes`, uma coluna anulável: não toca `app_verandi`,
-- Auth, Storage nem dado existente. O código lê o cartão com `*`, então tolera
-- a coluna ausente; só gravar a previsão depende dela. Aplicar só no Supabase
-- local; produção fica pendente para o Gabriel autorizar.

set search_path = public, extensions;

alter table public.quadro_cartoes
  add column if not exists previsao_de_fechamento date;

comment on column public.quadro_cartoes.previsao_de_fechamento is
  'Quando se espera fechar o negócio. Null = ninguém previu.';

notify pgrst, 'reload schema';
