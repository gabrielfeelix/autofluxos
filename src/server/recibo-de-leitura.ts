import 'server-only'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { contextoDeResposta } from './repos/conversas'

/**
 * O segundo tique, quando alguém abre a conversa no painel.
 *
 * ---------------------------------------------------------------------------
 * Por que isto faltava, e por que incomoda
 * ---------------------------------------------------------------------------
 *
 * O número roda na Cloud API: ninguém "abre o WhatsApp" do lado do cliente. Se
 * o painel não avisar a Meta, a pessoa que escreveu vê **um tique cinza para
 * sempre**, mesmo depois de alguém ler e responder. No WhatsApp, um tique
 * parado quer dizer "não chegou", e é o que faz ela mandar a mesma pergunta
 * de novo, ou desistir.
 *
 * O bot já marcava lida quando ia responder (`aguardarResposta` manda `read`
 * junto do "digitando"). O que faltava era o caso em que **uma pessoa** abre a
 * conversa e talvez não responda nada.
 *
 * ---------------------------------------------------------------------------
 * Roda depois da resposta, e não durante
 * ---------------------------------------------------------------------------
 *
 * Quem chama usa o `after` do Next: é uma chamada de rede para a Meta, e pôr
 * uma requisição externa no caminho de desenhar o Inbox é trocar um tique por
 * um segundo de espera em toda troca de conversa.
 *
 * Nunca estoura. O recibo é cortesia; a tela é trabalho.
 */
export async function avisarQueLeu(
  clienteId: string,
  contatoId: string,
  /**
   * Quando esta pessoa tinha aberto a conversa antes desta vez, lido **antes**
   * de `marcarComoLida` empurrar o relógio.
   *
   * É o que evita um recibo por atualização de tela: só vale a pena avisar se
   * chegou mensagem depois da última olhada. `null` (nunca abriu) manda o
   * recibo, que é o caso em que ele mais importa.
   */
  leuAntesEm: string | null,
): Promise<void> {
  try {
    const contexto = await contextoDeResposta(clienteId, contatoId)
    if (!contexto?.ultimaEntradaWaId || !contexto.ultimaEntradaEm) return

    /*
     * Nada novo desde a última vez que esta pessoa olhou: a Meta já recebeu o
     * recibo daquela mensagem, e mandar de novo é gastar cota para repetir o
     * que ela já sabe.
     */
    if (leuAntesEm && Date.parse(contexto.ultimaEntradaEm) <= Date.parse(leuAntesEm)) return

    const canal = await adaptadorDoCanal(contexto.canal)
    /*
     * Nem todo canal tem recibo, o Instagram, por exemplo, não passa por aqui.
     * Perguntar antes é o que faz a ausência ser silêncio em vez de
     * `canal.marcarLida is not a function` no log de produção.
     */
    if (!canal.marcarLida) return

    await canal.marcarLida(contexto.ultimaEntradaWaId)
  } catch (erro) {
    console.warn(
      '[leitura] não deu para marcar a conversa como lida no WhatsApp',
      erro instanceof Error ? erro.message : String(erro),
    )
  }
}
