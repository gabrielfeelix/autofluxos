import type { EntregaDoPedido, StatusDePedido } from './pedidos'

/**
 * Os modelos aprovados que avisam a etapa do pedido fora das 24 horas.
 *
 * Dentro da janela o aviso sai como texto (`avisoDoStatus`); fora dela só
 * modelo aprovado chega, e é o caso de quem pediu pelo cardápio digital e
 * nunca abriu conversa. A conta cria os quatro com um clique (Pedidos), e a
 * Meta casa pelo nome. Utilidade: preso à transação, ~R$ 0,035 por envio.
 *
 * Corpo sempre na mesma ordem: `{{1}}` número do pedido, `{{2}}` nome da loja.
 */

export type ModeloDoPedido = {
  status: StatusDePedido
  entrega: EntregaDoPedido | 'qualquer'
  nome: string
  corpo: string
}

export const MODELOS_DO_PEDIDO: readonly ModeloDoPedido[] = [
  {
    status: 'em_preparo',
    entrega: 'qualquer',
    nome: 'aviso_pedido_em_preparo',
    corpo: 'Atualização do pedido {{1}}, feito em {{2}}: seu pedido está em preparo. Avisaremos por aqui assim que ele estiver pronto.',
  },
  {
    status: 'saiu',
    entrega: 'entrega',
    nome: 'aviso_pedido_saiu_entrega',
    corpo: 'Atualização do pedido {{1}}, feito em {{2}}: seu pedido saiu para entrega e deve chegar em breve.',
  },
  {
    status: 'saiu',
    entrega: 'retirada',
    nome: 'aviso_pedido_pronto_retirada',
    corpo: 'Atualização do pedido {{1}}, feito em {{2}}: seu pedido está pronto para retirada.',
  },
  {
    status: 'cancelado',
    entrega: 'qualquer',
    nome: 'aviso_pedido_cancelado',
    corpo: 'Atualização do pedido {{1}}, feito em {{2}}: seu pedido foi cancelado. Se tiver alguma dúvida, responda esta mensagem.',
  },
]

export const EXEMPLOS_DO_MODELO_DO_PEDIDO = ['1042', 'Pizzaria Bella Napoli']

/** O modelo da etapa, ou `null` quando a etapa não avisa. Consumo no local conta como retirada. */
export function modeloDaEtapa(status: StatusDePedido, entrega: EntregaDoPedido): ModeloDoPedido | null {
  const comoRetira = entrega === 'entrega' ? 'entrega' : 'retirada'
  return MODELOS_DO_PEDIDO.find((m) => m.status === status && (m.entrega === 'qualquer' || m.entrega === comoRetira)) ?? null
}

/** Os valores do corpo, ou `null` quando falta algum: a Meta recusa parâmetro vazio. */
export function valoresDoAviso(numero: string, loja: string): string[] | null {
  const valores = [numero.trim(), loja.trim()]
  return valores.every(Boolean) ? valores : null
}
