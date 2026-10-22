import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import {
  centavosDeReais,
  diaEmSaoPaulo,
  type AcessoAoGateway,
  type Ambiente,
  type CobrancaCriada,
  type GatewayDePagamento,
  type PagamentoLido,
  type PedidoDeCobranca,
  type SituacaoDoPagamento,
} from './pagamento'

/**
 * O Asaas: a conta do dono por **chave de API**, que ele cria no próprio Asaas
 * e cola na tela Pagamentos. Não há login como no Mercado Pago.
 *
 * O argumento de venda é a nota fiscal: o Asaas emite NFS-e da cobrança paga
 * (R$ 0,49), coisa que nenhuma plataforma de chat faz. É ligada lá dentro,
 * pelo dono; aqui não muda nada.
 *
 * Referência: https://docs.asaas.com (v3). A chave vai no cabeçalho
 * `access_token`, e conta criada depois de 13/jun/2024 exige `User-Agent`.
 */

const BASE: Record<Ambiente, string> = {
  producao: 'https://api.asaas.com/v3',
  teste: 'https://api-sandbox.asaas.com/v3',
}
const PRAZO_MS = 10_000

/**
 * Os eventos que nos interessam. Vencer não está aqui de propósito: quem vence
 * a cobrança é o nosso relógio, que também cancela no Asaas. `PAYMENT_DELETED`
 * fica para a tela saber quando o dono apagou a cobrança por lá.
 */
export const EVENTOS_DO_AVISO = [
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
] as const

/**
 * Que ambiente a chave diz ser. `$aact_prod_` e `$aact_hmlg_` são o formato
 * atual; chave antiga só com `$aact_` é tentada em produção e depois no
 * sandbox, por `validarChave`.
 */
export function ambienteDaChave(chave: string): Ambiente | 'desconhecido' | null {
  const limpa = chave.trim()
  if (!/^\$aact_[A-Za-z0-9_:=+/.-]{20,}$/.test(limpa)) return null
  if (limpa.startsWith('$aact_hmlg_')) return 'teste'
  if (limpa.startsWith('$aact_prod_')) return 'producao'
  return 'desconhecido'
}

type Erro = { status: number; codigo: string | null }

export class ErroDoAsaas extends Error {
  constructor(
    mensagem: string,
    readonly detalhe: Erro,
  ) {
    super(mensagem)
  }
}

const erroSchema = z.object({ errors: z.array(z.object({ code: z.string().optional() })).optional() })

async function chamar<T>(
  acesso: AcessoAoGateway,
  metodo: 'GET' | 'POST' | 'DELETE',
  caminho: string,
  corpo?: unknown,
): Promise<T> {
  const resposta = await fetch(`${BASE[acesso.ambiente]}${caminho}`, {
    method: metodo,
    headers: {
      access_token: acesso.token.trim(),
      'User-Agent': 'AutoFluxos/1.0',
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    // GET com corpo dá 403 no Asaas.
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(PRAZO_MS),
    cache: 'no-store',
  })
  const json = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    // Só o código do erro: a descrição pode trazer dado da pessoa cobrada.
    const codigo = erroSchema.safeParse(json).data?.errors?.[0]?.code ?? null
    throw new ErroDoAsaas(`o Asaas recusou ${metodo} ${caminho.split('?')[0]} (${resposta.status}${codigo ? `, ${codigo}` : ''})`, {
      status: resposta.status,
      codigo,
    })
  }
  return json as T
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

const carteirasSchema = z.object({ data: z.array(z.object({ id: z.string().min(1) })).min(1) })
const comercialSchema = z.object({
  tradingName: z.string().nullish(),
  companyName: z.string().nullish(),
  name: z.string().nullish(),
  email: z.string().nullish(),
})

export type ContaDoAsaas = {
  /** O `walletId`: um por conta, é o que impede a mesma conta em duas organizações. */
  contaId: string
  apelido: string | null
  email: string | null
  ambiente: Ambiente
}

async function lerContaNoAmbiente(token: string, ambiente: Ambiente): Promise<ContaDoAsaas> {
  const acesso = { token, ambiente }
  const carteiras = carteirasSchema.safeParse(await chamar(acesso, 'GET', '/wallets/'))
  if (!carteiras.success) throw new Error('o Asaas respondeu sem carteira')
  // Os dados comerciais são só para a tela; sem eles a conexão vale igual.
  const comercial = comercialSchema.safeParse(
    await chamar(acesso, 'GET', '/myAccount/commercialInfo/').catch(() => null),
  ).data
  return {
    contaId: carteiras.data.data[0]!.id,
    apelido: comercial?.tradingName || comercial?.companyName || comercial?.name || comercial?.email || null,
    email: comercial?.email ?? null,
    ambiente,
  }
}

/**
 * Prova que a chave abre uma conta antes de guardar. Chave errada dá 401, e a
 * tela diz "chave recusada" em vez de salvar algo que vai falhar na primeira
 * cobrança, no meio de uma venda.
 */
export async function validarChave(chave: string): Promise<ContaDoAsaas> {
  const tipo = ambienteDaChave(chave)
  if (!tipo) throw new ErroDoAsaas('isto não parece uma chave do Asaas', { status: 0, codigo: 'formato' })
  if (tipo !== 'desconhecido') return lerContaNoAmbiente(chave.trim(), tipo)
  try {
    return await lerContaNoAmbiente(chave.trim(), 'producao')
  } catch (erro) {
    if (!(erro instanceof ErroDoAsaas) || erro.detalhe.status !== 401) throw erro
    return lerContaNoAmbiente(chave.trim(), 'teste')
  }
}

/**
 * O segredo que o Asaas manda de volta em `asaas-access-token` a cada aviso.
 *
 * Derivado, e não sorteado e guardado: a rota confere **antes** de tocar o
 * banco, como todo webhook daqui (`assinatura-obrigatoria.test.ts`). É o mesmo
 * desenho do Telegram (`segredoDoWebhook`). Trocar o `BETTER_AUTH_SECRET`
 * invalida os avisos, e a solução é o dono reconectar.
 */
export function segredoDoAviso(clienteId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o aviso do Asaas')
  return createHmac('sha256', `asaas:${chave}`).update(clienteId).digest('hex')
}

/** O cabeçalho que chegou bate? Falha fechada sem o segredo no ambiente. */
export function avisoAutentico(clienteId: string, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, segredoDoAviso(clienteId))
  } catch {
    return false
  }
}

