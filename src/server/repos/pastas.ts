import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Gavetas para organizar fluxos (0029).
 *
 * Elas não têm permissão, não herdam nada e não mudam comportamento nenhum:
 * são um rótulo com nome. Foi de propósito — pasta que decide quem vê o quê
 * vira um segundo sistema de autorização paralelo ao de contas, e dois sistemas
 * de autorização é como um deles fica para trás.
 */

export type Pasta = { id: string; nome: string }

export async function listarPastas(clienteId: string): Promise<Pasta[]> {
  const { data, error } = await db()
    .from('pastas')
    .select('id, nome')
    .eq('client_id', clienteId)
    .order('nome', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as pastas: ${error.message}`)
  return data as Pasta[]
}

export async function criarPasta(
  clienteId: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = nome.trim().slice(0, 40)
  if (limpo === '') return { ok: false, motivo: 'escreva o nome da pasta' }

  const { error } = await db().from('pastas').insert({ client_id: clienteId, nome: limpo })

  if (error?.code === '23505') return { ok: false, motivo: `já existe uma pasta “${limpo}”` }
  if (error) throw new Error(`não deu para criar a pasta: ${error.message}`)
  return { ok: true }
}

/**
 * Apagar a pasta devolve os fluxos para a raiz — é o `on delete set null` da
 * 0029. `cascade` aqui seria um clique de arrumação levando junto o desenho
 * publicado que está atendendo gente.
 */
export async function apagarPasta(clienteId: string, pastaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('pastas')
    .delete()
    .eq('id', pastaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar a pasta: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/**
 * Move um fluxo para uma pasta — ou para a raiz, com `null`.
 *
 * A pasta é conferida contra o **mesmo cliente**: o id chega de um formulário, e
 * a chave estrangeira só sabe que ela existe, não de quem é. Sem isso, um fluxo
 * apareceria dentro da gaveta de outra conta.
 */
export async function moverFluxo(
  clienteId: string,
  fluxoId: string,
  pastaId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (pastaId !== null) {
    const { data: pasta, error } = await db()
      .from('pastas')
      .select('id')
      .eq('id', pastaId)
      .eq('client_id', clienteId)
      .maybeSingle()

    if (ehIdInvalido(error)) return { ok: false, motivo: 'esta pasta não existe' }
    if (error) throw new Error(`não deu para conferir a pasta: ${error.message}`)
    if (!pasta) return { ok: false, motivo: 'esta pasta não é deste cliente' }
  }

  const { data, error } = await db()
    .from('flows')
    .update({ pasta_id: pastaId })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return { ok: false, motivo: 'esta automação não existe mais' }
  if (error) throw new Error(`não deu para mover o fluxo: ${error.message}`)
  if ((data?.length ?? 0) !== 1) return { ok: false, motivo: 'esta automação não existe mais' }
  return { ok: true }
}
