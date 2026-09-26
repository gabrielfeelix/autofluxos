-- A nota da pesquisa que espera o "por quê?" (`npsPendente` em
-- src/core/engine/types.ts).
--
-- O bloco `nps` da 0060 para duas vezes no mesmo nó: a nota e o comentário. O
-- motor guardava a nota colhida em `npsPendente`, mas a sessão é gravada campo a
-- campo, e esse campo nunca teve coluna. É o mesmo buraco que a 0038 fechou
-- para `ia_pendente`: nos testes do motor a sessão passa de mão em mão na
-- memória e tudo funciona; na produção cada mensagem relê a sessão do banco, o
-- pendente chegava vazio, e o comentário da pessoa voltava ao bloco como nota
-- nova ("8" virava segunda nota, "demorou muito" virava tentativa inválida).
--
-- `jsonb` e não colunas soltas, pelo motivo da `ia_pendente`: nota, bloco e
-- variável de destino só fazem sentido juntos, e nenhuma consulta filtra por
-- dentro. Não cabe em `vars`: aquilo é o que o fluxo colheu e o que
-- `{{variavel}}` enxerga, e o estado do motor não pode vazar para lá.
--
-- Aditiva: coluna anulável, sem default, nenhuma linha reescrita. Null é o
-- estado normal, "não há comentário sendo esperado".
alter table public.sessions
  add column if not exists nps_pendente jsonb;

comment on column public.sessions.nps_pendente is
  'A nota da pesquisa já gravada, enquanto o bloco nps espera o comentário. Null na maior parte do tempo. Ver responderNps em src/core/engine/executar.ts.';

notify pgrst, 'reload schema';
