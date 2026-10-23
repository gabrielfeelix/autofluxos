import 'server-only'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { z } from 'zod'
import { enderecoDoAviso } from './aviso-por-endereco'
import {
  EMAIL_SEM_EMAIL,
  ErroDeConexao,
  diaEmSaoPaulo,
  finalDe,
  type AcessoAoGateway,
  type ConexaoProvada,
  type GatewayDePagamento,
  type PagamentoLido,
  type SituacaoDoPagamento,
} from './pagamento'

/**
 * A Iugu pelo token de API colado (docs/gateways/pesquisa-picpay-iugu-paghiper.md,
 * seção 2).
 *
 * - **Conectar tem atrito**: o painel da Iugu pede uma chave pública RSA para
 *   criar o token, e um administrador da conta precisa aprovar antes de ele
 *   funcionar (até lá, 401). Para o dono não mexer com chave, a tela gera o
 *   par aqui (`parDeChavesParaIugu`) e mostra só a pública; a privada não é
 *   guardada, porque criar fatura e ler fatura não pedem assinatura.
 * - **Cobrar**: fatura só com Pix, CPF obrigatório, mínimo de R$ 1,00. A
 *   própria fatura é o link (`secure_url`).
 * - **Aviso**: gatilho `invoice.status_changed` cadastrado por API ao
 *   conectar, em formulário (`data[id]`), sem assinatura. Releitura sempre.
 * - Fatura `canceled` ou `expired` ainda pode virar `paid` (pagamento
 *   atrasado), e `aplicarPagamento` aceita pago depois de vencida.
 */

const API = 'https://api.iugu.com/v1'
const PRAZO_MS = 10_000

async function chamar<T>(
  token: string,
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  corpo?: unknown,
  idempotencia?: string,
): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new ErroDaIugu(`a Iugu recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`, resposta.status)
  return (await resposta.json().catch(() => ({}))) as T
}

export class ErroDaIugu extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

/** A chave pública que o dono cola na Iugu ao criar o token. A privada morre aqui. */
export function parDeChavesParaIugu(): string {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return publicKey.export({ type: 'spki', format: 'pem' }).toString()
}

export async function conectarIugu(valores: Record<string, string>, clienteId: string): Promise<ConexaoProvada> {
  const token = valores.token?.trim() ?? ''
  if (!/^[A-Za-z0-9]{20,100}$/.test(token))
    throw new ErroDeConexao('Isto não parece um token de API da Iugu. Copie o token inteiro, logo depois de criar.')
  try {
    await chamar(token, 'GET', '/invoices?limit=1')
  } catch (erro) {
    if (erro instanceof ErroDaIugu && erro.status === 401) {
      throw new ErroDeConexao('A Iugu recusou o token. Se ele acabou de ser criado, um administrador da conta precisa aprovar antes.')
    }
    throw erro
  }

  const url = enderecoDoAviso('iugu', clienteId)
  let avisoNoGateway: string | null = null
  if (url) {
    try {
      const criado = z
        .object({ id: z.string().min(1) })
        .parse(await chamar(token, 'POST', '/web_hooks', { event: 'invoice.status_changed', url }))
      avisoNoGateway = criado.id
    } catch (erro) {
      if (process.env.VERCEL_ENV === 'production')
        throw new ErroDeConexao('A Iugu não aceitou o aviso de pagamento. Tente de novo em instantes.')
      console.warn('[iugu] conectado sem aviso fora de produção', erro instanceof Error ? erro.message : erro)
    }
  }

  return {
    contaNoGateway: createHash('sha256').update(token).digest('hex').slice(0, 32),
    apelido: `token terminado em ${finalDe(token)}`,
    token,
    ambiente: 'producao',
    avisoNoGateway,
  }
}

export async function apagarAvisoDaIugu(acesso: AcessoAoGateway, avisoId: string): Promise<void> {
  await chamar(acesso.token, 'DELETE', `/web_hooks/${encodeURIComponent(avisoId)}`).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const ID_DA_FATURA = /^[0-9A-F]{32}$/i

/** O gatilho vem em formulário: `data[id]` é a fatura. */
export function pagamentoDoAvisoDaIugu(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null
  const id = (corpo as Record<string, unknown>)['data[id]']
  return typeof id === 'string' && ID_DA_FATURA.test(id) ? id : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

const faturaSchema = z.object({
  id: z.string(),
  status: z.string(),
  total_cents: z.number().nullish(),
  paid_cents: z.number().nullish(),
  total_paid_cents: z.number().nullish(),
  paid_at: z.string().nullish(),
  external_reference: z.string().nullish(),
  secure_url: z.string().nullish(),
  pix: z.object({ qrcode_text: z.string().nullish() }).partial().nullish(),
})

export function situacaoDaIugu(status: string): SituacaoDoPagamento {
  if (status === 'paid' || status === 'externally_paid') return 'paga'
  if (status === 'refunded' || status === 'chargeback' || status === 'in_protest') return 'estornada'
  if (status === 'canceled' || status === 'expired') return 'cancelada'
  return 'pendente'
}

export const iugu: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    if (!pedido.pagador.documento) throw new Error('a Iugu exige o CPF ou CNPJ de quem paga')
    if (pedido.valorCentavos < 100) throw new Error('a Iugu não cobra menos de R$ 1,00')
    const fatura = faturaSchema.parse(
      await chamar(
        acesso.token,
        'POST',
        '/invoices',
        {
          email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
          due_date: diaEmSaoPaulo(pedido.venceEm),
          items: [{ description: pedido.descricao.slice(0, 200), quantity: 1, price_cents: pedido.valorCentavos }],
          payable_with: ['pix'],
          payer: { cpf_cnpj: pedido.pagador.documento, name: pedido.pagador.nome.slice(0, 100) },
          external_reference: pedido.referencia,
        },
        pedido.referencia,
      ),
    )
    if (!fatura.pix?.qrcode_text) throw new Error('a Iugu não devolveu o Pix; confira se o Pix está ativo na conta')
    return { pagamentoId: fatura.id, preferenciaId: null, pixCopiaCola: fatura.pix.qrcode_text, link: fatura.secure_url ?? null }
  },

  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    if (!ID_DA_FATURA.test(pagamentoId)) throw new Error('id de fatura da Iugu estranho')
    const f = faturaSchema.parse(await chamar(acesso.token, 'GET', `/invoices/${pagamentoId}`))
    const situacao = situacaoDaIugu(f.status)
    return {
      pagamentoId: f.id,
      referencia: f.external_reference ?? null,
      situacao,
      valorCentavos: (situacao === 'paga' ? (f.total_paid_cents ?? f.paid_cents) : null) ?? f.total_cents ?? 0,
      pagaEm: situacao === 'paga' ? (f.paid_at ? new Date(f.paid_at) : new Date()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamar(acesso.token, 'PUT', `/invoices/${encodeURIComponent(pagamentoId)}/cancel`)
  },
}
