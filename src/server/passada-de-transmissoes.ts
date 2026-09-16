import 'server-only'
import { dispararTransmissao, type ResumoDoDisparo } from './disparar-transmissao'
import { transmissoesVencidas } from './repos/transmissoes'

/**
 * A passada que faz as transmissões andarem.
 *
 * ---------------------------------------------------------------------------
 * Por que isto existe separado do motor
 * ---------------------------------------------------------------------------
 *
 * `dispararTransmissao` sabe mandar **uma** transmissão e devolve depois de
 * `POR_PASSADA` destinatários, de propósito, a função da Vercel morre no
 * `maxDuration`. Quem decide *quais* transmissões andam agora, e quanto de
 * orçamento cada carona tem, é este arquivo.
 *
 * Sem ele o motor era órfão: estava pronto, testado, e nenhuma rota o chamava.
 * Uma transmissão criada ficava `agendada` para sempre.
 *
 * ---------------------------------------------------------------------------
 * Quem chama isto, e por que são três
 * ---------------------------------------------------------------------------
 *
 * O mesmo desenho de `enviarAgendadas`, pelo mesmo motivo: a Vercel no plano
 * Hobby dispara cron **uma vez por dia**, e uma campanha marcada para as 15h
 * conferida só de madrugada não é campanha.
 *
 * 1. **carona no webhook**, chegou mensagem nesta conta, então a conta está
 *    viva; é daqui que vem a resolução de minuto;
 * 2. **carona no pulso do Inbox**, enquanto alguém está com a tela aberta, o
 *    servidor já olha o banco. Cobre a conta que está transmitindo sem receber
 *    nada de volta, que é o caso normal de uma campanha;
 * 3. **cron diário**, o piso, para a conta que passou o dia sem ninguém.
 *
 * ---------------------------------------------------------------------------
 * O orçamento é por carona, e é pequeno de propósito
 * ---------------------------------------------------------------------------
 *
 * Uma passada com `POR_PASSADA` (200) destinatários leva 200 × o intervalo do
 * ritmo, dezenas de segundos. Isso cabe no cron, mas **não** cabe atrás do 200
 * que o webhook tem que devolver à Meta, nem dentro do pulso do Inbox.
 *
 * Por isso as caronas passam um teto pequeno: elas fazem a campanha *andar*, e
 * a chamada seguinte continua de onde esta parou. A fila é do banco, não da
 * memória, sair no meio nunca perde nada.
 */

/** Quantos destinatários cada carona curta pode mandar, por transmissão. */
export const POR_CARONA = 15

/**
 * Quantas transmissões uma passada toca.
 *
 * Duas contas transmitindo ao mesmo tempo é o normal; vinte não é. O teto
 * existe para uma conta com muita campanha aberta não consumir o orçamento
 * inteiro da função e deixar as outras paradas.
 */
export const TRANSMISSOES_POR_PASSADA = 5

export type ResumoDaPassada = {
  pegas: number
  tocadas: number
  falhas: number
  resumos: ResumoDoDisparo[]
}

/**
 * Faz andar o que está vencido ou já começou.
 *
 * **Uma transmissão que falha não derruba as outras**, e isso importa mais aqui
 * do que em qualquer outra fila deste produto: são de clientes diferentes, e um
 * número desconectado numa conta não pode impedir a campanha de outra de sair.
 * Por isso o `try` é por transmissão, e não em volta do laço, mesmo desenho de
 * `enviarAgendadas` e `rodarTarefas`.
 */
export async function passadaDeTransmissoes(
  opcoes: { porPassada?: number; quantas?: number } = {},
): Promise<ResumoDaPassada> {
  const vencidas = await transmissoesVencidas()
  const fila = vencidas.slice(0, opcoes.quantas ?? TRANSMISSOES_POR_PASSADA)

  const resumo: ResumoDaPassada = {
    pegas: fila.length,
    tocadas: 0,
    falhas: 0,
    resumos: [],
  }

  for (const transmissao of fila) {
    try {
      const r = await dispararTransmissao(transmissao.id, {
        ...(opcoes.porPassada !== undefined ? { porPassada: opcoes.porPassada } : {}),
      })
      resumo.tocadas += 1
      resumo.resumos.push(r)
    } catch (erro) {
      /*
       * Estourar aqui é anormal: o motor já trata erro de envio por
       * destinatário e para a transmissão sozinho quando o template morre. O
       * que sobra é falha nossa, banco fora, token ilegível, e ela não pode
       * ficar muda, porque ninguém está olhando quando isto roda.
       */
      resumo.falhas += 1
      console.error('[transmissoes] a passada falhou', transmissao.id, erro)
    }
  }

  return resumo
}
