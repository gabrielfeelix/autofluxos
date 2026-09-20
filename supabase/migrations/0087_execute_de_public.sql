-- ---------------------------------------------------------------------------
-- 0087 — o revoke que não fechou, porque o EXECUTE vinha de PUBLIC
-- ---------------------------------------------------------------------------
--
-- A ocorrência medida, na produção, em 22/set/2026
-- ---------------------------------------------------------------------------
--
-- Auditando o isolamento da F9 (T9.1, item 5), três das 31 funções de `public`
-- respondiam verdadeiro para `has_function_privilege('anon', ..., 'EXECUTE')`:
--
--     concluir_processo      TABLE(...)                   0072
--     resolver_continuidade  SETOF conclusoes_de_processo  0072
--     reabrir_ao_receber     trigger                       0049
--
-- As outras 28 estavam fechadas, então isto é lapso pontual e não política.
--
-- A causa é a lição da 0026 se repetindo, e ela está escrita no §6 do
-- `docs/BANCO-COMPARTILHADO.md`: **`revoke ... from anon, authenticated` não
-- fecha função.** O Postgres concede `EXECUTE` a `PUBLIC` no momento da
-- criação, e `anon`/`authenticated` herdam de lá o que se revoga deles. A ACL
-- das três provava isso na produção, com o `=X/postgres` inicial:
--
--     concluir_processo -> =X/postgres | postgres=X/postgres | service_role=X/postgres
--                          ^^^^^^^^^^^ isto é PUBLIC
--
-- A 0072 escreveu `revoke execute ... from anon, authenticated` nas duas dela,
-- sem `public` na lista. A `reabrir_ao_receber` da 0049 não tem revoke nenhum.
-- O default fechado da 0041 não alcança isto: ele governa `grant` de tabela,
-- e o `EXECUTE` implícito a `PUBLIC` é outra porta.
--
-- Qual era o alcance real, medido e não suposto
-- ---------------------------------------------------------------------------
--
-- Nenhum dado vazou, e vale registrar por quê, para ninguém ler este arquivo
-- daqui a um ano e concluir que houve incidente:
--
--  * `resolver_continuidade` chamada por `anon` pela Data API responde **401**
--    `permission denied for table conclusoes_de_processo`. A função entra, e o
--    `grant` de tabela da 0041 barra na linha seguinte. É a defesa em
--    profundidade funcionando: a camada de fora falhou, a de dentro segurou;
--  * `concluir_processo` responde **404** no PostgREST, porque ela tem oito
--    argumentos e a chamada sem parâmetros não casa assinatura. Com os
--    argumentos certos cairia no mesmo `permission denied` da anterior, pela
--    mesma razão: ela é `security invoker`;
--  * `reabrir_ao_receber` é a única `security definer` das três, e seria a
--    grave, porque `security definer` roda como `postgres` e ignoraria o
--    `grant` que segurou as outras duas. **Ela retorna `trigger`**, e o
--    Postgres recusa chamada direta de função de gatilho: "trigger functions
--    can only be called as triggers". O PostgREST sequer a expõe.
--
-- Ou seja: o risco aqui é de profundidade perdida, não de porta aberta. É
-- exatamente por isso que ele se conserta agora, barato, e não quando alguém
-- acrescentar a quarta função e ela não tiver uma segunda camada atrás.
--
-- O que esta migration faz
-- ---------------------------------------------------------------------------
--
-- `revoke ... from public` nas três, que é a forma que a 0040 já usou e que o
-- documento manda usar. `anon` e `authenticated` continuam na lista de
-- propósito: revogar de `PUBLIC` não tira concessão feita diretamente a um
-- papel, e escrever as três é o que torna o resultado independente de quais
-- concessões diretas existam hoje.
--
-- Nenhuma função é recriada. Recriar mudaria o corpo junto do privilégio, e
-- misturar as duas coisas numa migration é o que impede reverter uma sem a
-- outra.
--
-- Sem `notify pgrst`, e isto é decisão: o cache do PostgREST é o mesmo dos dois
-- produtos, e esta migration não muda nenhum objeto que a Data API exponha.
-- Recarregar o cache seria arriscar a API da Verandi para nada, que é o mesmo
-- raciocínio da 0056.
-- ---------------------------------------------------------------------------

revoke execute on function public.concluir_processo(uuid, uuid, text, numeric, text, text, text, text)
  from public, anon, authenticated;

revoke execute on function public.resolver_continuidade(uuid)
  from public, anon, authenticated;

revoke execute on function public.reabrir_ao_receber()
  from public, anon, authenticated;

-- O gatilho continua funcionando depois do revoke, e isso não é sorte: o
-- Postgres executa função de gatilho com os privilégios do dono da tabela, e
-- não com os de quem disparou o `insert`. Quem escrever teste disto: o caminho
-- é inserir em `public.messages` e conferir que `contacts.estado` reabriu.
