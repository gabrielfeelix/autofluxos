import 'server-only'
import { CONTATO, montarEmail, type Email, type EmailMontado } from '@/core/email/layout'
import { MODELOS, type IdDoModelo, type ParametrosDo } from '@/core/email/modelos'
import { enderecoDoPainel } from './endereco'

/**
 * E-mail transacional pela Brevo, melhor-esforço.
 *
 * **Sem `BREVO_API_KEY` e `EMAIL_REMETENTE` no ambiente, não envia e diz que
 * não enviou.** O remetente é `<algo>@autofluxos.mail.4yu.com.br` (a regra dos
 * namespaces em `4yu-apps/CLAUDE.md`), autenticado na Brevo desde 05/out
 * (antes disso a Brevo recusava: "sender is not valid"). Mandar do domínio
 * raiz sujaria a reputação da caixa humana da 4YU, e isso não se desfaz.
 *
 * O desenho e os textos moram em `core/email/`; aqui só se envia.
 */
export function emailConfigurado(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_REMETENTE)
}

export type Destinatario = { email: string; nome?: string }

async function enviarEmail(para: Destinatario[], email: EmailMontado, etiqueta: string): Promise<boolean> {
  if (!emailConfigurado() || para.length === 0) {
    // Local: sem chave, o texto (com o link) vai para o log do servidor, o
    // único jeito de percorrer "esqueci a senha" sem mandar e-mail de verdade.
    if (process.env.NODE_ENV !== 'production' && para.length > 0) {
      console.info(`[email] não configurado; "${email.assunto}" para ${para[0]?.email}:\n${email.texto}`)
    }
    return false
  }
  try {
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_REMETENTE, name: 'AutoFluxos' },
        // O remetente é `nao-responda@`: quem responde cai na caixa humana da 4YU.
        replyTo: { email: CONTATO, name: '4YU' },
        to: para.map(({ email, nome }) => (nome ? { email, name: nome } : { email })),
        subject: email.assunto,
        textContent: email.texto,
        htmlContent: email.html,
        // A etiqueta é o id do modelo: o relatório da Brevo separa por ela.
        tags: [`autofluxos:${etiqueta}`],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!resposta.ok) console.error('[email] a Brevo recusou', resposta.status, await resposta.text().catch(() => ''))
    return resposta.ok
  } catch (erro) {
    console.error('[email] não foi possível enviar', erro)
    return false
  }
}

/**
 * Manda um dos modelos de `core/email/modelos.ts`. `true` se a Brevo aceitou.
 *
 * Não lança: nenhum e-mail daqui é o único caminho para o que ele carrega, e
 * derrubar a ação de quem clicou porque a Brevo piscou trocaria uma falha
 * pequena por uma grande.
 *
 * **Um envio por pessoa**, e não um com todos no `to`: com vários no `to`,
 * cada um veria o e-mail dos outros, e numa organização isso é a lista da
 * equipe inteira indo para quem não precisava dela.
 */
export async function enviarModelo<I extends IdDoModelo>(para: Destinatario | Destinatario[], id: I, parametros: ParametrosDo<I>): Promise<boolean> {
  const lista = (Array.isArray(para) ? para : [para]).filter((pessoa) => pessoa.email.includes('@'))
  if (lista.length === 0) return false
  const modelo = MODELOS[id] as unknown as { montar: (p: ParametrosDo<I>) => Email }
  const email = montarEmail(modelo.montar(parametros), enderecoParaEmail())
  const enviados = await Promise.all(lista.map((pessoa) => enviarEmail([pessoa], email, id)))
  return enviados.some(Boolean)
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

/** Um endereço do painel para botão de e-mail: `linkDoPainel('/entrar')`. */
export function linkDoPainel(caminho: string): string {
  return `${enderecoParaEmail()}${caminho}`
}

export async function enviarRedefinicaoDeSenha(para: Destinatario, token: string) {
  const link = linkDoPainel(`/redefinir-senha?token=${encodeURIComponent(token)}`)
  return enviarModelo(para, 'redefinirSenha', { nome: para.nome ?? '', link })
}

export async function enviarConfirmacaoDeEmail(para: Destinatario, token: string) {
  const link = linkDoPainel(`/confirmar-email?token=${encodeURIComponent(token)}`)
  return enviarModelo(para, 'confirmarEmail', { nome: para.nome ?? '', link })
}
