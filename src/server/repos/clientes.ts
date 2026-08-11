import 'server-only'
import { db } from '../db'

export type Cliente = {
  id: string
  nome: string
  contextoNegocio: string
  /** Etapa 2 é plano à parte. Sem isto, fluxo com nó de IA não publica. */
  iaHabilitada: boolean
}

type Linha = {
  id: string
  nome: string
  contexto_negocio: string
  ia_habilitada: boolean
}

const COLUNAS = 'id, nome, contexto_negocio, ia_habilitada'

function paraCliente(linha: Linha): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    contextoNegocio: linha.contexto_negocio,
    iaHabilitada: linha.ia_habilitada,
  }
}

export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await db()
    .from('clients')
    .select(COLUNAS)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar clientes: ${error.message}`)
  return (data as Linha[]).map(paraCliente)
}

export async function acharCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await db().from('clients').select(COLUNAS).eq('id', id).maybeSingle()

  if (error) throw new Error(`não deu para buscar o cliente: ${error.message}`)
  return data ? paraCliente(data as Linha) : null
}

export async function criarCliente(nome: string): Promise<Cliente> {
  const { data, error } = await db()
    .from('clients')
    .insert({ nome: nome.trim() })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o cliente: ${error.message}`)
  return paraCliente(data as Linha)
}
