import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  ehEscopoDaApi,
  montarChave,
  sortearPublico,
  sortearSegredo,
  type EscopoDaApi,
} from '@/core/api/chaves'
import { db, ehIdInvalido } from '../db'

/**
 * As chaves da API pública (0120).
 *
 * **O segredo entra e não sai.** `criarChaveDeApi` é o único lugar em que a
 * chave inteira existe, e ela volta só para quem acabou de criar. Depois disso
 * o banco tem o SHA-256 e os 4 últimos caracteres, e nada daqui devolve hash.
 */

export type ChaveDeApi = {
  id: string
  nome: string
  publico: string
  final: string
  escopos: EscopoDaApi[]
  criadaPorNome: string | null
  criadaEm: string
  ultimaEm: string | null
  chamadas: number
  revogadaEm: string | null
}

type Linha = {
  id: string
  nome: string
  publico: string
  final: string
  escopos: string[]
  criada_por_nome: string | null
  criada_em: string
  ultima_em: string | null
  chamadas: number | string
  revogada_em: string | null
}

const COLUNAS = 'id, nome, publico, final, escopos, criada_por_nome, criada_em, ultima_em, chamadas, revogada_em'

function paraChave(linha: Linha): ChaveDeApi {
  return {
    id: linha.id,
    nome: linha.nome,
    publico: linha.publico,
    final: linha.final,
    escopos: linha.escopos.filter(ehEscopoDaApi),
    criadaPorNome: linha.criada_por_nome,
    criadaEm: linha.criada_em,
    ultimaEm: linha.ultima_em,
    chamadas: Number(linha.chamadas),
    revogadaEm: linha.revogada_em,
  }
}

export function hashDoSegredo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex')
}

/** As chaves desta conta, as ativas primeiro e as revogadas por último. */
export async function listarChavesDeApi(clienteId: string): Promise<ChaveDeApi[]> {
  const { data, error } = await db()
    .from('chaves_de_api')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criada_em', { ascending: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as chaves de API: ${error.message}`)
  const chaves = (data as Linha[]).map(paraChave)
  return [...chaves.filter((c) => !c.revogadaEm), ...chaves.filter((c) => c.revogadaEm)]
}

/**
 * Cria a chave e devolve ela **inteira**, a única vez que isso acontece.
 *
 * `publico` é único no banco; a colisão em 62^12 é teórica, mas se vier, uma
 * nova tentativa resolve em vez de devolver erro para quem clicou.
 */
export async function criarChaveDeApi(
  clienteId: string,
  dados: { nome: string; escopos: EscopoDaApi[]; autorId: string | null; autorNome: string | null },
): Promise<{ chave: ChaveDeApi; inteira: string }> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const publico = sortearPublico((n) => randomBytes(n))
    const segredo = sortearSegredo((n) => randomBytes(n))

    const { data, error } = await db()
      .from('chaves_de_api')
      .insert({
        client_id: clienteId,
        nome: dados.nome,
        publico,
        hash: hashDoSegredo(segredo),
        final: segredo.slice(-4),
        escopos: dados.escopos,
        criada_por: dados.autorId,
        criada_por_nome: dados.autorNome,
      })
      .select(COLUNAS)
      .single()

    if (error?.code === '23505') continue
    if (error) throw new Error(`não deu para criar a chave de API: ${error.message}`)
    return { chave: paraChave(data as Linha), inteira: montarChave(publico, segredo) }
  }
  throw new Error('não deu para sortear um identificador livre para a chave')
}

/** Revoga na hora. Devolve a chave revogada, ou `null` se não é desta conta. */
export async function revogarChaveDeApi(clienteId: string, id: string): Promise<ChaveDeApi | null> {
  const { data, error } = await db()
    .from('chaves_de_api')
    .update({ revogada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clienteId)
    .is('revogada_em', null)
    .select(COLUNAS)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para revogar a chave de API: ${error.message}`)
  return data ? paraChave(data as Linha) : null
}

export type ChaveConferida = { chaveId: string; clienteId: string; publico: string; escopos: EscopoDaApi[] }

/**
 * A chave que bate com `publico` e `segredo`, ativa, ou `null`.
 *
 * **Sem cache, de propósito**: revogar vale na chamada seguinte. A comparação
 * do hash é em tempo constante, mesmo sendo hash: o custo é zero e tira a
 * pergunta da mesa.
 */
export async function conferirChaveDeApi(publico: string, segredo: string): Promise<ChaveConferida | null> {
  const { data, error } = await db()
    .from('chaves_de_api')
    .select('id, client_id, hash, escopos, revogada_em')
    .eq('publico', publico)
    .maybeSingle()

  if (error) throw new Error(`não deu para conferir a chave de API: ${error.message}`)
  if (!data) return null

  const linha = data as { id: string; client_id: string; hash: string; escopos: string[]; revogada_em: string | null }
  if (linha.revogada_em) return null

  const esperado = Buffer.from(linha.hash, 'hex')
  const recebido = Buffer.from(hashDoSegredo(segredo), 'hex')
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null

  return { chaveId: linha.id, clienteId: linha.client_id, publico, escopos: linha.escopos.filter(ehEscopoDaApi) }
}

/** Conta a chamada e marca "usada agora". Nunca estoura: é dado de apoio. */
export async function registrarUsoDaChave(chaveId: string): Promise<void> {
  try {
    const { error } = await db().rpc('registrar_uso_da_chave', { p_id: chaveId })
    if (error) console.error('[api] não deu para registrar o uso da chave:', error.message)
  } catch (erro) {
    console.error('[api] não deu para registrar o uso da chave:', erro)
  }
}
