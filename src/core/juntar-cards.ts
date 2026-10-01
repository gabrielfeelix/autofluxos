import type { Acao } from './engine/types'
import type { ProdutoDaLoja } from './loja'

/**
 * A frase da IA seguida dos cards que ela apresenta vira uma ação só.
 *
 * Desde 1/out/2026 cada mensagem de serviço é cobrada, e "Veja três opções" +
 * três cards eram quatro. Juntas saem numa (o carrossel do WhatsApp). Só junta
 * quando **todo** produto sai como card com foto, a frase cabe no corpo e
 * nenhum dos dois espera antes de sair; senão fica como estava.
 */
export function juntarFraseAosCards(acoes: Acao[], saiComoCard: (p: ProdutoDaLoja) => boolean): Acao[] {
  const saida: Acao[] = []
  for (let i = 0; i < acoes.length; i++) {
    const acao = acoes[i]!
    const seguinte = acoes[i + 1]
    if (
      acao.tipo === 'enviar_texto' &&
      !acao.atrasoMs &&
      seguinte?.tipo === 'enviar_produtos' &&
      !seguinte.atrasoMs &&
      !seguinte.texto &&
      seguinte.produtos.length > 0 &&
      seguinte.produtos.length <= 10 &&
      acao.texto.trim().length > 0 &&
      acao.texto.length <= LIMITE_DA_FRASE_JUNTO_DOS_CARDS &&
      seguinte.produtos.every(saiComoCard)
    ) {
      saida.push({ ...seguinte, texto: semRepetirOsCards(acao.texto, seguinte.produtos) })
      i++
      continue
    }
    saida.push(acao)
  }
  return saida
}

/** O corpo do carrossel aceita 1024; o do card único, 1024 com o card dentro. */
const LIMITE_DA_FRASE_JUNTO_DOS_CARDS = 800

/**
 * Textos seguidos do robô numa mensagem só (pedido de 01/out/2026: a Meta
 * cobra cada mensagem desde esse dia, e a PCYES media ~6 por conversa).
 *
 * Junta, na ordem em que sairiam:
 *
 * - texto seguido de texto, num parágrafo cada;
 * - texto seguido de botões ou lista, como começo do corpo da pergunta.
 *
 * O teto é de caractere e não de quantidade: o que passa dele sai separado,
 * como antes. 1.000 cabe no corpo de botões do WhatsApp (1.024) e no texto do
 * Instagram (1.000), e é o limite de uma bolha que ainda se lê no celular.
 *
 * Não junta quando a segunda tem atraso, que é o desenho pedindo pausa entre
 * as duas, nem pergunta com foto em cima, que já sai em mensagem própria.
 */
export const TETO_DA_BOLHA_JUNTADA = 1_000

/**
 * Ações que não mandam nada nem mudam quem conduz: o texto pode passar por
 * cima delas para encontrar o seguinte. Transferir, encerrar e ir para outro
 * fluxo ficam de fora de propósito, porque mudam o que vem depois.
 */
const SILENCIOSAS = new Set<Acao['tipo']>([
  'salvar_campo',
  'mover_etapa',
  'aplicar_etiqueta',
  'escrever_nota',
  'guardar_nota',
  'guardar_comentario',
])

export function juntarTextosSeguidos(acoes: Acao[]): Acao[] {
  const saida: Acao[] = []
  // Onde está o último texto que ainda pode receber o seguinte.
  let aberto = -1
  for (const acao of acoes) {
    if (SILENCIOSAS.has(acao.tipo)) {
      saida.push(acao)
      continue
    }
    const anterior = aberto >= 0 ? saida[aberto] : undefined
    const semAtraso = !('atrasoMs' in acao && acao.atrasoMs)
    if (anterior?.tipo === 'enviar_texto' && semAtraso && anterior.texto.trim()) {
      if (acao.tipo === 'enviar_texto' && acao.texto.trim()) {
        const texto = `${anterior.texto}\n\n${acao.texto}`
        if (texto.length <= TETO_DA_BOLHA_JUNTADA) {
          saida[aberto] = { ...anterior, texto }
          continue
        }
      }
      if (acao.tipo === 'enviar_opcoes' && !acao.imagem) {
        const texto = acao.texto.trim() ? `${anterior.texto}\n\n${acao.texto}` : anterior.texto
        if (texto.length <= TETO_DA_BOLHA_JUNTADA) {
          saida[aberto] = { ...acao, texto, ...(anterior.atrasoMs ? { atrasoMs: anterior.atrasoMs } : {}) }
          aberto = -1
          continue
        }
      }
    }
    saida.push(acao)
    aberto = acao.tipo === 'enviar_texto' ? saida.length - 1 : -1
  }
  return saida
}

/**
 * Tira da frase as linhas que repetem o card: nome do produto, preço, link.
 *
 * A regra está no prompt, e o modelo às vezes não segue: o mousepad do Evandro
 * (PCYES, 01/out/2026) saiu com nome, preço e link no texto e de novo no card
 * logo abaixo. Linha que só repete o card some; frase que cita o produto no
 * meio de uma explicação fica.
 */
export function semRepetirOsCards(texto: string, produtos: readonly ProdutoDaLoja[]): string {
  const nomes = new Set(produtos.map((p) => normalizar(p.nome)))
  const links = produtos.map((p) => p.link).filter(Boolean)
  const linhas = texto.split('\n').filter((linha) => {
    const limpa = normalizar(linha.replace(/[*_•-]/g, ''))
    if (limpa === '') return true
    if (nomes.has(limpa)) return false
    if (/https?:\/\//.test(linha) && (links.some((l) => linha.includes(l)) || /^\s*https?:\/\/\S+\s*$/.test(linha))) return false
    if (/^r\$\s?[\d.,]+(,|\s|$)/i.test(limpa) && /estoque|à vista|no pix|parcel|de r\$/i.test(limpa + ' ')) return false
    if (/^r\$\s?[\d.,]+$/i.test(limpa)) return false
    return true
  })
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ')
}
