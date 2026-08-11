import 'server-only'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { db } from '../db'

/**
 * Um fluxo salvo no banco. `rascunho` é o grafo mutável — o que o editor
 * escreve. O publicado vira linha imutável em `flow_versions` no passo 5.
 */
export type FluxoSalvo = {
  id: string
  clienteId: string
  nome: string
  rascunho: Fluxo
  atualizadoEm: string
}

type Linha = {
  id: string
  client_id: string
  nome: string
  rascunho: unknown
  atualizado_em: string
}

const COLUNAS = 'id, client_id, nome, rascunho, atualizado_em'

/**
 * `rascunho` é `jsonb`: o banco aceita qualquer coisa ali. Uma migração
 * malfeita, um `update` na mão pelo painel, uma versão antiga do schema — e o
 * motor receberia lixo. Validar na leitura é a mesma disciplina da fronteira
 * de rede, e o erro aponta o fluxo culpado em vez de estourar lá dentro.
 */
function paraFluxo(linha: Linha): FluxoSalvo {
  const analise = fluxoSchema.safeParse(linha.rascunho)
  if (!analise.success) {
    throw new Error(
      `o fluxo "${linha.nome}" (${linha.id}) está com o grafo inválido no banco: ` +
        analise.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '),
    )
  }

  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.nome,
    rascunho: analise.data,
    atualizadoEm: linha.atualizado_em,
  }
}

export async function listarFluxos(clienteId: string): Promise<FluxoSalvo[]> {
  const { data, error } = await db()
    .from('flows')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar os fluxos: ${error.message}`)
  return (data as Linha[]).map(paraFluxo)
}

export async function acharFluxo(id: string): Promise<FluxoSalvo | null> {
  const { data, error } = await db().from('flows').select(COLUNAS).eq('id', id).maybeSingle()

  if (error) throw new Error(`não deu para buscar o fluxo: ${error.message}`)
  return data ? paraFluxo(data as Linha) : null
}

export async function criarFluxo(
  clienteId: string,
  nome: string,
  rascunho: Fluxo,
): Promise<FluxoSalvo> {
  const { data, error } = await db()
    .from('flows')
    .insert({ client_id: clienteId, nome: nome.trim(), rascunho: fluxoSchema.parse(rascunho) })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o fluxo: ${error.message}`)
  return paraFluxo(data as Linha)
}

/** Salva o desenho. Valida antes de gravar — o banco nunca recebe grafo torto. */
export async function salvarRascunho(id: string, rascunho: Fluxo): Promise<void> {
  const { error } = await db()
    .from('flows')
    .update({ rascunho: fluxoSchema.parse(rascunho) })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o rascunho: ${error.message}`)
}
