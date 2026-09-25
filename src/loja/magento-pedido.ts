import type { CredencialDaChamada } from '@/server/efeitos/http'
import type { chamarHttp } from '@/server/efeitos/http'
import type { ResultadoDaLoja } from './types'

/**
 * "Cadê meu pedido?" respondido pela própria loja, pela REST de admin do
 * Magento, com o token que a conta já conectou para o estoque exato.
 *
 * ---------------------------------------------------------------------------
 * A trava: o pedido só aparece para quem comprou
 * ---------------------------------------------------------------------------
 *
 * Número de pedido é sequencial e fácil de chutar. Responder "#000123 saiu
 * para entrega em Maringá, 2 headsets" para qualquer um que digite o número é
 * vazar endereço, compra e nome de terceiro.
 *
 * Então o pedido só volta quando **o telefone da conversa** (que o servidor
 * injeta, e o modelo não escolhe) bate com o telefone do pedido, ou quando o
 * **CPF** que a pessoa informou bate com o documento do pedido. Não bateu, a
 * resposta é a mesma de "não achei": quem chuta não descobre nem que o número
 * existe.
 *
 * Telefone compara pelos últimos 8 dígitos: a mesma pessoa aparece como
 * `5544999998888` na conversa e `(44) 9 9999-8888` no pedido, e o nono dígito
 * vem e vai conforme quem cadastrou.
 */

type Chamar = typeof chamarHttp

export type PedidoDaLoja = {
  numero: string
  situacao: string
  situacaoCodigo: string
  feitoEm: string
  total: string
  itens: { nome: string; quantidade: number }[]
  rastreios: { transportadora: string; codigo: string }[]
}

export type ConsultaDePedido =
  | { encontrado: true; pedido: PedidoDaLoja }
  | { encontrado: false; motivo: 'nao_achei_ou_nao_confere' }

/** O que cada status padrão do Magento quer dizer para quem comprou. */
const SITUACOES: Record<string, string> = {
  pending: 'Aguardando pagamento',
  pending_payment: 'Aguardando pagamento',
  payment_review: 'Pagamento em análise',
  processing: 'Pagamento aprovado, em separação',
  holded: 'Em análise pela loja',
  complete: 'Enviado',
  closed: 'Devolvido ou reembolsado',
  canceled: 'Cancelado',
  fraud: 'Em análise pela loja',
}

export function situacaoDoPedido(codigo: string, rotulo?: string): string {
  return SITUACOES[codigo] ?? (rotulo && rotulo.trim() !== '' ? rotulo : codigo)
}

export function soDigitos(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\D/g, '') : ''
}

/** Mesma pessoa? Pelos últimos 8 dígitos, e só com 8 ou mais dos dois lados. */
export function mesmoTelefone(a: string, b: string): boolean {
  const x = soDigitos(a)
  const y = soDigitos(b)
  if (x.length < 8 || y.length < 8) return false
  return x.slice(-8) === y.slice(-8)
}

/** CPF ou CNPJ, só dígitos, e só se tiver tamanho de documento. */
export function mesmoDocumento(a: string, b: string): boolean {
  const x = soDigitos(a)
  const y = soDigitos(b)
  if (x.length !== 11 && x.length !== 14) return false
  return x === y
}

type EnderecoDoMagento = { telephone?: unknown; vat_id?: unknown }
type PedidoDoMagento = {
  entity_id?: unknown
  increment_id?: unknown
  status?: unknown
  status_label?: unknown
  created_at?: unknown
  grand_total?: unknown
  order_currency_code?: unknown
  customer_taxvat?: unknown
  billing_address?: EnderecoDoMagento
  items?: { name?: unknown; qty_ordered?: unknown; parent_item_id?: unknown }[]
  extension_attributes?: {
    shipping_assignments?: { shipping?: { address?: EnderecoDoMagento } }[]
  }
}

/** Quem pode ver este pedido: os telefones e documentos que ele carrega. */
export function conferePedido(
  pedido: PedidoDoMagento,
  quem: { telefone: string; documento?: string },
): boolean {
  const entrega = pedido.extension_attributes?.shipping_assignments?.[0]?.shipping?.address
  const telefones = [pedido.billing_address?.telephone, entrega?.telephone].map(soDigitos)
  if (telefones.some((t) => mesmoTelefone(t, quem.telefone))) return true

  if (quem.documento) {
    const documentos = [pedido.customer_taxvat, pedido.billing_address?.vat_id, entrega?.vat_id].map(soDigitos)
    if (documentos.some((d) => mesmoDocumento(d, quem.documento ?? ''))) return true
  }
  return false
}

