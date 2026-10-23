import 'server-only'
import { z } from 'zod'
import { enderecoDoAviso } from './aviso-por-endereco'
import {
  EMAIL_SEM_EMAIL,
  ErroDeConexao,
  finalDe,
  type AcessoAoGateway,
  type ConexaoProvada,
  type GatewayDePagamento,
  type PagamentoLido,
  type SituacaoDoPagamento,
} from './pagamento'

/**
 * A PagHiper: Pix avulso com `apiKey` + `token` colados
 * (docs/gateways/pesquisa-picpay-iugu-paghiper.md, seção 3).
 *
 * A página de criar Pix não está no índice da documentação: o contrato é o do
 * SDK do plugin oficial (github.com/paghiper/woocommerce-paghiper,
 * `includes/paghiper-php-sdk/src/Transaction.php`). As credenciais vão **no
 * corpo**, não no cabeçalho.
 *
 * - **Aviso por cobrança** (`notification_url`, molde InfinitePay). O aviso só
 *   traz `transaction_id` e `notification_id`; a situação vem de perguntar à
 *   PagHiper com as credenciais do dono, que é a nossa regra por desenho dela.
 *   Por isso o id que o aviso entrega é `transação|notificação`.
 * - **Vencimento em dias inteiros**: o Pix vale até o fim do dia do vencimento,
 *   e quem fecha a cobrança antes é o nosso relógio.
 * - Sem sandbox nem idempotência documentados.
 */

const PIX = 'https://pix.paghiper.com'
const API = 'https://api.paghiper.com'
const PRAZO_MS = 10_000

type Credencial = { apiKey: string; token: string }

function credencial(acesso: AcessoAoGateway): Credencial {
  const lido = z.object({ apiKey: z.string().min(1), token: z.string().min(1) }).safeParse(JSON.parse(acesso.token))
  if (!lido.success) throw new Error('credencial da PagHiper estragada no cofre')
  return lido.data
}

async function chamar<T>(url: string, credenciais: Credencial, corpo: Record<string, unknown>): Promise<T> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...credenciais, ...corpo }),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // Só o status: o corpo enviado tem as credenciais, e o de volta, o CPF.
  if (!resposta.ok) throw new Error(`a PagHiper recusou ${new URL(url).pathname} (${resposta.status})`)
  return (await resposta.json()) as T
}

const respostaSchema = z.object({
  result: z.string(),
  response_message: z.string().nullish(),
  transaction_id: z.string().nullish(),
  order_id: z.string().nullish(),
  status: z.string().nullish(),
  value_cents: z.union([z.number(), z.string()]).transform(Number).nullish(),
  value_cents_paid: z.union([z.number(), z.string()]).transform(Number).nullish(),
  status_date: z.string().nullish(),
  pix_code: z.object({ emv: z.string().nullish(), pix_url: z.string().nullish() }).partial().nullish(),
})

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

/**
 * O plugin oficial confere a chave pedindo a situação de uma transação que não
 * existe: chave errada volta reclamando da `apiKey` ou do `token`; certa, de
 * transação não encontrada.
 */
