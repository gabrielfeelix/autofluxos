-- 0136, fecha a função de gatilho da 0134 para `anon` e `authenticated`.
--
-- `public.contato_nasce_com_responsavel` é `security definer` e nasceu
-- executável por qualquer papel: o aviso do painel em 19/out/2026 a listou
-- para `anon` e `authenticated`. O default por schema que a 0041 trocou não
-- alcança o `EXECUTE` que o Postgres concede a `PUBLIC` em toda função nova,
-- porque default por schema só acrescenta privilégio, nunca tira o global.
-- Função nova em `public` continua precisando do revoke explícito.
--
-- Gatilho não precisa de `EXECUTE` para disparar: o Postgres só confere o
-- privilégio no `create trigger`. O insert do servidor segue igual.
--
-- Só em `public`. Nada da Verandi é tocado.

revoke all on function public.contato_nasce_com_responsavel() from public, anon, authenticated;
grant execute on function public.contato_nasce_com_responsavel() to service_role;
