import { normalizar } from '@/core/engine/interpolar'

/**
 * A busca da galeria de templates.
 *
 * Mora em `core/` porque é regra, não desenho: o que casa e o que não casa
 * precisa ser igual na aba Templates e no modal de criar automação — são duas
 * telas mostrando a mesma lista, e duas buscas parecidas divergiriam no dia em
 * que alguém mexesse numa delas.
 *
 * **Acento e caixa não contam** (`normalizar` é a mesma do motor): quem procura
 * "pos venda" tem que achar "Pós-venda", senão a busca ensina a não usar busca.
 *
 * **Toda palavra do termo precisa casar**, e não qualquer uma. Com "ou", digitar
 * mais palavras traria *mais* resultado — o contrário do que quem digita
 * espera. As palavras podem casar em campos diferentes: "agenda lembrete" acha
 * o modelo cujo nome é lembrete e cuja etiqueta é Agenda.
 */

export type ModeloBuscavel = {
  id: string
  nome: string
  resumo: string
  etiquetas: readonly string[]
  /**
   * Como as pessoas chamam isto, e o texto do cartão não diz.
   *
   * Veio de um teste bobo e certeiro: procurar "cobrança" não achava o
   * "Lembrete de pagamento", porque a palavra não aparece nem no nome nem no
   * resumo. Sinônimo não é enfeite de SEO — é o que impede a busca de ensinar
   * que não vale a pena buscar. Não aparece na tela.
   */
  sinonimos?: readonly string[]
}

/**
 * Os modelos que sobram depois do termo digitado e das etiquetas marcadas.
 *
 * Etiquetas marcadas se somam com **e**: marcar "WhatsApp" e "SDR" pede os dois.
 * É o que faz o segundo clique estreitar a lista; com "ou", marcar mais chips
 * devolveria mais coisa e o filtro deixaria de servir para achar.
 */
export function filtrarModelos<T extends ModeloBuscavel>(
  modelos: readonly T[],
  termo: string,
  etiquetas: readonly string[] = [],
): T[] {
  const palavras = normalizar(termo).split(/\s+/).filter((p) => p !== '')
  const pedidas = etiquetas.map(normalizar)

  return modelos.filter((modelo) => {
    const daModelo = modelo.etiquetas.map(normalizar)
    if (!pedidas.every((etiqueta) => daModelo.includes(etiqueta))) return false

    const texto = normalizar(
      `${modelo.nome} ${modelo.resumo} ${modelo.etiquetas.join(' ')} ${(modelo.sinonimos ?? []).join(' ')}`,
    )
    return palavras.every((palavra) => texto.includes(palavra))
  })
}

/**
 * Quantos modelos cada etiqueta tem, na ordem em que as etiquetas foram dadas.
 *
 * Serve para o chip mostrar o número e para **esconder etiqueta vazia**: chip
 * que sempre devolve lista vazia é uma promessa que a tela não cumpre.
 */
export function contarEtiquetas<T extends ModeloBuscavel>(
  modelos: readonly T[],
  etiquetas: readonly string[],
): { etiqueta: string; quantos: number }[] {
  return etiquetas
    .map((etiqueta) => ({
      etiqueta,
      quantos: modelos.filter((modelo) => modelo.etiquetas.includes(etiqueta)).length,
    }))
    .filter((linha) => linha.quantos > 0)
}
