/**
 * O config padrão é o unitário, e isso é a correção de um vazamento real.
 *
 * Este arquivo carregava o `.env` de produção e incluía `src/**\/*.test.ts`
 * inteiro — a suíte de banco junto. `npm test` já apontava para
 * `vitest.unit.config.ts`, mas quem digita `npx vitest`, quem roda `vitest` sem
 * `--config` e a extensão do editor caem no arquivo padrão, e nada aqui
 * recusava um endereço remoto. Em 21/set/2026 apareceram três `publicou_fluxo`
 * de `gente@exemplo.test` no `af_auditoria` de produção, conta de cliente
 * pagante, por esse caminho.
 *
 * Apagar o arquivo não resolveria: sem ele o Vitest roda com o default dele,
 * que varre `**\/*.test.ts` sem alias e sem `test/rede-bloqueada.ts`. Reexportar
 * o config unitário faz o caminho padrão ser o caminho seguro.
 *
 * Integração continua exigindo escolha explícita:
 * `npm run test:integration:local`.
 */
export { default } from './vitest.unit.config'
