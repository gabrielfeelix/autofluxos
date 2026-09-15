/**
 * Onde estão os endereços dentro de um texto de conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que isto vem ANTES da marcação, e não depois
 * ---------------------------------------------------------------------------
 *
 * **É o conserto de um defeito visto em produção.** Um link de anúncio do Google
 * colado na conversa apareceu metade azul e metade em itálico preto:
 *
 * ```
 * https://exemplo.com.br/emprestimo?gadsource=1&gadcampaignid=232&gclid=CjwKCAj_BwE
 *                                      ↑ daqui em diante, itálico
 * ```
 *
 * A causa é que `_` é itálico na marcação do WhatsApp, e a marcação era
 * interpretada primeiro. Ela via `_source=1&gad_` como um par e partia a URL em
 * três trechos — e o linkificador, que rodava depois, só enxergava pedaços. Não
 * é caso de borda: `gclid`, `utm_*` e `_ga` fazem de quase todo link de campanha
 * um texto cheio de sublinhados.
 *
 * Então o texto é partido por endereço **antes** de qualquer coisa, e a marcação
 * só roda no que sobra. Quem dita isso não é elegância: é o WhatsApp, que
 * também não formata dentro de URL.
 *
 * **O que se perde, e por que cabe:** negrito que começa antes de um link e
 * fecha depois dele deixa de valer, porque o par `*…*` cai em dois pedaços
 * diferentes. Isso é raro; link com `_` é o dia a dia.
 *
 * Mora em `core/` porque é regra sobre texto, sem React e sem rede — e regra
 * assim tem que dar para testar sem montar tela.
 */

/**
 * O que conta como endereço.
 *
 * `https://…`, `http://…` e o `www.` sem esquema, que é como muita gente cola.
 *
 * **A pontuação final fica de fora**, e é isso que o `[^\s<.,;:!?)\]}"']` do fim
 * faz: sem ele, "veja em exemplo.com." levaria o ponto para dentro do link e
 * abriria uma página que não existe. É o erro mais comum de quem escreve este
 * padrão à mão, e ele aparece sempre que alguém termina a frase com ponto.
 *
 * Sem `g` na declaração de propósito: uma expressão global guarda `lastIndex`
 * entre chamadas, e uma constante de módulo compartilhada entre chamadas é a
 * fonte clássica de "só funciona uma vez". Quem precisa do global clona.
 */
const ENDERECO = /\b(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)\]}"']/i

export type PedacoDeTexto =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'endereco'; valor: string; href: string }

/**
 * Parte o texto em pedaços comuns e endereços, na ordem em que aparecem.
 *
 * Texto sem nenhum endereço devolve um pedaço só — quem chama não precisa de
 * caso especial.
 */
export function partirPorEndereco(texto: string): PedacoDeTexto[] {
  const pedacos: PedacoDeTexto[] = []
  const busca = new RegExp(ENDERECO.source, 'gi')
  let ultimo = 0

  for (const achado of texto.matchAll(busca)) {
    const inicio = achado.index
    const bruto = achado[0]
    if (inicio > ultimo) pedacos.push({ tipo: 'texto', valor: texto.slice(ultimo, inicio) })
    pedacos.push({
      tipo: 'endereco',
      valor: bruto,
      // `www.` sem esquema vira `https`. Um `href` sem esquema é tratado pelo
      // navegador como caminho relativo — o clique iria para dentro do painel.
      href: /^www\./i.test(bruto) ? `https://${bruto}` : bruto,
    })
    ultimo = inicio + bruto.length
  }

  if (ultimo < texto.length) pedacos.push({ tipo: 'texto', valor: texto.slice(ultimo) })
  return pedacos
}
