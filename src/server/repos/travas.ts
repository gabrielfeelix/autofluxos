import 'server-only'
import { db } from '../db'

/**
 * Uma conversa por vez, por contato.
 *
 * Existe por um defeito reproduzido em teste: duas mensagens da mesma pessoa
 * chegando quase juntas viram dois `after()` concorrentes, os dois leem a
 * sessão no mesmo estado, e como o primeiro ainda não gravou, o segundo
 * também conclui que a conversa é nova — nascem **duas sessões** e a pessoa vê
 * a saudação duas vezes.
 *
 * O desenho está em `supabase/migrations/0007_travas.sql`; aqui mora só a
 * política de espera.
 */

/**
 * Quanto tempo a trava vale.
 *
 * Tem que caber o pior caso do processamento — que é o `maxDuration` de 60s do
 * webhook, gasto por um fluxo com nó de API lento. Um pouco mais, para a trava
 * não vencer com o trabalho ainda em pé; nunca muito mais, porque este é o
 * tempo que um contato fica mudo se a função morrer segurando a trava.
 */
const VALIDADE_SEGUNDOS = 75

/** Quanto tempo alguém espera pela vez antes de desistir. */
const ESPERA_MAXIMA_MS = 20_000

/** Entre uma tentativa e outra. Sobe até um teto — ver `esperar`. */
const PAUSA_INICIAL_MS = 120
const PAUSA_MAXIMA_MS = 1_500

export type Destravar = () => Promise<void>

/**
 * Espera a vez e devolve como soltar. `null` = não conseguiu a tempo.
 *
 * **Espera em vez de desistir de cara**, e isso é decisão: quando chega aqui, a
 * mensagem já foi gravada e deduplicada em `registrarEntrada`, então desistir
 * significa a pessoa nunca receber resposta e a Meta nunca reenviar. Vinte
 * segundos cabem no orçamento de 60s do webhook e cobrem qualquer conversa
 * normal — o que não couber é sinal de coisa travada, não de fila.
 *
 * Quem chama **precisa** soltar num `finally`. Não soltar não é catastrófico
 * (a trava vence sozinha), mas deixa o contato mudo pelo resto da validade.
 */
export async function travarContato(contatoId: string): Promise<Destravar | null> {
  const limite = Date.now() + ESPERA_MAXIMA_MS
  let pausa = PAUSA_INICIAL_MS

  for (;;) {
    const { data, error } = await db().rpc('travar_contato', {
      alvo: contatoId,
      segundos: VALIDADE_SEGUNDOS,
    })

    // Banco fora do ar não pode virar exceção aqui: isto roda dentro do
    // `after()` do webhook, e exceção lá deixa a pessoa sem resposta nenhuma.
    // Sem trava, quem chamou decide — e hoje decide passar para uma pessoa.
    if (error) return null

    if (data === true) {
      return async () => {
        try {
          await db().rpc('destravar_contato', { alvo: contatoId })
        } catch {
          // A trava vence sozinha. Estourar aqui trocaria um contato mudo por
          // 75 segundos por uma exceção sem dono no caminho do webhook.
        }
      }
    }

    if (Date.now() + pausa >= limite) return null

    await esperar(pausa)
    // Recuo: duas mensagens seguidas se resolvem no primeiro fôlego; uma fila
    // maior não fica martelando o banco enquanto espera.
    pausa = Math.min(pausa * 2, PAUSA_MAXIMA_MS)
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}
