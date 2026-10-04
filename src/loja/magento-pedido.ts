import type { CredencialDaChamada } from '@/server/efeitos/http'
import type { chamarHttp } from '@/server/efeitos/http'
import type { RastreioDaFreteRapido } from './frete-rapido'
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
  /** Onde a entrega está, pela Frete Rápido. Ausente sem token ou sem frete. */
  entrega?: RastreioDaFreteRapido
  /**
   * O andamento que a loja anota no pedido ("Coletado / Postado - 28/09/2026
   * às 20:40:12"), do mais novo para o mais antigo, até 3. Na PCYES é o
   * rastreio que a integração de frete escreve no histórico do Magento.
   */
  andamento?: { texto: string; quando: string }[]
  /** Nome de quem comprou. Só na busca da equipe, para conferir antes de mandar. */
  comprador?: string
  /** A página pública de rastreio da Frete Rápido, quando o envio tem o código. */
  linkDoRastreio?: string
}

export type ConsultaDePedido =
  /** `confere`: o telefone ou documento do pedido é o da conversa (busca da equipe). */
  | { encontrado: true; pedido: PedidoDaLoja; confere?: boolean }
  | { encontrado: false; motivo: 'nao_achei_ou_nao_confere'; proximoPasso: ProximoPassoDoPedido }

/**
 * O que o bot faz quando não achou, decidido aqui e não pelo modelo. A ordem
 * é a de loja grande: pede o que falta para conferir quem é, e só depois de
 * ter os dois (número e CPF) e ainda assim não achar, chama o time.
 */
export type ProximoPassoDoPedido =
  | 'pedir_numero_ou_cpf'
  | 'pedir_cpf'
  | 'pedir_numero_do_pedido'
  | 'oferecer_atendente'

export function proximoPassoDoPedido(temNumero: boolean, temDocumento: boolean): ProximoPassoDoPedido {
  if (temNumero && temDocumento) return 'oferecer_atendente'
  if (temNumero) return 'pedir_cpf'
  if (temDocumento) return 'pedir_numero_do_pedido'
  return 'pedir_numero_ou_cpf'
}

/** O que cada status padrão do Magento quer dizer para quem comprou. */
const SITUACOES: Record<string, string> = {
  pending: 'Aguardando pagamento',
  pending_payment: 'Aguardando pagamento',
  payment_review: 'Pagamento em análise',
  processing: 'Pagamento aprovado, em separação',
  holded: 'Em análise pela loja',
  complete: 'Enviado',
  // Status próprio da PCYES (30/set/2026): a Braspress já coletou.
  delivered_carrier: 'Entregue à transportadora',
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
  billing_address?: EnderecoDoMagento & { firstname?: unknown; lastname?: unknown }
  customer_firstname?: unknown
  customer_lastname?: unknown
  status_histories?: { comment?: unknown; created_at?: unknown }[]
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
/**
 * "Em Transferência - 28/09/2026 às 21:32:52" vira texto e quando. Comentário
 * que não tem esse formato (nota interna da loja, "Ordered amount of...") fica
 * de fora: só o que é andamento de entrega pode chegar a quem comprou.
 */
export function andamentoDoPedido(historico: PedidoDoMagento['status_histories']): { texto: string; quando: string }[] {
  const saida: { texto: string; quando: string }[] = []
  for (const h of historico ?? []) {
    const comentario = typeof h.comment === 'string' ? h.comment.trim() : ''
    const m = /^(.{2,80}?)\s+-\s+(\d{2})\/(\d{2})\/(\d{4})\s+às\s+(\d{2}:\d{2})/.exec(comentario)
    if (!m) continue
    saida.push({ texto: m[1]!, quando: `${m[2]}/${m[3]} às ${m[5]}` })
    if (saida.length === 3) break
  }
  return saida
}

function nomeDoComprador(pedido: PedidoDoMagento): string {
  const partes = [
    pedido.customer_firstname ?? pedido.billing_address?.firstname,
    pedido.customer_lastname ?? pedido.billing_address?.lastname,
  ]
  return partes.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(' ').trim()
}

export function recortarPedido(
  pedido: PedidoDoMagento,
  rastreios: PedidoDaLoja['rastreios'],
  opcoes: { comComprador?: boolean } = {},
): PedidoDaLoja {
  const andamento = andamentoDoPedido(pedido.status_histories)
  const comprador = opcoes.comComprador ? nomeDoComprador(pedido) : ''
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
    ...(andamento.length > 0 ? { andamento } : {}),
    ...(comprador ? { comprador } : {}),
  }
}

