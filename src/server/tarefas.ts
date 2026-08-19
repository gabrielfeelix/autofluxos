import 'server-only'
import { rodarTimeoutDePergunta, type FabricaDeCanal } from './receber-mensagem'
import { rodarPassoDeSequencia } from './sequencias-passo'
import {
  devolverDesconhecidas,
  marcarFalha,
  marcarFeita,
  pegarTarefas,
  TAREFAS_POR_PASSADA,
  type Tarefa,
} from './repos/tarefas'

/**
 * O executor da fila do agendador (B1).
 *
 * Uma passada pega o que venceu, executa cada tarefa, e marca o resultado. É
 * chamado pelo cron da Vercel — e, nos testes, direto.
 *
 * **Uma tarefa que falha não pode derrubar as outras.** Elas são de clientes
 * diferentes: um número desconectado numa conta não pode impedir a cobrança de
 * pergunta de outra. Por isso o `try` é por tarefa, e não em volta do laço.
 */

export type ResumoDaPassada = {
  pegas: number
  feitas: number
  ignoradas: number
  falhas: number
}

export async function rodarTarefas(
  limite = TAREFAS_POR_PASSADA,
  /** Injetável só para os testes rodarem sem a rede da Meta, como no webhook. */
  fabricaDeCanal?: FabricaDeCanal,
): Promise<ResumoDaPassada> {
  // Tarefa que ficou `rodando` e nunca voltou é execução que morreu no meio —
  // função encerrada pelo teto de tempo, deploy no meio da passada. Devolver as
  // velhas para a fila antes de pegar novas é o que impede a fila de entupir
  // com linhas que ninguém mais vai olhar.
  await devolverDesconhecidas()

  const tarefas = await pegarTarefas(limite)
  const resumo: ResumoDaPassada = {
    pegas: tarefas.length,
    feitas: 0,
    ignoradas: 0,
    falhas: 0,
  }

  for (const tarefa of tarefas) {
    try {
      const resultado = await executar(tarefa, fabricaDeCanal)
      if (resultado === 'feita') resumo.feitas += 1
      else resumo.ignoradas += 1
      await marcarFeita(tarefa.id)
    } catch (erro) {
      resumo.falhas += 1
      const motivo = erro instanceof Error ? erro.message : String(erro)
      console.error('[tarefas] a tarefa falhou', tarefa.id, tarefa.tipo, motivo)
      await marcarFalha(tarefa.id, tarefa.tentativas, motivo)
    }
  }

  return resumo
}

/**
 * "Ignorada" é resultado normal, não erro.
 *
 * O mundo mudou entre agendar e executar na maioria das vezes: a pessoa
 * respondeu, alguém assumiu, a conversa acabou. Contar isso como falha faria a
 * tarefa voltar para a fila para ser ignorada de novo, três vezes, até
 * "falhar" — e encheria o painel de erro onde não houve nenhum.
 */
async function executar(
  tarefa: Tarefa,
  fabricaDeCanal?: FabricaDeCanal,
): Promise<'feita' | 'ignorada'> {
  switch (tarefa.tipo) {
    case 'timeout_de_pergunta':
      return rodarTimeoutDePergunta(tarefa.dados, fabricaDeCanal)
    case 'passo_de_sequencia':
      return rodarPassoDeSequencia(tarefa.dados, fabricaDeCanal)
  }
}
