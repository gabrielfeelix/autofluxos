import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { enderecoDoAviso } from './aviso-por-endereco'
import {
  ErroDeConexao,
  finalDe,
  type AcessoAoGateway,
  type Ambiente,
  type ConexaoProvada,
  type GatewayDePagamento,
  type PagamentoLido,
  type PedidoDeCobranca,
} from './pagamento'

/**
 * A Woovi (ex-OpenPix) pelo AppID colado (docs/gateways/pesquisa-pagarme-woovi.md).
 *
 * - **Conectar**: o dono gera o AppID em API/Plugins. Ele não tem prefixo de
 *   ambiente: a credencial é provada em produção e, recusada lá, no sandbox; o
 *   ambiente que aceitou é o da conexão.
 * - **Cobrar**: só Pix, sem CPF obrigatório. O `correlationID` é a nossa
 *   referência, e é por ele que se relê e se cancela: `pagamentoId` é ele.
 * - **Aviso**: cadastrado por API ao conectar (`OPENPIX:CHARGE_COMPLETED`), no
 *   endereço com segredo da organização. A Woovi assina com RSA, mas a regra é
 *   a mesma dos outros: só o `correlationID` sai do corpo, e a cobrança é
 *   relida com o AppID do dono.
 * - Estorno não muda o `status` da cobrança na Woovi (vira outro recurso): não
 *   é lido aqui.
 */

const BASES: Record<Ambiente, string> = { producao: 'https://api.woovi.com', teste: 'https://api.woovi-sandbox.com' }
const PRAZO_MS = 10_000

async function chamar<T>(acesso: AcessoAoGateway, metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`${BASES[acesso.ambiente]}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: acesso.token,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  // Só o status: o corpo de erro pode trazer dados de quem paga.
  if (!resposta.ok) throw new ErroDaWoovi(`a Woovi recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status})`, resposta.status)
  return (await resposta.json().catch(() => ({}))) as T
}

export class ErroDaWoovi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

const avisoCriadoSchema = z.object({ webhook: z.object({ id: z.string().min(1) }) })

/**
 * Prova o AppID, descobre o ambiente e cadastra o aviso. Falhou o aviso em
 * produção, não conecta: sem ele, só o relógio do vencimento confirmaria.
 */
export async function conectarWoovi(valores: Record<string, string>, clienteId: string): Promise<ConexaoProvada> {
  const appId = valores.appId?.trim() ?? ''
  if (!/^[A-Za-z0-9+/=:._-]{20,500}$/.test(appId))
    throw new ErroDeConexao('Isto não parece um AppID da Woovi. Copie o AppID inteiro, em API/Plugins.')

  let ambiente: Ambiente | null = null
  for (const tentativa of ['producao', 'teste'] as const) {
    try {
      await chamar({ token: appId, ambiente: tentativa }, 'GET', '/api/v1/webhook')
      ambiente = tentativa
      break
    } catch (erro) {
      if (!(erro instanceof ErroDaWoovi) || (erro.status !== 401 && erro.status !== 403)) throw erro
    }
  }
  if (!ambiente) {
    throw new ErroDeConexao('A Woovi recusou o AppID. Confira se copiou inteiro e se ele tem permissão de cobrança e de webhook.')
  }

  const acesso = { token: appId, ambiente }
  const url = enderecoDoAviso('woovi', clienteId)
  let avisoNoGateway: string | null = null
  if (url) {
    try {
      const criado = avisoCriadoSchema.parse(
        await chamar(acesso, 'POST', '/api/v1/webhook', {
          webhook: { name: 'AutoFluxos', event: 'OPENPIX:CHARGE_COMPLETED', url, isActive: true },
        }),
      )
      avisoNoGateway = criado.webhook.id
    } catch (erro) {
      if (process.env.VERCEL_ENV === 'production') {
        throw new ErroDeConexao('A Woovi não aceitou o aviso de pagamento. Confira se o AppID tem a permissão de webhook.')
      }
      console.warn('[woovi] conectado sem aviso fora de produção', erro instanceof Error ? erro.message : erro)
    }
  }

  return {
    // O AppID não diz de qual empresa é; o resumo dele impede o mesmo AppID em duas organizações.
    contaNoGateway: createHash('sha256').update(appId).digest('hex').slice(0, 32),
    apelido: `AppID terminado em ${finalDe(appId)}`,
    token: appId,
    ambiente,
    avisoNoGateway,
  }
}

export async function apagarAvisoDaWoovi(acesso: AcessoAoGateway, avisoId: string): Promise<void> {
  await chamar(acesso, 'DELETE', `/api/v1/webhook/${encodeURIComponent(avisoId)}`).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Só o `correlationID`, que é a nossa referência. O resto do corpo não é lido. */
export function pagamentoDoAvisoDaWoovi(corpo: unknown): string | null {
  const charge = corpo && typeof corpo === 'object' ? (corpo as { charge?: { correlationID?: unknown } }).charge : null
  const id = charge?.correlationID
  return typeof id === 'string' && UUID.test(id) ? id : null
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

const cobrancaSchema = z.object({
  charge: z.object({
    correlationID: z.string(),
    status: z.string(),
    value: z.number(),
    brCode: z.string().nullish(),
    paymentLinkUrl: z.string().nullish(),
    paidAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  }),
})

function clienteDaWoovi(pagador: PedidoDeCobranca['pagador']) {
  const nome = pagador.nome.slice(0, 100)
  if (pagador.documento) return { name: nome, taxID: pagador.documento }
  if (pagador.email) return { name: nome, email: pagador.email }
  if (pagador.telefone) return { name: nome, phone: `+${pagador.telefone}` }
  return undefined
}

export const woovi: GatewayDePagamento = {
  async criarCobranca(acesso, pedido) {
    const cliente = clienteDaWoovi(pedido.pagador)
    // `return_existing`: repetir a mesma referência devolve a cobrança já criada, sem duplicar.
    const { charge } = cobrancaSchema.parse(
      await chamar(acesso, 'POST', '/api/v1/charge?return_existing=true', {
        correlationID: pedido.referencia,
        value: pedido.valorCentavos,
        comment: pedido.descricao.slice(0, 140),
        expiresDate: pedido.venceEm.toISOString(),
        ...(cliente ? { customer: cliente } : {}),
      }),
    )
    return {
      pagamentoId: charge.correlationID,
      preferenciaId: null,
      pixCopiaCola: charge.brCode ?? null,
      link: charge.paymentLinkUrl ?? null,
    }
  },

  async lerPagamento(acesso, pagamentoId): Promise<PagamentoLido> {
    if (!UUID.test(pagamentoId)) throw new Error('id de cobrança da Woovi estranho')
    const { charge } = cobrancaSchema.parse(await chamar(acesso, 'GET', `/api/v1/charge/${encodeURIComponent(pagamentoId)}`))
    const paga = charge.status === 'COMPLETED'
    return {
      pagamentoId: charge.correlationID,
      referencia: charge.correlationID,
      situacao: paga ? 'paga' : charge.status === 'EXPIRED' ? 'cancelada' : 'pendente',
      valorCentavos: charge.value,
      // O GET pode não trazer `paidAt`; a última mudança é a hora do pagamento.
      pagaEm: paga ? new Date(charge.paidAt ?? charge.updatedAt ?? Date.now()) : null,
    }
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamar(acesso, 'DELETE', `/api/v1/charge/${encodeURIComponent(pagamentoId)}`)
  },
}