const avisoCriadoSchema = z.object({ id: z.string().min(1) })

/**
 * Pede ao Asaas que avise do pagamento. O dono não configura nada lá: a chave
 * já dá esse poder. A fila é sequencial, como o Asaas recomenda: aviso de
 * estorno não pode chegar antes do de pagamento.
 */
export async function criarAviso(
  acesso: AcessoAoGateway,
  entrada: { url: string; email: string; clienteId: string },
): Promise<string> {
  const criado = avisoCriadoSchema.parse(
    await chamar(acesso, 'POST', '/webhooks', {
      name: 'AutoFluxos',
      url: entrada.url,
      email: entrada.email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      sendType: 'SEQUENTIALLY',
      authToken: segredoDoAviso(entrada.clienteId),
      events: EVENTOS_DO_AVISO,
    }),
  )
  return criado.id
}

/** Falha engolida: a chave pode já ter sido apagada no Asaas, e desconectar não pode travar nisso. */
export async function apagarAviso(acesso: AcessoAoGateway, avisoId: string): Promise<void> {
  await chamar(acesso, 'DELETE', `/webhooks/${encodeURIComponent(avisoId)}`).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

const listaDeClientesSchema = z.object({ data: z.array(z.object({ id: z.string().min(1) })) })
const idSchema = z.object({ id: z.string().min(1) })

/**
 * O Asaas só cobra quem é cliente dele, com CPF ou CNPJ. Procura pelo
 * documento antes de criar: a mesma pessoa cobrada duas vezes vira um cliente
 * só na conta do dono, e o histórico dela lá fica inteiro.
 */
async function clienteNoAsaas(acesso: AcessoAoGateway, pagador: PedidoDeCobranca['pagador']): Promise<string> {
  if (!pagador.documento) throw new ErroDoAsaas('o Asaas exige CPF ou CNPJ de quem paga', { status: 0, codigo: 'documento' })
  const achados = listaDeClientesSchema.parse(
    await chamar(acesso, 'GET', `/customers?cpfCnpj=${encodeURIComponent(pagador.documento)}&limit=1`),
  )
  if (achados.data[0]) return achados.data[0].id

  const telefone = pagador.telefone?.startsWith('55') ? pagador.telefone.slice(2) : null
  return idSchema.parse(
    await chamar(acesso, 'POST', '/customers', {
      name: pagador.nome.slice(0, 100),
      cpfCnpj: pagador.documento,
      ...(pagador.email ? { email: pagador.email } : {}),
      ...(telefone ? { mobilePhone: telefone } : {}),
      // O Asaas manda e-mail e SMS de cobrança por padrão. A conversa já
      // cobrou; um SMS a mais, do Asaas, parece golpe para quem recebe.
      notificationDisabled: true,
    }),
  ).id
}

const pagamentoSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  value: z.number(),
  externalReference: z.string().nullish(),
  invoiceUrl: z.string().nullish(),
  deleted: z.boolean().nullish(),
  paymentDate: z.string().nullish(),
  clientPaymentDate: z.string().nullish(),
  confirmedDate: z.string().nullish(),
  subscription: z.string().nullish(),
  dueDate: z.string().nullish(),
})

