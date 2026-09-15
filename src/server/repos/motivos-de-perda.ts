import 'server-only'
import { MOTIVOS_INICIAIS } from '@/core/crm'
import { db, ehIdInvalido } from '../db'

/**
 * Por que se perde nesta conta (0058).
 *
 * Lista fechada em vez de texto livre porque agrupar é a única razão de
 * registrar o motivo — e texto livre produz "preço", "Preço", "caro" e "achou
 * caro" como quatro motivos diferentes.
 */

export type Motivo = { id: string; nome: string; ordem: number }

/**
 * Os motivos da conta, criando os iniciais na primeira vez.
 *
 * Semear na primeira leitura, e não no cadastro da conta: conta criada antes da
 * 0058 nunca passou por aquele código, e a alternativa seria uma migration que
 * escreve linha por cliente — dado semeado em banco compartilhado, que é o que
 * se quer fazer menos vezes.
 *
 * Lista vazia seria pior que uma lista genérica: obrigaria a cadastrar motivo
 * antes de poder perder a primeira venda, no momento exato em que ninguém tem
 * paciência para cadastro.
 */
export async function listarMotivos(clienteId: string): Promise<Motivo[]> {
  const { data, error } = await db()
    .from('motivos_de_perda')
    .select('id, nome, ordem')
    .eq('client_id', clienteId)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os motivos: ${error.message}`)

  const achados = (data as Motivo[]) ?? []
  if (achados.length > 0) return achados

  return semear(clienteId)
}

async function semear(clienteId: string): Promise<Motivo[]> {
  const { data, error } = await db()
    .from('motivos_de_perda')
    .upsert(
      MOTIVOS_INICIAIS.map((nome, ordem) => ({ client_id: clienteId, nome, ordem })),
      { onConflict: 'client_id,nome', ignoreDuplicates: true },
    )
    .select('id, nome, ordem')

  // Semear é conveniência. Se falhar — duas abas semeando ao mesmo tempo, por
  // exemplo —, a tela ainda funciona com a lista que conseguir ler depois.
  if (error) {
    console.error('[motivos] não deu para semear:', error.message)
    return []
  }

  return ((data as Motivo[]) ?? []).sort((a, b) => a.ordem - b.ordem)
}

export async function criarMotivo(
  clienteId: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'escreva o motivo' }
  if (limpo.length > 40) return { ok: false, motivo: 'o motivo cabe em 40 caracteres' }

  const atuais = await listarMotivos(clienteId)
  if (atuais.some((m) => m.nome.trim().toLowerCase() === limpo.toLowerCase())) {
    return { ok: false, motivo: 'este motivo já existe' }
  }

  const { error } = await db()
    .from('motivos_de_perda')
    .insert({ client_id: clienteId, nome: limpo, ordem: atuais.length })

  if (error) throw new Error(`não deu para criar o motivo: ${error.message}`)
  return { ok: true }
}

/**
 * Apagar um motivo **não reescreve as perdas antigas**.
 *
 * `quadro_cartoes.motivo` guarda o texto, não o id, exatamente por isto: a
 * conta pode reorganizar a lista quando quiser sem que o histórico do trimestre
 * passado mude de sentido embaixo de quem já leu o relatório.
 */
export async function apagarMotivo(clienteId: string, motivoId: string): Promise<boolean> {
  const { error, count } = await db()
    .from('motivos_de_perda')
    .delete({ count: 'exact' })
    .eq('client_id', clienteId)
    .eq('id', motivoId)

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o motivo: ${error.message}`)
  return (count ?? 0) > 0
}
