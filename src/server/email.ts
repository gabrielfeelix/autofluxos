import 'server-only'

/**
 * E-mail transacional pela Brevo, melhor-esforço.
 *
 * **Sem `BREVO_API_KEY` e `EMAIL_REMETENTE` no ambiente, não envia e diz que
 * não enviou.** O remetente é `<algo>@autofluxos.mail.4yu.com.br` (a regra dos
 * namespaces em `4yu-apps/CLAUDE.md`), e esse domínio ainda não tem DKIM da
 * Brevo publicado (conferido em 24/set: NXDOMAIN). Até ter, o aviso vale só no
 * app, e quem chama registra que o e-mail não saiu. Mandar do domínio raiz
 * sujaria a reputação da caixa humana da 4YU, e isso não se desfaz.
 */
export function emailConfigurado(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_REMETENTE)
}

export async function enviarEmail(para: { email: string; nome?: string }[], assunto: string, texto: string): Promise<boolean> {
  if (!emailConfigurado() || para.length === 0) return false
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_REMETENTE, name: 'AutoFluxos' },
        to: para.map(({ email, nome }) => (nome ? { email, name: nome } : { email })),
        subject: assunto,
        textContent: texto,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resposta.ok) console.error('[email] a Brevo recusou', resposta.status, await resposta.text().catch(() => ''))
    return resposta.ok
  } catch (erro) {
    console.error('[email] não deu para enviar', erro)
    return false
  }
}
