import type { EntregaDoPedido, StatusDePedido } from './pedidos'

/**
 * Os modelos aprovados que avisam a etapa do pedido fora das 24 horas.
 *
 * Dentro da janela o aviso sai como texto (`avisoDoStatus`); fora dela só
 * modelo aprovado chega, e é o caso de quem pediu pelo cardápio digital e
 * nunca abriu conversa. A conta cria os quatro com um clique (Pedidos), e a
 * Meta casa pelo nome. Utilidade: preso à transação, ~R$ 0,035 por envio.
 *
 * Um valor só, `{{1}}`, o número do pedido; o `#` já está no corpo. A loja
 * não aparece: a mensagem sai do número dela. Texto aprovado pelo Gabriel em
 * 27/out/2026, igual ao de dentro da janela (`avisoDoStatus`).
 */

export type ModeloDoPedido = {
  status: StatusDePedido
  entrega: EntregaDoPedido | 'qualquer'
  nome: string
  corpo: string
  /** Botão de link com o fim variável (`{{1}}` no fim da URL), preenchido em cada envio. */
  botao?: { texto: string; url: string }
}

export const MODELOS_DO_PEDIDO: readonly ModeloDoPedido[] = [
  {
    status: 'em_preparo',
    entrega: 'qualquer',
    nome: 'aviso_pedido_em_preparo',
    corpo: 'Boa notícia! Seu pedido #{{1}} já está em preparo. Assim que ele sair, avisamos por aqui.',
  },
  {
    status: 'saiu',
    entrega: 'entrega',
    nome: 'aviso_pedido_saiu_entrega',
    corpo: 'Seu pedido está a caminho! O pedido #{{1}} saiu para entrega e chega em breve.',
  },
  {
    status: 'saiu',
    entrega: 'retirada',
    nome: 'aviso_pedido_pronto_retirada',
    corpo: 'Tudo pronto! Seu pedido #{{1}} já pode ser retirado. Estamos esperando por você.',
  },
  {
    status: 'cancelado',
    entrega: 'qualquer',
    nome: 'aviso_pedido_cancelado',
    corpo: 'Seu pedido #{{1}} foi cancelado. Se tiver alguma dúvida, é só responder esta mensagem.',
  },
]

export const PREFIXO_DO_RASTREIO_DA_FOODY = 'https://app.foodydelivery.com/trk/'

/**
 * O "saiu para entrega" com o botão que abre o mapa do entregador, quando o
 * pedido traz o link de rastreio da Foody. Fica fora de `MODELOS_DO_PEDIDO`
 * de propósito: conta sem Foody não precisa dele, e a tela de Pedidos não
 * deve cobrar um modelo que ela nunca vai usar. Sem ele aprovado, o aviso sai
 * pelo `aviso_pedido_saiu_entrega`. Texto aprovado pelo Gabriel em 27/out/2026.
 */
export const MODELO_DE_RASTREIO: ModeloDoPedido = {
  status: 'saiu',
  entrega: 'entrega',
  nome: 'aviso_pedido_saiu_rastreio',
  corpo: 'Seu pedido está a caminho! O pedido #{{1}} saiu para entrega. Acompanhe o entregador em tempo real pelo botão abaixo.',
  botao: { texto: 'Acompanhar entrega', url: `${PREFIXO_DO_RASTREIO_DA_FOODY}{{1}}` },
}

/** O fim do link de rastreio da Foody, que vai no botão, ou `null` quando o link não é dela. */
export function fimDoRastreio(url: string | null): string | null {
  if (!url?.startsWith(PREFIXO_DO_RASTREIO_DA_FOODY)) return null
  const fim = url.slice(PREFIXO_DO_RASTREIO_DA_FOODY.length)
  return /^[\w-]{1,100}$/.test(fim) ? fim : null
}

export const EXEMPLOS_DO_MODELO_DO_PEDIDO = ['1042']

/** O modelo da etapa, ou `null` quando a etapa não avisa. Consumo no local conta como retirada. */
export function modeloDaEtapa(status: StatusDePedido, entrega: EntregaDoPedido): ModeloDoPedido | null {
  const comoRetira = entrega === 'entrega' ? 'entrega' : 'retirada'
  return MODELOS_DO_PEDIDO.find((m) => m.status === status && (m.entrega === 'qualquer' || m.entrega === comoRetira)) ?? null
}

/** O valor do corpo, sem o `#` que a plataforma às vezes manda, ou `null` quando vazio: a Meta recusa parâmetro vazio. */
export function valoresDoAviso(numero: string): string[] | null {
  const limpo = numero.trim().replace(/^#/, '').trim()
  return limpo ? [limpo] : null
}
