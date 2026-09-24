/**
 * O arranjo dos blocos de uma tela de Análise: em que ordem eles aparecem e
 * quais a pessoa escondeu.
 *
 * Guardado em cookie, e não no banco nem no `localStorage`: o servidor lê o
 * cookie e já desenha a tela arrumada, sem o bloco escondido piscar na
 * hidratação (o mesmo motivo do cookie da barra lateral). É preferência de
 * quem olha, de um aparelho, e perder não custa nada além de rearrumar.
 *
 * Tudo aqui é tolerante: cookie velho, com bloco que deixou de existir ou sem
 * um bloco novo, vira um arranjo válido. Bloco novo entra visível, na posição
 * padrão dele, para quem já tinha arrumado a tela não deixar de vê-lo.
 */

export type PaginaDeAnalise = 'atendimento' | 'vendas'

export type Arranjo = { ordem: string[]; ocultos: string[] }

export const ARRANJO_VAZIO: Arranjo = { ordem: [], ocultos: [] }

export function nomeDoCookie(pagina: PaginaDeAnalise): string {
  return `autofluxos-blocos-${pagina}`
}

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string' && v.length <= 40).slice(0, 40) : []
}

export function lerArranjo(texto: string | undefined): Arranjo {
  if (!texto) return ARRANJO_VAZIO
  try {
    const bruto = JSON.parse(decodeURIComponent(texto)) as { o?: unknown; h?: unknown }
    return { ordem: listaDeTexto(bruto.o), ocultos: listaDeTexto(bruto.h) }
  } catch {
    return ARRANJO_VAZIO
  }
}

export function escreverArranjo(arranjo: Arranjo): string {
  return encodeURIComponent(JSON.stringify({ o: arranjo.ordem, h: arranjo.ocultos }))
}

/**
 * A ordem final dos blocos que existem: os que o cookie conhece, na ordem
 * dele, e os novos encaixados logo depois do vizinho que os precede no padrão.
 */
export function ordenarBlocos(padrao: string[], arranjo: Arranjo): string[] {
  const existentes = new Set(padrao)
  const salvos = arranjo.ordem.filter((id, i, todos) => existentes.has(id) && todos.indexOf(id) === i)
  if (salvos.length === 0) return [...padrao]
  const resultado = [...salvos]
  padrao.forEach((id, i) => {
    if (resultado.includes(id)) return
    const anterior = padrao.slice(0, i).reverse().find((v) => resultado.includes(v))
    resultado.splice(anterior === undefined ? 0 : resultado.indexOf(anterior) + 1, 0, id)
  })
  return resultado
}

/** Troca um bloco de lugar com o vizinho visível, pulando os escondidos. */
export function moverBloco(ordem: string[], ocultos: string[], id: string, direcao: -1 | 1): string[] {
  const visiveis = ordem.filter((v) => !ocultos.includes(v))
  const pos = visiveis.indexOf(id)
  const alvo = visiveis[pos + direcao]
  if (pos === -1 || alvo === undefined) return ordem
  const nova = [...ordem]
  const a = nova.indexOf(id)
  const b = nova.indexOf(alvo)
  nova[a] = alvo
  nova[b] = id
  return nova
}
