/**
 * O anúncio que trouxe a pessoa, com nome de gente.
 *
 * ---------------------------------------------------------------------------
 * O problema
 * ---------------------------------------------------------------------------
 *
 * O `referral` do CTWA traz `source_id` — o `ad_id` da Meta, dezesseis dígitos —
 * e o `headline`, que é o título escrito no criativo. Nenhum dos dois é o
 * **nome da campanha** que o gestor de tráfego deu no Gerenciador de Anúncios.
 * Quem atende vê "Filme institucional para sua empresa"; quem paga a mídia
 * pensa em "Institucional | Retargeting | Set26".
 *
 * A Meta não manda esse nome em lugar nenhum do webhook. Ele só existe atrás de
 * uma segunda chamada, ao nó `Ad`, com um token de Ads — e é por isso que
 * quase ninguém no mercado o mostra: Wati e Zenvia param no id, Ploomes diz por
 * escrito que não tem, RD manda usar Zapier. Este módulo é a metade pura desse
 * caminho: o que é nome, o que é cache, e quando um cache está velho.
 *
 * ---------------------------------------------------------------------------
 * Por que o id continua sendo a verdade
 * ---------------------------------------------------------------------------
 *
 * O nome é **cache**, nunca o registro. Campanha é renomeada — no meio do mês,
 * depois de um teste A/B, quando a agência muda de convenção — e o histórico
 * não pode se reescrever sozinho: a conversa de agosto veio do anúncio que se
 * chamava algo em agosto. Guardar o `ad_id` cru e resolver o nome à parte é o
 * que mantém as duas coisas verdadeiras ao mesmo tempo.
 *
 * É também o que faz a tela degradar bem. Token vencido, permissão revogada,
 * Meta fora do ar: sem nome, a linha volta a mostrar o `headline`, que já está
 * no contato desde a primeira mensagem. Nunca fica vazia.
 */

/** Quanto tempo um nome resolvido continua valendo. */
export const VALIDADE_DO_NOME_EM_HORAS = 24

/**
 * Os nomes de um anúncio, como a Meta os devolve.
 *
 * Os três níveis porque os três respondem perguntas diferentes: o anúncio diz
 * qual criativo, o conjunto diz qual público, a campanha diz qual objetivo. Um
 * atendente lê o de baixo; quem decide orçamento lê o de cima.
 */
export type NomesDoAnuncio = {
  anuncio: string
  conjunto: string
  campanha: string
}

/** O que fica guardado, com a hora em que foi resolvido. */
export type AnuncioEmCache = NomesDoAnuncio & {
  adId: string
  resolvidoEm: string
}

/**
 * O cache venceu?
 *
 * **Vencido não é inútil.** Um nome de 30 horas continua sendo o melhor palpite
 * que existe — quase sempre o anúncio nem foi renomeado. Por isso `venceu` só
 * decide *quando vale a pena perguntar de novo*, e quem usa continua mostrando
 * o que tem enquanto a resposta não chega. Tratar vencido como ausente faria a
 * tela piscar de volta para o `headline` toda vez que o relógio virasse.
 */
export function venceu(resolvidoEm: string, agora: Date = new Date()): boolean {
  const quando = Date.parse(resolvidoEm)
  if (Number.isNaN(quando)) return true

  const horas = (agora.getTime() - quando) / 3_600_000
  return horas >= VALIDADE_DO_NOME_EM_HORAS
}

/**
 * O que a linha da conversa mostra, em ordem de quem responde melhor.
 *
 * 1. **O nome da campanha**, quando resolvido. É o que liga a conversa ao
 *    dinheiro investido, e é a razão de tudo isto existir.
 * 2. **O título do anúncio** (`headline`), que chega de graça no webhook e já
 *    é legível. É o degrau em que o produto estava ontem.
 * 3. **O rótulo** — "Anúncio", "Direto" — quando não há mais nada.
 *
 * Nunca o `ad_id`: dezesseis dígitos na coluna do contato são exatamente a
 * queixa que `rotuloDoCampo` existe para resolver. O id vive no `title`, para
 * quem precisa casar com o Gerenciador.
 */
export function comoMostrar(entrada: {
  rotulo: string
  titulo: string
  nomes: NomesDoAnuncio | null
}): { texto: string; detalhe: string | null } {
  const { rotulo, titulo, nomes } = entrada

  if (nomes && nomes.campanha.trim() !== '') {
    /*
     * O conjunto entra no detalhe, e não no texto. Ele é o que distingue duas
     * linhas iguais quando a mesma campanha roda com dois públicos — informação
     * que importa a quem analisa e é ruído a quem só vai responder "oi".
     */
    const partes = [nomes.anuncio, nomes.conjunto].map((p) => p.trim()).filter((p) => p !== '')
    return { texto: nomes.campanha.trim(), detalhe: partes.length > 0 ? partes.join(' · ') : null }
  }

  if (titulo.trim() !== '') return { texto: titulo.trim(), detalhe: null }
  return { texto: rotulo, detalhe: null }
}

/**
 * Os ids que precisam ir à Meta, de uma lista de conversas.
 *
 * **Sem repetição, e sem os que já têm nome fresco.** Uma fila de 200 conversas
 * de uma mesma campanha tem 200 vezes o mesmo `ad_id`; perguntar 200 vezes
 * gastaria o limite da Página por nada — e o limite da Meta é proporcional ao
 * volume de leads, isto é, apertado justamente para quem está começando.
 */
export function idsParaResolver(
  adIds: string[],
  cache: Map<string, AnuncioEmCache>,
  agora: Date = new Date(),
): string[] {
  const pedir = new Set<string>()

  for (const bruto of adIds) {
    const adId = bruto.trim()
    if (adId === '') continue

    const guardado = cache.get(adId)
    if (!guardado || venceu(guardado.resolvidoEm, agora)) pedir.add(adId)
  }

  return [...pedir]
}
