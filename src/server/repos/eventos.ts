import 'server-only'
import type { Evento, TipoDeEvento } from '@/core/crm'
import type { Anotacao } from '@/core/anotacoes'
import { db, ehIdInvalido } from '../db'

/**
 * A linha do tempo do contato (0058).
 *
 * Como todo `repos/`: só ida ao banco. Quem transforma evento em frase é
 * `core/crm.ts`.
 *
 * **Escrever aqui nunca pode derrubar a ação que gerou o evento.** Registrar que
 * alguém assumiu o cartão é dado de apoio; falhar a atribuição porque o
 * histórico não gravou seria inverter a importância das duas coisas. Por isso
 * `anotar` engole o erro e segue, é a mesma decisão que a auditoria já toma.
 */

export async function anotar(
  clienteId: string,
  contatoId: string,
  tipo: TipoDeEvento,
  dados: Record<string, unknown> = {},
  autor: string | null = null,
): Promise<void> {
  try {
    const { error } = await db().from('eventos_do_contato').insert({
      client_id: clienteId,
      contato_id: contatoId,
      tipo,
      dados,
      autor,
    })
    if (error) console.error('[eventos] não deu para anotar:', error.message)
  } catch (erro) {
    console.error('[eventos] não deu para anotar:', erro)
  }
}

/** Vários contatos, o mesmo fato. O caminho é a seleção em lote da tela. */
export async function anotarEmLote(
  clienteId: string,
  contatos: string[],
  tipo: TipoDeEvento,
  dados: Record<string, unknown> = {},
  autor: string | null = null,
): Promise<void> {
  if (contatos.length === 0) return
  try {
    const { error } = await db()
      .from('eventos_do_contato')
      .insert(
        contatos.map((contatoId) => ({
          client_id: clienteId,
          contato_id: contatoId,
          tipo,
          dados,
          autor,
        })),
      )
    if (error) console.error('[eventos] não deu para anotar em lote:', error.message)
  } catch (erro) {
    console.error('[eventos] não deu para anotar em lote:', erro)
  }
}

/**
 * A linha do tempo de uma pessoa, do mais novo para o mais velho.
 *
 * Com teto, e o teto é baixo de propósito: o painel mostra o que aconteceu
 * ultimamente, e "tudo desde sempre" de um contato de dois anos é uma rolagem
 * que ninguém termina, e uma consulta que cresce sem limite.
 */
export async function linhaDoTempo(
  clienteId: string,
  contatoId: string,
  limite = 40,
): Promise<Evento[]> {
  const { data, error } = await db()
    .from('eventos_do_contato')
    .select('id, tipo, dados, autor, criado_em')
    .eq('client_id', clienteId)
    .eq('contato_id', contatoId)
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler a linha do tempo: ${error.message}`)

  return (data as { id: string; tipo: string; dados: Record<string, unknown> | null; autor: string | null; criado_em: string }[]).map(
    (linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      dados: linha.dados ?? {},
      autor: linha.autor,
      criadoEm: linha.criado_em,
    }),
  )
}

/**
 * As anotações da equipe sobre um contato, da mais nova para a mais antiga
 * (tarefa 5.9).
 *
 * São os eventos `nota` do diário, os mesmos que a linha do tempo da ficha já
 * mostra: uma anotação é "o que aconteceu em volta da conversa, com autor e
 * hora", e uma segunda tabela guardaria os mesmos campos. Ver o porquê em
 * `acaoAnotarNoDiario`.
 */
export async function anotacoesDoContato(
  clienteId: string,
  contatoId: string,
  limite = 50,
): Promise<Anotacao[]> {
  const { data, error } = await db()
    .from('eventos_do_contato')
    .select('id, dados, autor, criado_em')
    .eq('client_id', clienteId)
    .eq('contato_id', contatoId)
    .eq('tipo', 'nota')
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler as anotações: ${error.message}`)

  return (data as { id: string; dados: { texto?: unknown } | null; autor: string | null; criado_em: string }[]).map(
    (linha) => ({
      id: linha.id,
      texto: typeof linha.dados?.texto === 'string' ? linha.dados.texto : '',
      autor: linha.autor,
      criadoEm: linha.criado_em,
    }),
  )
}

/**
 * Grava uma anotação e **devolve o que gravou**, ou lança.
 *
 * Ao contrário de `anotar`, que engole o erro porque ali o evento é dado de
 * apoio, aqui a anotação é a própria ação: a tela mostra a nota na hora e
 * precisa saber se ela ficou, para dizer o erro e oferecer tentar de novo.
 */
export async function registrarAnotacao(
  clienteId: string,
  contatoId: string,
  texto: string,
  autor: string | null,
  /** A anotação feita na página do negócio vai para o histórico dele (F2). */
  cartaoId: string | null = null,
): Promise<Anotacao> {
  const dados = cartaoId ? { texto, cartaoId } : { texto }
  const { data, error } = await db()
    .from('eventos_do_contato')
    .insert({ client_id: clienteId, contato_id: contatoId, tipo: 'nota', dados, autor })
    .select('id, criado_em')
    .single()

  if (error) throw new Error(`não deu para guardar a anotação: ${error.message}`)
  const linha = data as { id: string; criado_em: string }
  return { id: linha.id, texto, autor, criadoEm: linha.criado_em }
}
