import 'server-only'
import { createHmac } from 'node:crypto'

/**
 * As chamadas de administração da Bot API: quem é o bot, e para onde ele manda
 * as mensagens. O envio de mensagem mora no adaptador (`channels/telegram.ts`).
 *
 * **O token vai na URL**, e por isso nenhum erro daqui repete a URL: ela
 * levaria a credencial para o log. O erro diz o método e a descrição que o
 * Telegram devolveu, e só.
 */

const RAIZ = process.env.TELEGRAM_API_ROOT ?? 'https://api.telegram.org'

/** O formato do token do @BotFather: `123456789:AA...`. */
export const FORMATO_DO_TOKEN = /^(\d{5,15}):[A-Za-z0-9_-]{30,}$/

type Resposta<T> = { ok: boolean; result?: T; description?: string }

async function chamar<T>(token: string, metodo: string, corpo?: Record<string, unknown>): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`${RAIZ}/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo ?? {}),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error(`o Telegram não respondeu (${metodo})`)
  }
  const lido = (await resposta.json().catch(() => ({ ok: false }))) as Resposta<T>
  if (!lido.ok || lido.result === undefined) {
    throw new Error(
      resposta.status === 401 || resposta.status === 404
        ? 'o Telegram não reconheceu este token. Copie de novo do @BotFather.'
        : `o Telegram recusou (${metodo}): ${lido.description ?? resposta.status}`,
    )
  }
  return lido.result
}

export async function quemEOBot(token: string): Promise<{ id: string; username: string | null; nome: string }> {
  const eu = await chamar<{ id: number; username?: string; first_name: string }>(token, 'getMe')
  return { id: String(eu.id), username: eu.username ?? null, nome: eu.first_name }
}

/**
 * O segredo que o Telegram manda de volta em todo webhook.
 *
 * Derivado, e não guardado: o mesmo bot sempre dá o mesmo segredo, e não há
 * mais um valor no cofre para rotacionar. Quem não tem o `BETTER_AUTH_SECRET`
 * não consegue montar um, e é isso que impede alguém de chamar a nossa rota
 * fingindo ser o Telegram.
 */
export function segredoDoWebhook(botId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o webhook do Telegram')
  return createHmac('sha256', `telegram:${chave}`).update(botId).digest('hex').slice(0, 48)
}

export function enderecoDoWebhook(botId: string): string {
  const base = process.env.VERCEL_ENV === 'production' ? 'https://dialogon.com.br' : (process.env.BETTER_AUTH_URL ?? '')
  return `${base}/api/webhook/telegram/${botId}`
}

/** Aponta o bot para nós. Só mensagens e toques em botão interessam. */
export async function ligarWebhook(token: string, botId: string): Promise<void> {
  await chamar<boolean>(token, 'setWebhook', {
    url: enderecoDoWebhook(botId),
    secret_token: segredoDoWebhook(botId),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  })
}

/** Solta o bot. Falhar aqui não impede desligar: o token pode já ter sido revogado. */
export async function desligarWebhook(token: string): Promise<void> {
  await chamar<boolean>(token, 'deleteWebhook').catch(() => {})
}

/** Tira o "carregando" do botão tocado. Sem isto o relógio gira até o Telegram desistir. */
export async function responderToque(token: string, toqueId: string): Promise<void> {
  await chamar<boolean>(token, 'answerCallbackQuery', { callback_query_id: toqueId }).catch(() => {})
}
