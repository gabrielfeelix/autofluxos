import 'server-only'
import { db, ehIdInvalido } from '../db'
import { type CanalSalvo, COLUNAS_DO_CANAL, paraCanal } from './conversas'

/**
 * O bot do Telegram de um cliente (0140).
 *
 * Mesma regra do Instagram: o token vai para o Vault na escrita e só sai por
 * `lerTokenDoCanal()`. As colunas próprias do Telegram ficam aqui, e não em
 * `COLUNAS_DO_CANAL`, para o resto do produto não depender delas.
 */

export type CanalDoTelegram = CanalSalvo & { tgBotId: string; tgUsername: string | null }

const COLUNAS = `${COLUNAS_DO_CANAL}, tg_bot_id, tg_username`

function paraCanalDoTelegram(linha: Record<string, unknown>): CanalDoTelegram {
  return {
    ...paraCanal(linha),
    tgBotId: String(linha.tg_bot_id),
    tgUsername: (linha.tg_username ?? null) as string | null,
  }
}

export async function canalDoTelegram(clienteId: string): Promise<CanalDoTelegram | null> {
  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('provider', 'telegram')
    .maybeSingle()
  if (ehIdInvalido(error)) return null
  // Antes da 0140 a coluna não existe: a tela mostra "não conectado".
  if (error) return null
  return data ? paraCanalDoTelegram(data as Record<string, unknown>) : null
}

export async function acharCanalPorBot(botId: string): Promise<CanalDoTelegram | null> {
  const { data, error } = await db().from('channels').select(COLUNAS).eq('tg_bot_id', botId).maybeSingle()
  if (error || !data) return null
  return paraCanalDoTelegram(data as Record<string, unknown>)
}

/**
 * Liga o bot, ou troca o token do que já estava ligado.
 *
 * O mesmo bot em outra conta é recusado por extenso: o `unique` da 0140
 * barraria com uma mensagem que não ajuda ninguém.
 */
export async function salvarBotDoTelegram(entrada: {
  clienteId: string
  botId: string
  username: string | null
  token: string
}): Promise<CanalDoTelegram> {
  const deOutro = await acharCanalPorBot(entrada.botId)
  if (deOutro && deOutro.clienteId !== entrada.clienteId) throw new Error('este bot já está ligado a outra conta')

  const existente = await canalDoTelegram(entrada.clienteId)
  if (existente?.tokenRef) {
    const { error: erroDoCofre } = await db().rpc('trocar_segredo', { alvo: existente.tokenRef, valor: entrada.token })
    if (erroDoCofre) throw new Error(`não foi possível guardar o token: ${erroDoCofre.message}`)
    const { data, error } = await db()
      .from('channels')
      .update({ tg_bot_id: entrada.botId, tg_username: entrada.username, status: 'ativo' })
      .eq('id', existente.id)
      .select(COLUNAS)
      .single()
    if (error) throw new Error(`não foi possível atualizar o bot: ${error.message}`)
    return paraCanalDoTelegram(data as Record<string, unknown>)
  }

  const { data: segredo, error: erroDoCofre } = await db().rpc('criar_segredo', {
    valor: entrada.token,
    apelido: `telegram_${crypto.randomUUID()}`,
  })
  if (erroDoCofre) throw new Error(`não foi possível guardar o token: ${erroDoCofre.message}`)
  const tokenRef = segredo as string

  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: entrada.clienteId,
      provider: 'telegram',
      phone_number_id: null,
      tg_bot_id: entrada.botId,
      tg_username: entrada.username,
      token_ref: tokenRef,
      status: 'ativo',
    })
    .select(COLUNAS)
    .single()
  if (error) {
    // O segredo já está no cofre e a linha não nasceu: sem isto ele ficaria órfão.
    await db().rpc('apagar_segredo', { alvo: tokenRef })
    throw new Error(`não foi possível ligar o bot: ${error.message}`)
  }
  return paraCanalDoTelegram(data as Record<string, unknown>)
}

/** Desliga o bot. O gatilho da 0040 apaga o token do cofre junto. */
export async function desligarBotDoTelegram(clienteId: string): Promise<void> {
  const { error } = await db().from('channels').delete().eq('client_id', clienteId).eq('provider', 'telegram')
  if (error) throw new Error(`não foi possível desligar o bot: ${error.message}`)
}
