import type { CredencialDaChamada } from '@/server/efeitos/http'
import type { chamarHttp } from '@/server/efeitos/http'
import type { ResultadoDaLoja } from './types'

/**
 * Os cupons ativos da loja, para quem atende mandar pela Inbox (pedido do dono
 * da PCYES em 30/set/2026: "já puxa frete, produto e pedido; agora o cupom").
 *
 * Lê as **regras de preço do carrinho** do Magento com o token da integração.
 * Ele precisa da permissão "Marketing › Promoções › Regras de Preço do
 * Carrinho" (`Magento_SalesRule::quote`); sem ela o Magento responde 401, e a
 * tela diz o que liberar em vez de mostrar uma lista vazia que parece "não há
 * cupom".
 *
 * Só entra regra com **código fixo** (`SPECIFIC_COUPON`) e sem geração
 * automática: é o cupom que se divulga ("BEMVINDO5"). Regra sem cupom é
 * desconto automático (os 5% do Pix), e regra de códigos gerados tem um código
 * por pessoa, que não é o que se manda numa conversa.
 */

type Chamar = typeof chamarHttp

export type CupomDaLoja = {
  codigo: string
  nome: string
  /** "10% de desconto", "R$ 50,00 de desconto no carrinho", "Frete grátis". */
  desconto: string
  /** Descrição que a loja escreveu na regra; vazia quando não há. */
  descricao: string
  /** `AAAA-MM-DD`, ou `null` sem data de fim. */
  validoAte: string | null
  /** Quantas vezes já foi usado: o mais usado vem primeiro na lista. */
  usos: number
}

type RegraDoMagento = {
  rule_id?: unknown
  name?: unknown
  description?: unknown
  is_active?: unknown
  from_date?: unknown
  to_date?: unknown
  simple_action?: unknown
  discount_amount?: unknown
  coupon_type?: unknown
  use_auto_generation?: unknown
  simple_free_shipping?: unknown
  apply_to_shipping?: unknown
}

type CupomDoMagento = {
  rule_id?: unknown
  code?: unknown
  usage_limit?: unknown
  times_used?: unknown
  expiration_date?: unknown
  is_primary?: unknown
}

export async function listarCupons(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  hoje: string,
  chamar: Chamar,
): Promise<ResultadoDaLoja<CupomDaLoja[]>> {
  if (!dados.credencial) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

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
      return {
        ok: false,
        motivo:
          'o token da loja não pode ler cupons: libere "Marketing › Promoções › Regras de Preço do Carrinho" na integração do Magento',
      }
    }
    return { ok: false, motivo: `a loja não respondeu: ${r.motivo}` }
  }

  const regras = await ler(`/rest/V1/salesRules/search?${filtroIgual('is_active', '1')}&searchCriteria[pageSize]=200`)
  if (!regras.ok) return regras
  const deCupom = ((regras.valor as { items?: RegraDoMagento[] } | null)?.items ?? []).filter((r) =>
    regraDeCupomFixo(r, hoje),
  )
  if (deCupom.length === 0) return { ok: true, valor: [] }

  const ids = deCupom.map((r) => String(r.rule_id))
  const cupons = await ler(`/rest/V1/coupons/search?${filtroEm('rule_id', ids)}&searchCriteria[pageSize]=500`)
  if (!cupons.ok) return cupons
  return {
    ok: true,
    valor: juntarCupons(deCupom, (cupons.valor as { items?: CupomDoMagento[] } | null)?.items ?? [], hoje),
  }
}

/**
 * Regra ativa, de código fixo, dentro das datas. Exportada para o teste: é a
 * regra que decide o que aparece para quem atende, e errar aqui é mandar cupom
 * vencido a um cliente.
 */
export function regraDeCupomFixo(regra: RegraDoMagento, hoje: string): boolean {
  if (!verdadeiro(regra.is_active)) return false
  if (verdadeiro(regra.use_auto_generation)) return false
  const tipo = String(regra.coupon_type ?? '')
  if (tipo !== 'SPECIFIC_COUPON' && tipo !== '2') return false
  const de = dataDe(regra.from_date)
  const ate = dataDe(regra.to_date)
  if (de && de > hoje) return false
  if (ate && ate < hoje) return false
  return true
}

export function juntarCupons(regras: RegraDoMagento[], cupons: CupomDoMagento[], hoje: string): CupomDaLoja[] {
  const porRegra = new Map(regras.map((r) => [String(r.rule_id), r]))
  const vistos = new Set<string>()
  const lista: CupomDaLoja[] = []
  for (const cupom of cupons) {
    const regra = porRegra.get(String(cupom.rule_id))
    const codigo = typeof cupom.code === 'string' ? cupom.code.trim() : ''
    if (!regra || codigo === '' || vistos.has(codigo)) continue
    const limite = Number(cupom.usage_limit ?? 0)
    if (limite > 0 && Number(cupom.times_used ?? 0) >= limite) continue
    const expira = dataDe(cupom.expiration_date)
    if (expira && expira < hoje) continue
    vistos.add(codigo)
    const fim = [dataDe(regra.to_date), expira].filter((d): d is string => d !== null).sort()[0] ?? null
    lista.push({
      codigo,
      nome: nomeLimpo(String(regra.name ?? '')) || codigo,
      desconto: textoDoDesconto(regra),
      descricao: String(regra.description ?? '').trim(),
      validoAte: fim,
      usos: Number(cupom.times_used ?? 0) || 0,
    })
  }
  // O mais usado primeiro: é o que a equipe manda todo dia (na PCYES, o de
  // primeira compra), e não pode ficar perdido entre cinquenta de parceiros.
  return lista.sort((a, b) => b.usos - a.usos || a.codigo.localeCompare(b.codigo, 'pt-BR'))
}

