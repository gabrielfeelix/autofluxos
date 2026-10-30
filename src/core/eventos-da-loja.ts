/**
 * O status do pedido da loja como evento (0153), sem o lojista precisar de
 * desenvolvedor: o Dialogon lê os pedidos da Magento conectada e cada
 * mudança de status vira `pedido.<status>`, o mesmo nome que um webhook
 * mandaria. O gatilho de Automações > Eventos decide o que acontece.
 *
 * Por que consulta e não webhook da Magento: a Magento aberta não avisa
 * mudança de pedido sem módulo instalado, e instalar módulo é justamente o
 * desenvolvedor que o lojista não tem. O token que a conta já conectou lê
 * `/V1/orders` por `updated_at`.
 */

/** Os status padrão da Magento, com o nome do evento e o que ele quer dizer. */
export const EVENTOS_DA_LOJA = [
  { status: 'processing', evento: 'pedido.processando', rotulo: 'pagamento aprovado, em separação' },
  { status: 'complete', evento: 'pedido.concluido', rotulo: 'faturado e enviado' },
  { status: 'canceled', evento: 'pedido.cancelado', rotulo: 'cancelado' },
  { status: 'holded', evento: 'pedido.retido', rotulo: 'retido pela loja' },
  { status: 'closed', evento: 'pedido.reembolsado', rotulo: 'reembolsado' },
] as const

/**
 * O evento de um status da loja. Status próprio da loja (`em_transporte`,
 * `entregue`) vira `pedido.<status>` como veio, para quem criou o status
 * poder ligar um gatilho a ele.
 */
export function eventoDoStatus(status: string): string | null {
  const limpo = status.trim().toLowerCase()
  if (!/^[a-z0-9_]{1,40}$/.test(limpo)) return null
  return EVENTOS_DA_LOJA.find((e) => e.status === limpo)?.evento ?? `pedido.${limpo}`
}

export type PedidoLido = {
  increment_id?: unknown
  status?: unknown
  updated_at?: unknown
  customer_id?: unknown
  customer_firstname?: unknown
  customer_lastname?: unknown
  customer_email?: unknown
  grand_total?: unknown
  billing_address?: { telephone?: unknown; firstname?: unknown; lastname?: unknown }
  extension_attributes?: Record<string, unknown>
}

/**
 * Os dados do aviso, com os nomes que o fluxo usa (`{{nome}}`, `{{pedido}}`,
 * `{{customer_id}}`). Os campos simples de `extension_attributes` vêm junto: é
 * onde um módulo da loja põe o aceite de WhatsApp (`aceita_whatsapp`).
 */
export function dadosDoPedido(pedido: PedidoLido): Record<string, string | number | boolean> {
  const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')
  const dados: Record<string, string | number | boolean> = {}
  for (const [chave, valor] of Object.entries(pedido.extension_attributes ?? {})) {
    if (!/^\w{1,40}$/.test(chave)) continue
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') dados[chave] = valor
  }
  const proprios = {
    pedido: texto(pedido.increment_id),
    status: texto(pedido.status),
    nome: texto(pedido.customer_firstname) || texto(pedido.billing_address?.firstname),
    sobrenome: texto(pedido.customer_lastname) || texto(pedido.billing_address?.lastname),
    email: texto(pedido.customer_email),
    customer_id: texto(pedido.customer_id),
    total: texto(pedido.grand_total),
  }
  for (const [chave, valor] of Object.entries(proprios)) if (valor) dados[chave] = valor
  return comAceite(dados)
}

/**
 * Os atributos próprios do cadastro do cliente na Magento
 * (`custom_attributes`), juntos aos dados do aviso. É onde a loja guarda o
 * aceite de WhatsApp (`aceita_whatsapp`, na PCYES). O que o pedido já trouxe
 * ganha: o cadastro só completa.
 */
export function comAtributosDoCliente(
  dados: Record<string, string | number | boolean>,
  cliente: { custom_attributes?: { attribute_code?: unknown; value?: unknown }[] } | null,
): Record<string, string | number | boolean> {
  const juntos = { ...dados }
  for (const { attribute_code: codigo, value: valor } of cliente?.custom_attributes ?? []) {
    if (typeof codigo !== 'string' || !/^\w{1,40}$/.test(codigo) || codigo in juntos) continue
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') juntos[codigo] = valor
  }
  return comAceite(juntos)
}

/** "1" e "true" de um atributo da Magento valem como aceite. */
function comAceite(dados: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const aceite = dados.aceita_whatsapp
  if (aceite === '1' || aceite === 'true' || aceite === 1) return { ...dados, aceita_whatsapp: true }
  return dados
}

/** O telefone do pedido, só dígitos, da cobrança. */
export function telefoneDoPedido(pedido: PedidoLido): string {
  const bruto = pedido.billing_address?.telephone
  return typeof bruto === 'string' || typeof bruto === 'number' ? String(bruto).replace(/\D/g, '') : ''
}

/**
 * O `updated_at` da Magento (`2026-10-26 18:04:11`, UTC sem fuso) como
 * instante, e de volta. A consulta compara texto no formato da loja.
 */
export function instanteDaLoja(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(valor)) return null
  const data = new Date(`${valor.replace(' ', 'T')}Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

export function formatoDaLoja(data: Date): string {
  return data.toISOString().slice(0, 19).replace('T', ' ')
}
