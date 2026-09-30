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
      saida.push({ ...seguinte, texto: acao.texto })
      i++
      continue
    }
    saida.push(acao)
  }
  return saida
}

/** O corpo do carrossel aceita 1024; o do card único, 1024 com o card dentro. */
const LIMITE_DA_FRASE_JUNTO_DOS_CARDS = 800
