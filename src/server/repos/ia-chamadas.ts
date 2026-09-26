import 'server-only'
import { db } from '../db'

/**
 * O registro do que a IA fez no sistema de um cliente.
 *
 * **Existe por obrigação, e a obrigação tem artigo.** O art. 20 da LGPD dá ao
 * titular o direito de pedir revisão de uma decisão automatizada que o afete, e
 * obriga o controlador a informar os critérios usados. "A IA marcou você na
 * terça" é uma decisão dessas. Sem registro de qual consulta foi chamada, com
 * quais argumentos e quem decidiu, não há como responder, e a hora de
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
  /** A pessoa respondeu não. Nada saiu, e é exatamente por isso que registra. */
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
 * deduplicada, e a pessoa ficaria esperando uma resposta que não vem, tudo
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

/**
 * O nome que marca, em `ia_chamadas`, uma **resposta** do modelo, e não uma
 * consulta ao sistema do cliente.
 *
 * Existe por causa do limite por contato (`clients.ia_limite_contato_dia`,
 * 0106). A tabela só registrava consulta de ferramenta, e resposta sem
 * ferramenta, que é a maioria, não deixava rastro nenhum para contar. Não há
 * outra coluna que diga "esta mensagem foi a IA que escreveu", e criar uma
 * seria migration; a linha aqui cabe no que já existe.
 *
 * Nenhuma ferramenta do catálogo tem este nome, e é por ele que a contagem
 * separa uma coisa da outra: consulta não gasta o limite, só a resposta, que
 * é o que custa e o que a pessoa conta como "o bot me respondeu".
 */
export const FERRAMENTA_RESPOSTA = 'resposta'

/** A janela do limite: as últimas 24 horas, e não o dia do calendário. */
const JANELA_DO_LIMITE_MS = 24 * 60 * 60 * 1_000

/**
 * Quanto a IA ainda pode responder para este contato, pela regra da conta.
 *
 * `limite` nulo é "sem limite", o de todas as contas antes da 0106, e aí nem a
 * contagem é feita: é uma leitura só, pela chave primária.
 *
 * **Erro de leitura é "sem limite", nunca "esgotado".** O limite existe para
 * conter custo numa conta de demonstração; banco lento derrubando o
 * atendimento de todo mundo para proteger essa conta seria trocar um problema
 * pequeno por um grande. Vai para o console e a conversa segue.
 */
export async function cotaDeIaDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ limite: number | null; usadas: number }> {
  const semLimite = { limite: null, usadas: 0 }
  try {
    const { data: conta, error: erroConta } = await db()
      .from('clients')
      .select('ia_limite_contato_dia')
      .eq('id', clienteId)
      .maybeSingle()
    if (erroConta) {
      console.error('[ia] não deu para ler o limite por contato', erroConta.message)
      return semLimite
    }

    const limite = (conta as { ia_limite_contato_dia: number | null } | null)?.ia_limite_contato_dia ?? null
    if (limite === null) return semLimite

    const desde = new Date(Date.now() - JANELA_DO_LIMITE_MS).toISOString()
    const { count, error } = await db()
      .from('ia_chamadas')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('contato_id', contatoId)
      .eq('ferramenta', FERRAMENTA_RESPOSTA)
      .gte('criado_em', desde)
    if (error) {
      console.error('[ia] não deu para contar as respostas do contato', error.message)
      return semLimite
    }

    return { limite, usadas: count ?? 0 }
  } catch (erro) {
    console.error('[ia] não deu para ler a cota de IA do contato', erro)
    return semLimite
  }
}

/** Grava uma resposta do modelo para a contagem do limite. Nunca estoura, como `registrarChamada`. */
export async function registrarRespostaDaIa(clienteId: string, contatoId: string): Promise<void> {
  await registrarChamada({
    clienteId,
    contatoId,
    ferramenta: FERRAMENTA_RESPOSTA,
    argumentos: {},
    decididoPor: 'ia',
    ok: true,
  })
}
