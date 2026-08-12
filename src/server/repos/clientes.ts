import 'server-only'
import { db, ehIdInvalido } from '../db'

export type Cliente = {
  id: string
  nome: string
  contextoNegocio: string
}

type Linha = {
  id: string
  nome: string
  contexto_negocio: string
}

/**
 * `ia_habilitada` saiu daqui.
 *
 * A migration 0005 moveu o plano de IA para o fluxo e deixou a coluna do
 * cliente para trás de propósito, dizendo que ela sumiria "quando alguém
 * confirmar que ninguém mais depende dela". Ninguém depende: nada no código
 * lia `cliente.iaHabilitada`. Parar de selecionar é essa confirmação; o `drop`
 * no banco é o passo seguinte, e separado — código que parou de usar volta
 * fácil, coluna apagada não.
 */
const COLUNAS = 'id, nome, contexto_negocio'

function paraCliente(linha: Linha): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    contextoNegocio: linha.contexto_negocio,
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

  if (ehIdInvalido(error)) return null
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

/**
 * O que a IA pode dizer sobre este negócio.
 *
 * É a única fonte de verdade do nó de IA: o prompt manda responder `não sei`
 * para tudo que não estiver aqui (ver `ia/prompt.ts`). Sem isto preenchido, o
 * bloco de IA existe, chama o modelo, e responde `não sei` sempre — passando a
 * conversa para uma pessoa toda vez. Falha fechado, e por isso ninguém percebe
 * que está quebrado.
 */
export async function atualizarContexto(id: string, contexto: string): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({ contexto_negocio: contexto })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o contexto: ${error.message}`)
}