function dinheiro(valor: unknown, moeda: unknown): string {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return ''
  const codigo = typeof moeda === 'string' && moeda.length === 3 ? moeda : 'BRL'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo }).format(n)
}

/** O recorte que vai para a IA. Sem endereço, sem e-mail, sem documento. */
export function recortarPedido(
  pedido: PedidoDoMagento,
  rastreios: PedidoDaLoja['rastreios'],
): PedidoDaLoja {
  const codigo = typeof pedido.status === 'string' ? pedido.status : ''
  const rotulo = typeof pedido.status_label === 'string' ? pedido.status_label : undefined
  return {
    numero: String(pedido.increment_id ?? ''),
    situacao: situacaoDoPedido(codigo, rotulo),
    situacaoCodigo: codigo,
    feitoEm: typeof pedido.created_at === 'string' ? pedido.created_at.slice(0, 10) : '',
    total: dinheiro(pedido.grand_total, pedido.order_currency_code),
    // Item filho de configurável repete o pai; só os de primeiro nível contam.
    itens: (pedido.items ?? [])
      .filter((i) => i.parent_item_id == null)
      .map((i) => ({ nome: String(i.name ?? ''), quantidade: Number(i.qty_ordered ?? 0) }))
      .filter((i) => i.nome !== ''),
    rastreios,
  }
}

function filtro(campo: string, valor: string): string {
  const p = 'searchCriteria[filterGroups][0][filters][0]'
  return (
    `${p}[field]=${encodeURIComponent(campo)}` +
    `&${p}[value]=${encodeURIComponent(valor)}` +
    `&${p}[conditionType]=eq&searchCriteria[pageSize]=5`
  )
}

export async function consultarPedido(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  entrada: { numero: string; telefone: string; documento?: string },
  chamar: Chamar,
): Promise<ResultadoDaLoja<ConsultaDePedido>> {
  if (!dados.credencial) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

  const numero = entrada.numero.replace(/^#/, '').trim()
  if (numero === '') return { ok: true, valor: { encontrado: false, motivo: 'nao_achei_ou_nao_confere' } }

  async function ler(caminho: string): Promise<ResultadoDaLoja<unknown>> {
    const r = await chamar(
      {
        tipo: 'chamar_http',
        metodo: 'GET',
        url: `${dados.endereco}${caminho}`,
        cabecalhos: [],
        corpo: '',
        mapear: [],
        aoFalhar: 'humano',
      },
      { deTeste: false, credencial: dados.credencial, comJson: true },
    )
    if (r.ok) return { ok: true, valor: r.json }
    if (/respondeu (401|403)/.test(r.motivo)) {
      return { ok: false, motivo: 'o token da loja não tem permissão para ler pedidos' }
    }
    return { ok: false, motivo: `a loja não respondeu: ${r.motivo}` }
  }

  const achados = await ler(`/rest/V1/orders?${filtro('increment_id', numero)}`)
  if (!achados.ok) return achados

  const lista = (achados.valor as { items?: PedidoDoMagento[] } | null)?.items ?? []
  const pedido = lista.find((p) => conferePedido(p, entrada))
  if (!pedido) return { ok: true, valor: { encontrado: false, motivo: 'nao_achei_ou_nao_confere' } }

  // Rastreio é melhor-esforço: o status sozinho já responde a pergunta, e um
  // envio ilegível não pode esconder que o pedido existe e foi pago.
  let rastreios: PedidoDaLoja['rastreios'] = []
  const idInterno = pedido.entity_id != null ? String(pedido.entity_id) : ''
  if (idInterno !== '') {
    const envios = await ler(`/rest/V1/shipments?${filtro('order_id', idInterno)}`)
    if (envios.ok) {
      const itens = (envios.valor as { items?: { tracks?: { title?: unknown; track_number?: unknown }[] }[] } | null)?.items ?? []
      rastreios = itens
        .flatMap((e) => e.tracks ?? [])
        .map((t) => ({ transportadora: String(t.title ?? ''), codigo: String(t.track_number ?? '') }))
        .filter((t) => t.codigo !== '')
    }
  }

  return { ok: true, valor: { encontrado: true, pedido: recortarPedido(pedido, rastreios) } }
}
