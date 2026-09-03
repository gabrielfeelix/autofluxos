/**
 * A decisão do pulso: a tela à vista está velha?
 *
 * Vive fora do componente para poder ser testada sem navegador — e ela merece
 * teste, porque já errou duas vezes.
 *
 * **Erro 1.** O componente guardava a última leitura num `useRef`. Como
 * `router.refresh()` remonta a árvore, o ref zerava, toda leitura virava
 * "primeira leitura" e nada acontecia.
 *
 * **Erro 2.** A correção guardava "já pedi refresh para este carimbo" para não
 * repetir trabalho — e isso virou uma trava permanente: bastava UM refresh não
 * chegar até a tela para a comparação passar a devolver `false` para sempre. O
 * Inbox congelava de vez, que é pior do que o defeito original.
 *
 * A regra sobrou de uma linha, e é a certa: **se o banco não bate com a tela, a
 * tela está velha.** Pedir refresh a mais custa uma renderização no servidor;
 * pedir de menos deixa quem atende olhando para uma conversa que não existe
 * mais.
 */
export function precisaAtualizar({
  doBanco,
  naTela,
}: {
  /** O pulso que a rota acabou de devolver. */
  doBanco: string | null
  /** O pulso de quando o servidor desenhou esta página. */
  naTela: string | null
}): boolean {
  return doBanco !== naTela
}
