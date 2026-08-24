/**
 * Limites que a tela e o servidor precisam saber juntos.
 *
 * Mora em `core/` e não em `repos/` por um motivo prático: componente de
 * cliente não pode importar módulo com `server-only`, e um número duplicado
 * entre a tela e o banco é um número que um dia diverge.
 */

/**
 * O teto do nome de uma automação.
 *
 * Não é limite de banco — é limite de leitura. O nome aparece no cabeçalho do
 * editor, na lista e no seletor de fluxo de cada papel de número; passar disso
 * empurra os controles da direita para fora em vez de informar mais.
 */
export const LIMITE_NOME_DO_FLUXO = 80
