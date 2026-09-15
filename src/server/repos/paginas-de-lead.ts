import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Qual conta é dona de cada Página do Facebook (0051).
 *
 * Existe porque o webhook `leadgen` chega numa URL só, para todos os clientes,
 * e o corpo não diz de quem é o lead — só em qual Página o formulário está.
 */

export type PaginaDeLead = { pageId: string; nome: string; criadoEm: string }

/**
 * A conta dona desta Página, ou `null` quando ninguém a cadastrou.
 *
 * `null` é resposta esperada: o cliente pode inscrever o app numa Página a mais
 * sem avisar. Quem chama transforma isso em alerta — o lead é descartado, e é
 * melhor descartar com aviso do que adivinhar a conta.
 */
export async function clientePelaPagina(pageId: string): Promise<string | null> {
  const limpo = pageId.trim()
  if (limpo === '') return null

  const { data, error } = await db()
    .from('paginas_de_lead')
    .select('client_id')
    .eq('page_id', limpo)
    .maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return null
    throw new Error(`não deu para achar a conta da página: ${error.message}`)
  }

  return (data as { client_id: string } | null)?.client_id ?? null
}

/** As Páginas de uma conta, para a tela de configuração. */
export async function paginasDaConta(clienteId: string): Promise<PaginaDeLead[]> {
  const { data, error } = await db()
    .from('paginas_de_lead')
    .select('page_id, nome, criado_em')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para listar as páginas: ${error.message}`)
  }

  return ((data ?? []) as { page_id: string; nome: string | null; criado_em: string }[]).map(
    (linha) => ({ pageId: linha.page_id, nome: linha.nome ?? '', criadoEm: linha.criado_em }),
  )
}

/**
 * Liga uma Página a uma conta.
 *
 * A Página já cadastrada em **outra** conta é recusada com motivo, e não
 * sobrescrita: sobrescrever mudaria silenciosamente para onde vão os leads de
 * um cliente que não pediu nada.
 */
export async function ligarPagina(entrada: {
  clienteId: string
  pageId: string
  nome?: string
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const pageId = entrada.pageId.trim()
  if (pageId === '') return { ok: false, motivo: 'informe o id da página' }

  const dono = await clientePelaPagina(pageId)
  if (dono && dono !== entrada.clienteId) {
    return { ok: false, motivo: 'esta página já está ligada a outra conta' }
  }

  const { error } = await db()
    .from('paginas_de_lead')
    .upsert(
      { page_id: pageId, client_id: entrada.clienteId, nome: entrada.nome ?? '' },
      { onConflict: 'page_id' },
    )

  if (error) return { ok: false, motivo: `não deu para ligar a página: ${error.message}` }
  return { ok: true }
}

/** Desliga a Página. Os leads dela param de entrar; os já criados ficam. */
export async function desligarPagina(clienteId: string, pageId: string): Promise<boolean> {
  const { error, count } = await db()
    .from('paginas_de_lead')
    .delete({ count: 'exact' })
    .eq('page_id', pageId.trim())
    .eq('client_id', clienteId)

  if (error) throw new Error(`não deu para desligar a página: ${error.message}`)
  return (count ?? 0) > 0
}
