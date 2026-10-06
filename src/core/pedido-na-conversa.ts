import type { PedidoDaLoja } from '@/loja/magento-pedido'

/**
 * O status do pedido como sai no WhatsApp, quando quem atende manda pela Inbox.
 *
 * Vai como corpo do card com a foto do produto e o botão de rastreio
 * (`acoes-pedido-do-inbox.ts`). A ordem é a da pergunta de quem recebe:
 *
 * 1. **A resposta, na primeira linha**: é ela que aparece na notificação e na
 *    lista de conversas. "📦 Pedido #000002025" ali não dizia nada.
 * 2. A previsão, logo embaixo.
 * 3. A linha do tempo, com a etapa atual em 🔵. Na etapa da transportadora, o
 *    rótulo é o último andamento real: o status "Entregue à transportadora"
 *    da PCYES sai antes da coleta, e "Com a transportadora" ao lado de
 *    "Aguardando coleta" se contradizia (revisão de 06/out/2026).
 * 4. Transportadora e código com rótulo escrito: código solto não diz o que é.
 * 5. Número e total no fim, como comprovante, e os itens em uma linha cada.
 *
 * Situação fora do caminho feliz (cancelado, em análise) não ganha linha do
 * tempo, que mentiria um progresso. Marcação do WhatsApp: *negrito*.
 */
export function mensagemDoPedido(pedido: PedidoDaLoja): string {
  const etapa = etapaDoPedido(pedido)
  const evento = ultimoAndamento(pedido)
  const linhas = [tituloDoPedido(pedido, etapa, evento)]

  const previsao = etapa === 3 ? '' : dataComDia(pedido.entrega?.previsao ?? '', 'longo')
  if (previsao) linhas.push(`Previsão de entrega: *${previsao}*`)

  if (etapa !== null) linhas.push('', ...linhaDoTempo(etapa, evento))

  const transportadora = nomeCurto(pedido.entrega?.transportadora || pedido.rastreios[0]?.transportadora || '')
  // Link no lugar do código não vai no texto: o botão já leva a ele.
  const bruto = pedido.rastreios[0]?.codigo || pedido.entrega?.codigo || ''
  const codigo = codigoDaFreteRapido(bruto) ?? (/^https?:\/\//i.test(bruto) ? '' : bruto)
  const envio = [
    ...(transportadora ? [`Transportadora: ${transportadora}`] : []),
    ...(codigo ? [`Código de rastreio: ${codigo}`] : []),
  ]
  if (envio.length > 0) linhas.push('', ...envio)

  linhas.push('', [`*Pedido #${pedido.numero}*`, pedido.total].filter(Boolean).join(' · '))
  linhas.push(...pedido.itens.slice(0, 3).map((i) => `${i.quantidade}x ${cortar(i.nome, LIMITE_DO_ITEM)}`))
  if (pedido.itens.length > 3) linhas.push(`e mais ${pedido.itens.length - 3} item(ns)`)
  return linhas.join('\n')
}

/** Cabe numa linha do WhatsApp no celular, com o "1x " na frente. */
const LIMITE_DO_ITEM = 34

/** Corta na última palavra inteira que cabe: "Sublim…" lia como erro. */
function cortar(texto: string, limite: number): string {
  const limpo = texto.trim()
  if (limpo.length <= limite) return limpo
  const corte = limpo.slice(0, limite)
  const espaco = corte.lastIndexOf(' ')
  return `${(espaco > limite / 2 ? corte.slice(0, espaco) : corte).trimEnd()}…`
}

/** A resposta em uma frase: o que aparece na notificação. */
function tituloDoPedido(pedido: PedidoDaLoja, etapa: number | null, evento: string): string {
  switch (etapa) {
    case 0:
      return '⏳ *Aguardando a confirmação do pagamento*'
    case 1:
      return '📦 *Estamos separando seu pedido*'
    case 2:
      return /aguardando coleta/i.test(evento) ? '📦 *Seu pedido está pronto para envio*' : '🚚 *Seu pedido está a caminho*'
    case 3:
      return '🏠 *Seu pedido foi entregue*'
    default:
      return `📦 *Situação do pedido: ${pedido.situacao}*`
  }
}

/** O andamento mais recente, da loja ou da Frete Rápido. Vazio sem nenhum. */
function ultimoAndamento(pedido: PedidoDaLoja): string {
  return (pedido.andamento?.[0]?.texto ?? pedido.entrega?.ultima?.situacao ?? '').trim()
}

/**
 * As quatro etapas: o rótulo de quando já passou, de quando é a atual e de
 * quando ainda vem. O de depois é escrito no futuro: "⚪ Entregue" numa lista
 * lia como entrega feita (06/out/2026, revisão do card).
 */
const ETAPAS = [
  { feita: 'Pagamento aprovado', atual: 'Aguardando pagamento', depois: 'Aprovação do pagamento' },
  { feita: 'Pedido separado', atual: 'Em separação', depois: 'Separação do pedido' },
  { feita: 'Enviado pela transportadora', atual: 'Com a transportadora', depois: 'Envio pela transportadora' },
  { feita: 'Entregue', atual: 'Entregue', depois: 'Entrega no seu endereço' },
] as const

function linhaDoTempo(etapa: number, evento: string): string[] {
  return ETAPAS.map((e, i) => {
    if (i < etapa || etapa === 3) return `✅ ${e.feita}`
    if (i > etapa) return `⚪ ${e.depois}`
    // Na transportadora, o andamento real diz mais que o rótulo fixo.
    const atual = i === 2 && evento ? rotuloDoAndamento(evento) : e.atual
    return `🔵 *${atual}*`
  })
}

/** "Aguardando coleta / postagem" é jargão de frete; o resto passa como veio. */
function rotuloDoAndamento(evento: string): string {
  if (/aguardando coleta/i.test(evento)) return 'Aguardando a transportadora'
  return evento.charAt(0).toUpperCase() + evento.slice(1)
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
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/** "2026-10-08" vira "qui, 08/10" (ou "quinta, 08/10"); o que não é data passa como `dataCurta`. */
export function dataComDia(data: string, formato: 'curto' | 'longo' = 'curto'): string {
  // "2026-10-08" ou "08/10/2026": a Frete Rápido manda a previsão no segundo
  // jeito, e o card saía com "08/10/2026" em vez de "quinta, 08/10".
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim())
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(data.trim())
  const [ano, mes, dia] = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : []
  if (!ano || !mes || !dia) return dataCurta(data)
  const semana = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia))).getUTCDay()
  return `${(formato === 'longo' ? DIAS_LONGOS : DIAS)[semana]}, ${dia}/${mes}`
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
