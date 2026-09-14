/**
 * Acima disto a tela mostra "99+". Contar mais não muda decisão nenhuma.
 *
 * **Mora em `core/` e não junto das leituras** porque é um número de tela, não
 * uma regra de banco: `repos/leituras.ts` é `server-only`, e importar o teto de
 * lá impedia qualquer componente de cliente de desenhar a insígnia — o que
 * bloqueava a fila de filtrar no navegador por causa de uma constante.
 */
export const TETO_DA_INSIGNIA = 99
