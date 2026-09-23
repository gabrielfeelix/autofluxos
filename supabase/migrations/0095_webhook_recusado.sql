-- 0095: o webhook de entrada guarda a última chamada recusada (tarefa 5.7 do
-- plano de UX de 23/09).
--
-- `ultima_em` (0044) só registra a chamada que passou na assinatura. A pergunta
-- de quem liga uma integração nova é outra: "chegou alguma coisa e foi
-- recusada?". Sem isto, assinatura errada e integração que nunca chamou
-- aparecem iguais na tela: "ainda não recebeu nenhuma chamada".
--
-- **A recusa não diz de qual webhook ela era.** A chamada traz só a assinatura,
-- e a rota confere contra todos os segredos ativos da conta, de propósito (sem
-- id no caminho, ninguém enumera webhook de outra conta). Então a recusa marca
-- todos os ativos da conta, que é exatamente o conjunto que poderia ter
-- assinado. A tela compara as duas datas e mostra a mais nova.
--
-- Uma coluna nullable numa tabela do AutoFluxos: não toca `app_verandi`, Auth,
-- Storage nem grants (a tabela já tem os dela). Aplicar só no Supabase local;
-- produção fica pendente para o Gabriel autorizar.

set search_path = public, extensions;

alter table public.webhooks_de_entrada
  add column if not exists recusada_em timestamptz;

comment on column public.webhooks_de_entrada.recusada_em is
  'Última chamada recusada por assinatura na conta (marca todos os ativos, porque a chamada não diz qual webhook era). Ver 0095.';
