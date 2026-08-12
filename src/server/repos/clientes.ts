import 'server-only'
import { db, ehIdInvalido } from '../db'

export type Cliente = {
  id: string
  nome: string
  contextoNegocio: string
  /** Quem responde por este cliente. Ex.: "Daniel, dono do estúdio". */
  responsavel: string
  /** Telefone de quem responde — **não** é o número que o bot atende. */
  telefone: string
  email: string
  /** O que foi combinado e não cabe em campo. */
  observacoes: string
}

/**
 * O cadastro que dá para editar de uma vez na tela do cliente.
 *
 * `contextoNegocio` fica de fora de propósito: ele tem tela própria porque é
 * o bloco de IA, não um campo de ficha.
 */
export type Cadastro = Pick<Cliente, 'nome' | 'responsavel' | 'telefone' | 'email' | 'observacoes'>

type Linha = {
  id: string
  nome: string
  contexto_negocio: string
  responsavel: string
  telefone: string
  email: string
  observacoes: string
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
const COLUNAS = 'id, nome, contexto_negocio, responsavel, telefone, email, observacoes'

function paraCliente(linha: Linha): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    contextoNegocio: linha.contexto_negocio,
    responsavel: linha.responsavel,
    telefone: linha.telefone,
    email: linha.email,
    observacoes: linha.observacoes,
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
/**
 * Grava a ficha do cliente.
 *
 * O nome é o único obrigatório — cliente cadastrado no meio de uma reunião tem
 * só isso, e exigir telefone para salvar o nome faria a pessoa inventar um.
 */
export async function atualizarCadastro(id: string, cadastro: Cadastro): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({
      nome: cadastro.nome.trim(),
      responsavel: cadastro.responsavel.trim(),
      telefone: cadastro.telefone.trim(),
      email: cadastro.email.trim(),
      observacoes: cadastro.observacoes.trim(),
    })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o cadastro: ${error.message}`)
}

export async function atualizarContexto(id: string, contexto: string): Promise<void> {
  const { error } = await db()
    .from('clients')
    .update({ contexto_negocio: contexto })
    .eq('id', id)

  if (error) throw new Error(`não deu para salvar o contexto: ${error.message}`)
}
