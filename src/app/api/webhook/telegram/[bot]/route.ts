import { after } from 'next/server'
import { iguais } from '@/lib/segredo'
import { alertar } from '@/server/alertar'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { receberDoTelegram } from '@/server/receber-do-telegram'
import { segredoDoWebhook } from '@/server/telegram/bot-api'

export const maxDuration = 300

/**
 * O webhook de um bot do Telegram (0140).
 *
 * O id do bot vem no endereço, e o Telegram devolve em todo update o
 * `secret_token` que registramos no `setWebhook`. Sem ele batendo, a chamada
 * não é do Telegram, e nada é processado.
 *
 * Responde 200 na hora e processa depois, como o WhatsApp: o Telegram reenvia
 * o que demora, e a resposta do bot não pode virar duas.
 */
export async function POST(req: Request, { params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params
  if (!/^\d{5,15}$/.test(bot)) return new Response('não encontrado', { status: 404 })

  const recebido = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  let esperado: string
  try {
    esperado = segredoDoWebhook(bot)
  } catch {
    return new Response('não configurado', { status: 503 })
  }
  if (!iguais(recebido, esperado)) return new Response('não autorizado', { status: 401 })

  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta

  let payload: unknown
  try {
    payload = JSON.parse(lido.corpo)
  } catch {
    return new Response('ok', { status: 200 })
  }

  after(async () => {
    try {
      await receberDoTelegram(bot, payload)
    } catch (erro) {
      console.error('[webhook telegram] falhou ao processar', erro)
      await alertar('o processamento do webhook do Telegram falhou', erro, { bot })
    }
  })
  return new Response('ok', { status: 200 })
}
