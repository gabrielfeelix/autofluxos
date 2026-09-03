import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Quem entra no painel.
 *
 * **Uma porta só: `/entrar`, com login por usuário (Better Auth).** A senha
 * única do time — `/login`, `PAINEL_SENHA` e um cookie assinado — foi a porta do
 * MVP e saiu de cena. Ela existia enquanto nenhuma tela sabia de qual conta a
 * pessoa era; hoje toda tela sabe, e manter as duas significava manter um
 * caminho que alcança qualquer conta **sem passar por membro** e, portanto, sem
 * deixar rastro na auditoria.
 *
 * **O que este arquivo decide é "a requisição segue", não "esta pessoa pode".**
 * A distinção não é acadêmica: a documentação do Next avisa que Server Action é
 * um POST na rota onde ela é usada, e um refactor que a mova para outra rota a
 * tira do matcher sem ninguém perceber. Autorização de verdade mora em
 * `server/sessao.ts` e é chamada por quem renderiza ou executa.
 *
 * Daí a conferência aqui ser só de **presença do cookie**. Ela é barata, não vai
 * ao banco, e não decide nada sozinha: um cookie forjado passa por aqui e morre
 * no `getSession` da tela seguinte.
 */

/**
 * As telas que existem para quem ainda não entrou.
 *
 * **`/criar-conta` não está aqui, e a primeira escrita a tinha posto.** Ela abre
 * a porta de primeira execução — se não há usuário nenhum, quem chega nasce
 * administrador da plataforma —, e a própria tela é quem fecha isso: a pergunta
 * que a destranca ("não há ninguém?") só tem resposta afirmativa uma vez na vida
 * do sistema. Ver `acoes-conta.ts`.
 */
const PORTAS_ABERTAS = [
  /**
   * A raiz é a **landing pública**, não o painel — o painel mudou para
   * `/painel` justamente por isto.
   *
   * Ela precisa abrir sem sessão pela mesma razão que a política de
   * privacidade: a verificação de acesso da Meta exige um site que mostre o
   * serviço, e quem revisa não tem conta aqui. Um domínio de produto que
   * responde com a tela de login é, para efeito de análise, um site que não
   * existe.
   *
   * Não vaza nada: a página é estática e não lê sessão nem banco.
   */
  '/',
  '/entrar',
  /**
   * A política de privacidade **precisa** abrir sem sessão.
   *
   * É a URL que o app review da Meta exige, e quem revisa não tem conta aqui:
   * uma página que redireciona para o login é, para efeito de análise, uma
   * página que não existe. Ela não lê dado nenhum — é texto.
   */
  '/privacidade',
  /**
   * Os termos e as instruções de exclusão de dados, pelo mesmo motivo da
   * política: os três são campos obrigatórios das Configurações Básicas do app
   * na Meta, e quem revisa não tem conta aqui. As três são texto e não leem
   * banco nenhum.
   */
  '/termos',
  '/exclusao-de-dados',
]

/**
 * A página de um fluxo compartilhado (0030).
 *
 * É prefixo e não caminho exato porque o token vem no endereço. E ela é a
 * **única** rota de tela que abre sem sessão nenhuma — a autorização dela não
 * mora aqui: quem decide o que mostrar é `repos/compartilhar.ts`, olhando token,
 * revogação e prazo, e quem decide para onde importar é
 * `acaoImportarFluxoCompartilhado`, que confere o acesso à conta de destino.
 *
 * Com a barra no fim, de propósito: sem ela, uma rota futura chamada
 * `/faturamento` nasceria pública sem ninguém notar.
 */
const PREFIXOS_ABERTOS = [
  '/f/',
  /**
   * Os logos de cliente servidos para o `=IMAGE()` do Google Sheets (ver
   * `public/logos/README.md`).
   *
   * Precisam abrir sem sessão porque quem busca é o servidor do Google, que não
   * tem cookie nenhum. Sem esta linha o arquivo estático cai no matcher e volta
   * um redirecionamento para `/entrar` — a planilha mostra imagem quebrada e o
   * motivo não aparece em lugar nenhum.
   *
   * A primeira tentativa serviu de `/clientes/`, que é justamente o prefixo da
   * área autenticada. O caminho novo não colide com rota de tela nenhuma.
   */
  '/logos/',
]

export async function proxy(req: NextRequest) {
  const caminho = req.nextUrl.pathname

  // Sempre abertas, e **sem redirecionar quem já parece logado**. A tentação é
  // mandar para a raiz quem chega ao `/entrar` com cookie; um cookie vencido faz
  // isso virar laço: a raiz confere de verdade, não encontra sessão, e devolve
  // para cá. Quem decide isso é a própria tela, que lê a sessão.
  if (PORTAS_ABERTAS.includes(caminho)) return NextResponse.next()
  if (PREFIXOS_ABERTOS.some((prefixo) => caminho.startsWith(prefixo))) return NextResponse.next()

  // Presença, não validade. Ver o comentário no topo.
  if (getSessionCookie(req) !== null) return NextResponse.next()

  // Rota de API não redireciona nem renderiza: ela responde status.
  if (caminho.startsWith('/api/')) return new NextResponse('sessão expirada', { status: 401 })

  return NextResponse.redirect(new URL('/entrar', req.nextUrl))
}

export const config = {
  // Três exceções, e as três por quem chama:
  //
  // `robots.txt` **precisa** ser lido por quem não tem sessão — é essa a função
  // dele. Dentro do matcher, o crawler recebia o redirecionamento e nunca via a
  // regra que proíbe indexar.
  //
  // `api/manutencao` é chamada pela tarefa agendada da plataforma, que não tem
  // cookie. Ela se protege com `CRON_SECRET` e falha fechada sem ele.
  //
  // `api/auth` é o próprio login: entrar, sair, trocar de companhia. Exigir
  // sessão para chegar até ele seria exigir sessão para criar uma.
  // `sitemap.xml` entra pelo mesmo motivo que o `robots.txt`: quem o lê é um
  // rastreador sem cookie, e dentro do matcher ele receberia o redirecionamento
  // para `/entrar` em vez da lista de páginas.
  matcher: [
    '/((?!api/auth|api/webhook|api/manutencao|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
