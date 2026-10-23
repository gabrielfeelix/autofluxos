import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  EMAIL_SEM_EMAIL,
  ErroDeConexao,
  finalDe,
  telefoneBrasileiro,
  type AcessoAoGateway,
  type ConexaoProvada,
  type GatewayDePagamento,
  type PagamentoLido,
  type SituacaoDoPagamento,
} from './pagamento'

/**
 * O Pagar.me (Stone), API v5, pela chave secreta colada
 * (docs/gateways/pesquisa-pagarme-woovi.md, parte 1).
 *
 * - **Conectar**: `sk_` (produção) ou `sk_test_` (sandbox), em HTTP Basic. Não
 *   há OAuth nem dado da conta pela API: o resumo da chave impede a mesma chave
 *   em duas organizações.
 * - **Cobrar**: pedido com pagamento Pix. O Pix do Pagar.me exige `customer`
 *   com nome, e-mail, documento e telefone: CPF obrigatório aqui, e-mail
 *   preenchido como no Mercado Pago quando o contato não tem.
 * - **Aviso**: não há API para cadastrar. O dono cola o endereço (com o
 *   segredo da organização) em Configurações > Webhooks; a tela mostra qual.
 *   Do corpo sai só o id da cobrança (`ch_`), relida com a chave do dono.
 * - Se o dono ligar a lista de IPs permitidos no Pagar.me, nossas chamadas
 *   caem: a Vercel não tem IP fixo.
 */

const API = 'https://api.pagar.me/core/v5'
const PRAZO_MS = 10_000

async function chamar<T>(acesso: AcessoAoGateway, metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Basic ${Buffer.from(`${acesso.token}:`).toString('base64')}`,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new ErroDoPagarme(`o Pagar.me recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`, resposta.status)
  return (await resposta.json()) as T
}

export class ErroDoPagarme extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

export async function conectarPagarme(valores: Record<string, string>): Promise<ConexaoProvada> {
  const chave = valores.chave?.trim() ?? ''
  if (!/^sk_(test_)?[A-Za-z0-9]{8,80}$/.test(chave)) {
    throw new ErroDeConexao('Isto não parece uma chave secreta do Pagar.me. Ela começa com sk_.')
  }
  const ambiente = chave.startsWith('sk_test_') ? 'teste' : 'producao'
  try {
    await chamar({ token: chave, ambiente }, 'GET', '/orders?size=1')
  } catch (erro) {
    if (erro instanceof ErroDoPagarme && (erro.status === 401 || erro.status === 403)) {
      throw new ErroDeConexao(
        'O Pagar.me recusou a chave. Confira se copiou a chave secreta inteira e se a lista de IPs permitidos está desligada.',
      )
    }
    throw erro
  }
  return {
    contaNoGateway: createHash('sha256').update(chave).digest('hex').slice(0, 32),
    apelido: `chave terminada em ${finalDe(chave)}`,
    token: chave,
    ambiente,
  }
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const ID_DA_COBRANCA = /^ch_[A-Za-z0-9]{8,40}$/

/** `charge.*` traz a cobrança em `data`; `order.*`, o pedido com as cobranças dentro. */
export function pagamentoDoAvisoDoPagarme(corpo: unknown): string | null {
  const lido = z
    .object({
      type: z.string(),
      data: z.object({ id: z.string().optional(), charges: z.array(z.object({ id: z.string() })).optional() }),
    })
    .safeParse(corpo)
  if (!lido.success) return null
  const id = lido.data.type.startsWith('order.') ? lido.data.data.charges?.[0]?.id : lido.data.data.id
  return id && ID_DA_COBRANCA.test(id) ? id : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

const cobrancaSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  status: z.string(),
  amount: z.number(),
  paid_amount: z.number().nullish(),
  paid_at: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  order: z.object({ code: z.string().nullish() }).partial().nullish(),
  last_transaction: z.object({ qr_code: z.string().nullish(), qr_code_url: z.string().nullish() }).partial().nullish(),
})

export function situacaoDoPagarme(status: string): SituacaoDoPagamento {
  if (status === 'paid' || status === 'overpaid') return 'paga'
  if (status === 'refunded' || status === 'partial_refunded' || status === 'chargedback') return 'estornada'
  if (status === 'canceled' || status === 'failed') return 'cancelada'
  return 'pendente'
}

export const pagarme: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    const documento = pedido.pagador.documento
    if (!documento) throw new Error('o Pagar.me exige o CPF ou CNPJ de quem paga')
    const telefone = telefoneBrasileiro(pedido.pagador.telefone)
    const criado = z.object({ charges: z.array(cobrancaSchema).min(1) }).parse(
      await chamar(acesso, 'POST', '/orders', {
        code: pedido.referencia,
        items: [{ amount: pedido.valorCentavos, description: pedido.descricao.slice(0, 256), quantity: 1, code: 'cobranca' }],
        customer: {
          name: pedido.pagador.nome.slice(0, 64),
          email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
          document: documento,
          document_type: documento.length === 14 ? 'CNPJ' : 'CPF',
          type: documento.length === 14 ? 'company' : 'individual',
          ...(telefone ? { phones: { mobile_phone: { country_code: '55', area_code: telefone.ddd, number: telefone.numero } } } : {}),
        },
        // UTC sem fuso, como a documentação pede.
        payments: [{ payment_method: 'pix', pix: { expires_at: pedido.venceEm.toISOString().slice(0, 19) } }],
        metadata: { referencia: pedido.referencia },
      }),
    )
    const cobranca = criado.charges[0]!
    const pix = cobranca.last_transaction?.qr_code
    if (!pix) throw new Error('o Pagar.me não devolveu o Pix')
    return { pagamentoId: cobranca.id, preferenciaId: null, pixCopiaCola: pix, link: cobranca.last_transaction?.qr_code_url ?? null }
  },

  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    if (!ID_DA_COBRANCA.test(pagamentoId)) throw new Error('id de cobrança do Pagar.me estranho')
    const c = cobrancaSchema.parse(await chamar(acesso, 'GET', `/charges/${pagamentoId}`))
    const situacao = situacaoDoPagarme(c.status)
    const referencia = typeof c.metadata?.referencia === 'string' ? c.metadata.referencia : (c.order?.code ?? c.code ?? null)
    return {
      pagamentoId: c.id,
      referencia,
      situacao,
      valorCentavos: situacao === 'paga' ? (c.paid_amount ?? c.amount) : c.amount,
      pagaEm: situacao === 'paga' ? (c.paid_at ? new Date(c.paid_at) : new Date()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamar(acesso, 'DELETE', `/charges/${encodeURIComponent(pagamentoId)}`)
  },
}
