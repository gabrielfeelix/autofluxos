import 'server-only'
import {
  passoDoIndice,
  quandoRodaOPasso,
  type EventoDeSequencia,
  type MotivoDeSaida,
} from '@/core/sequencias'
import { chaveDoPasso } from '@/core/tarefas'
import { agendar, cancelarPorChave } from './repos/tarefas'
import {
  inscrever,
  sairDasSequencias,
  sairPorEtiquetaDeSaida,
  sequenciasDoEvento,
} from './repos/sequencias'

/**
 * As sequências, do lado que mexe no mundo (0031).
 *
 * `core/sequencias.ts` diz **quando** um passo acontece; `repos/sequencias.ts`
 * guarda; este arquivo é quem **inscreve e tira**. Quem executa o passo mora em
 * `sequencias-passo.ts`, e a separação não é estética: entrar e sair acontece
 * no caminho de uma mensagem que chega, e executar precisa de
 * `receber-mensagem.ts` inteiro. Juntos, os dois fechariam um ciclo de imports
 * entre este arquivo e aquele.
 *
 * Como em `server/tarefas.ts`, tudo aqui foi escrito para que "não fez nada"
 * seja um desfecho normal e não uma falha.
 */

/**
 * Põe o contato nas sequências que este evento dispara.
 *
 * **Nada aqui pode derrubar quem chamou.** Quem chama já encerrou um
 * atendimento ou já etiquetou alguém — o trabalho que importava está feito, e
 * uma exceção aqui desfaria a impressão de que ele aconteceu. Por isso o
 * `try/catch` engole e loga: o custo do erro é um acompanhamento que não
 * começou, e ele é menor do que o custo de a tela dizer que falhou o que deu
 * certo.
 */
export async function inscreverNoEvento(
  clienteId: string,
  contatos: string[],
  evento: EventoDeSequencia,
  etiquetaId: string | null = null,
): Promise<void> {
  if (contatos.length === 0) return

  try {
    const sequencias = await sequenciasDoEvento(clienteId, evento, etiquetaId)
    if (sequencias.length === 0) return

    for (const sequencia of sequencias) {
      const primeiro = passoDoIndice(sequencia.passos, 0)
      if (!primeiro) continue

      for (const contatoId of contatos) {
        const inscricao = await inscrever(clienteId, sequencia.id, contatoId)
        // `null` = já havia uma ativa. Aplicar a mesma etiqueta duas vezes não
        // pode inscrever a pessoa duas vezes — quem garante isso de verdade é o
        // índice único parcial da 0031, e aqui a resposta é só "já estava".
        if (!inscricao) continue

        await agendar({
          clienteId,
          tipo: 'passo_de_sequencia',
          quando: quandoRodaOPasso(new Date(inscricao.entrouEm), primeiro),
          chave: chaveDoPasso(inscricao.id),
          dados: {
            inscricaoId: inscricao.id,
            sequenciaId: sequencia.id,
            contatoId,
            passoIndice: 0,
            entrouEm: inscricao.entrouEm,
          },
        })
      }
    }
  } catch (erro) {
    console.error(
      '[sequencias] não deu para inscrever',
      erro instanceof Error ? erro.message : erro,
    )
  }
}

/**
 * Tira o contato de tudo em que ele estiver.
 *
 * É a regra que separa acompanhamento de spam, e ela roda no caminho quente:
 * **toda mensagem que chega tira quem a mandou das sequências dele**. Uma
 * pessoa que voltou a falar não precisa ser lembrada de falar.
 *
 * As tarefas agendadas são canceladas junto. Sem isso elas acordariam, leriam
 * uma inscrição já morta e seriam ignoradas — correto, mas ao custo de uma
 * passada do agendador por inscrição, todo dia, para nada.
 */
export async function sairPorEvento(contatoId: string, motivo: MotivoDeSaida): Promise<void> {
  try {
    const inscricoes = await sairDasSequencias(contatoId, motivo)
    for (const id of inscricoes) await cancelarPorChave(chaveDoPasso(id))
  } catch (erro) {
    console.error('[sequencias] não deu para sair', erro instanceof Error ? erro.message : erro)
  }
}

/** A saída específica da etiqueta de saída — só das sequências que a declaram. */
export async function sairPelaEtiqueta(
  clienteId: string,
  etiquetaId: string,
  contatos: string[],
): Promise<void> {
  try {
    const inscricoes = await sairPorEtiquetaDeSaida(clienteId, etiquetaId, contatos)
    for (const id of inscricoes) await cancelarPorChave(chaveDoPasso(id))
  } catch (erro) {
    console.error(
      '[sequencias] não deu para sair pela etiqueta',
      erro instanceof Error ? erro.message : erro,
    )
  }
}