/**
 * Os pedidos de um CPF ou CNPJ, o mais recente primeiro. O Magento guarda o
 * documento como a pessoa digitou no checkout, então a busca vai com os dois
 * jeitos (só dígitos e com máscara) no mesmo grupo, que o Magento lê como "ou".
 */
export function filtroPorDocumento(documento: string): string {
  const mascara =
    documento.length === 11
      ? documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  const g = 'searchCriteria[filterGroups][0][filters]'
  return (
    [documento, mascara]
      .map((v, i) => `${g}[${i}][field]=customer_taxvat&${g}[${i}][value]=${encodeURIComponent(v)}&${g}[${i}][conditionType]=eq`)
      .join('&') +
    '&searchCriteria[sortOrders][0][field]=created_at&searchCriteria[sortOrders][0][direction]=DESC&searchCriteria[pageSize]=5'
  )
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
  entrada: {
    numero: string
    telefone: string
    documento?: string
    /**
     * Busca da equipe pela Inbox: acha pelo número sem exigir que o telefone
     * confira (o cliente pode ter comprado com outro número) e devolve
     * `confere` e o nome do comprador, para quem atende conferir antes de
     * mandar. O bot nunca passa isto.
     */
    daEquipe?: boolean
  },
  chamar: Chamar,
): Promise<ResultadoDaLoja<ConsultaDePedido>> {
  if (!dados.credencial) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

  const numero = entrada.numero.replace(/^#/, '').trim()
  const documento = soDigitos(entrada.documento ?? '')

  /*
   * A pessoa pode ter mandado o CPF onde se pedia "número ou CPF", e o modelo
   * passou como número (PCYES, 02/out/2026: `10306066920` buscado como pedido
   * duas vezes, e o pedido existia). 11 ou 14 dígitos no número contam como
   * documento se o documento veio vazio.
   */
  const digitosDoNumero = soDigitos(numero)
  const numeroEhDocumento = digitosDoNumero.length === 11 || digitosDoNumero.length === 14
  const documentoReserva =
    documento.length === 11 || documento.length === 14 ? documento : numeroEhDocumento ? digitosDoNumero : ''
  const naoAchei = {
    ok: true as const,
    valor: {
      encontrado: false as const,
      motivo: 'nao_achei_ou_nao_confere' as const,
      proximoPasso: proximoPassoDoPedido(numero !== '' && !numeroEhDocumento, documentoReserva !== ''),
    },
  }

  const semNumeroNemDocumento = numero === '' && documento.length !== 11 && documento.length !== 14
  if (semNumeroNemDocumento) return naoAchei

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

  /*
   * Com número: o pedido volta se o telefone **ou** o CPF conferem, a regra
   * de sempre. Sem número, só com o CPF: a busca é pelo documento, e aí o
   * documento sozinho não basta, porque CPF de outra pessoa se descobre fácil.
   * O pedido só volta se **também** o telefone da conversa for o da compra.
   */
  const achados = await ler(numero !== '' ? `/rest/V1/orders?${filtro('increment_id', numero)}` : `/rest/V1/orders?${filtroPorDocumento(documento)}`)
  if (!achados.ok) return achados

  const lista = (achados.valor as { items?: PedidoDoMagento[] } | null)?.items ?? []
  let conferido =
    numero !== ''
      ? lista.find((p) => conferePedido(p, entrada))
      : lista.find((p) => conferePedido(p, { telefone: entrada.telefone }))
  let pedido = conferido ?? (entrada.daEquipe && numero !== '' ? lista[0] : undefined)

  // O número não achou: tenta pelo documento, com a regra de sempre, só com
  // o telefone da conversa.
  if (!pedido && numero !== '' && documentoReserva !== '') {
    const porDocumento = await ler(`/rest/V1/orders?${filtroPorDocumento(documentoReserva)}`)
    if (!porDocumento.ok) return porDocumento
    const outros = (porDocumento.valor as { items?: PedidoDoMagento[] } | null)?.items ?? []
    conferido = outros.find((p) => conferePedido(p, { telefone: entrada.telefone }))
    pedido = conferido
  }
  if (!pedido) return naoAchei

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

  return {
    ok: true,
    valor: {
      encontrado: true,
      pedido: recortarPedido(pedido, rastreios, { comComprador: entrada.daEquipe }),
      ...(entrada.daEquipe ? { confere: conferido !== undefined } : {}),
    },
  }
}

/** Um pedido na lista de "Status do pedido" da Inbox: o bastante para escolher. */
export type PedidoNaLista = {
  numero: string
  situacao: string
  feitoEm: string
  total: string
  /** O telefone da compra é o desta conversa. */
  confere: boolean
  /** Já chegou na casa de quem comprou (não só na transportadora). */
  entregue: boolean
}

/**
 * Entregue para quem comprou. "Entregue à transportadora" (`delivered_carrier`,
 * PCYES) ainda está a caminho, por isso a transportadora fica de fora.
 */
export function pedidoEntregue(codigo: unknown, rotulo: unknown): boolean {
  const c = typeof codigo === 'string' ? codigo.toLowerCase() : ''
  if (c === 'delivered' || c === 'entregue' || c === 'delivered_customer') return true
  const r = typeof rotulo === 'string' ? rotulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() : ''
  return /\bentregue\b/.test(r) && !/transportadora/.test(r)
}

/**
 * O padrão do `like` que acha o telefone em qualquer máscara: os últimos 8
 * dígitos partidos em 4 e 4, que é onde cai o hífen de "99999-9999" e de
 * "3333-4444". Com menos de 8 dígitos não há busca.
 */
export function padraoDoTelefone(telefone: string): string | null {
  const d = soDigitos(telefone)
  if (d.length < 8) return null
  const fim = d.slice(-8)
  return `%${fim.slice(0, 4)}%${fim.slice(4)}`
}

/**
 * Os pedidos de quem está na conversa, para a equipe escolher sem digitar o
 * número (Inbox, "Status do pedido").
 *
 * **O telefone da conversa vem primeiro** (dono, 02/out/2026: a ficha quase
 * nunca tem CPF na primeira conversa). O `/V1/orders` não filtra por telefone,
 * que mora no endereço, mas o `/V1/customers/search` filtra pelo
 * `billing_telephone` do cadastro: o telefone acha o cliente, e o e-mail e o
 * CPF dele acham os pedidos. Pedido de convidado não tem cadastro e só aparece
 * pelo CPF ou e-mail da ficha, ou pelo número digitado.
 *
 * As chaves vão todas no mesmo grupo, que o Magento lê como "ou". O telefone
 * entra de novo no fim, para marcar quais conferem.
 */
export async function listarPedidosDaPessoa(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  quem: { telefone: string; documento?: string; email?: string },
  chamar: Chamar,
): Promise<ResultadoDaLoja<PedidoNaLista[]>> {
  if (!dados.credencial) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

  const valores: [string, string][] = []
  const jaTem = new Set<string>()
  function porDocumento(bruto: unknown) {
    const documento = soDigitos(bruto)
    if ((documento.length !== 11 && documento.length !== 14) || jaTem.has(documento)) return
    jaTem.add(documento)
    const mascara =
      documento.length === 11
        ? documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    valores.push(['customer_taxvat', documento], ['customer_taxvat', mascara])
  }
  function porEmail(bruto: unknown) {
    const email = typeof bruto === 'string' ? bruto.trim().toLowerCase() : ''
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || jaTem.has(email)) return
    jaTem.add(email)
    valores.push(['customer_email', email])
  }

  porDocumento(quem.documento)
  porEmail(quem.email)

  // Os três caminhos correm juntos: recentes pelo telefone do pedido, cadastro
  // pelo telefone, e o CPF/e-mail da ficha.
  const [recentes, clientes] = await Promise.all([
    recentesComTelefone(dados, quem.telefone, chamar),
    clientesPeloTelefone(dados, quem.telefone, chamar),
  ])
  for (const cliente of clientes) {
    porEmail(cliente.email)
    porDocumento(cliente.taxvat)
  }

  let pelaChave: PedidoDoMagento[] = []
  if (valores.length > 0) {
    const g = 'searchCriteria[filterGroups][0][filters]'
    const consulta =
      valores
        .map(([campo, valor], i) => `${g}[${i}][field]=${campo}&${g}[${i}][value]=${encodeURIComponent(valor)}&${g}[${i}][conditionType]=eq`)
        .join('&') +
      '&searchCriteria[sortOrders][0][field]=created_at&searchCriteria[sortOrders][0][direction]=DESC&searchCriteria[pageSize]=5'
    const r = await lerPedidos(dados, consulta, chamar)
    if (!r.ok && recentes.length === 0) return r
    if (r.ok) pelaChave = r.valor
  }

  // Um pedido só uma vez, do mais novo para o mais antigo, até 5.
  const vistos = new Set<string>()
  const juntos = [...recentes, ...pelaChave]
    .filter((p) => {
      const n = String(p.increment_id ?? '')
      if (n === '' || vistos.has(n)) return false
      vistos.add(n)
      return true
    })
    .sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))
    .slice(0, 5)

  return {
    ok: true,
    valor: juntos.map((p) => {
      const recorte = recortarPedido(p, [])
      return {
        numero: recorte.numero,
        situacao: recorte.situacao,
        feitoEm: recorte.feitoEm,
        total: recorte.total,
        confere: conferePedido(p, { telefone: quem.telefone }),
        entregue: pedidoEntregue(p.status, p.status_label),
      }
    }),
  }
}

