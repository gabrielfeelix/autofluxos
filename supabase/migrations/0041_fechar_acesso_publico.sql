-- 0041 — o schema `public` para de nascer aberto para a Data API.
--
-- O §6 do BANCO-COMPARTILHADO afirmava, até 03/set, que as tabelas de `public`
-- não tinham `grant` para `anon`/`authenticated`. A afirmação era falsa, e a
-- correção do documento parou onde não devia: passou a dizer que o `grant`
-- existe, que revogar em massa "é mudança global e não foi feita", e que o que
-- protege é a RLS ligada sem política. Isso é verdade para tabela. **Não é
-- verdade para função.**
--
-- Conferido no banco em 03/set/2026:
--
--   * 13 dos 42 objetos de `public` têm os 7 privilégios concedidos a `anon` e
--     a `authenticated` — herdados do default do projeto Supabase, que
--     concede tudo em `public` para os dois papéis. As outras 29 estão limpas
--     porque as migrations a partir da `0014` passaram a revogar à mão, uma a
--     uma. `ia_chamadas` (0038) e `alertas` (0039) escaparam do hábito.
--
--   * `public` **está** exposto na Data API: `db_schema` do PostgREST é
--     `public,graphql_public,app_verandi`. Não é superfície teórica.
--
--   * As 21 funções de `public` são executáveis por `anon` e por
--     `authenticated` — **inclusive as que uma migration antiga já tentou
--     fechar**. `revoke execute ... from anon, authenticated` não faz nada
--     quando o `GRANT EXECUTE ... TO PUBLIC` implícito do Postgres continua
--     de pé: os dois papéis herdam de `PUBLIC` o que foi revogado deles.
--     A `0026` revogou `pegar_tarefas` de `anon` e `authenticated` e a função
--     seguiu executável pelos dois. Só a `0040` acertou a forma, ao revogar
--     também de `public`.
--
-- Uma função não é protegida por RLS. As nossas são quase todas
-- `security invoker`, e nesse caso a RLS da tabela ainda barra — mas
-- `limpar_segredo_da_conexao` é `security definer` e apaga de `vault.secrets`.
-- Ela é gêmea da `apagar_token_do_canal`, que a `0040` fechou; ficou aberta
-- porque ninguém olhou as duas juntas. Hoje ela não é alcançável por RPC
-- (o PostgREST não expõe função que retorna `trigger`), e é exatamente esse
-- tipo de garantia — de outro projeto, que pode mudar sem nos avisar — que não
-- deve ser a única coisa entre um segredo e a internet.
--
-- Então a decisão muda: em vez de "nunca crie política sem tratar como
-- exposição pública", que depende de alguém lembrar, `public` fecha por
-- padrão. `anon` e `authenticated` deixam de alcançar qualquer coisa aqui, e o
-- default do projeto deixa de abrir o que for criado daqui em diante.
--
-- **O que isto não quebra, conferido antes de escrever.** O AutoFluxos acessa
-- o banco só pelo servidor, com `service_role` — não há uma única referência a
-- chave anônima no repositório. A Verandi mora em `app_verandi` e nenhum
-- objeto dela referencia `public` (zero funções e zero views, conferido). O
-- `service_role` recebe de volta, explicitamente, tudo o que o revoke tira,
-- porque parte do que ele tinha vinha herdado de `PUBLIC`.
--
-- **O que fica de fora, de propósito.** O default do papel `supabase_admin`
-- também concede tudo em `public`, e `postgres` não é membro dele: alterar
-- exigiria credencial que não temos. Objeto criado por nós nasce como
-- `postgres`, então o default que importa é o que esta migration corrige.

set search_path = public, extensions;

-- 1. o que existe hoje

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- `public` primeiro: sem ele, os dois papéis herdam de volta o que se revoga.
revoke all on all routines in schema public from public, anon, authenticated;

-- 2. o servidor continua entrando pela porta dele
--
-- Necessário porque parte do acesso do `service_role` às funções vinha do
-- `EXECUTE` implícito de `PUBLIC`, que o passo 1 acabou de tirar.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all routines in schema public to service_role;

-- 3. o que for criado a partir daqui nasce fechado

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
