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
  // Link no lugar do código não vai no texto: o botão já leva a ele.
  const bruto = pedido.rastreios[0]?.codigo || pedido.entrega?.codigo || ''
  const codigo = codigoDaFreteRapido(bruto) ?? (/^https?:\/\//i.test(bruto) ? '' : bruto)
  if (codigo) linhas.push(`Código de rastreio: ${codigo}`)

  if (pedido.itens.length > 0) {
    linhas.push('', ...pedido.itens.slice(0, 5).map((i) => `• ${i.quantidade}x ${i.nome}`))
    if (pedido.itens.length > 5) linhas.push(`• e mais ${pedido.itens.length - 5} item(ns)`)
  }
  if (pedido.total) linhas.push(`Total: ${pedido.total}`)
  return linhas.join('\n')
}

/**
 * A página pública de rastreio da Frete Rápido, quando o pedido tem o código.
 *
 * O código é o `id_frete` deles (`FR260928DHHN5`: FR, a data e um sufixo) e
 * o link é `ondeestameupedido.com.br/<código>`, confirmado em 30/set/2026 na
 * própria API (`url_rastreio` do frete do pedido 000001955 da PCYES). Ele
 * chega pelo rastreio do envio no Magento; sem esse código, `null`.
 */
export function linkDoRastreio(pedido: Pick<PedidoDaLoja, 'rastreios'>): string | null {
  const codigo = pedido.rastreios.map((r) => codigoDaFreteRapido(r.codigo)).find(Boolean)
  return codigo ? `https://ondeestameupedido.com.br/${codigo}` : null
}

/**
 * O código FR, venha ele puro ou dentro do link. A PCYES grava no rastreio do
 * envio o link inteiro (`https://ondeestameupedido.com.br/FR260928DHHN5`),
 * não o código (30/set/2026).
 */
export function codigoDaFreteRapido(rastreio: string): string | null {
  const m = /(?:^|ondeestameupedido\.com\.br\/)(FR\d{6}[A-Z0-9]{3,})\/?$/i.exec(rastreio.trim())
  return m ? m[1]!.toUpperCase() : null
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
