import 'server-only'
import { db } from '../db'

/**
 * O registro do que a IA fez no sistema de um cliente.
 *
 * **Existe por obrigação, e a obrigação tem artigo.** O art. 20 da LGPD dá ao
 * titular o direito de pedir revisão de uma decisão automatizada que o afete, e
 * obriga o controlador a informar os critérios usados. "A IA marcou você na
 * terça" é uma decisão dessas. Sem registro de qual consulta foi chamada, com
 * quais argumentos e quem decidiu, não há como responder — e a hora de
 * descobrir isso seria a hora do pedido.
 *
 * Barato agora, caro depois: é uma tabela e um insert enquanto o produto está
 * sendo construído, e é uma escavação em log de servidor quando alguém
 * perguntar.
 *
 * **Nunca guarda o corpo da resposta.** `detalhe` é motivo de falha, curto.
 * Copiar o que a API do cliente devolveu faria deste banco uma segunda cópia do
 * dado dele, com todas as obrigações que isso traz e nenhum dos benefícios.
 */

export type DecididoPor =
  /** A IA agiu sozinha, sob política `automatico`. */
  | 'ia'
  /** A pessoa respondeu sim à pergunta de confirmação. */
  | 'pessoa_confirmou'
  /** A pessoa respondeu não. Nada saiu — e é exatamente por isso que registra. */
  | 'pessoa_recusou'
  /** A conferência barrou antes de sair: id inventado, ferramenta não autorizada. */
  | 'recusado_pela_trava'

export type ChamadaDeIa = {
  clienteId: string
  contatoId?: string
  fluxoId?: string
  ferramenta: string
  argumentos: Record<string, string>
  decididoPor: DecididoPor
  /** O que a pessoa leu antes de confirmar, quando houve confirmação. */
  resumo?: string
  ok: boolean
  detalhe?: string
}

/**
 * Grava uma chamada. Nunca estoura.
 *
 * Log que derruba a conversa é pior que log nenhum: a exceção subiria até o
 * `after()` do webhook, a sessão não seria salva, a mensagem já foi
 * deduplicada, e a pessoa ficaria esperando uma resposta que não vem — tudo
 * isso para registrar uma linha. Falha aqui vai para o console e a conversa
 * segue.
 */
export async function registrarChamada(chamada: ChamadaDeIa): Promise<void> {
  try {
    const { error } = await db()
      .from('ia_chamadas')
      .insert({
        client_id: chamada.clienteId,
        contato_id: chamada.contatoId ?? null,
        fluxo_id: chamada.fluxoId ?? null,
        ferramenta: chamada.ferramenta,
        argumentos: chamada.argumentos,
        decidido_por: chamada.decididoPor,
        resumo: chamada.resumo ?? null,
        ok: chamada.ok,
        detalhe: chamada.detalhe ?? null,
      })

    if (error) console.error('[ia] não deu para registrar a chamada', error.message)
  } catch (erro) {
    console.error('[ia] não deu para registrar a chamada', erro)
  }
}
