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

/**
 * O teto da anotação do contato.
 *
 * Nota é lembrete, não prontuário — o histórico da conversa é a conversa. Mora
 * aqui, e não em `repos/leads.ts` onde nasceu, porque o bloco de Anotação
 * (0044) é editado no navegador e o campo precisa contar os caracteres na
 * frente de quem escreve. `leads.ts` tem `server-only`: importá-lo do editor
 * quebra o build, e copiar o número seria criar o par que um dia diverge.
 */
export const LIMITE_DA_NOTA = 2_000
