-- 0042 — a auditoria volta a ser append-only.
--
-- **O que quebrou, e como apareceu.** A 0041 fechou `public` para `anon` e
-- `authenticated` e devolveu ao `service_role`, no passo 2, tudo o que o passo 1
-- havia tirado:
--
--   grant all on all tables in schema public to service_role;
--
-- `all tables` inclui `public.af_auditoria`, e com isso `update`, `delete` e
-- `truncate` voltaram para a chave que a aplicação usa — desfazendo em silêncio
-- a garantia que a 0021 tinha escrito por extenso. O teste
-- `src/server/repos/auditoria.test.ts` ("a aplicação não apaga nem edita o que
-- já foi registrado") passou a falhar contra produção, que é exatamente o
-- trabalho que ele existe para fazer.
--
-- **Por que isso importa mais do que parece.** O registro serve para responder
-- "quem publicou isso?" e, sobretudo, "a 4YU agiu dentro da conta do cliente?".
-- Um log que o próprio sistema consegue editar não prova nada: basta um bug —
-- ou alguém com a chave — para o passado virar outro. Com o `grant all` de pé,
-- apagar o rastro de um "entrar como" era um `delete` de uma linha.
--
-- **A forma da correção repete a lição que a 0021 já tinha pago:** `revoke all`
-- e conceder de volta só `select` e `insert`, em vez de revogar `update` e
-- `delete`. Na primeira escrita da 0021 foram revogados só esses dois, e
-- `truncate` ficou de pé — o que esvazia a tabela inteira e torna o append-only
-- decorativo. Lista do que entra é sempre melhor que lista do que sai.
--
-- **E o default do schema não protege esta tabela.** O passo 3 da 0041 fecha o
-- que nascer daqui em diante para `anon` e `authenticated`; ele não diz nada
-- sobre `service_role`, que precisa mesmo de acesso amplo em `public`. Então
-- qualquer futuro `grant all ... to service_role` reabre isto de novo. Por isso
-- esta migration é idempotente e o comentário da tabela passa a avisar: quem
-- escrever um grant amplo em `public` tem que reexecutar o revoke daqui.

set search_path = public, extensions;

revoke all on public.af_auditoria from anon, authenticated;

revoke all on public.af_auditoria from service_role;
grant select, insert on public.af_auditoria to service_role;

comment on table public.af_auditoria is
  'Registro append-only de quem fez o quê. Não tem update nem delete: log que o sistema edita não prova nada. Atenção: um `grant all on all tables in schema public to service_role` reabre esta tabela — foi o que a 0041 fez e a 0042 desfez. Depois de qualquer grant amplo em public, reexecute o revoke da 0042.';

notify pgrst, 'reload schema';