/** Quantos pedidos recentes a busca por telefone varre. A PCYES inteira tem uns 2 mil. */
export const PEDIDOS_VARRIDOS = 300

async function lerPedidos(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  consulta: string,
  chamar: Chamar,
): Promise<ResultadoDaLoja<PedidoDoMagento[]>> {
  const r = await chamar(
    {
      tipo: 'chamar_http',
      metodo: 'GET',
      url: `${dados.endereco}/rest/V1/orders?${consulta}`,
      cabecalhos: [],
      corpo: '',
      mapear: [],
      aoFalhar: 'humano',
    },
    { deTeste: false, credencial: dados.credencial, comJson: true },
  )
  if (!r.ok) {
    if (/respondeu (401|403)/.test(r.motivo)) return { ok: false, motivo: 'o token da loja não tem permissão para ler pedidos' }
    return { ok: false, motivo: `a loja não respondeu: ${r.motivo}` }
  }
  return { ok: true, valor: (r.json as { items?: PedidoDoMagento[] } | null)?.items ?? [] }
}

/**
 * Os pedidos recentes com o telefone desta conversa na cobrança ou na entrega.
 *
 * O `/V1/orders` não filtra por telefone, então lê os últimos
 * `PEDIDOS_VARRIDOS` só com os campos da lista (`fields`) e confere aqui. Pega
 * pedido de convidado, que não tem cadastro, e não depende de o token poder
 * ler clientes (02/out/2026: o #1975 do Ale não aparecia pelo cadastro).
 */