/** "[PCYES] CUPOM WERDUM" vira "WERDUM": o prefixo é arrumação interna da loja. */
function nomeLimpo(nome: string): string {
  return nome
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(/^cupom\s+/i, '')
    .trim()
}

export function textoDoDesconto(regra: RegraDoMagento): string {
  const valor = Number(regra.discount_amount ?? 0)
  const freteGratis = String(regra.simple_free_shipping ?? '0') !== '0' && String(regra.simple_free_shipping ?? '') !== ''
  const partes: string[] = []
  if (valor > 0) {
    const reais = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const porcento = `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    switch (String(regra.simple_action ?? '')) {
      case 'by_percent':
        partes.push(`${porcento} de desconto`)
        break
      case 'by_fixed':
        partes.push(`${reais} de desconto em cada produto`)
        break
      case 'cart_fixed':
        partes.push(`${reais} de desconto no carrinho`)
        break
      default:
        partes.push('Desconto especial')
    }
  }
  if (freteGratis) partes.push('Frete grátis')
  return partes.join(' + ') || 'Desconto especial'
}

/**
 * A mensagem que sai: curta, uma só, com o código em negrito.
 *
 * "Cupom 10% off para o site: *BEMVINDO10*", no formato que o dono pediu. O
 * botão "copiar código" do WhatsApp só existe em modelo de marketing aprovado
 * (pago por envio), e ele preferiu a mensagem seca.
 */
export function mensagemDoCupom(cupom: CupomDaLoja): string {
  const linhas = [`Cupom ${descontoCurto(cupom.desconto)} para o site:`, `*${cupom.codigo}*`]
  if (cupom.validoAte) linhas.push(`Válido até ${dataLegivel(cupom.validoAte)}.`)
  return linhas.join('\n')
}

/** "10% de desconto" vira "10% off"; o resto vai como está, em minúscula. */
function descontoCurto(desconto: string): string {
  return desconto
    .replace(/ de desconto em cada produto/, ' off em cada produto')
    .replace(/ de desconto no carrinho/, ' off')
    .replace(/ de desconto/, ' off')
    .replace('Frete grátis', 'de frete grátis')
    .replace('Desconto especial', 'de desconto')
}

function dataLegivel(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function dataDe(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim())
  return m ? m[1]! : null
}

function verdadeiro(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function filtroIgual(campo: string, valor: string): string {
  const p = 'searchCriteria[filterGroups][0][filters][0]'
  return `${p}[field]=${encodeURIComponent(campo)}&${p}[value]=${encodeURIComponent(valor)}&${p}[conditionType]=eq`
}

function filtroEm(campo: string, valores: string[]): string {
  const p = 'searchCriteria[filterGroups][0][filters][0]'
  return `${p}[field]=${encodeURIComponent(campo)}&${p}[value]=${encodeURIComponent(valores.join(','))}&${p}[conditionType]=in`
}

/** Pedidos que usaram um cupom no período, sem os cancelados. */
export type VendasDoCupom = { codigo: string; pedidos: number; receita: number }

/**
 * Status que não viraram venda: cancelado, e `closed`, que no Magento é o
 * pedido reembolsado por inteiro.
 */
const NAO_E_VENDA = new Set(['canceled', 'closed'])

/**
 * Quantos pedidos usaram o cupom entre dois instantes, e quanto somaram.
 *
 * `de` e `ate` em UTC no formato do Magento (`AAAA-MM-DD HH:MM:SS`), que é como
 * ele guarda `created_at`. A comparação do código é a do MySQL, que ignora
 * maiúscula: "chat10" digitado no site conta como CHAT10.
 */
export async function vendasDoCupom(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  codigo: string,
  periodo: { de: string; ate: string },
  chamar: Chamar,
): Promise<ResultadoDaLoja<VendasDoCupom>> {
  if (!dados.credencial) return { ok: false, motivo: 'a loja desta conta não tem token conectado' }

  const filtros = [
    filtroNoGrupo(0, 'coupon_code', codigo, 'eq'),
    filtroNoGrupo(1, 'created_at', periodo.de, 'gteq'),
    filtroNoGrupo(2, 'created_at', periodo.ate, 'lt'),
  ].join('&')
  const r = await chamar(
    {
      tipo: 'chamar_http',
      metodo: 'GET',
      url: `${dados.endereco}/rest/V1/orders?${filtros}&searchCriteria[pageSize]=500&fields=items[grand_total,status]`,
      cabecalhos: [],
      corpo: '',
      mapear: [],
      aoFalhar: 'humano',
    },
    { deTeste: false, credencial: dados.credencial, comJson: true },
  )
  if (!r.ok) return { ok: false, motivo: `a loja não respondeu: ${r.motivo}` }

  const itens = (r.json as { items?: { grand_total?: unknown; status?: unknown }[] } | null)?.items ?? []
  let pedidos = 0
  let receita = 0
  for (const item of itens) {
    if (typeof item.status === 'string' && NAO_E_VENDA.has(item.status)) continue
    pedidos++
    receita += Number(item.grand_total) || 0
  }
  return { ok: true, valor: { codigo, pedidos, receita: Math.round(receita * 100) / 100 } }
}

function filtroNoGrupo(grupo: number, campo: string, valor: string, condicao: string): string {
  const p = `searchCriteria[filterGroups][${grupo}][filters][0]`
  return `${p}[field]=${encodeURIComponent(campo)}&${p}[value]=${encodeURIComponent(valor)}&${p}[conditionType]=${condicao}`
}
