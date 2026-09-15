import 'server-only'
import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { assinar } from '@/core/atendente'
import { adaptadorDoCanal } from './adaptador-do-canal'
import {
  marcarEnviada,
  marcarFalha,
  pegarVencidas,
  AGENDADAS_POR_PASSADA,
  type MensagemAgendada,
} from './repos/mensagens-agendadas'
import { confirmarEntrega, contextoDeResposta, registrarSaida } from './repos/conversas'

/**
 * A passada que manda o que venceu.
 *
 * ---------------------------------------------------------------------------
 * Quem chama isto, e por quê são três
 * ---------------------------------------------------------------------------
 *
 * A Vercel no plano Hobby dispara cron **uma vez por dia**. Um agendamento para
 * as 15h conferido só de madrugada não é agendamento. Então são três gatilhos,
 * pelo mesmo desenho que `rodarTarefas` já usa:
 *
 * 1. **carona no webhook** — a conta que tem mensagem marcada é, quase sempre,
 *    a conta que está conversando; é daqui que vem a resolução de minuto;
 * 2. **carona no pulso do Inbox** — enquanto alguém está com a tela aberta, o
 *    servidor já olha o banco de segundo em segundo. Uma passada por minuto
 *    ali cobre o caso de a mensagem marcada ser para uma conversa parada;
 * 3. **cron diário** — o piso, para a conta que passou o dia sem nada.
 *
 * O que isso **não** entrega está escrito na tela de marcar: com o painel
 * fechado e nenhuma mensagem chegando, a mensagem sai no primeiro dos três que
 * acontecer. Prometer precisão de minuto num plano que não a tem seria mentir
 * para o dono.
 *
 * ---------------------------------------------------------------------------
 * Uma que falha não derruba as outras
 * ---------------------------------------------------------------------------
 *
 * São de clientes diferentes: um número desconectado numa conta não pode
 * impedir a mensagem de outra. Por isso o `try` é por linha, e não em volta do
 * laço — o mesmo desenho de `rodarTarefas`.
 */

export type ResumoDasAgendadas = {
  pegas: number
  enviadas: number
  falhas: number
}

export async function enviarAgendadas(
  limite = AGENDADAS_POR_PASSADA,
): Promise<ResumoDasAgendadas> {
  const vencidas = await pegarVencidas(limite)
  const resumo: ResumoDasAgendadas = { pegas: vencidas.length, enviadas: 0, falhas: 0 }

  for (const agendada of vencidas) {
    try {
      await enviarUma(agendada)
      resumo.enviadas += 1
    } catch (erro) {
      resumo.falhas += 1
      const motivo = erro instanceof Error ? erro.message : String(erro)
      console.error('[agendadas] não saiu', agendada.id, motivo)
      await marcarFalha(agendada.id, motivo)
    }
  }

  return resumo
}

async function enviarUma(agendada: MensagemAgendada): Promise<void> {
  const contexto = await contextoDeResposta(agendada.clienteId, agendada.contatoId)
  if (!contexto) throw new Error('este contato não tem mais um número conectado para responder')

  /*
   * A janela de 24h é conferida **agora**, e não na hora de marcar.
   *
   * Quem marcou viu um aviso quando o horário já se sabia fora — mas a janela
   * reabre a cada mensagem do cliente, e fecha se ele parar de escrever. O que
   * vale é o estado no instante do envio, e a recusa precisa chegar à tela com
   * a palavra certa: não é erro nosso, é regra da Meta, e o caminho de saída é
   * a pessoa escrever de novo quando o cliente voltar a falar.
   */
  if (!dentroDaJanela(contexto.ultimaEntradaEm)) {
    throw new Error(
      'a janela de 24h fechou antes da hora marcada: o WhatsApp só deixa retomar por um modelo aprovado',
    )
  }

  const canal = await adaptadorDoCanal(contexto.canal)

  /*
   * Grava antes de mandar, como toda saída deste produto: uma função que morre
   * entre o envio e o registro não pode apagar do histórico algo que o cliente
   * já recebeu. A tela mostra "envio não confirmado" até a confirmação chegar.
   *
   * O autor é quem **marcou**, não quem estava online quando saiu — a mensagem
   * é dela, escrita por ela, e a assinatura que o cliente recebe diz o mesmo
   * nome.
   */
  const registro = await registrarSaida({
    contatoId: agendada.contatoId,
    sessaoId: contexto.sessaoId,
    texto: agendada.texto,
    autor: autorDaPessoa({ nome: agendada.criadaPorNome }),
  })

  await canal.enviarTexto(contexto.waId, assinar(agendada.texto, agendada.criadaPorNome))
  await confirmarEntrega(registro)
  await marcarEnviada(agendada.id)
}
