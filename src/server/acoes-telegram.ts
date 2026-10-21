'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirCapacidade, recusou } from './permissoes'
import { lerTokenDoCanal } from './repos/conversas'
import { canalDoTelegram, desligarBotDoTelegram, salvarBotDoTelegram } from './repos/canais-telegram'
import { desligarWebhook, FORMATO_DO_TOKEN, ligarWebhook, quemEOBot } from './telegram/bot-api'

/**
 * Ligar e desligar o bot do Telegram (0140).
 *
 * Ligar é colar o token do @BotFather: conferimos com o Telegram quem é o bot,
 * guardamos o token no cofre e apontamos o bot para nós. Se o apontamento
 * falhar, o canal não fica meio ligado: a linha é apagada e a pessoa vê o
 * motivo.
 */

function voltar(clienteId: string, resultado: string): never {
  redirect(`/clientes/${clienteId}/conversas/canais/telegram?resultado=${resultado}`)
}

export async function acaoConectarTelegram(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  // Ligar canal é configurar a operação, como conectar número.
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  const token = String(dados.get('token') ?? '').trim()
  if (!FORMATO_DO_TOKEN.test(token)) voltar(clienteId, 'token_invalido')

  let botId: string
  try {
    const bot = await quemEOBot(token)
    botId = bot.id
    await salvarBotDoTelegram({ clienteId, botId: bot.id, username: bot.username, token })
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : ''
    voltar(clienteId, texto.includes('outra conta') ? 'de_outra_conta' : texto.includes('não reconheceu') ? 'token_recusado' : 'falhou')
  }

  try {
    await ligarWebhook(token, botId)
  } catch {
    await desligarBotDoTelegram(clienteId).catch(() => {})
    voltar(clienteId, 'sem_webhook')
  }

  revalidatePath(`/clientes/${clienteId}/conversas/canais`)
  voltar(clienteId, 'conectado')
}

export async function acaoDesligarTelegram(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  const canal = await canalDoTelegram(clienteId)
  if (canal?.tokenRef) await desligarWebhook(await lerTokenDoCanal(canal)).catch(() => {})
  await desligarBotDoTelegram(clienteId)
  revalidatePath(`/clientes/${clienteId}/conversas/canais`)
  voltar(clienteId, 'desligado')
}
