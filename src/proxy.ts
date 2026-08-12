import { NextResponse, type NextRequest } from 'next/server'

/**
 * Senha no painel.
 *
 * O arquivo se chama `proxy` porque no Next 16 o nome `middleware` foi
 * aposentado — mesmo comportamento, nome que descreve melhor onde ele roda
 * (`guides/upgrading/version-16.md`). O runtime aqui é sempre Node, não Edge.
 *
 * O modelo de operação é agência: quem mexe é uma pessoa só (ver §8). Login com
 * usuário, papel e convite entra quando existir um segundo operador — mas
 * "ainda não tem login" não pode virar "o painel do cliente está aberto na
 * internet". Uma senha resolve hoje pelo custo de um arquivo.
 *
 * O webhook do WhatsApp fica de fora: a Meta não tem como mandar senha, e ele
 * se protege por assinatura HMAC, que é a defesa certa para aquele caso.
 */
export function proxy(req: NextRequest) {
  const senha = process.env.PAINEL_SENHA

  if (!senha) {
    // Sem senha em desenvolvimento é conveniência. Em produção é buraco: falha
    // fechado em vez de servir o painel para qualquer um.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('PAINEL_SENHA não configurada', { status: 503 })
    }
    return NextResponse.next()
  }

  const cabecalho = req.headers.get('authorization') ?? ''
  if (cabecalho.startsWith('Basic ')) {
    const [, informada] = atob(cabecalho.slice(6)).split(':')
    if (informada !== undefined && iguais(informada, senha)) return NextResponse.next()
  }

  return new NextResponse('preciso de senha', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AutoFluxos", charset="UTF-8"' },
  })
}

/** Compara sem sair mais cedo no primeiro byte diferente. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

export const config = {
  matcher: ['/((?!api/webhook|_next/static|_next/image|favicon.ico).*)'],
}
