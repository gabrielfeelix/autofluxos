import { CARTOES_DO_CARROSSEL, type Componentes } from './templates'

/**
 * Os modelos da recuperação de carrinho, um por quantidade de itens.
 *
 * **Por que dez modelos e não um.** A Meta só envia um carrossel com o número
 * de cartões com que ele foi aprovado. Então existe um modelo por tamanho de
 * carrinho, e o sistema da loja escolhe pelo número de itens: `carrinho_3`
 * para três. Carrossel tem no mínimo 2 cartões, por isso o de um item é foto
 * no topo e texto (`carrinho_1`). Carrinho com mais de 10 manda os 10 primeiros
 * no `carrinho_10`. (Ideia do Gabriel, 29/out/2026.)
 *
 * Todos são marketing: só vão para quem não pediu para sair das promoções
 * (`POST /mensagens/template` confere). Puro e sem rede.
 */

export const PREFIXO_DO_CARRINHO = 'carrinho_'

export type ModeloDoCarrinho = {
  nome: string
  componentes: Componentes
  exemplos: string[]
  exemplosDoCartao: string[]
}

const SAIR = 'Para não receber promoções, responda SAIR.'

const DUVIDA = 'Quer ajuda pra decidir? Pergunta sobre produto, frete ou pagamento é só responder aqui. 💬'

/**
 * O preço vem pronto de quem integra, numa variável só: "Por *R$ 349,90*" ou,
 * em promoção, "De ~R$ 399,90~ por *R$ 349,90*". Assim o mesmo modelo serve
 * aos dois casos, sem dobrar a família (decisão do Gabriel, 29/out/2026).
 */
const PRECO_DE_EXEMPLO = 'De ~R$ 399,90~ por *R$ 349,90*'

/** O endereço da loja sem barra no fim: o botão é `<endereço>/{{1}}`, e o fim vem do carrinho. */
function base(endereco: string): string {
  return endereco.trim().replace(/\/+$/, '')
}

/**
 * Os dez modelos, do `carrinho_1` ao `carrinho_10`.
 *
 * O texto do cartão não começa nem termina em variável: a Meta recusa corpo
 * assim ("parâmetro no começo ou no fim"), e o ponto final resolve o fim.
 */
export function modelosDoCarrinho(loja: { nome: string; endereco: string; exemplo: string }): ModeloDoCarrinho[] {
  const botao = { tipo: 'URL' as const, texto: 'Finalizar compra', valor: `${base(loja.endereco)}/{{1}}` }
  const umItem: ModeloDoCarrinho = {
    nome: `${PREFIXO_DO_CARRINHO}1`,
    componentes: {
      cabecalho: { tipo: 'imagem', url: loja.exemplo },
      corpo: `Oi, {{1}}! 👋\n\n🎮 *{{2}}* continua no seu carrinho na *${loja.nome}*, do jeito que você deixou.\n{{3}}.\n\n${DUVIDA}`,
      rodape: SAIR,
      botoes: [botao],
    },
    exemplos: ['Maria', 'Headset Gamer Zero', PRECO_DE_EXEMPLO],
    exemplosDoCartao: [],
  }
  const carrosseis = Array.from({ length: CARTOES_DO_CARROSSEL.maximo - 1 }, (_, i): ModeloDoCarrinho => {
    const cartoes = i + CARTOES_DO_CARROSSEL.minimo
    return {
      nome: `${PREFIXO_DO_CARRINHO}${cartoes}`,
      componentes: {
        corpo: `Oi, {{1}}! 👋\n\nSeu carrinho na *${loja.nome}* continua do jeito que você deixou. 🛒\n\n${DUVIDA}\n\n_${SAIR}_`,
        carrossel: { cartoes, cabecalho: 'imagem', corpo: '🎮 *{{1}}*\n{{2}}. Ele continua separado no seu carrinho.', botoes: [botao], exemplo: loja.exemplo },
      },
      exemplos: ['Maria'],
      exemplosDoCartao: ['Headset Gamer Zero', PRECO_DE_EXEMPLO],
    }
  })
  return [umItem, ...carrosseis]
}
