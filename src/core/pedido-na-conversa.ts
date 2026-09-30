import type { PedidoDaLoja } from '@/loja/magento-pedido'

/**
 * O status do pedido como sai no WhatsApp, quando quem atende manda pela Inbox.
 *
 * Tudo o que a pessoa costuma perguntar numa mensagem só (desde 1/out/2026 cada
 * uma é cobrada): em que pé está, com quem, quando chega, o que foi comprado e
 * quanto deu. Marcação do WhatsApp: *negrito* com um asterisco.
 */
export function mensagemDoPedido(pedido: PedidoDaLoja): string {
  const linhas = [`📦 *Pedido #${pedido.numero}*`, `Situação: *${pedido.situacao}*`]

  const transportadora = pedido.entrega?.transportadora || pedido.rastreios[0]?.transportadora || ''
  if (transportadora) linhas.push(`Transportadora: ${nomeCurto(transportadora)}`)
  const previsao = dataCurta(pedido.entrega?.previsao ?? '')
  if (previsao) linhas.push(`Previsão de entrega: *${previsao}*`)

  const ultima = pedido.andamento?.[0]
  if (ultima) linhas.push(`Última atualização: ${ultima.texto}, ${ultima.quando}`)
  else if (pedido.entrega?.ultima) {
    const { situacao, quando } = pedido.entrega.ultima
    linhas.push(`Última atualização: ${situacao}${quando ? `, ${dataCurta(quando)}` : ''}`)
  }
  const codigo = pedido.rastreios[0]?.codigo || pedido.entrega?.codigo || ''
  if (codigo) linhas.push(`Código de rastreio: ${codigo}`)

  if (pedido.itens.length > 0) {
    linhas.push('', ...pedido.itens.slice(0, 5).map((i) => `• ${i.quantidade}x ${i.nome}`))
    if (pedido.itens.length > 5) linhas.push(`• e mais ${pedido.itens.length - 5} item(ns)`)
  }
  if (pedido.total) linhas.push(`Total: ${pedido.total}`)
  return linhas.join('\n')
}

/** "BRASPRESS TRANSPORTES URGENTES LTDA" vira "Braspress". */
export function nomeCurto(razaoSocial: string): string {
  const primeira = razaoSocial.trim().split(/\s+/)[0] ?? ''
  if (!primeira) return ''
  return primeira.length <= 3 ? primeira.toUpperCase() : primeira[0]!.toUpperCase() + primeira.slice(1).toLowerCase()
}

/** "2026-10-02" (ou com hora) vira "02/10"; o resto passa como veio. */
export function dataCurta(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim())
  return m ? `${m[3]}/${m[2]}` : data.trim()
}
