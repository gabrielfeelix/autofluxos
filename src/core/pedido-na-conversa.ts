import type { PedidoDaLoja } from '@/loja/magento-pedido'

/**
 * O status do pedido como sai no WhatsApp, quando quem atende manda pela Inbox.
 *
 * Tudo o que a pessoa costuma perguntar numa mensagem só (desde 1/out/2026 cada
 * uma é cobrada): em que pé está, quando chega, com quem, o que foi comprado e
 * quanto deu. Vai como corpo do card com a foto do produto e o botão de
 * rastreio (`acoes-pedido-do-inbox.ts`). Marcação do WhatsApp: *negrito* com
 * um asterisco.
 *
 * A linha do tempo (pago, separado, transportadora, entregue) é o desenho que
 * loja grande usa no app, feito com o que o WhatsApp tem: emoji e quebra de
 * linha. Situação fora do caminho feliz (cancelado, em análise) não ganha
 * linha do tempo, que mentiria um progresso: sai só a situação.
 */
export function mensagemDoPedido(pedido: PedidoDaLoja): string {
  const linhas = [`📦 *Pedido #${pedido.numero}*`, '']

  const etapa = etapaDoPedido(pedido)
  if (etapa === null) linhas.push(`Situação: *${pedido.situacao}*`)
  else linhas.push(...linhaDoTempo(etapa))

  const detalhes: string[] = []
  const previsao = etapa === 3 ? '' : dataComDia(pedido.entrega?.previsao ?? '')
  if (previsao) detalhes.push(`📅 Previsão de entrega: *${previsao}*`)

  const transportadora = nomeCurto(pedido.entrega?.transportadora || pedido.rastreios[0]?.transportadora || '')
  // Link no lugar do código não vai no texto: o botão já leva a ele.
  const bruto = pedido.rastreios[0]?.codigo || pedido.entrega?.codigo || ''
  const codigo = codigoDaFreteRapido(bruto) ?? (/^https?:\/\//i.test(bruto) ? '' : bruto)
  const envio = [transportadora, codigo].filter(Boolean).join(' · ')
  if (envio) detalhes.push(`🚛 ${envio}`)

  const ultima = pedido.andamento?.[0]
  if (ultima) detalhes.push(`📍 ${ultima.texto}, ${ultima.quando}`)
  else if (pedido.entrega?.ultima) {
    const { situacao, quando } = pedido.entrega.ultima
    detalhes.push(`📍 ${situacao}${quando ? `, ${dataCurta(quando)}` : ''}`)
  }
  if (detalhes.length > 0) linhas.push('', ...detalhes)

  if (pedido.itens.length > 0) {
    linhas.push('', ...pedido.itens.slice(0, 5).map((i) => `${i.quantidade}x ${i.nome}`))
    if (pedido.itens.length > 5) linhas.push(`e mais ${pedido.itens.length - 5} item(ns)`)
  }
  if (pedido.total) linhas.push(`*Total: ${pedido.total}*`)
  return linhas.join('\n')
}

/**
 * As quatro etapas: o rótulo de quando já passou, de quando é a atual e de
 * quando ainda vem. O de depois é escrito no futuro: "⚪ Entregue" numa lista
 * lia como entrega feita (06/out/2026, revisão do card).
 */
const ETAPAS = [
  { feita: 'Pagamento aprovado', atual: '⏳ *Aguardando pagamento*', depois: 'Aprovação do pagamento' },
  { feita: 'Pedido separado', atual: '📦 *Em separação*', depois: 'Separação do pedido' },
  { feita: 'Com a transportadora', atual: '🚚 *Com a transportadora*', depois: 'Envio pela transportadora' },
  { feita: 'Entregue', atual: '🏠 *Entregue*', depois: 'Entrega no seu endereço' },
] as const

function linhaDoTempo(etapa: number): string[] {
  return ETAPAS.map((e, i) => (i < etapa ? `✅ ${e.feita}` : i === etapa ? e.atual : `⚪ ${e.depois}`))
}

/**
 * Em que etapa o pedido está, de 0 (pagamento) a 3 (entregue). `null` fora do
 * caminho feliz. Entregue vem da Frete Rápido, que é quem sabe; "Entregue à
 * transportadora", o status da PCYES, é a etapa 2.
 */
export function etapaDoPedido(pedido: Pick<PedidoDaLoja, 'situacaoCodigo' | 'entrega'>): number | null {
  const ultima = pedido.entrega?.ultima?.situacao ?? ''
  if (/entreg(ue|a realizada)/i.test(ultima) && !/transportadora/i.test(ultima)) return 3
  switch (pedido.situacaoCodigo) {
    case 'pending':
    case 'pending_payment':
    case 'payment_review':
      return 0
    case 'processing':
      return 1
    case 'complete':
    case 'delivered_carrier':
      return 2
    default:
      return null
  }
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** "2026-10-08" vira "qua, 08/10"; o que não é data passa como `dataCurta`. */
export function dataComDia(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim())
  if (!m) return dataCurta(data)
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return `${DIAS[dia]}, ${m[3]}/${m[2]}`
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
