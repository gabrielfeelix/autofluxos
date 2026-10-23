import 'server-only'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { iguais } from '@/lib/segredo'
import { ambienteDaChave, chamar, ErroDoAsaas } from './asaas'
import { centavosDeReais, type AcessoAoGateway } from './pagamento'

/**
 * A conta Asaas **da 4YU**, que cobra a mensalidade do AutoFluxos
 * (docs/PLANO-MENSALIDADE-ASAAS.md).
 *
 * Não confundir com `asaas.ts`, que fala com a conta de cada cliente para ele
 * cobrar quem conversa com ele. Lá a chave vem do Vault, uma por organização;
 * aqui é uma só, `ASAAS_4YU_CHAVE`, no cofre e na Vercel. A chave diz o
 * ambiente: `$aact_hmlg_` é o sandbox, `$aact_prod_` é a produção.
 */

export function acessoDa4yu(): AcessoAoGateway {
  const chave = process.env.ASAAS_4YU_CHAVE?.trim()
  if (!chave) throw new Error('falta ASAAS_4YU_CHAVE para cobrar a mensalidade')
  const ambiente = ambienteDaChave(chave)
  if (!ambiente) throw new Error('ASAAS_4YU_CHAVE não parece uma chave do Asaas')
  // Chave antiga, sem o marcador do ambiente: só existe em produção.
  return { token: chave, ambiente: ambiente === 'desconhecido' ? 'producao' : ambiente }
}

export function mensalidadeConfigurada(): boolean {
  return Boolean(process.env.ASAAS_4YU_CHAVE?.trim())
}

// ---------------------------------------------------------------------------
// O aviso
// ---------------------------------------------------------------------------

/**
 * Os eventos da mensalidade. Aqui vencer **está**, ao contrário do aviso da
 * cobrança no chat: atraso é o que move a suspensão (fase 3), e o relógio
 * dele é o Asaas, não o nosso.
 */
export const EVENTOS_DA_MENSALIDADE = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
] as const

/** O caminho do aviso, para `garantirAviso` e para a rota. */
export const CAMINHO_DO_AVISO = '/api/webhook/assinatura'

/**
 * O `asaas-access-token` do aviso da 4YU. Derivado, como o de `asaas.ts`, e
 * com rótulo próprio: o segredo de uma organização nunca abre esta rota, e o
 * desta rota nunca abre a de uma organização.
 */
export function segredoDoAvisoDa4yu(): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o aviso da mensalidade')
  return createHmac('sha256', `asaas-4yu:${chave}`).update('mensalidade').digest('hex')
}

/** O cabeçalho que chegou bate? Falha fechada sem o segredo no ambiente. */
export function avisoDa4yuAutentico(recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, segredoDoAvisoDa4yu())
  } catch {
    return false
  }
}

const listaDeAvisosSchema = z.object({ data: z.array(z.object({ id: z.string(), url: z.string().nullish() })) })

/**
 * Cadastra o aviso na conta da 4YU se ele ainda não existe. Roda antes de
 * cada assinatura criada: assim ninguém precisa entrar no painel do Asaas
 * para configurar webhook, nem no sandbox nem na produção.
 */
export async function garantirAviso(origem: string, email: string): Promise<void> {
  const acesso = acessoDa4yu()
  const url = `${origem.replace(/\/$/, '')}${CAMINHO_DO_AVISO}`
  const existentes = listaDeAvisosSchema.parse(await chamar(acesso, 'GET', '/webhooks?limit=100'))
  if (existentes.data.some((aviso) => aviso.url === url)) return
  await chamar(acesso, 'POST', '/webhooks', {
    name: 'AutoFluxos, mensalidade',
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    sendType: 'SEQUENTIALLY',
    authToken: segredoDoAvisoDa4yu(),
    events: EVENTOS_DA_MENSALIDADE,
  })
}

const avisoSchema = z.object({ event: z.string(), payment: z.object({ id: z.string().min(1) }).optional() })

