import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { lerCodigoDoClique } from '@/server/link-do-clique'
import { lerTemplate } from '@/server/repos/templates'
import { anotarClique } from '@/server/repos/transmissoes'

/**
 * O clique no botão de link de um modelo que conta cliques (0139).
 *
 * O destino mora no botão do modelo, e não no código: o código diz qual
 * modelo e, se veio de transmissão, qual destinatário. Quem está logado no
 * painel não conta, pelo mesmo motivo do link de produto: o atendente
 * conferindo o link viraria "o cliente clicou".
 *
 * Anotar nunca segura o redirecionamento. Falhar a anotação custa um número no
 * relatório; falhar o redirecionamento custa a venda.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const lido = lerCodigoDoClique(codigo)
  if (!lido) return new NextResponse('link inválido', { status: 404 })

  const template = await lerTemplate(lido.conteudo.t).catch(() => null)
  const destino = template?.componentes.botoes?.find((b) => b.tipo === 'URL' && b.destino)?.destino
  if (!destino || !/^https?:\/\//.test(destino)) return new NextResponse('link inválido', { status: 404 })

  if (lido.assinado && lido.conteudo.d && getSessionCookie(req) === null) {
    await anotarClique(lido.conteudo.d).catch((erro) => console.error('[clique] não anotou:', erro))
  }

  return NextResponse.redirect(comUtmDaTransmissao(destino), 302)
}

/** UTM de transmissão, sem sobrescrever a que a conta já escreveu no link. */
function comUtmDaTransmissao(link: string): string {
  try {
    const url = new URL(link)
    const utms: [string, string][] = [
      ['utm_source', 'whatsapp'],
      ['utm_medium', 'transmissao'],
      ['utm_campaign', 'autofluxos'],
    ]
    for (const [nome, valor] of utms) if (!url.searchParams.has(nome)) url.searchParams.set(nome, valor)
    return url.toString()
  } catch {
    return link
  }
}
