import 'server-only'

/**
 * O corpo cru de um webhook, com teto de tamanho.
 *
 * Os webhooks da Meta leem o corpo inteiro antes de conferir a assinatura
 * (ela é sobre os bytes exatos), então sem teto qualquer um mandava megabytes
 * para uma função que só depois descobre que não eram da Meta. O cabeçalho
 * `content-length` é escolhido por quem chama, e por isso os bytes de verdade
 * são conferidos também. Um megabyte é folga larga para os lotes da Meta.
 */
export const TETO_DO_WEBHOOK_EM_BYTES = 1024 * 1024

export async function lerCorpoComTeto(
  req: Request,
  teto = TETO_DO_WEBHOOK_EM_BYTES,
): Promise<{ ok: true; corpo: string } | { ok: false; resposta: Response }> {
  const recusa = { ok: false as const, resposta: new Response('corpo grande demais', { status: 413 }) }
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > teto) return recusa

  let corpo: string
  try {
    corpo = await req.text()
  } catch {
    return { ok: false, resposta: new Response('corpo ilegível', { status: 400 }) }
  }
  if (Buffer.byteLength(corpo, 'utf8') > teto) return recusa
  return { ok: true, corpo }
}
