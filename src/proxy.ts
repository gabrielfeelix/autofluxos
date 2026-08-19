import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import {
  COOKIE_PAINEL,
  basicAuthConfere,
  conferirSessao,
  segredoDeSessao,
} from '@/lib/painel-auth'

/**
 * Quem entra no painel — e, por enquanto, são **duas** portas.
 *
 * A senha única (`PAINEL_SENHA` + cookie assinado) é a que está no ar desde o
 * MVP. O login por usuário (Better Auth) nasceu ao lado dela e ainda não a
 * substituiu. As duas convivem de propósito: enquanto a senha única funcionar
 * exatamente como funcionava, nada que já está rodando pode quebrar por causa
 * do sistema novo.
 *
 * **O que este arquivo decide é "a requisição segue", não "esta pessoa pode".**
 * A distinção não é acadêmica: a documentação do Next avisa que Server Action é
 * um POST na rota onde ela é usada, e um refactor que a mova para outra rota a
 * tira do matcher sem ninguém perceber. Autorização de verdade mora em
 * `server/sessao.ts` e é chamada por quem renderiza ou executa.
 *
 * Daí a conferência do login por usuário aqui ser só de **presença do cookie**.
 * Ela é barata, não vai ao banco, e não decide nada sozinha: um cookie forjado
 * passa por aqui e morre no `getSession` da tela seguinte.
 */

/**
 * A única tela que existe para quem ainda não entrou.
 *
 * **`/criar-conta` não está aqui, e a primeira escrita a tinha posto.** Ela
 * abre a porta de primeira execução — se não há usuário nenhum, quem chega
 * nasce administrador da plataforma. Pública, isso significa que qualquer um na
 * internet vira administrador do painel enquanto o primeiro não for criado.
 *
 * Atrás da senha única, quem cria o primeiro administrador é quem já tem acesso
 * total hoje, e a fronteira de confiança não muda de lugar. Depois do primeiro,
 * a tela exige sessão de administrador de qualquer forma.
 */
const PORTAS_ABERTAS = ['/entrar']

/**
 * A página de um fluxo compartilhado (0030).
 *
 * É prefixo e não caminho exato porque o token vem no endereço. E ela é a
 * **única** rota de tela deste sistema que abre sem sessão nenhuma — o que
 * significa que a autorização dela não pode morar aqui: quem decide o que
 * mostrar é `repos/compartilhar.ts`, olhando token, revogação e prazo, e quem
 * decide para onde importar é `acaoImportarFluxoCompartilhado`, que confere o
 * acesso à conta de destino como toda ação.
 *
 * Deixá-la atrás do login mataria a funcionalidade: o ponto do link é chegar a
 * quem ainda não tem conta aqui.
 */
const PREFIXOS_ABERTOS = ['/f/']

export async function proxy(req: NextRequest) {
  const caminho = req.nextUrl.pathname
  const senha = process.env.PAINEL_SENHA

  // Quem confere o prazo é aqui, e não o navegador: `maxAge` é um pedido, e um
  // cookie copiado continua valendo até o servidor recusar a data que ele traz.
  const cookiePainel = req.cookies.get(COOKIE_PAINEL)?.value ?? ''
  const temPainel = senha
    ? (await conferirSessao(cookiePainel, segredoDeSessao(senha))) ||
      basicAuthConfere(req.headers.get('authorization'), senha)
    : false

  // Presença, não validade. Ver o comentário no topo.
  const temUsuario = getSessionCookie(req) !== null

  // Sempre abertas, e **sem redirecionar quem já parece logado**. A tentação é
  // mandar para a raiz quem chega ao `/entrar` com cookie; um cookie vencido
  // faz isso virar laço: a raiz confere de verdade, não encontra sessão, e
  // devolve para cá. Quem decide isso é a própria tela, que lê a sessão em vez
  // de olhar para o cookie.
  if (PORTAS_ABERTAS.includes(caminho)) return NextResponse.next()
  if (PREFIXOS_ABERTOS.some((prefixo) => caminho.startsWith(prefixo))) return NextResponse.next()

  const login = caminho === '/login'

  if (!senha) {
    // Sem senha única configurada, ela simplesmente não é uma porta. Em
    // desenvolvimento o painel segue aberto para quem clonou o repositório e
    // ainda não tem credencial nenhuma; em produção, o login por usuário passa
    // a ser o único caminho.
    //
    // Isto substitui o 503 que existia aqui. Ele fazia sentido quando não havia
    // outra forma de entrar; hoje ele derrubaria um ambiente que já autentica.
    if (login || process.env.NODE_ENV !== 'production') return NextResponse.next()
    if (temUsuario) return NextResponse.next()
    return NextResponse.redirect(new URL('/entrar', req.nextUrl))
  }

  if (login) {
    return temPainel ? NextResponse.redirect(new URL('/', req.nextUrl)) : NextResponse.next()
  }

  if (temPainel) return NextResponse.next()

  /**
   * A sessão de usuário abre o painel — e toda tela alcançada por aqui confere
   * quem é de novo, no servidor.
   *
   * A área do administrador exige papel de plataforma; a moldura do cliente e o
   * editor exigem ser daquela conta; as rotas de API que carregam `clienteId`
   * perguntam o mesmo antes de ler qualquer coisa. O simulador ganhou a
   * conferência pelo dono do `fluxoId`, que era por onde a credencial de um
   * cliente vazava para quem postasse o id dele.
   */
  if (temUsuario) return NextResponse.next()

  if (caminho.startsWith('/api/')) {
    return new NextResponse('sessão expirada', { status: 401 })
  }

  // Enquanto a senha única for a porta principal, quem perdeu a sessão volta
  // para ela — mandar o operador de hoje para uma tela onde a senha dele não
  // funciona seria trocar "expirou" por "quebrou". As duas telas apontam uma
  // para a outra, então ninguém fica preso na errada.
  return NextResponse.redirect(new URL(senha ? '/login' : '/entrar', req.nextUrl))
}

export const config = {
  // Três exceções, e as três por quem chama:
  //
  // `robots.txt` **precisa** ser lido por quem não tem sessão — é essa a função
  // dele. Dentro do matcher, o crawler recebia o redirecionamento para `/login`
  // e nunca via a regra que proíbe indexar.
  //
  // `api/manutencao` é chamada pela tarefa agendada da plataforma, que não tem
  // cookie de painel. Ela se protege com `CRON_SECRET` e falha fechada sem ele.
  //
  // `api/auth` é o próprio login: entrar, sair, trocar de companhia. Exigir
  // sessão para chegar até ele seria exigir sessão para criar uma.
  matcher: [
    '/((?!api/auth|api/webhook|api/manutencao|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}
