import 'server-only'
import { OPERADORES_DE_GATILHO, type Gatilho, type OperadorDeGatilho } from '@/core/gatilhos'
import { db, ehIdInvalido } from '../db'

/**
 * Os gatilhos por palavra-chave da conta (0024).
 *
 * A decisão de qual deles casa é pura e mora em `core/gatilhos.ts`. Aqui só
 * entram as idas ao banco — inclusive a contagem de disparos, que é uma RPC
 * porque somar do lado da aplicação perde disparo exatamente no gatilho
 * popular, que é o único cuja contagem alguém vai olhar.
 */

type Linha = {
  id: string
  frase: string
  operador: string
  flow_id: string
  ativo: boolean
  execucoes: number
}

const COLUNAS = 'id, frase, operador, flow_id, ativo, execucoes'

/**
 * O banco tem `check (operador in ('igual','contem'))`, então uma linha torta
 * não deveria existir. "Não deveria" não é garantia: a coluna é texto e um
 * `update` na mão pela UI do Supabase passa por cima de qualquer intenção
 * nossa. Cair no padrão mais frouxo — `contem` — é o lado seguro do erro:
 * dispara demais em vez de sumir sem explicação.
 */
function paraOperador(valor: string): OperadorDeGatilho {
  return (OPERADORES_DE_GATILHO as readonly string[]).includes(valor)
    ? (valor as OperadorDeGatilho)
    : 'contem'
}

function paraGatilho(linha: Linha): Gatilho {
  return {
    id: linha.id,
    frase: linha.frase,
    operador: paraOperador(linha.operador),
    fluxoId: linha.flow_id,
    ativo: linha.ativo,
    execucoes: linha.execucoes,
  }
}

/** Todos os gatilhos da conta, ligados ou não. É o que a tela lista. */
export async function listarGatilhos(clienteId: string): Promise<Gatilho[]> {
  const { data, error } = await db()
    .from('gatilhos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os gatilhos: ${error.message}`)
  return (data as Linha[]).map(paraGatilho)
}

/**
 * Só os que podem disparar. É esta que o webhook chama, em toda mensagem de
 * texto — por isso ela não traz o que a tela precisa e a outra traz.
 */
export async function gatilhosAtivos(clienteId: string): Promise<Gatilho[]> {
  const { data, error } = await db()
    .from('gatilhos')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('ativo', true)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os gatilhos: ${error.message}`)
  return (data as Linha[]).map(paraGatilho)
}

/**
 * Cadastra uma palavra-chave.
 *
 * O fluxo é conferido contra o **mesmo cliente** antes de entrar: o id chega de
 * um formulário e nada impede alguém de postar o id de um fluxo de outra conta.
 * A chave estrangeira aceitaria — ela só sabe que o fluxo existe.
 */
export async function criarGatilho(
  clienteId: string,
  gatilho: { frase: string; operador: OperadorDeGatilho; fluxoId: string },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const frase = gatilho.frase.trim()
  if (frase === '') return { ok: false, motivo: 'escreva a palavra ou frase' }

  const { data: fluxo, error: erroDoFluxo } = await db()
    .from('flows')
    .select('id')
    .eq('id', gatilho.fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'escolha um fluxo válido' }
  if (erroDoFluxo) throw new Error(`não deu para conferir o fluxo: ${erroDoFluxo.message}`)
  if (!fluxo) return { ok: false, motivo: 'este fluxo não é deste cliente' }

  const { error } = await db().from('gatilhos').insert({
    client_id: clienteId,
    frase,
    operador: gatilho.operador,
    flow_id: gatilho.fluxoId,
  })

  // O índice único é por (conta, frase, operador). Sem tratar, "essa palavra já
  // está cadastrada" chegaria na tela como "alguma coisa quebrou".
  if (error?.code === '23505') {
    return { ok: false, motivo: `já existe um gatilho “${frase}” com este operador` }
  }
  if (error) throw new Error(`não deu para criar o gatilho: ${error.message}`)
  return { ok: true }
}

/** Liga/desliga sem apagar — a contagem de execuções é o histórico dele. */
export async function alternarGatilho(
  clienteId: string,
  gatilhoId: string,
  ativo: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('gatilhos')
    .update({ ativo })
    .eq('id', gatilhoId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para mudar o gatilho: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/** O par gatilho–cliente, como em toda escrita por aqui: a URL é adivinhável. */
export async function apagarGatilho(clienteId: string, gatilhoId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('gatilhos')
    .delete()
    .eq('id', gatilhoId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o gatilho: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/**
 * Registra que este gatilho abriu uma conversa.
 *
 * **Falhar aqui não pode derrubar a conversa.** O contador é para a tela
 * responder "vale a pena manter esta regra?" — perder uma unidade dele é um
 * incômodo; estourar no meio do webhook depois de o fluxo já ter sido escolhido
 * deixa a pessoa sem resposta e a Meta não reenvia.
 */
export async function contarDisparo(gatilhoId: string): Promise<void> {
  const { error } = await db().rpc('contar_disparo_do_gatilho', { p_gatilho_id: gatilhoId })
  if (error) console.error('[gatilhos] não deu para contar o disparo', error.message)
}
