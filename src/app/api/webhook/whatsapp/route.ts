import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { receberMensagem } from '@/server/receber-mensagem'

/**
 * Onde o WhatsApp bate.
 *
 * Duas regras da Meta moldam este arquivo:
 *
 * 1. **Responder 200 em menos de 20 segundos** (a recomendação é abaixo de 5).
 *    Passou disso, ela reenvia — e reenvio vira conversa andando duas vezes.
 *    Por isso a resposta sai na hora e o processamento vai para o `after()`.
 * 2. **Validar a assinatura.** Sem isso, a URL é pública e qualquer um manda
 *    mensagem falsa em nome de qualquer cliente.
 *
 * A duplicata que escapar mesmo assim é pega pelo `unique` em
 * `messages.wa_message_id`.
 */

/**
 * O `after()` continua rodando depois da resposta, mas dentro do orçamento de
 * tempo da função — que na Vercel é curto por padrão.
 *
 * Sem isto, um parceiro lento no nó de API estoura o orçamento antes do nosso
 * próprio timeout de 10s por chamada: a função é morta no meio, o handoff nunca
 * é gravado, e a sessão fica presa em `aguardando_http`. Como a mensagem já foi
 * deduplicada, a Meta não reenvia e a pessoa fica sem resposta nenhuma.
 *
 * 60s cobre o pior caso realista: três saltos de redirecionamento no timeout
 * cheio, mais o banco.
 */
export const maxDuration = 60

export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams
  const modo = parametros.get('hub.mode')
  const token = parametros.get('hub.verify_token')
  const desafio = parametros.get('hub.challenge')

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN

  if (modo === 'subscribe' && esperado && token === esperado && desafio) {
    return new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  return new Response('não autorizado', { status: 403 })
}

export async function POST(req: Request) {
  // Precisa ser o corpo cru: a assinatura é calculada sobre os bytes exatos, e
  // um `JSON.parse` seguido de `stringify` já não bate mais.
  const corpo = await req.text()

  if (!assinaturaConfere(corpo, req.headers.get('x-hub-signature-256'))) {
    return new Response('assinatura inválida', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(corpo)
  } catch {
    // Corpo estranho não é motivo para a Meta ficar reenviando.
    return new Response('ok', { status: 200 })
  }

  after(async () => {
    try {
      await receberMensagem(payload)
    } catch (erro) {
      // Já respondemos 200. Deixar estourar aqui só produziria um unhandled
      // rejection sem ninguém para ver.
      console.error('[webhook] falhou ao processar', erro)
      // Esta é *a* exceção que deixa alguém sem resposta no WhatsApp: a Meta já
      // recebeu 200 e não reenvia. Sem aviso, ela é invisível até o cliente
      // ligar reclamando.
      await alertar('o processamento do webhook falhou', erro)
    }
  })

  return new Response('ok', { status: 200 })
}

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.META_APP_SECRET
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false

  const esperada = createHmac('sha256', segredo).update(corpo).digest('hex')
  const recebida = cabecalho.slice('sha256='.length)

  const a = Buffer.from(esperada, 'hex')
  const b = Buffer.from(recebida, 'hex')
  if (a.length !== b.length) return false

  // Comparação de tempo constante: comparar com `===` vazaria, pelo tempo de
  // resposta, quantos bytes iniciais o atacante já acertou.
  return timingSafeEqual(a, b)
}
