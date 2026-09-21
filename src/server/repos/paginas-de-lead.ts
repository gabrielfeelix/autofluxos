import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Qual conta é dona de cada Página do Facebook (0051).
 *
 * Existe porque o webhook `leadgen` chega numa URL só, para todos os clientes,
 * e o corpo não diz de quem é o lead, só em qual Página o formulário está.
 */

export type PaginaDeLead = { pageId: string; nome: string; criadoEm: string }

/**
 * A conta dona desta Página, ou `null` quando ninguém a cadastrou.
 *
 * `null` é resposta esperada: o cliente pode inscrever o app numa Página a mais
 * sem avisar. Quem chama transforma isso em alerta, o lead é descartado, e é
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

/**
 * Os formulários que a reconciliação precisa varrer.
 *
 * Sai de `passagens`? Não: sai dos leads já recebidos. Um formulário só é
 * conhecido depois que o primeiro lead dele chegou, o que é suficiente, porque
 * a reconciliação existe para pegar o que **falhou**, e falha de formulário que
 * nunca entregou nada é problema de configuração, não de entrega perdida.
 */
export async function formulariosAtivos(): Promise<
  { clienteId: string; pageId: string; formId: string }[]
> {
  /*
   * Em ordem de quem foi varrido há mais tempo.
   *
   * A reconciliação pega só os primeiros N por execução, o limite da Meta é
   * por Página e proporcional ao volume de leads, então varrer tudo todo dia
   * estoura o teto de quem está começando. Ordenar por `varrido_em` faz a fila
   * girar: quem esperou mais vai primeiro, e ninguém fica para trás para
   * sempre. `nulls first` põe o formulário nunca varrido na frente de todos,
   * que é onde ele tem de estar.
   */
  const { data, error } = await db()
    .from('formularios_de_lead')
    .select('client_id, page_id, form_id')
    .order('varrido_em', { ascending: true, nullsFirst: true })

  if (error) {
    if (ehIdInvalido(error)) return []
    throw new Error(`não deu para listar os formulários: ${error.message}`)
  }

  return ((data ?? []) as { client_id: string; page_id: string; form_id: string }[]).map((l) => ({
    clienteId: l.client_id,
    pageId: l.page_id,
    formId: l.form_id,
  }))
}

/**
 * Anota o formulário na primeira vez que um lead dele chega.
 *
 * Silencioso por decisão: é registro de apoio à reconciliação, e falhar aqui
 * não pode impedir o lead de entrar, que é o trabalho de verdade.
 */
export async function anotarFormulario(entrada: {
  clienteId: string
  pageId: string
  formId: string
}): Promise<void> {
  if (entrada.formId.trim() === '') return

  await db()
    .from('formularios_de_lead')
    .upsert(
      {
        client_id: entrada.clienteId,
        page_id: entrada.pageId,
        form_id: entrada.formId.trim(),
      },
      { onConflict: 'form_id' },
    )
}

/**
 * Marca que estes formulários acabaram de ser varridos.
 *
 * É o que faz a fila girar. Sem isto, `formulariosAtivos` devolveria sempre a
 * mesma ordem e os mesmos trinta seriam varridos todo dia.
 */
export async function marcarVarredura(formIds: string[]): Promise<void> {
  if (formIds.length === 0) return

  await db()
    .from('formularios_de_lead')
    .update({ varrido_em: new Date().toISOString() })
    .in('form_id', formIds)
}
