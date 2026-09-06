-- 0043 — o quadro que recebe contato novo sozinho
--
-- **A queixa que originou isto:** "o lead não vai automático, tem que clicar e
-- puxar". E era verdade — `porNoQuadro` só era chamado pela tela, e
-- `porContatoNaEtapa` (o bloco de etapa do fluxo) **move** quem já é cartão,
-- não cria. Contato que ninguém adicionou à mão nunca existiu no quadro.
--
-- **Por que uma coluna, e não "o primeiro quadro criado".** Uma conta pode ter
-- N quadros (`quadros_conta_idx` é em `client_id`, sem unique), então "entrar
-- sozinho" precisa responder *em qual*. Usar o mais antigo seria implícito
-- demais: ninguém entende por que é aquele, e mudar exigiria apagar e recriar
-- um quadro inteiro. Pôr em todos daria 3 cartões a quem tem 3 quadros. Uma
-- marca explícita é a única saída que a pessoa consegue prever e mudar.
--
-- **O default `false` é o comportamento correto, não uma migração pela metade.**
-- Conta sem quadro marcado continua exatamente como hoje: nada entra sozinho.
-- Quem não quer a automação não precisa desligar nada — ela nasce desligada.

set search_path = public, extensions;

alter table public.quadros
  add column if not exists padrao boolean not null default false;

-- No máximo um padrão por conta.
--
-- **Índice parcial, e é o ponto todo.** Um `unique (client_id, padrao)` comum
-- proibiria dois quadros *não*-padrão na mesma conta, que é justamente o caso
-- normal. Com o `where padrao`, as linhas `false` nem entram no índice: elas
-- convivem às dezenas e só a marcada colide.
create unique index if not exists quadros_padrao_unico_idx
  on public.quadros (client_id) where padrao;

comment on column public.quadros.padrao is
  'Quadro que recebe contato novo automaticamente. No máximo um por conta (quadros_padrao_unico_idx). Falso em todos = nada entra sozinho, que é o padrão.';

notify pgrst, 'reload schema';
