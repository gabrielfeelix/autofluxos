/**
 * A decisão do pulso: a tela à vista está velha?
 *
 * Vive fora do componente para poder ser testada sem navegador — e ela merece
 * teste, porque a primeira versão errou aqui.
 *
 * **O erro que isto documenta:** o componente guardava a última leitura num
 * `useRef`. Só que `router.refresh()` remonta a árvore e zera o ref; toda
 * leitura virava "primeira leitura", nenhuma comparação acontecia, e o Inbox
 * ficava parado — o defeito exato que ele existia para consertar.
 *
 * A comparação certa é contra o que o **servidor desenhou**, que é um fato
 * sobre a tela e não sobre a memória do componente.
 */
export function precisaAtualizar({
  doBanco,
  naTela,
  jaPedido,
}: {
  /** O pulso que a rota acabou de devolver. */
  doBanco: string | null
  /** O pulso de quando o servidor desenhou esta página. */
  naTela: string | null
  /** O último carimbo para o qual já pedimos refresh, e ainda não voltou. */
  jaPedido: string | null
}): boolean {
  // Nada mudou desde que a página foi desenhada.
  if (doBanco === naTela) return false
  // O refresh deste carimbo já foi pedido; pedir de novo é trabalho repetido.
  if (doBanco === jaPedido) return false
  return true
}
