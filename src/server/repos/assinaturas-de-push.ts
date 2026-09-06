import 'server-only'
import { db } from '../db'

/**
 * Para onde mandar o aviso de handoff (0045).
 *
 * **Uma linha por navegador, não por pessoa.** Quem abre o painel no celular e
 * no computador tem duas assinaturas, e as duas devem tocar — o aviso existe
 * justamente para alcançar o aparelho que está à mão. Por isso a chave única é
 * o `endpoint`, que é o que o navegador devolve e o que o servidor de push do
 * fabricante entende.
 */

export type AssinaturaDePush = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** O que o `PushSubscription` do navegador entrega, já conferido. */
export type AssinaturaCrua = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function guardarAssinatura(
  clienteId: string,
  usuarioId: string,
  assinatura: AssinaturaCrua,
): Promise<void> {
  /*
   * `upsert` pelo endpoint, e não `insert`.
   *
   * O navegador devolve o **mesmo** endpoint a cada visita ao painel; sem isto,
   * cada abertura acrescentaria uma linha e a pessoa receberia o mesmo aviso N
   * vezes — o caminho mais curto para alguém desligar a permissão e o produto
   * voltar a ser mudo.
   *
   * O `client_id`/`usuario_id` sendo reescritos é de propósito: o mesmo
   * navegador pode passar a atender por outra conta, e o aviso tem que seguir
   * quem está usando aquele aparelho agora.
   */
  const { error } = await db()
    .from('assinaturas_de_push')
    .upsert(
      {
        client_id: clienteId,
        usuario_id: usuarioId,
        endpoint: assinatura.endpoint,
        p256dh: assinatura.p256dh,
        auth: assinatura.auth,
        falhou_em: null,
      },
      { onConflict: 'endpoint' },
    )

  if (error) throw new Error(`não deu para guardar a assinatura de push: ${error.message}`)
}

/** Quem desligou o aviso naquele navegador. */
export async function apagarAssinatura(endpoint: string): Promise<void> {
  const { error } = await db().from('assinaturas_de_push').delete().eq('endpoint', endpoint)
  if (error) throw new Error(`não deu para apagar a assinatura de push: ${error.message}`)
}

/**
 * Os aparelhos de quem vai ser avisado.
 *
 * Recebe a lista de usuários já decidida por `core/aviso-de-handoff.ts` — a
 * decisão de **quem** avisar não mora aqui, e sim num módulo puro que dá para
 * testar sem banco.
 */
export async function assinaturasDe(
  clienteId: string,
  usuarioIds: string[],
): Promise<AssinaturaDePush[]> {
  if (usuarioIds.length === 0) return []

  const { data, error } = await db()
    .from('assinaturas_de_push')
    .select('id, endpoint, p256dh, auth')
    .eq('client_id', clienteId)
    .in('usuario_id', usuarioIds)

  if (error) throw new Error(`não deu para ler as assinaturas de push: ${error.message}`)

  return (data ?? []).map((linha) => ({
    id: String(linha.id),
    endpoint: String(linha.endpoint),
    p256dh: String(linha.p256dh),
    auth: String(linha.auth),
  }))
}
