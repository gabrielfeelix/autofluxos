import { LIMITE_ATRASO_SEGUNDOS, LIMITE_PARTES, type NoMensagem, type Parte } from './schema'
import { partesDaMensagem } from './mensagem'

/**
 * Pôr (ou tirar) o "digitando…" em vários blocos de uma vez.
 *
 * **Por que em lote.** O atraso antes de falar é uma decisão de ritmo da
 * conversa inteira, não de um bloco: quem quer que o bot pareça gente quer isso
 * em toda fala, e um fluxo de vinte blocos custava vinte idas ao painel — com o
 * risco de sobrar um bloco instantâneo no meio, que é justamente o que denuncia
 * o robô.
 *
 * **Só dois tipos de bloco falam.** Mensagem e mídia. Pergunta, condição,
 * guardar e o resto não mandam texto, então não têm o que atrasar — e dizer que
 * "aplicou em 9 blocos" quando 5 ignoraram seria mentira na tela. Por isso a
 * conta de quantos mudaram sai daqui, e não da tela.
 */

/** Os blocos que têm o que atrasar. */
export const TIPOS_COM_ATRASO = ['mensagem', 'midia'] as const

export function aceitaAtraso(tipo: string): boolean {
  return (TIPOS_COM_ATRASO as readonly string[]).includes(tipo)
}

/** Segundos dentro do que o schema aceita — a tela pode mandar qualquer coisa. */
function segundosValidos(segundos: number): number {
  if (!Number.isFinite(segundos)) return 0
  return Math.min(Math.max(Math.round(segundos), 0), LIMITE_ATRASO_SEGUNDOS)
}

/**
 * Os dados do bloco com o atraso trocado. `null` quando nada muda — bloco que
 * não fala, ou que já estava exatamente assim.
 *
 * Zero **tira** o atraso, em vez de esperar zero segundo. É o que faz o mesmo
 * controle servir para desfazer o lote inteiro.
 *
 * No bloco de mensagem o atraso é um pedaço da pilha e precisa vir **na
 * frente**: no meio dela, a espera aconteceria depois de a fala já ter saído,
 * que é outro comportamento. Escreve `partes` porque é o único formato que o
 * editor escreve — `partesDaMensagem` lê o formato antigo e devolve a pilha
 * equivalente, então grafo velho entra no lote sem migration nenhuma.
 */
export function dadosComAtraso(
  tipo: string,
  data: Record<string, unknown>,
  segundos: number,
): Record<string, unknown> | null {
  const quanto = segundosValidos(segundos)

  if (tipo === 'midia') {
    const atual = typeof data.atraso === 'number' ? data.atraso : 0
    if (atual === quanto) return null
    if (quanto === 0) {
      const resto = { ...data }
      delete resto.atraso
      return resto
    }
    return { ...data, atraso: quanto }
  }

  if (tipo !== 'mensagem') return null

  const partes = partesDaMensagem({
    id: 'lote',
    type: 'mensagem',
    position: { x: 0, y: 0 },
    data: data as NoMensagem['data'],
  })

  const primeira = partes[0]
  const jaTemNaFrente = primeira?.tipo === 'atraso'

  if (quanto === 0) {
    if (!jaTemNaFrente) return null
    return { ...data, partes: partes.slice(1) }
  }

  if (jaTemNaFrente) {
    if (primeira.segundos === quanto) return null
    const novas: Parte[] = [{ tipo: 'atraso', segundos: quanto }, ...partes.slice(1)]
    return { ...data, partes: novas }
  }

  // Pilha cheia: o pedaço não cabe, e crescer além do limite geraria um bloco
  // que o schema recusa na hora de salvar.
  if (partes.length >= LIMITE_PARTES) return null

  return { ...data, partes: [{ tipo: 'atraso', segundos: quanto }, ...partes] satisfies Parte[] }
}

/**
 * O lote inteiro. Devolve os blocos já trocados e quantos de fato mudaram — a
 * tela precisa do número para não prometer o que não fez.
 */
export function aplicarAtrasoEmLote<T extends { id: string; type?: string; data: Record<string, unknown> }>(
  blocos: T[],
  ids: string[],
  segundos: number,
): { blocos: T[]; mudados: number } {
  const alvo = new Set(ids)
  let mudados = 0

  const saida = blocos.map((bloco) => {
    if (!alvo.has(bloco.id)) return bloco
    const dados = dadosComAtraso(bloco.type ?? '', bloco.data, segundos)
    if (dados === null) return bloco
    mudados += 1
    return { ...bloco, data: dados }
  })

  return { blocos: saida, mudados }
}
