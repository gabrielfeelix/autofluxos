import 'server-only'
import type { Campanha } from '@/core/campanhas'
import { db, ehIdInvalido } from '../db'

/**
 * As campanhas da conta (0027).
 *
 * Espelha `repos/gatilhos.ts` de propósito: são a mesma forma — frase → fluxo,
 * com liga/desliga e contagem — e a diferença mora só em `core/`, na regra de
 * casamento. Duas formas diferentes para a mesma coisa seriam duas telas que a
 * pessoa precisa aprender separadamente.
 */

type Linha = {
  id: string
  nome: string
  frase: string
  flow_id: string
  ativa: boolean
  execucoes: number
}

const COLUNAS = 'id, nome, frase, flow_id, ativa, execucoes'

function paraCampanha(linha: Linha): Campanha {
  return {
    id: linha.id,
    nome: linha.nome,
    frase: linha.frase,
    fluxoId: linha.flow_id,
    ativa: linha.ativa,
    execucoes: linha.execucoes,
  }
}

export async function listarCampanhas(clienteId: string): Promise<Campanha[]> {
  const { data, error } = await db()
    .from('campanhas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as campanhas: ${error.message}`)
  return (data as Linha[]).map(paraCampanha)
}

/** Só as que podem abrir conversa. É esta que o webhook chama. */
export async function campanhasAtivas(clienteId: string): Promise<Campanha[]> {
  const { data, error } = await db()
    .from('campanhas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('ativa', true)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as campanhas: ${error.message}`)
  return (data as Linha[]).map(paraCampanha)
}

export async function criarCampanha(
  clienteId: string,
  campanha: { nome: string; frase: string; fluxoId: string },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const nome = campanha.nome.trim()
  const frase = campanha.frase.trim()
  if (nome === '') return { ok: false, motivo: 'dê um nome à campanha' }
  if (frase === '') return { ok: false, motivo: 'escreva a frase que o anúncio manda' }

  // O fluxo é conferido contra o **mesmo cliente**: o id chega de formulário, e
  // a chave estrangeira só sabe que ele existe, não de quem é.
  const { data: fluxo, error: erroDoFluxo } = await db()
    .from('flows')
    .select('id')
    .eq('id', campanha.fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDoFluxo)) return { ok: false, motivo: 'escolha um fluxo válido' }
  if (erroDoFluxo) throw new Error(`não deu para conferir o fluxo: ${erroDoFluxo.message}`)
  if (!fluxo) return { ok: false, motivo: 'este fluxo não é deste cliente' }

  const { error } = await db()
    .from('campanhas')
    .insert({ client_id: clienteId, nome, frase, flow_id: campanha.fluxoId })

  if (error?.code === '23505') {
    return { ok: false, motivo: 'já existe uma campanha com esta frase' }
  }
  if (error) throw new Error(`não deu para criar a campanha: ${error.message}`)
  return { ok: true }
}

/** Desligar em vez de apagar mantém o histórico do anúncio que já rodou. */
export async function alternarCampanha(
  clienteId: string,
  campanhaId: string,
  ativa: boolean,
): Promise<boolean> {
  const { data, error } = await db()
    .from('campanhas')
    .update({ ativa })
    .eq('id', campanhaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para mudar a campanha: ${error.message}`)
  return (data?.length ?? 0) === 1
}

export async function apagarCampanha(clienteId: string, campanhaId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('campanhas')
    .delete()
    .eq('id', campanhaId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar a campanha: ${error.message}`)
  return (data?.length ?? 0) === 1
}

/** Como no gatilho: falhar a contagem não pode derrubar a conversa. */
export async function contarDisparoDaCampanha(campanhaId: string): Promise<void> {
  const { error } = await db().rpc('contar_disparo_da_campanha', { p_campanha_id: campanhaId })
  if (error) console.error('[campanhas] não deu para contar o disparo', error.message)
}

/**
 * Liga o contato à campanha que o trouxe — **só na primeira vez**.
 *
 * Atribuição de primeiro toque, a mesma regra de `campos.origem` desde a 0009.
 * Sobrescrever faria a pessoa que voltou por um segundo anúncio trocar de dono,
 * e o relatório do primeiro perderia o lead que ele pagou para trazer.
 */
export async function atribuirCampanha(contatoId: string, campanhaId: string): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .update({ campanha_id: campanhaId })
    .eq('id', contatoId)
    .is('campanha_id', null)

  if (error) console.error('[campanhas] não deu para atribuir o contato', error.message)
}

/** Quantos contatos cada campanha trouxe. É a coluna que diz se ela valeu. */
export async function contatosPorCampanha(clienteId: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('contacts')
    .select('campanha_id')
    .eq('client_id', clienteId)
    .not('campanha_id', 'is', null)

  const total = new Map<string, number>()
  if (ehIdInvalido(error)) return total
  if (error) throw new Error(`não deu para contar os contatos por campanha: ${error.message}`)

  for (const linha of data as { campanha_id: string }[]) {
    total.set(linha.campanha_id, (total.get(linha.campanha_id) ?? 0) + 1)
  }
  return total
}
