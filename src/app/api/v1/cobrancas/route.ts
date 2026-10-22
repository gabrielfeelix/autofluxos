import { createHash } from 'node:crypto'
import { z } from 'zod'
import { reaisParaCentavos } from '@/core/api/cobrancas'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo } from '@/server/api/autenticar'
import {
  criarCobrancaPelaApi,
  LIMITE_MAXIMO_DE_COBRANCAS,
  LIMITE_PADRAO_DE_COBRANCAS,
  listarCobrancasDaApi,
} from '@/server/api/cobrancas'
import { STATUS_DE_COBRANCA } from '@/server/repos/cobrancas'
import {
  concluirIdempotencia,
  liberarIdempotencia,
  reservarIdempotencia,
} from '@/server/repos/idempotencia-da-api'

/**
 * `GET /api/v1/cobrancas`: as cobranças da conta, mais novas primeiro, por
 * telefone e status. Para o histórico inteiro, `GET /relatorios/cobrancas`.
 *
 * `POST /api/v1/cobrancas`: cria no gateway conectado e devolve o Pix e o
 * link, **sem mandar na conversa**. `Idempotency-Key` é obrigatório: o
 * sistema de fora repete a chamada quando a resposta não chega, e duas
 * cobranças iguais para a mesma pessoa são o pior jeito de errar com dinheiro.
 * Só a criação que deu certo guarda a resposta; recusa libera a chave.
 */

export const maxDuration = 30

const ROTA = 'POST /api/v1/cobrancas'

/** O gateway recusa Pix que vence em cima da hora, e 30 dias é o teto do Mercado Pago. */
const MINUTOS_MINIMOS_ATE_VENCER = 15
const DIAS_MAXIMOS_ATE_VENCER = 30
const HORAS_PADRAO_ATE_VENCER = 24

const filtroSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40).optional(),
  status: z.enum(STATUS_DE_COBRANCA).optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO_DE_COBRANCAS).default(LIMITE_PADRAO_DE_COBRANCAS),
})

export async function GET(request: Request) {
  const acesso = await autenticarChave(request, 'cobrancas:ler')
  if (acesso instanceof Response) return acesso

  const analise = filtroSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  try {
    const cobrancas = await listarCobrancasDaApi(acesso.clienteId, {
      limite: analise.data.limite,
      ...(analise.data.telefone ? { telefone: analise.data.telefone } : {}),
      ...(analise.data.status ? { status: analise.data.status } : {}),
    })
    if (!cobrancas) return erroDaApi(404, 'contato_nao_encontrado', 'Nenhum contato com este telefone nesta conta.')
    return Response.json({ cobrancas })
  } catch (erro) {
    console.error(`[api] GET cobrancas falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não foi possível ler as cobranças agora. Tente de novo.')
  }
}

const corpoSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40),
  nome: z.string().trim().max(120).optional(),
  valor: z
    .number('em reais, como número. Exemplo: 49.9')
    .max(1_000_000, 'até 1.000.000')
    .refine((v) => reaisParaCentavos(v) !== null, 'em reais, maior que zero, com até duas casas'),
  descricao: z.string().trim().min(1, 'obrigatório').max(200),
  vence_em: z.iso.datetime({ offset: true, message: 'data ISO 8601 com fuso. Exemplo: 2026-11-01T18:00:00-03:00' }).optional(),
  documento: z.string().trim().max(20).optional(),
})

export async function POST(request: Request) {
  const acesso = await autenticarChave(request, 'cobrancas:criar')
  if (acesso instanceof Response) return acesso

  const chave = request.headers.get('idempotency-key')?.trim() ?? ''
  if (!chave || chave.length > 120) {
    return erroDaApi(
      400,
      'idempotencia_obrigatoria',
      'Envie o cabeçalho Idempotency-Key (até 120 caracteres), único por cobrança. Exemplo: o id do pedido no seu sistema.',
    )
  }

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  const agora = Date.now()
  const venceEm = analise.data.vence_em ? new Date(analise.data.vence_em) : new Date(agora + HORAS_PADRAO_ATE_VENCER * 3_600_000)
  if (venceEm.getTime() < agora + MINUTOS_MINIMOS_ATE_VENCER * 60_000 || venceEm.getTime() > agora + DIAS_MAXIMOS_ATE_VENCER * 86_400_000) {
    return erroDaApi(
      422,
      'corpo_invalido',
      `vence_em: entre ${MINUTOS_MINIMOS_ATE_VENCER} minutos e ${DIAS_MAXIMOS_ATE_VENCER} dias a partir de agora.`,
    )
  }

  const impressao = createHash('sha256').update(JSON.stringify(analise.data)).digest('hex')

  let reserva
  try {
    reserva = await reservarIdempotencia({ clienteId: acesso.clienteId, chave, chaveApiId: acesso.chaveId, rota: ROTA, impressao })
  } catch (erro) {
    console.error(`[api] idempotência falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não foi possível criar agora. Tente de novo com a mesma Idempotency-Key.')
  }

  if (reserva.tipo === 'repetida') {
    return Response.json(reserva.resposta, { status: reserva.status, headers: { 'Idempotent-Replayed': 'true' } })
  }
  if (reserva.tipo === 'em_andamento') {
    return erroDaApi(409, 'requisicao_em_andamento', 'Uma chamada com esta Idempotency-Key ainda está sendo processada. Tente de novo em alguns segundos.', {
      'Retry-After': '5',
    })
  }
  if (reserva.tipo === 'conflito') {
    return erroDaApi(422, 'idempotencia_conflito', 'Esta Idempotency-Key já foi usada com outro corpo nas últimas 24h. Use uma chave nova para cada cobrança.')
  }

  try {
    const resultado = await criarCobrancaPelaApi(acesso.clienteId, {
      telefone: analise.data.telefone,
      valorCentavos: reaisParaCentavos(analise.data.valor) as number,
      descricao: analise.data.descricao,
      venceEm,
      ...(analise.data.nome ? { nome: analise.data.nome } : {}),
      ...(analise.data.documento ? { documento: analise.data.documento } : {}),
    })
    if (!resultado.ok) {
      await liberarIdempotencia(acesso.clienteId, chave)
      return erroDaApi(resultado.status, resultado.codigo, resultado.mensagem)
    }
    const corpo = { cobranca: resultado.cobranca }
    await concluirIdempotencia(acesso.clienteId, chave, 201, corpo)
    return Response.json(corpo, { status: 201 })
  } catch (erro) {
    await liberarIdempotencia(acesso.clienteId, chave)
    console.error(`[api] POST cobrancas falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não foi possível criar agora. Tente de novo com a mesma Idempotency-Key.')
  }
}
