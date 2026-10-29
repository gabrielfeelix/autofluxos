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

const DUVIDA = 'Se ficou alguma dúvida sobre produto, frete ou pagamento, é só responder esta mensagem.'

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
      corpo: `Oi, {{1}}! O {{2}} que você escolheu na ${loja.nome} continua no seu carrinho.\n\n${DUVIDA}`,
      rodape: SAIR,
      botoes: [botao],
    },
    exemplos: ['Maria', 'Headset Gamer'],
    exemplosDoCartao: [],
  }
  const carrosseis = Array.from({ length: CARTOES_DO_CARROSSEL.maximo - 1 }, (_, i): ModeloDoCarrinho => {
    const cartoes = i + CARTOES_DO_CARROSSEL.minimo
    return {
      nome: `${PREFIXO_DO_CARRINHO}${cartoes}`,
      componentes: {
        corpo: `Oi, {{1}}! Os itens que você escolheu na ${loja.nome} continuam no seu carrinho. ${DUVIDA}\n\n${SAIR}`,
        carrossel: { cartoes, cabecalho: 'imagem', corpo: 'Este item ficou esperando por você no carrinho: {{1}}, por {{2}} no site da loja.', botoes: [botao], exemplo: loja.exemplo },
      },
      exemplos: ['Maria'],
      exemplosDoCartao: ['Headset Gamer', 'R$ 349,90'],
    }
  })
  return [umItem, ...carrosseis]
}
