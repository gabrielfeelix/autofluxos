import 'server-only'
import { db, ehIdInvalido } from '../db'
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from '../cofre'

/**
 * Conexões: a credencial de um cliente, guardada no cofre.
 *
 * **A regra que este arquivo existe para cumprir: o valor sai daqui uma única
 * vez, e só para quem vai fazer a requisição.** Tudo que é lido para a tela
 * passa por `Conexao`, que não tem campo de valor, não por disciplina de quem
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
  /** Último teste (0097). `null`: nunca testada, ou o banco ainda sem a coluna. */
  testadaEm: string | null
  testeOk: boolean | null
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
  testada_em?: string | null
  teste_ok?: boolean | null
}

const COLUNAS = 'id, client_id, nome, tipo, campo'
/** Com o último teste (0097). Sem a migration, a leitura cai em `COLUNAS`. */
const COLUNAS_COM_TESTE = `${COLUNAS}, testada_em, teste_ok`

function paraConexao(linha: Linha): Conexao {
  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.nome,
    tipo: linha.tipo,
    campo: linha.campo,
    testadaEm: linha.testada_em ?? null,
    testeOk: linha.teste_ok ?? null,
  }
}

export async function listarConexoes(clienteId: string): Promise<Conexao[]> {
  const ler = (colunas: string) =>
    db().from('connections').select(colunas).eq('client_id', clienteId).order('criado_em', { ascending: true })
  let { data, error } = await ler(COLUNAS_COM_TESTE)
  // Produção sem a 0097: a tela funciona, só não sabe do último teste.
  if (error?.code === '42703') ({ data, error } = await ler(COLUNAS))

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as conexões: ${error.message}`)
  return (data as unknown as Linha[]).map(paraConexao)
}

/**
 * As Conexões que um fluxo pode usar: todas, menos o token da loja.
 *
 * O token do Magento (0092) é uma Conexão comum no cofre, e sem este filtro
 * aparecia no seletor de credencial do nó de API e da IA. Escolhido lá, ele
 * sairia no `Authorization` para qualquer URL que o fluxo chamasse: um token
 * de administrador da loja entregue a um terceiro. Na tela de Chaves ele
 * continua aparecendo, porque apagar por lá é permitido.
 */
export async function listarConexoesParaFluxos(clienteId: string): Promise<Conexao[]> {
  const [todas, { data, error }] = await Promise.all([
    listarConexoes(clienteId),
    db().from('lojas_integradas').select('conexao_id').eq('client_id', clienteId).not('conexao_id', 'is', null),
  ])
  if (ehIdInvalido(error)) return todas
  if (error) throw new Error(`não deu para conferir o token da loja: ${error.message}`)
  const daLoja = new Set((data as { conexao_id: string }[]).map((l) => l.conexao_id))
  return todas.filter((c) => !daLoja.has(c.id))
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
    // órfão para sempre, e credencial órfã é credencial que ninguém percebe
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

  // O valor novo nunca foi testado: o teste do antigo não vale para ele.
  await marcarTeste(id, clienteId, null)
}

/**
 * Grava o resultado do último teste (0097). `null` apaga, é o "nunca testada".
 *
 * Melhor esforço: sem a coluna (produção antes da 0097) não grava e não
 * derruba quem chamou, porque o teste em si já respondeu à pessoa.
 */
export async function marcarTeste(id: string, clienteId: string, ok: boolean | null): Promise<void> {
  const { error } = await db()
    .from('connections')
    .update({ testada_em: ok === null ? null : new Date().toISOString(), teste_ok: ok })
    .eq('id', id)
    .eq('client_id', clienteId)
  if (error && error.code !== '42703' && error.code !== 'PGRST204') {
    throw new Error(`não deu para gravar o teste da conexão: ${error.message}`)
  }
}

export async function apagarConexao(id: string, clienteId: string): Promise<void> {
  // A Conexão pode ser o token do Magento (0092), e ela aparece na tela de
  // Chaves de API como qualquer outra. O `on delete set null` sozinho esbarra
  // no check `lojas_estoque_exige_token` e derruba o delete inteiro, então o
  // estoque exato da loja é desligado antes. Filtrado pela conta: apagar pela
  // conta errada não desliga nada e o delete abaixo não acha a linha.
  const { error: erroDaLoja } = await db()
    .from('lojas_integradas')
    .update({ conexao_id: null, estoque_exato: 'desligado', estoque_id: null, atualizado_em: new Date().toISOString() })
    .eq('conexao_id', id)
    .eq('client_id', clienteId)
  if (erroDaLoja) throw new Error(`não deu para desligar o estoque exato da loja: ${erroDaLoja.message}`)

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
  const valor = await lerDoCofre(linha.secret_id)
  if (valor === null) return null

  return { tipo: linha.tipo, campo: linha.campo, valor }
}
