import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * O "último evento" das conexões (tarefa 6.4): quando algo chegou de fora pela
 * última vez. Só leitura, e barata: as duas consultas andam por índice
 * (`contacts_ultima_mensagem_idx`; em `passagens`, o prefixo `client_id` de
 * `passagens_do_anuncio_idx`) e trazem uma linha.
 *
 * **A mensagem é da conta, não do número.** `messages` não guarda o canal, e
 * a sessão só existe quando uma automação roda; atribuir a mensagem a um
 * número seria chute. A tela diz "última mensagem recebida na conta", que é o
 * que o dado sustenta.
 */

export async function ultimaMensagemRecebida(clienteId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('contacts')
    .select('ultima_mensagem_em')
    .eq('client_id', clienteId)
    .not('ultima_mensagem_em', 'is', null)
    .order('ultima_mensagem_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return null
    throw new Error(`não deu para ler a última mensagem: ${error.message}`)
  }
  return (data as { ultima_mensagem_em: string } | null)?.ultima_mensagem_em ?? null
}

/** A última chegada vinda de anúncio (formulário ou clique para conversar). */
export async function ultimaChegadaDeAnuncio(clienteId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('passagens')
    .select('criado_em')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (ehIdInvalido(error)) return null
    throw new Error(`não deu para ler a última chegada de anúncio: ${error.message}`)
  }
  return (data as { criado_em: string } | null)?.criado_em ?? null
}
