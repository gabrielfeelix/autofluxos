import 'server-only'
import { db } from '../db'

/**
 * Os avisos de plano já dados (0102): uma linha por aviso, e a chave diz qual
 * (`descida:2026-10-01:7d`, `consumo:2026-09-01:80`, `preco:2026-10-24`).
 * A tela lê os do mês para mostrar a faixa; a passada diária grava para o
 * e-mail não sair duas vezes.
 */

export type AvisoDePlano = { chave: string; criadoEm: string }

/** Grava o aviso. `false` quando ele já tinha sido dado. */
export async function marcarAviso(clienteId: string, chave: string): Promise<boolean> {
  const { error } = await db().from('avisos_de_plano').insert({ client_id: clienteId, chave })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`não deu para gravar o aviso: ${error.message}`)
}

export async function marcarEmailEnviado(clienteId: string, chave: string): Promise<void> {
  await db().from('avisos_de_plano').update({ email_enviado_em: new Date().toISOString() }).eq('client_id', clienteId).eq('chave', chave)
}

/** Os avisos dados à organização desde `desde` (ISO), do mais novo ao mais velho. */
export async function avisosDesde(clienteId: string, desde: string): Promise<AvisoDePlano[]> {
  const { data, error } = await db()
    .from('avisos_de_plano')
    .select('chave, criado_em')
    .eq('client_id', clienteId)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
  if (error) return []
  return ((data ?? []) as { chave: string; criado_em: string }[]).map((linha) => ({ chave: linha.chave, criadoEm: linha.criado_em }))
}
