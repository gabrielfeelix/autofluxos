import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_PAINEL, conferirSessao, iguais, segredoDeSessao } from '@/lib/painel-auth'

/**
 * Protege o painel com a senha única do MVP.
 *
 * A tela de login transforma a senha em um cookie HTTP-only. Basic Auth segue
 * aceito nas rotas protegidas por compatibilidade com acessos já configurados.
 */
export async function proxy(req: NextRequest) {
  const senha = process.env.PAINEL_SENHA
  const login = req.nextUrl.pathname === '/login'

  if (!senha) {
    // A tela precisa continuar acessível para explicar o ambiente incompleto.
    if (login || process.env.NODE_ENV !== 'production') return NextResponse.next()
    return new NextResponse('PAINEL_SENHA não configurada', { status: 503 })
  }

  // Quem confere o prazo é aqui, e não o navegador: `maxAge` é um pedido, e um
  // cookie copiado continua valendo até o servidor recusar a data que ele traz.
  const sessao = req.cookies.get(COOKIE_PAINEL)?.value ?? ''
  const autenticada = await conferirSessao(sessao, segredoDeSessao(senha))

  if (login) {
    return autenticada
      ? NextResponse.redirect(new URL('/', req.nextUrl))
      : NextResponse.next()
  }

  if (autenticada || basicAuthConfere(req, senha)) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse('sessão expirada', { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', req.nextUrl))
}

function basicAuthConfere(req: NextRequest, senha: string): boolean {
  const cabecalho = req.headers.get('authorization') ?? ''
  if (!cabecalho.startsWith('Basic ')) return false

  try {
    const [, informada] = atob(cabecalho.slice(6)).split(':')
    return informada !== undefined && iguais(informada, senha)
  } catch {
    return false
  }
}

export const config = {
  // Duas exceções, e as duas por quem chama:
  //
  // `robots.txt` **precisa** ser lido por quem não tem sessão — é essa a função
  // dele. Dentro do matcher, o crawler recebia o redirecionamento para `/login`
  // e nunca via a regra que proíbe indexar.
  //
  // `api/manutencao` é chamada pela tarefa agendada da plataforma, que não tem
  // cookie de painel. Ela se protege com `CRON_SECRET` e falha fechada sem ele.
  matcher: [
    '/((?!api/webhook|api/manutencao|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}
