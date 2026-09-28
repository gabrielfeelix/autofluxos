import 'server-only'
import { enderecoDoPainel } from './endereco'

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

export async function enviarEmail(
  para: { email: string; nome?: string }[],
  assunto: string,
  texto: string,
  html?: string,
): Promise<boolean> {
  if (!emailConfigurado() || para.length === 0) {
    // Local: sem chave, o texto (com o link) vai para o log do servidor, o
    // único jeito de percorrer "esqueci a senha" sem mandar e-mail de verdade.
    if (process.env.NODE_ENV !== 'production' && para.length > 0) {
      console.info(`[email] não configurado; "${assunto}" para ${para[0]?.email}:\n${texto}`)
    }
    return false
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_REMETENTE, name: 'AutoFluxos' },
        to: para.map(({ email, nome }) => (nome ? { email, name: nome } : { email })),
        subject: assunto,
        textContent: texto,
        ...(html ? { htmlContent: html } : {}),
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

/**
 * O endereço que vai **dentro** do e-mail.
 *
 * Em produção é o domínio escrito aqui, e não `enderecoDoPainel()`: sem
 * `BETTER_AUTH_URL` configurada, aquela função cai no `VERCEL_URL`, que é o
 * endereço do deploy, e um link de redefinição para ele morreria no próximo
 * push.
 */
export function enderecoParaEmail(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://autofluxos.4yu.com.br'
  return enderecoDoPainel()
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Um e-mail curto de conta: um botão, e o link por extenso embaixo. */
function mensagemDeConta({ saudacao, corpo, botao, link, rodape }: { saudacao: string; corpo: string; botao: string; link: string; rodape: string }) {
  const texto = `${saudacao}\n\n${corpo}\n\n${botao}: ${link}\n\n${rodape}\n\nAutoFluxos`
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b6b66">AUTOFLUXOS</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapar(saudacao)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55">${escapar(corpo)}</p>
<p style="margin:0 0 24px"><a href="${escapar(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px">${escapar(botao)}</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b6b66">Se o botão não abrir, copie este endereço no navegador:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#6b6b66">${escapar(link)}</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b6b66">${escapar(rodape)}</p>
</td></tr></table></td></tr></table></body></html>`
  return { texto, html }
}

function oi(nome?: string): string {
  const primeiro = nome?.trim().split(' ')[0]
  return primeiro ? `Oi, ${primeiro}.` : 'Oi.'
}

export async function enviarRedefinicaoDeSenha(para: { email: string; nome?: string }, token: string) {
  const link = `${enderecoParaEmail()}/redefinir-senha?token=${encodeURIComponent(token)}`
  const { texto, html } = mensagemDeConta({
    saudacao: oi(para.nome),
    corpo: 'Alguém pediu para redefinir a senha da sua conta do AutoFluxos. O link vale por 1 hora e funciona uma vez só.',
    botao: 'Criar uma senha nova',
    link,
    rodape: 'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
  })
  return enviarEmail([para], 'Redefinir a senha do AutoFluxos', texto, html)
}

export async function enviarConfirmacaoDeEmail(para: { email: string; nome?: string }, token: string) {
  const link = `${enderecoParaEmail()}/confirmar-email?token=${encodeURIComponent(token)}`
  const { texto, html } = mensagemDeConta({
    saudacao: oi(para.nome),
    corpo: 'Confirme que este e-mail é seu para manter o acesso ao AutoFluxos. É por ele que você recupera a senha.',
    botao: 'Confirmar meu e-mail',
    link,
    rodape: 'Se você não criou uma conta no AutoFluxos, ignore este e-mail.',
  })
  return enviarEmail([para], 'Confirme seu e-mail no AutoFluxos', texto, html)
}
