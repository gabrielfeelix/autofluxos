/**
 * Quais testes falam com o banco.
 *
 * A lista é explícita, e não um padrão de nome, por dois motivos. O primeiro é
 * que renomear 25 arquivos perderia o histórico deles no `git log --follow`. O
 * segundo é que a lista é auditável: dá para ler num relance quem toca o banco,
 * em vez de confiar que ninguém esqueceu um sufixo.
 *
 * Estes arquivos rodam **só** em `vitest.integration.config.ts`, contra o
 * Supabase local em Docker. A configuração unitária os exclui, então um teste
 * que dependa de banco nunca passa verde por engano na suíte padrão.
 *
 * Arquivo novo que fale com o banco entra aqui. O teste de
 * `test/integracao/lista-de-integracao.test.ts` recusa quem usar credencial sem
 * estar nesta lista. `auth` e `acoes-conta` entram por `DATABASE_URL`: falam com
 * o Postgres direto, por `pg`, em vez de passarem pelo cliente do Supabase.
 */
export const TESTES_DE_INTEGRACAO = [
  'src/server/acoes-conta.test.ts',
  'src/server/agendador.test.ts',
  'src/server/auth.test.ts',
  'src/server/fluxos-padrao.test.ts',
  'src/server/passada-de-retomada.test.ts',
  'src/server/receber-evento.test.ts',
  'src/server/receber-lead-do-formulario.test.ts',
  'src/server/receber-mensagem.test.ts',
  'src/server/repos/acervo-envio.test.ts',
  'src/server/repos/acervo.test.ts',
  'src/server/repos/alertas.test.ts',
  'src/server/repos/auditoria.test.ts',
  'src/server/repos/compartilhar.test.ts',
  'src/server/repos/crm.test.ts',
  'src/server/repos/etiquetas.test.ts',
  'src/server/repos/leads.test.ts',
  'src/server/repos/leituras.test.ts',
  'src/server/repos/metricas-b3.test.ts',
  'src/server/repos/metricas.test.ts',
  'src/server/repos/paginas-de-lead.test.ts',
  'src/server/repos/painel.test.ts',
  'src/server/repos/porta-de-entrada.test.ts',
  'src/server/repos/pulso.test.ts',
  'src/server/repos/quadros.test.ts',
  'src/server/repos/relacionamento.test.ts',
  'src/server/repos/venda-nao-e-atendimento.test.ts',
  'src/server/repos/vendas.test.ts',
  'src/server/repos/repos.test.ts',
  'src/server/repos/retencao.test.ts',
  'src/server/repos/sequencias.test.ts',
] as const