/**
 * Só o id do pagamento sai do corpo. O pagamento é relido na API com a chave
 * da 4YU antes de qualquer coisa mudar: corpo forjado não troca plano.
 */
export function pagamentoDoAvisoDa4yu(corpo: unknown): string | null {
  const lido = avisoSchema.safeParse(corpo)
  if (!lido.success || !lido.data.payment) return null
  if (!(EVENTOS_DA_MENSALIDADE as readonly string[]).includes(lido.data.event)) return null
  return lido.data.payment.id
}

// ---------------------------------------------------------------------------
// Cliente e assinatura
// ---------------------------------------------------------------------------

const idSchema = z.object({ id: z.string().min(1) })
const listaSchema = z.object({ data: z.array(z.object({ id: z.string().min(1) })) })

export type Assinante = {
  clienteId: string
  nome: string
  /** CPF ou CNPJ, só dígitos. O Asaas não cria cliente sem. */
  documento: string
  email: string
}

/**
 * O cliente do AutoFluxos como cliente da 4YU no Asaas. Procura pela
 * referência antes de criar: clicar duas vezes em Assinar não pode virar dois
 * clientes, nem duas notas fiscais no nome de cada um.
 *
 * Aqui as notificações do Asaas ficam **ligadas**, ao contrário de
 * `asaas.ts`: a régua de lembretes por e-mail é o que cobra o atraso.
 */
export async function garantirClienteNoAsaas(assinante: Assinante): Promise<string> {
  const acesso = acessoDa4yu()
  const achados = listaSchema.parse(
    await chamar(acesso, 'GET', `/customers?externalReference=${encodeURIComponent(assinante.clienteId)}&limit=1`),
  )
  if (achados.data[0]) return achados.data[0].id
  return idSchema.parse(
    await chamar(acesso, 'POST', '/customers', {
      name: assinante.nome.slice(0, 100),
      cpfCnpj: assinante.documento,
      email: assinante.email,
      externalReference: assinante.clienteId,
    }),
  ).id
}

export type PedidoDeAssinatura = {
  clienteAsaas: string
  clienteId: string
  valorCentavos: number
  ciclo: 'mensal' | 'anual'
  /** `aaaa-mm-dd`. O dia em que assinou é o dia da cobrança. */
  primeiroVencimento: string
  descricao: string
}

const pagamentosSchema = z.object({
  data: z.array(z.object({ id: z.string(), dueDate: z.string(), invoiceUrl: z.string().nullish() })),
})

/**
 * `billingType: UNDEFINED`: quem escolhe entre cartão, Pix e boleto é o
 * cliente, na página do Asaas. Devolve o link da primeira fatura, que é para
 * onde o botão Assinar leva.
 */
export async function criarAssinatura(pedido: PedidoDeAssinatura): Promise<{ assinaturaId: string; link: string | null }> {
  const acesso = acessoDa4yu()
  const criada = idSchema.parse(
    await chamar(acesso, 'POST', '/subscriptions', {
      customer: pedido.clienteAsaas,
      billingType: 'UNDEFINED',
      cycle: pedido.ciclo === 'anual' ? 'YEARLY' : 'MONTHLY',
      value: pedido.valorCentavos / 100,
      nextDueDate: pedido.primeiroVencimento,
      description: pedido.descricao.slice(0, 500),
      externalReference: pedido.clienteId,
    }),
  )
  return { assinaturaId: criada.id, link: await linkDaProximaFatura(criada.id) }
}

/** O link da fatura em aberto mais antiga da assinatura, ou `null` se não há. */
export async function linkDaProximaFatura(assinaturaId: string): Promise<string | null> {
  const lidos = pagamentosSchema.safeParse(
    await chamar(acessoDa4yu(), 'GET', `/subscriptions/${encodeURIComponent(assinaturaId)}/payments?status=PENDING`).catch(
      () => null,
    ),
  )
  if (!lidos.success) return null
  const maisAntiga = [...lidos.data.data].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return maisAntiga?.invoiceUrl ?? null
}

