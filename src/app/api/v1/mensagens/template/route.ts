import { createHash } from 'node:crypto'
import { z } from 'zod'
import { autenticarChave, erroDaApi, frasesDoZod, lerCorpo } from '@/server/api/autenticar'
import { enviarModeloPelaApi } from '@/server/api/templates'
import {
  concluirIdempotencia,
  liberarIdempotencia,
  reservarIdempotencia,
} from '@/server/repos/idempotencia-da-api'

/**
 * `POST /api/v1/mensagens/template`: envia um modelo aprovado, dentro ou fora
 * da janela de 24h. Contato que não existe é criado, com a mesma regra do
 * `POST /contatos`.
 *
 * **`Idempotency-Key` é obrigatório.** Desde 01/out/2026 a Meta cobra cada
 * mensagem, e o sistema de fora repete a chamada quando a resposta não chega.
 * Com a chave, a repetição recebe a resposta guardada (24h) e nada sai de novo.
 *
 * A resposta só é guardada quando a mensagem saiu (202). Qualquer recusa (teto
 * do dia, modelo pausado, falha da Meta) libera a chave: nada foi enviado, e a
 * repetição com a mesma chave depois de corrigido deve poder tentar.
 */

export const maxDuration = 30

const ROTA = 'POST /api/v1/mensagens/template'

const valor = z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1, 'valor vazio').max(1024))

const corpoSchema = z.object({
  telefone: z.string().trim().min(1, 'obrigatório').max(40),
  template: z.string().trim().min(1, 'obrigatório').max(512),
  idioma: z.string().trim().min(2).max(15).optional(),
  valores: z
    .object({
      corpo: z.array(valor).max(20).optional(),
      cabecalho: z.array(valor).max(1).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const acesso = await autenticarChave(request, 'mensagens:enviar')
  if (acesso instanceof Response) return acesso

  const chave = request.headers.get('idempotency-key')?.trim() ?? ''
  if (!chave || chave.length > 120) {
    return erroDaApi(
      400,
      'idempotencia_obrigatoria',
      'Envie o cabeçalho Idempotency-Key (até 120 caracteres), único por mensagem. Exemplo: um UUID ou o id do pedido no seu sistema.',
    )
  }

  const lido = await lerCorpo(request)
  if (!lido.ok) return lido.resposta

  const analise = corpoSchema.safeParse(lido.corpo)
  if (!analise.success) return erroDaApi(422, 'corpo_invalido', frasesDoZod(analise.error.issues))

  const impressao = createHash('sha256').update(JSON.stringify(analise.data)).digest('hex')

  let reserva
  try {
    reserva = await reservarIdempotencia({ clienteId: acesso.clienteId, chave, chaveApiId: acesso.chaveId, rota: ROTA, impressao })
  } catch (erro) {
    console.error(`[api] idempotência falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para enviar agora. Tente de novo com a mesma Idempotency-Key.')
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
    return erroDaApi(422, 'idempotencia_conflito', 'Esta Idempotency-Key já foi usada com outro corpo nas últimas 24h. Use uma chave nova para cada mensagem.')
  }

  try {
    const resultado = await enviarModeloPelaApi(acesso.clienteId, analise.data)
    const status = resultado.ok ? 202 : resultado.status
    const corpo = resultado.ok ? resultado.corpo : { erro: { codigo: resultado.codigo, mensagem: resultado.mensagem } }

    if (resultado.ok) await concluirIdempotencia(acesso.clienteId, chave, status, corpo)
    else await liberarIdempotencia(acesso.clienteId, chave)

    return Response.json(corpo, { status })
  } catch (erro) {
    await liberarIdempotencia(acesso.clienteId, chave)
    console.error(`[api] POST mensagens/template falhou (chave ${acesso.publico}):`, erro instanceof Error ? erro.message : erro)
    return erroDaApi(500, 'erro_interno', 'Não deu para enviar agora. Tente de novo com a mesma Idempotency-Key.')
  }
}
