import 'server-only'
import { ehTipoDeTarefa, type TipoDeTarefa } from '@/core/tarefas'
import { db, ehIdInvalido } from '../db'

/**
 * A fila do agendador (0026).
 *
 * O que este arquivo **não** faz: executar. Quem sabe o que cada tipo de tarefa
 * significa é `server/tarefas.ts`; aqui é só a ida ao banco, como em todo
 * `repos/`.
 */

export type Tarefa = {
  id: string
  clienteId: string
  tipo: TipoDeTarefa
  quando: string
  dados: Record<string, unknown>
  tentativas: number
}

type Linha = {
  id: string
  client_id: string
  tipo: string
  quando: string
  dados: unknown
  tentativas: number
}

/** Quantas tarefas uma passada do cron pega. Ver a rota sobre o porquê deste teto. */
export const TAREFAS_POR_PASSADA = 50

/**
 * Depois de quantas tentativas a tarefa desiste.
 *
 * Três, e não infinitas: tarefa que falha três vezes seguidas falha por um
 * motivo que não vai passar sozinho — fluxo apagado, número desconectado,
 * credencial revogada. Continuar tentando transforma um defeito num consumo
 * permanente de cota, e esconde o erro numa fila que nunca esvazia.
 */
export const MAX_TENTATIVAS_DA_TAREFA = 3

/**
 * Agenda — ou reagenda, quando já existe uma com a mesma chave.
 *
 * **Reagendar substitui.** A intenção mais nova é a que vale: um fluxo que
 * repergunta acabou de recomeçar a espera, e manter o prazo antigo faria a
 * cobrança sair antes da hora.
 */
export async function agendar(tarefa: {
  clienteId: string
  tipo: TipoDeTarefa
  quando: Date
  dados: Record<string, unknown>
  chave?: string
}): Promise<void> {
  /**
   * Cancela a anterior e insere a nova, em vez de `upsert`.
   *
   * O índice único de `chave` é **parcial** (`where chave is not null and
   * estado = 'pendente'`, ver a 0026), e `ON CONFLICT` não usa índice parcial
   * sem repetir o predicado — coisa que o PostgREST não tem como expressar. E o
   * índice precisa ser parcial: sem isso, uma tarefa já `feita` bloquearia para
   * sempre o reagendamento da mesma conversa.
   *
   * A corrida entre as duas escritas é fechada em outro lugar: quem agenda está
   * dentro da trava do contato, e a chave é por sessão. Se ainda assim duas
   * chegarem juntas, a segunda bate no índice e vira log — uma cobrança a
   * menos, nunca duas.
   */
  if (tarefa.chave) await cancelarPorChave(tarefa.chave)

  const { error } = await db().from('tarefas').insert({
    client_id: tarefa.clienteId,
    tipo: tarefa.tipo,
    quando: tarefa.quando.toISOString(),
    dados: tarefa.dados,
    chave: tarefa.chave ?? null,
    estado: 'pendente',
    tentativas: 0,
  })

  // **Falhar aqui não pode derrubar a conversa.** Quem chama é o webhook, no
  // meio de uma mensagem que já foi deduplicada: uma exceção deixaria a pessoa
  // sem resposta para não ter conseguido agendar uma cobrança futura.
  if (error) console.error('[tarefas] não deu para agendar', error.message)
}

/**
 * Cancela o que estiver pendente com esta chave.
 *
 * É o que acontece quando a pessoa **responde**: o prazo deixou de existir, e
 * uma tarefa viva ali cobraria alguém que já falou.
 */
export async function cancelarPorChave(chave: string): Promise<void> {
  const { error } = await db()
    .from('tarefas')
    .update({ estado: 'cancelada' })
    .eq('chave', chave)
    .eq('estado', 'pendente')

  if (error) console.error('[tarefas] não deu para cancelar', error.message)
}

/**
 * Pega a vez de até `limite` tarefas vencidas, atomicamente.
 *
 * A atomicidade mora na função do banco (`for update skip locked`, ver a
 * 0026): duas invocações do cron que se sobrepõem não podem executar a mesma
 * tarefa, porque isso é a pessoa recebendo a mesma mensagem duas vezes.
 */
export async function pegarTarefas(limite = TAREFAS_POR_PASSADA): Promise<Tarefa[]> {
  const { data, error } = await db().rpc('pegar_tarefas', { p_limite: limite })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para pegar as tarefas: ${error.message}`)

  return (data as Linha[])
    .filter((linha) => ehTipoDeTarefa(linha.tipo))
    .map((linha) => ({
      id: linha.id,
      clienteId: linha.client_id,
      tipo: linha.tipo as TipoDeTarefa,
      quando: linha.quando,
      dados: (linha.dados ?? {}) as Record<string, unknown>,
      tentativas: linha.tentativas,
    }))
}

export async function marcarFeita(tarefaId: string): Promise<void> {
  const { error } = await db()
    .from('tarefas')
    .update({ estado: 'feita', erro: null })
    .eq('id', tarefaId)

  if (error) console.error('[tarefas] não deu para marcar como feita', error.message)
}

/**
 * Devolve à fila, ou desiste depois do teto.
 *
 * O motivo é gravado nos dois casos: é ele que responde "por que essa fila
 * parou" sem depender do log da Vercel, que expira.
 */
export async function marcarFalha(
  tarefaId: string,
  tentativas: number,
  motivo: string,
): Promise<void> {
  const desistiu = tentativas >= MAX_TENTATIVAS_DA_TAREFA

  const { error } = await db()
    .from('tarefas')
    .update({ estado: desistiu ? 'falhou' : 'pendente', erro: motivo.slice(0, 500) })
    .eq('id', tarefaId)

  if (error) console.error('[tarefas] não deu para registrar a falha', error.message)
}

/**
 * Tipo que esta versão do código não conhece: volta para a fila **sem** contar
 * como tentativa perdida para sempre.
 *
 * É o caso de um deploy pela metade — a tarefa foi criada por uma versão nova e
 * pega por uma antiga. Marcar como falha jogaria fora trabalho legítimo.
 */
export async function devolverDesconhecidas(): Promise<void> {
  const { error } = await db()
    .from('tarefas')
    .update({ estado: 'pendente' })
    .eq('estado', 'rodando')
    .lt('rodou_em', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  if (error) console.error('[tarefas] não deu para devolver as presas', error.message)
}