const pixSchema = z.object({ payload: z.string().min(1) })

const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const ESTORNADO = new Set([
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
])

export function situacaoDoAsaas(status: string, apagado = false): SituacaoDoPagamento {
  if (apagado) return 'cancelada'
  if (PAGO.has(status)) return 'paga'
  if (ESTORNADO.has(status)) return 'estornada'
  return 'pendente'
}

/** `2026-10-22` é dia, sem hora: meio-dia em Brasília, para não virar o dia anterior em UTC. */
function diaParaData(dia: string | null | undefined): Date | null {
  if (!dia) return null
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T12:00:00-03:00` : dia)
  return Number.isNaN(data.getTime()) ? null : data
}

function paraPagamentoLido(bruto: unknown): PagamentoLido {
  const p = pagamentoSchema.parse(bruto)
  const situacao = situacaoDoAsaas(p.status, p.deleted ?? false)
  return {
    pagamentoId: p.id,
    referencia: p.externalReference ?? null,
    situacao,
    valorCentavos: centavosDeReais(p.value),
    pagaEm: situacao === 'paga' ? diaParaData(p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate) ?? new Date() : null,
    recorrencia: p.subscription ?? null,
    vencimento: p.dueDate ?? null,
  }
}

const assinaturaSchema = z.object({ id: z.string().min(1), status: z.string().nullish(), deleted: z.boolean().nullish() })
const pagamentosDaAssinaturaSchema = z.object({ data: z.array(pagamentoSchema) })
const autorizacaoSchema = z.object({ id: z.string().min(1), status: z.string(), payload: z.string().nullish() })

/** O `contractId` do Pix Automático: até 35 caracteres. O uuid sem hífens cabe. */
function contratoDe(referencia: string): string {
  return referencia.replace(/-/g, '').slice(0, 35)
}

export const asaas: GatewayDePagamento = {
  /**
   * `billingType: UNDEFINED` e não `PIX`: a mesma cobrança vira Pix copia e
   * cola na conversa e, pelo link, cartão ou boleto, à escolha de quem paga.
   * Uma cobrança só, e não três, para não haver duas pagas pela mesma coisa.
   */
  async criarCobranca(acesso, pedido): Promise<CobrancaCriada> {
    const cliente = await clienteNoAsaas(acesso, pedido.pagador)
    const criado = pagamentoSchema.parse(
      await chamar(acesso, 'POST', '/payments', {
        customer: cliente,
        billingType: 'UNDEFINED',
        value: pedido.valorCentavos / 100,
        dueDate: diaEmSaoPaulo(pedido.venceEm),
        description: pedido.descricao.slice(0, 500),
        externalReference: pedido.referencia,
        // Pix Automático autorizado: o banco do pagador debita no vencimento.
        ...(pedido.autorizacaoPix ? { billingType: 'PIX', pixAutomaticAuthorizationId: pedido.autorizacaoPix } : {}),
      }),
    )
    if (pedido.autorizacaoPix) return { pagamentoId: criado.id, preferenciaId: null, pixCopiaCola: null, link: criado.invoiceUrl ?? null }
    // Conta sem chave Pix cadastrada não gera QR. A cobrança vale pelo link.
    const pix = pixSchema.safeParse(
      await chamar(acesso, 'GET', `/payments/${encodeURIComponent(criado.id)}/pixQrCode`).catch(() => null),
    )
    return {
      pagamentoId: criado.id,
      preferenciaId: null,
      pixCopiaCola: pix.success ? pix.data.payload : null,
      link: criado.invoiceUrl ?? null,
    }
  },

  async lerPagamento(acesso, pagamentoId) {
    return paraPagamentoLido(await chamar(acesso, 'GET', `/payments/${encodeURIComponent(pagamentoId)}`))
  },

  async cancelarPagamento(acesso, pagamentoId) {
    await chamar(acesso, 'DELETE', `/payments/${encodeURIComponent(pagamentoId)}`)
  },

  /**
   * Cartão recorrente (0145): a assinatura nasce sem o cartão, e o pagador o
   * informa na fatura do primeiro mês; dali em diante o Asaas cobra no
   * vencimento. Os pagamentos chegam pelo mesmo aviso, com `subscription`, e
   * `aplicarPagamento` acha a mensalidade por ele.
   */
  async criarAssinaturaNoCartao(acesso, pedido) {
    const cliente = await clienteNoAsaas(acesso, pedido.pagador)
    const criada = assinaturaSchema.parse(
      await chamar(acesso, 'POST', '/subscriptions', {
        customer: cliente,
        billingType: 'CREDIT_CARD',
        cycle: 'MONTHLY',
        value: pedido.valorCentavos / 100,
        nextDueDate: pedido.primeiroVencimento,
        description: pedido.descricao.slice(0, 500),
        externalReference: pedido.referencia,
      }),
    )
    const pagamentos = pagamentosDaAssinaturaSchema.safeParse(
      await chamar(acesso, 'GET', `/subscriptions/${encodeURIComponent(criada.id)}/payments`).catch(() => null),
    )
    return { idNoGateway: criada.id, link: pagamentos.success ? (pagamentos.data.data[0]?.invoiceUrl ?? null) : null, pixCopiaCola: null }
  },

  /**
   * Pix Automático, jornada 3 (0145): um QR só paga o primeiro mês e autoriza
   * os próximos. Modo `MANUAL`: a cobrança de cada mês é nossa, criada pelo
   * relógio com `pixAutomaticAuthorizationId`, e por isso volta com a nossa
   * referência como qualquer outra.
   */
  async criarAutorizacaoPix(acesso, pedido) {
    const cliente = await clienteNoAsaas(acesso, pedido.pagador)
    const criada = autorizacaoSchema.parse(
      await chamar(acesso, 'POST', '/pix/automatic/authorizations', {
        customerId: cliente,
        frequency: 'MONTHLY',
        contractId: contratoDe(pedido.referencia),
        startDate: pedido.primeiroVencimento,
        value: pedido.valorCentavos / 100,
        description: pedido.descricao.slice(0, 35),
        paymentCreationMode: 'MANUAL',
        immediateQrCode: {
          expirationSeconds: 3 * 24 * 3600,
          originalValue: pedido.valorCentavos / 100,
          description: pedido.descricao.slice(0, 35),
        },
      }),
    )
    return { idNoGateway: criada.id, link: null, pixCopiaCola: criada.payload ?? null }
  },

  async lerAdesao(acesso, modo, idNoGateway) {
    if (modo === 'cartao') {
      const a = assinaturaSchema.parse(await chamar(acesso, 'GET', `/subscriptions/${encodeURIComponent(idNoGateway)}`))
      if (a.deleted || a.status === 'INACTIVE' || a.status === 'EXPIRED') return 'encerrada'
      // Ativa no Asaas desde a criação; para nós, só depois do primeiro pagamento no cartão.
      const pagos = pagamentosDaAssinaturaSchema.safeParse(
        await chamar(acesso, 'GET', `/subscriptions/${encodeURIComponent(idNoGateway)}/payments`).catch(() => null),
      )
      return pagos.success && pagos.data.data.some((p) => situacaoDoAsaas(p.status) === 'paga') ? 'ativa' : 'aguardando'
    }
    const a = autorizacaoSchema.parse(await chamar(acesso, 'GET', `/pix/automatic/authorizations/${encodeURIComponent(idNoGateway)}`))
    if (a.status === 'ACTIVE') return 'ativa'
    if (a.status === 'CREATED') return 'aguardando'
    return 'encerrada'
  },

  async encerrarAdesao(acesso, modo, idNoGateway) {
    const caminho = modo === 'cartao' ? '/subscriptions/' : '/pix/automatic/authorizations/'
    await chamar(acesso, 'DELETE', `${caminho}${encodeURIComponent(idNoGateway)}`)
  },
}

const avisoSchema = z.object({
  event: z.string(),
  payment: z.object({ id: z.string().min(1) }).optional(),
})

/**
 * O que importa do aviso: só o id do pagamento. O resto do corpo **não é
 * lido**: o pagamento é relido na API com a chave do dono antes de qualquer
 * coisa mudar, e um corpo forjado não marca nada como pago.
 */
export function pagamentoDoAviso(corpo: unknown): string | null {
  const lido = avisoSchema.safeParse(corpo)
  if (!lido.success || !lido.data.payment) return null
  if (!(EVENTOS_DO_AVISO as readonly string[]).includes(lido.data.event)) return null
  return lido.data.payment.id
}