async function recentesComTelefone(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  telefone: string,
  chamar: Chamar,
): Promise<PedidoDoMagento[]> {
  if (soDigitos(telefone).length < 8) return []
  const campos =
    'items[increment_id,status,status_label,created_at,grand_total,order_currency_code,' +
    'billing_address[telephone],extension_attributes[shipping_assignments[shipping[address[telephone]]]]]'
  const consulta =
    'searchCriteria[sortOrders][0][field]=created_at&searchCriteria[sortOrders][0][direction]=DESC' +
    `&searchCriteria[pageSize]=${PEDIDOS_VARRIDOS}&fields=${encodeURIComponent(campos)}`
  const r = await lerPedidos(dados, consulta, chamar)
  if (!r.ok) return []
  return r.valor.filter((p) => conferePedido(p, { telefone }))
}

/**
 * Os cadastros da loja com este telefone. Falha aqui (token sem permissão de
 * clientes, loja fora) não derruba a lista: volta vazio e a busca segue pelo
 * que a ficha tiver.
 */
async function clientesPeloTelefone(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  telefone: string,
  chamar: Chamar,
): Promise<{ email?: unknown; taxvat?: unknown }[]> {
  const padrao = padraoDoTelefone(telefone)
  if (!padrao) return []
  const f = 'searchCriteria[filterGroups][0][filters][0]'
  const r = await chamar(
    {
      tipo: 'chamar_http',
      metodo: 'GET',
      url:
        `${dados.endereco}/rest/V1/customers/search?${f}[field]=billing_telephone` +
        `&${f}[value]=${encodeURIComponent(padrao)}&${f}[conditionType]=like&searchCriteria[pageSize]=5`,
      cabecalhos: [],
      corpo: '',
      mapear: [],
      aoFalhar: 'humano',
    },
    { deTeste: false, credencial: dados.credencial, comJson: true },
  )
  if (!r.ok) return []
  return (r.json as { items?: { email?: unknown; taxvat?: unknown }[] } | null)?.items ?? []
}
