import 'server-only'
import { MOTIVOS_DE_SAIDA, passoDoIndice, quandoRodaOPasso } from '@/core/sequencias'
import { chaveDoPasso, dadosDoPassoSchema } from '@/core/tarefas'
import { abrirFluxoParaContato, type FabricaDeCanal } from './receber-mensagem'
import { agendar } from './repos/tarefas'
import {
  acharInscricao,
  acharSequencia,
  avancarInscricao,
  encerrarInscricao,
} from './repos/sequencias'

/**
 * A execução de um passo de sequência (0031).
 *
 * Mora à parte de `server/sequencias.ts` para não fechar ciclo de imports: ele
 * é chamado do caminho de uma mensagem que chega, e este aqui precisa de
 * `receber-mensagem.ts` inteiro para abrir um fluxo. Quem chama este arquivo é
 * só o despachante do agendador, `server/tarefas.ts`.
 */

/**
 * Um passo venceu.
 *
 * A conferência dupla — inscrição ainda ativa **e** ainda no mesmo índice — é o
 * que impede o pior erro daqui: uma tarefa velha chegando depois de a pessoa já
 * ter avançado mandaria de novo algo que ela recebeu.
 *
 * **A janela de 24h é conferida na entrega, não no desenho.** O relógio corre
 * entre agendar e mandar, e a tela só conseguiu prever com a janela cheia. Se
 * ela fechou, a inscrição vira `bloqueada` — estado próprio, e não `saiu`,
 * porque é a única saída que significa "a sequência não entregou" em vez de "a
 * sequência funcionou". É o número que diz ao cliente que os prazos dele estão
 * longos demais.
 */
export async function rodarPassoDeSequencia(
  dados: unknown,
  fabricaDeCanal?: FabricaDeCanal,
): Promise<'feita' | 'ignorada'> {
  const analise = dadosDoPassoSchema.safeParse(dados)
  if (!analise.success) return 'ignorada'

  const { inscricaoId, sequenciaId, contatoId, passoIndice, entrouEm } = analise.data

  const inscricao = await acharInscricao(inscricaoId)
  if (!inscricao) return 'ignorada'
  if (inscricao.estado !== 'ativa') return 'ignorada'
  // A inscrição andou entre o agendamento e agora — outro passo já saiu.
  if (inscricao.passoAtual !== passoIndice) return 'ignorada'

  const sequencia = await acharSequencia(inscricao.clienteId, sequenciaId)
  // Sequência apagada ou desligada no meio do caminho. Desligar é um ato
  // deliberado do cliente, e continuar entregando depois dele seria ignorar o
  // interruptor que a tela oferece.
  if (!sequencia || !sequencia.ativa) {
    await encerrarInscricao(inscricaoId, 'saiu', 'sequencia_desligada')
    return 'ignorada'
  }

  const passo = passoDoIndice(sequencia.passos, passoIndice)
  if (!passo) {
    await encerrarInscricao(inscricaoId, 'concluida', null)
    return 'ignorada'
  }

  const resultado = await abrirFluxoParaContato(
    inscricao.clienteId,
    contatoId,
    passo.fluxoId,
    fabricaDeCanal,
  )

  if (resultado === 'ocupado') {
    // Uma mensagem está sendo processada agora, e a mensagem ganha do prazo,
    // sempre. Devolver o erro faz a tarefa voltar para a fila e tentar de novo
    // — é o único desfecho aqui que merece nova tentativa.
    throw new Error('o contato está ocupado; o passo tenta de novo')
  }

  if (resultado === 'janela_fechada') {
    await encerrarInscricao(inscricaoId, 'bloqueada', MOTIVOS_DE_SAIDA.janela_fechada)
    return 'ignorada'
  }

  if (resultado === 'automacao_pausada') {
    await encerrarInscricao(inscricaoId, 'saiu', 'automacao_pausada')
    return 'ignorada'
  }

  if (resultado === 'sem_fluxo' || resultado === 'sem_contexto') {
    // O fluxo do passo foi despublicado, apagado, ou o número saiu do ar. Não
    // adianta tentar de novo: nada disso passa sozinho, e insistir três vezes
    // só enche a fila de erro. A inscrição morre dizendo por quê.
    await encerrarInscricao(inscricaoId, 'saiu', 'sem_fluxo')
    return 'ignorada'
  }

  const proximo = passoDoIndice(sequencia.passos, passoIndice + 1)
  if (!proximo) {
    await encerrarInscricao(inscricaoId, 'concluida', null)
    return 'feita'
  }

  await avancarInscricao(inscricaoId, passoIndice + 1)
  await agendar({
    clienteId: inscricao.clienteId,
    tipo: 'passo_de_sequencia',
    // **Do evento, não do agora.** Recontar a partir daqui empurraria a
    // sequência inteira para a frente a cada atraso do agendador, e o passo de
    // 20h chegaria fora da janela por causa de uma passada que demorou.
    quando: quandoRodaOPasso(new Date(entrouEm), proximo),
    chave: chaveDoPasso(inscricaoId),
    dados: {
      inscricaoId,
      sequenciaId,
      contatoId,
      passoIndice: passoIndice + 1,
      entrouEm,
    },
  })

  return 'feita'
}
