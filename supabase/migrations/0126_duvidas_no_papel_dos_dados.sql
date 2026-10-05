-- As tabelas da 0125 no papel `autofluxos_dados` (0115).
--
-- Relatório e passada das dúvidas usam `bancoDeDados()`, que entra como
-- `autofluxos_dados`, e não como `service_role`. Sem isto, a 0125 nasceu
-- fechada para quem de fato lê e escreve nela: `permission denied` no card e
-- na passada. Mesma forma da 0115: grant explícito, mínimo por tabela, e a
-- política `dados_do_autofluxos` por causa da RLS ligada.
--
-- O que cada tabela precisa, e só isso:
--   duvidas           select (relatório), insert (passada)
--   duvidas_lidas     select, insert, update (a marca anda)
--   apelidos_de_tema  select, insert, update, delete (renomear e juntar)

set search_path = public, extensions;

grant select, insert on public.duvidas to autofluxos_dados;
grant select, insert, update on public.duvidas_lidas to autofluxos_dados;
grant select, insert, update, delete on public.apelidos_de_tema to autofluxos_dados;

do $$
declare
  t text;
begin
  foreach t in array array['duvidas', 'duvidas_lidas', 'apelidos_de_tema'] loop
    execute format('drop policy if exists dados_do_autofluxos on public.%I', t);
    execute format(
      'create policy dados_do_autofluxos on public.%I for all to autofluxos_dados using (true) with check (true)',
      t
    );
  end loop;
end
$$;
