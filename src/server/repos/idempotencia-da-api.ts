import 'server-only'
import { db } from '../db'

/**
 * A `Idempotency-Key` da API pública (0121).
 *
 * O sistema de fora manda a mesma chave quando repete uma chamada que não teve
 * resposta (tempo esgotado, rede caiu). A primeira chamada reserva a linha; as
 * repetições recebem a resposta guardada em vez de enviar de novo. Uma mensagem
 * em dobro é uma cobrança em dobro da Meta e um cliente final irritado.
 *
 * A reserva é o `insert` na chave primária `(client_id, chave)`: duas chamadas
 * ao mesmo tempo, só uma entra. A outra recebe `em_andamento`.
 */

export const VALIDADE_EM_HORAS = 24

export type Reserva =
  | { tipo: 'nova' }
  | { tipo: 'repetida'; status: number; resposta: unknown }
  | { tipo: 'em_andamento' }
  | { tipo: 'conflito' }

type Linha = { impressao: string; status: number | null; resposta: unknown; criado_em: string }

export async function reservarIdempotencia(dados: {
  clienteId: string
  chave: string
  chaveApiId: string
  rota: string
  impressao: string
}): Promise<Reserva> {
  const limite = new Date(Date.now() - VALIDADE_EM_HORAS * 3600_000).toISOString()

  // Vencida não conta: a mesma chave depois de 24h é uma chamada nova.
  const { error: erroDaLimpeza } = await db()
    .from('api_idempotencia')
    .delete()
    .eq('client_id', dados.clienteId)
    .eq('chave', dados.chave)
    .lt('criado_em', limite)
  if (erroDaLimpeza) throw new Error(`não deu para limpar a idempotência: ${erroDaLimpeza.message}`)

  const { error } = await db().from('api_idempotencia').insert({
    client_id: dados.clienteId,
    chave: dados.chave,
    chave_api_id: dados.chaveApiId,
    rota: dados.rota,
    impressao: dados.impressao,
  })
  if (!error) return { tipo: 'nova' }
  if (error.code !== '23505') throw new Error(`não deu para reservar a idempotência: ${error.message}`)

  const { data, error: erroDaLeitura } = await db()
    .from('api_idempotencia')
    .select('impressao, status, resposta, criado_em')
    .eq('client_id', dados.clienteId)
    .eq('chave', dados.chave)
    .maybeSingle()
  if (erroDaLeitura) throw new Error(`não deu para ler a idempotência: ${erroDaLeitura.message}`)

  const linha = data as Linha | null
  // Sumiu entre o insert e a leitura: a outra chamada falhou e liberou.
  if (!linha) return { tipo: 'em_andamento' }
  if (linha.impressao !== dados.impressao) return { tipo: 'conflito' }
  if (linha.status === null) return { tipo: 'em_andamento' }
  return { tipo: 'repetida', status: linha.status, resposta: linha.resposta }
}

export async function concluirIdempotencia(clienteId: string, chave: string, status: number, resposta: unknown): Promise<void> {
  const { error } = await db()
    .from('api_idempotencia')
    .update({ status, resposta })
    .eq('client_id', clienteId)
    .eq('chave', chave)
  if (error) console.error('[api] não deu para guardar a resposta idempotente:', error.message)
}

/** Falha nossa ou da Meta: nada saiu, então a repetição pode tentar de novo. */
export async function liberarIdempotencia(clienteId: string, chave: string): Promise<void> {
  const { error } = await db().from('api_idempotencia').delete().eq('client_id', clienteId).eq('chave', chave)
  if (error) console.error('[api] não deu para liberar a idempotência:', error.message)
}

/** Para o cron: apaga o que passou de 24h. Devolve quantas linhas saíram. */
export async function limparIdempotenciaVencida(): Promise<number> {
  const limite = new Date(Date.now() - VALIDADE_EM_HORAS * 3600_000).toISOString()
  const { data, error } = await db().from('api_idempotencia').delete().lt('criado_em', limite).select('chave')
  if (error) throw new Error(`não deu para limpar a idempotência: ${error.message}`)
  return (data ?? []).length
}
