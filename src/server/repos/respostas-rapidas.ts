import 'server-only'
import { db, ehIdInvalido } from '../db'

export type RespostaRapida = {
  id: string
  atalho: string
  texto: string
}

type Linha = {
  id: string
  atalho: string
  texto: string
}

const COLUNAS = 'id, atalho, texto'

/** Respostas que pertencem a um cliente, na ordem em que foram cadastradas. */
export async function listarRespostasRapidas(clienteId: string): Promise<RespostaRapida[]> {
  const { data, error } = await db()
    .from('quick_replies')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as respostas rápidas: ${error.message}`)
  return data as Linha[]
}

export async function criarRespostaRapida(
  clienteId: string,
  resposta: Omit<RespostaRapida, 'id'>,
): Promise<void> {
  const { error } = await db().from('quick_replies').insert({
    client_id: clienteId,
    atalho: resposta.atalho,
    texto: resposta.texto,
  })

  if (error?.code === '23505') {
    throw new Error(`já existe uma resposta rápida /${resposta.atalho} para este cliente`)
  }
  if (error) throw new Error(`não deu para criar a resposta rápida: ${error.message}`)
}

/** O par resposta–cliente evita apagar um atalho pelo id de outro cliente. */
export async function apagarRespostaRapida(respostaId: string, clienteId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('quick_replies')
    .delete()
    .eq('id', respostaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar a resposta rápida: ${error.message}`)
  return (data?.length ?? 0) === 1
}