export async function conectarPagHiper(valores: Record<string, string>): Promise<ConexaoProvada> {
  const apiKey = valores.apiKey?.trim() ?? ''
  const token = valores.token?.trim() ?? ''
  if (!/^apk_[A-Za-z0-9-]{8,80}$/.test(apiKey)) throw new ErroDeConexao('Isto não parece uma apiKey da PagHiper. Ela começa com apk_.')
  if (!/^[A-Za-z0-9]{8,120}$/.test(token))
    throw new ErroDeConexao('Isto não parece um token da PagHiper. Copie o token inteiro, em Credenciais.')

  const resposta = await chamar<{ status_request?: unknown }>(
    `${API}/transaction/status/`,
    { apiKey, token },
    { transaction_id: '0000000000000000' },
  )
  const lido = respostaSchema.safeParse(resposta.status_request)
  const mensagem = lido.success ? (lido.data.response_message ?? '') : ''
  if (/api.?key|token/i.test(mensagem)) throw new ErroDeConexao('A PagHiper recusou a apiKey ou o token. Confira os dois em Credenciais.')

  return {
    contaNoGateway: apiKey,
    apelido: `apiKey terminada em ${finalDe(apiKey)}`,
    token: JSON.stringify({ apiKey, token }),
    ambiente: 'producao',
  }
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const ID = /^[A-Za-z0-9]{8,64}$/

/** O aviso vem em formulário: `transaction_id` e `notification_id`. Vira `transação|notificação`. */
export function pagamentoDoAvisoDaPagHiper(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null
  const { transaction_id: transacao, notification_id: notificacao } = corpo as Record<string, unknown>
  if (typeof transacao !== 'string' || typeof notificacao !== 'string') return null
  return ID.test(transacao) && ID.test(notificacao) ? `${transacao}|${notificacao}` : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

export function situacaoDaPagHiper(status: string | null | undefined): SituacaoDoPagamento {
  if (status === 'paid' || status === 'completed') return 'paga'
  if (status === 'refunded') return 'estornada'
  if (status === 'canceled') return 'cancelada'
  return 'pendente'
}

/** `2026-10-23 10:00:00`, no relógio do Brasil. */
function dataDaPagHiper(texto: string | null | undefined): Date | null {
  const partes = texto?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  return partes ? new Date(`${partes[1]}T${partes[2]}-03:00`) : null
}

/** Dias inteiros até o vencimento, no mínimo um. */
export function diasAteVencer(venceEm: Date, agora = new Date()): number {
  return Math.max(1, Math.ceil((venceEm.getTime() - agora.getTime()) / 86_400_000))
}

export const paghiper: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    if (!pedido.pagador.documento) throw new Error('a PagHiper exige o CPF ou CNPJ de quem paga')
    const aviso = pedido.clienteId ? enderecoDoAviso('paghiper', pedido.clienteId) : null
    const resposta = await chamar<{ pix_create_request?: unknown }>(`${PIX}/invoice/create/`, credencial(acesso), {
      order_id: pedido.referencia,
      payer_email: pedido.pagador.email ?? EMAIL_SEM_EMAIL,
      payer_name: pedido.pagador.nome.slice(0, 100),
      payer_cpf_cnpj: pedido.pagador.documento,
      ...(pedido.pagador.telefone ? { payer_phone: pedido.pagador.telefone.replace(/^55/, '') } : {}),
      ...(aviso ? { notification_url: aviso } : {}),
      days_due_date: diasAteVencer(pedido.venceEm),
      items: [{ item_id: '1', description: pedido.descricao.slice(0, 100), quantity: 1, price_cents: pedido.valorCentavos }],
    })
    const criada = respostaSchema.parse(resposta.pix_create_request)
    if (criada.result !== 'success' || !criada.transaction_id || !criada.pix_code?.emv) {
      throw new Error('a PagHiper não criou o Pix')
    }
    return {
      pagamentoId: criada.transaction_id,
      preferenciaId: null,
      pixCopiaCola: criada.pix_code.emv,
      link: criada.pix_code.pix_url ?? null,
    }
  },

  /**
   * Com a notificação (`transação|notificação`), pergunta pelo endpoint de
   * notificação do Pix, que é o caminho documentado. Sem ela (o relógio do
   * vencimento), pelo de situação da transação; recusado, fica pendente e quem
   * decide é o aviso.
   */
  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    const [transacao, notificacao] = pagamentoId.split('|')
    if (!transacao || !ID.test(transacao) || (notificacao !== undefined && !ID.test(notificacao))) {
      throw new Error('id de transação da PagHiper estranho')
    }
    const resposta = notificacao
      ? await chamar<{ status_request?: unknown }>(`${PIX}/invoice/notification/`, credencial(acesso), {
          transaction_id: transacao,
          notification_id: notificacao,
        })
      : await chamar<{ status_request?: unknown }>(`${API}/transaction/status/`, credencial(acesso), { transaction_id: transacao })
    const lido = respostaSchema.safeParse(resposta.status_request)
    if (!lido.success || lido.data.result !== 'success') {
      return { pagamentoId: transacao, referencia: null, situacao: 'pendente', valorCentavos: 0, pagaEm: null }
    }
    const situacao = situacaoDaPagHiper(lido.data.status)
    return {
      pagamentoId: transacao,
      referencia: lido.data.order_id ?? null,
      situacao,
      valorCentavos: lido.data.value_cents_paid || lido.data.value_cents || 0,
      pagaEm: situacao === 'paga' ? (dataDaPagHiper(lido.data.status_date) ?? new Date()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    const transacao = pagamentoId.split('|')[0]!
    const resposta = await chamar<{ cancellation_request?: unknown }>(`${API}/transaction/cancel/`, credencial(acesso), {
      transaction_id: transacao,
      status: 'canceled',
    })
    const lido = respostaSchema.safeParse(resposta.cancellation_request)
    if (!lido.success || lido.data.result !== 'success') throw new Error('a PagHiper não cancelou o Pix')
  },
}
