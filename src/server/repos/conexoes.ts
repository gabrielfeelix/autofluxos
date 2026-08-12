import 'server-only'
import { db } from '../db'

/**
 * Conexões: a credencial de um cliente, guardada no cofre.
 *
 * **A regra que este arquivo existe para cumprir: o valor sai daqui uma única
 * vez, e só para quem vai fazer a requisição.** Tudo que é lido para a tela
 * passa por `Conexao`, que não tem campo de valor — não por disciplina de quem
 * escreve a tela, mas porque o tipo não permite.
 *
 * O valor mora no Supabase Vault, e o banco guarda só a referência. Ver
 * `supabase/migrations/0006_conexoes.sql` e `docs/CONEXOES.md`.
 */

export const TIPOS_DE_CONEXAO = ['bearer', 'cabecalho', 'query'] as const
export type TipoDeConexao = (typeof TIPOS_DE_CONEXAO)[number]

/** O que a tela pode ver. Repare no que não existe aqui: o valor. */
export type Conexao = {
  id: string
  clienteId: string
  nome: string
  tipo: TipoDeConexao
  /** Nome do cabeçalho ou do parâmetro. `null` no `bearer`. */
  campo: string | null
}

/** O que o resolvedor recebe, no servidor, para montar a requisição. */
export type Credencial = {
  tipo: TipoDeConexao
  campo: string | null
  valor: string
}

type Linha = {
  id: string
  client_id: string
  nome: string
  tipo: TipoDeConexao
  campo: string | null
}

const COLUNAS = 'id, client_id, nome, tipo, campo'

function paraConexao(linha: Linha): Conexao {
  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.nome,
    tipo: linha.tipo,
    campo: linha.campo,
  }
}

export async function listarConexoes(clienteId: string): Promise<Conexao[]> {
  const { data, error } = await db()
    .from('connections')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (error) throw new Error(`não deu para listar as conexões: ${error.message}`)
  return (data as Linha[]).map(paraConexao)
}

export async function criarConexao(entrada: {
  clienteId: string
  nome: string
  tipo: TipoDeConexao
  campo?: string | null
  valor: string
}): Promise<Conexao> {
  const nome = entrada.nome.trim()
  const campo = entrada.tipo === 'bearer' ? null : (entrada.campo ?? '').trim()

  if (nome === '') throw new Error('a conexão precisa de um nome')
  if (entrada.valor.trim() === '') throw new Error('a conexão precisa de um valor')
  if (entrada.tipo !== 'bearer' && campo === '') {
    throw new Error('diga o nome do cabeçalho ou do parâmetro')
  }

  // O apelido no cofre é só para dar um nome à linha de lá; ele precisa ser
  // único e não é mostrado em lugar nenhum. Vai com um id aleatório para nunca
  // colidir e para não vazar o nome do cliente dentro do Vault.
  const segredoId = await guardarNoCofre(entrada.valor, `conexao_${crypto.randomUUID()}`)

  const { data, error } = await db()
    .from('connections')
    .insert({
      client_id: entrada.clienteId,
      nome,
      tipo: entrada.tipo,
      campo,
      secret_id: segredoId,
    })
    .select(COLUNAS)
    .single()

  if (error) {
    // O segredo já está no cofre e a linha não nasceu. Sem isto ele ficaria
    // órfão para sempre — e credencial órfã é credencial que ninguém percebe
    // sendo usada.
    await apagarDoCofre(segredoId)
    if (error.code === '23505') throw new Error(`já existe uma conexão chamada "${nome}"`)
    throw new Error(`não deu para criar a conexão: ${error.message}`)
  }

  return paraConexao(data as Linha)
}

/**
 * Troca o valor sem mexer no id.
 *
 * É esta assinatura que faz rotação de credencial não exigir republicar fluxo:
 * os blocos apontam para a conexão, não para o segredo.
 */
export async function trocarValor(id: string, clienteId: string, valor: string): Promise<void> {
  if (valor.trim() === '') throw new Error('a conexão precisa de um valor')

  // O par (conexão, cliente) em toda operação, e não só na leitura: isolamento
  // que depende de quem chama lembrar de conferir é isolamento que uma tela
  // nova quebra sem ninguém notar.
  const { data, error } = await db()
    .from('connections')
    .select('secret_id')
    .eq('id', id)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar a conexão: ${error.message}`)
  if (!data) throw new Error('conexão não encontrada')

  const { error: erroDoCofre } = await db().rpc('trocar_segredo', {
    alvo: (data as { secret_id: string }).secret_id,
    valor,
  })
  if (erroDoCofre) throw new Error(`não deu para trocar o valor: ${erroDoCofre.message}`)
}

export async function apagarConexao(id: string, clienteId: string): Promise<void> {
  // O gatilho da migration apaga o segredo no cofre junto com a linha.
  const { error } = await db()
    .from('connections')
    .delete()
    .eq('id', id)
    .eq('client_id', clienteId)
  if (error) throw new Error(`não deu para apagar a conexão: ${error.message}`)
}

/**
 * A única função que devolve o valor em claro.
 *
 * Ela é chamada uma vez por requisição do nó de API, dentro do resolvedor, e o
 * retorno morre no fim da chamada. Nunca é serializada, nunca vai para a
 * sessão, nunca chega ao navegador.
 *
 * O `clienteId` não é conveniência: é o que impede o fluxo de um cliente
 * alcançar a credencial de outro. Um id de conexão que vaze não serve de nada
 * sem ser o cliente dono dela.
 */
export async function lerCredencial(id: string, clienteId: string): Promise<Credencial | null> {
  const { data, error } = await db()
    .from('connections')
    .select('tipo, campo, secret_id')
    .eq('id', id)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar a conexão: ${error.message}`)
  if (!data) return null

  const linha = data as { tipo: TipoDeConexao; campo: string | null; secret_id: string }
  const { data: valor, error: erroDoCofre } = await db().rpc('ler_segredo', {
    alvo: linha.secret_id,
  })

  if (erroDoCofre) throw new Error(`não deu para ler a credencial: ${erroDoCofre.message}`)
  if (typeof valor !== 'string' || valor === '') return null

  return { tipo: linha.tipo, campo: linha.campo, valor }
}

async function guardarNoCofre(valor: string, apelido: string): Promise<string> {
  const { data, error } = await db().rpc('criar_segredo', { valor, apelido })
  if (error) throw new Error(`não deu para guardar no cofre: ${error.message}`)
  if (typeof data !== 'string') throw new Error('o cofre não devolveu uma referência')
  return data
}

async function apagarDoCofre(id: string): Promise<void> {
  await db().rpc('apagar_segredo', { alvo: id })
}