/**
 * Muda o valor (subir de plano, atendente a mais). `updatePendingPayments`
 * corrige também a fatura já gerada e ainda não paga, para o cliente não
 * pagar o preço velho no mês em que subiu.
 */
export async function atualizarValor(
  assinaturaId: string,
  valorCentavos: number,
  extras: { ciclo?: 'mensal' | 'anual'; descricao?: string } = {},
): Promise<void> {
  await chamar(acessoDa4yu(), 'PUT', `/subscriptions/${encodeURIComponent(assinaturaId)}`, {
    value: valorCentavos / 100,
    updatePendingPayments: true,
    ...(extras.ciclo ? { cycle: extras.ciclo === 'anual' ? 'YEARLY' : 'MONTHLY' } : {}),
    ...(extras.descricao ? { description: extras.descricao.slice(0, 500) } : {}),
  })
}

/** Encerra a assinatura. Faturas já pagas continuam pagas; as pendentes somem. */
export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  try {
    await chamar(acessoDa4yu(), 'DELETE', `/subscriptions/${encodeURIComponent(assinaturaId)}`)
  } catch (erro) {
    // Já apagada no painel do Asaas: o resultado que se queria.
    if (erro instanceof ErroDoAsaas && erro.detalhe.status === 404) return
    throw erro
  }
}

// ---------------------------------------------------------------------------
// Ler a fatura
// ---------------------------------------------------------------------------

const pagamentoSchema = z.object({
  id: z.string().min(1),
  customer: z.string().nullish(),
  subscription: z.string().nullish(),
  externalReference: z.string().nullish(),
  status: z.string(),
  value: z.number(),
  dueDate: z.string(),
  invoiceUrl: z.string().nullish(),
  deleted: z.boolean().nullish(),
  paymentDate: z.string().nullish(),
  clientPaymentDate: z.string().nullish(),
  confirmedDate: z.string().nullish(),
})

export type EstadoDaFatura = 'pendente' | 'vencida' | 'paga' | 'estornada' | 'cancelada'

const PAGA = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const ESTORNADA = new Set([
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
])

/**
 * O vocabulário do Asaas no nosso. Diferente de `situacaoDoAsaas`, `vencida`
 * existe aqui: é o estado que a suspensão por atraso lê.
 */
export function estadoDaFatura(status: string, apagada = false): EstadoDaFatura {
  if (apagada) return 'cancelada'
  if (PAGA.has(status)) return 'paga'
  if (ESTORNADA.has(status)) return 'estornada'
  if (status === 'OVERDUE') return 'vencida'
  return 'pendente'
}

export type FaturaLida = {
  asaasId: string
  clienteAsaas: string | null
  assinaturaRef: string | null
  referencia: string | null
  estado: EstadoDaFatura
  valorCentavos: number
  vencimento: string
  link: string | null
  pagaEm: Date | null
}

/** `2026-10-22` é dia, sem hora: meio-dia em Brasília, para não virar o dia anterior em UTC. */
function diaParaData(dia: string | null | undefined): Date | null {
  if (!dia) return null
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T12:00:00-03:00` : dia)
  return Number.isNaN(data.getTime()) ? null : data
}

export function paraFaturaLida(bruto: unknown): FaturaLida {
  const p = pagamentoSchema.parse(bruto)
  const estado = estadoDaFatura(p.status, p.deleted ?? false)
  return {
    asaasId: p.id,
    clienteAsaas: p.customer ?? null,
    assinaturaRef: p.subscription ?? null,
    referencia: p.externalReference ?? null,
    estado,
    valorCentavos: centavosDeReais(p.value),
    vencimento: p.dueDate,
    link: p.invoiceUrl ?? null,
    pagaEm: estado === 'paga' ? (diaParaData(p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate) ?? new Date()) : null,
  }
}

export async function lerFatura(asaasId: string): Promise<FaturaLida> {
  return paraFaturaLida(await chamar(acessoDa4yu(), 'GET', `/payments/${encodeURIComponent(asaasId)}`))
}
