import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { lerLinkRastreado } from '@/server/link-de-produto'
import { anotar } from '@/server/repos/eventos'

/**
 * O clique em "Ver produto": anota e manda para a loja.
 *
 * Quem está logado no painel não conta: o mesmo link aparece no card dentro
 * do Inbox, e o atendente conferindo o produto viraria "o cliente abriu".
 * Anotar nunca segura o redirecionamento, `anotar` engole o próprio erro.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const conteudo = lerLinkRastreado(token)
  if (!conteudo) return new NextResponse('link inválido', { status: 404 })

  if (getSessionCookie(req) === null) {
    await anotar(conteudo.k, conteudo.c, 'abriu-produto', { produto: conteudo.n, link: conteudo.u })
  }

  return NextResponse.redirect(conteudo.u, 302)
}
