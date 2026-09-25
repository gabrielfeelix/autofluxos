import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Quem entra no painel.
 *
 * **Uma porta só: `/entrar`, com login por usuário (Better Auth).** A senha
 * única do time, `/login`, `PAINEL_SENHA` e um cookie assinado, foi a porta do
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
 * a porta de primeira execução, se não há usuário nenhum, quem chega nasce
 * administrador da plataforma , e a própria tela é quem fecha isso: a pergunta
 * que a destranca ("não há ninguém?") só tem resposta afirmativa uma vez na vida
 * do sistema. Ver `acoes-conta.ts`.
 */
const PORTAS_ABERTAS = [
  /**
   * A raiz é a **landing pública**, não o painel, o painel mudou para
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
   * O cadastro aberto ao público, a porta de quem chega pelo site.
   *
   * **`/primeiro-acesso` não entra nesta lista, e é de propósito.** Ele é o
   * segundo passo do mesmo cadastro, mas só se alcança já logado: a ação de
   * cadastrar cria a sessão antes de redirecionar para lá. Deixá-lo aberto
   * daria a uma URL digitada à mão uma tela que fala "bem-vindo" para quem não
   * entrou.
   *
   * Não confunda com `/criar-conta`, logo abaixo do comentário do topo: aquele
   * é o cadastro **interno** (primeira execução e administrador cadastrando
   * gente) e continua fora daqui.
   */
  '/cadastrar',
  /**
   * A política de privacidade **precisa** abrir sem sessão.
   *
   * É a URL que o app review da Meta exige, e quem revisa não tem conta aqui:
   * uma página que redireciona para o login é, para efeito de análise, uma
   * página que não existe. Ela não lê dado nenhum, é texto.
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
  /**
   * O service worker do aviso de handoff (0045).
   *
   * **Um service worker redirecionado não registra**, e falha calado: o
   * navegador recusa qualquer resposta que não seja o script em si, e o push
   * simplesmente nunca chega, sem erro em tela, sem erro em log. Foi assim que
   * ele saiu no primeiro deploy desta rodada: `GET /sw-push.js` respondia 307
   * para `/entrar`.
   *
   * É o mesmo problema que o comentário de `/logos/` abaixo descreve, e a
   * mesma correção. O arquivo é estático, não lê sessão nem banco: é código de
   * desenhar notificação. O que ele exibe chega cifrado, e as chaves para
   * decifrar são do navegador de quem assinou.
   */
  '/sw-push.js',
]

/**
 * A página de um fluxo compartilhado (0030).
 *
 * É prefixo e não caminho exato porque o token vem no endereço. E ela é a
 * **única** rota de tela que abre sem sessão nenhuma, a autorização dela não
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
   * **As rotas de retorno do OAuth. Sem isto elas nunca rodam.**
   *
   * Quem chega aqui é o navegador do cliente **voltando do facebook.com**, uma
   * navegação cross-site. O cookie de sessão do Better Auth é `SameSite=Lax`, e
   * `Lax` manda o navegador **não enviar o cookie** num redirect vindo de outro
   * site. Então o `getSessionCookie` abaixo não acha nada, a requisição cai no
   * 401 de `/api/`, e a rota de retorno, que já sabe se defender sozinha ,
   * jamais executa.
   *
   * O sintoma é cruel de diagnosticar porque **tudo parece certo dos dois
   * lados**: a Meta diz "conectado", o cliente vê a tela de sucesso dela, e o
   * nosso banco não tem linha nenhuma. Nem alerta sobra, porque o código que
   * alerta está depois do ponto que nunca é alcançado. Foi exatamente assim que
   * a primeira conexão real falhou, em 13/set/2026.
   *
   * Abrir isto não afrouxa nada, e é por isso que as duas rotas foram escritas
   * como foram: elas conferem o `state` assinado (qual cliente começou) e a
   * sessão (quem está pedindo) por conta própria, nesta ordem, e redirecionam
   * para a tela em vez de responder JSON. Ver o cabeçalho de
   * `api/whatsapp/retorno/route.ts`.
   */
  '/api/whatsapp/retorno',
  '/api/instagram/retorno',
  '/api/anuncios/retorno',
  // O mesmo caso, voltando da Nuvemshop (F4): `state` assinado mais sessão.
  '/api/loja/nuvemshop/retorno',
  /**
   * **Os webhooks da Meta. Mesmo bug das rotas de retorno, e custou o Inbox.**
   *
   * Quem chama aqui é o **servidor da Meta**, que não tem cookie nenhum, nunca
   * teve e nunca vai ter. Sem esta linha o `getSessionCookie` não acha nada, a
   * requisição cai no 401 de `/api/`, e a rota jamais executa.
   *
   * O sintoma foi o de 13/set: o número do cliente conectado e ativo, a WABA
   * inscrita no app, `messages` assinado no painel, e **nada chegando no
   * Inbox**. Tudo certo dos dois lados, e o proxy comendo a mensagem no meio.
   *
   * Um `curl -X POST` contra a URL do webhook devolvia `401` em produção: é o
   * teste de trinta segundos que prova isto, e vale mais que qualquer tela de
   * configuração da Meta dizendo "assinado".
   *
   * Não afrouxa nada. Estas rotas se defendem sozinhas pela **assinatura
   * `X-Hub-Signature-256`**, que é o mecanismo certo aqui: sessão de usuário
   * não existe nesta chamada, e exigir uma só garante que ela nunca aconteça.
   */
  '/api/webhook/',
  /**
   * Os logos de cliente servidos para o `=IMAGE()` do Google Sheets (ver
   * `public/logos/README.md`).
   *
   * Precisam abrir sem sessão porque quem busca é o servidor do Google, que não
   * tem cookie nenhum. Sem esta linha o arquivo estático cai no matcher e volta
   * um redirecionamento para `/entrar`, a planilha mostra imagem quebrada e o
   * motivo não aparece em lugar nenhum.
   *
   * A primeira tentativa serviu de `/clientes/`, que é justamente o prefixo da
   * área autenticada. O caminho novo não colide com rota de tela nenhuma.
   */
  /**
   * **A conversa da vitrine. Sem isto o fluxo compartilhado nunca responde.**
   *
   * Terceira vez o mesmo bug neste arquivo, e o terceiro sintoma idêntico: a
   * página `/f/` abre, o fluxo aparece, o visitante escreve, e não volta nada.
   * A tela sem sessão chama `/api/simular/compartilhado`, o `getSessionCookie`
   * não acha cookie nenhum porque quem abriu o link não tem conta, e o 401 de
   * `/api/` come a chamada antes de a rota existir.
   *
   * Pior: o 401 responde `text/plain`, então o `resposta.json()` da tela falha
   * e o motivo vira uma frase genérica, e essa frase é um item de sistema, que
   * o modo Conversa esconde. Erro invisível numa página pública, descoberto
   * porque alguém testou o link e perguntou "deveria responder?".
   *
   * O teste de trinta segundos que prova isto, o mesmo dos webhooks:
   *
   *     curl -s -o /dev/null -w '%{http_code}\n' -X POST \
   *       https://autofluxos.4yu.com.br/api/simular/compartilhado
   *
   * 401 quer dizer que o proxy está comendo; qualquer outra coisa quer dizer
   * que a rota rodou e se defendeu sozinha.
   *
   * Abrir não afrouxa nada, e a rota foi escrita para isso: ela não aceita
   * fluxo no corpo (o desenho vem do banco, pelo token), não resolve cliente
   * nenhum, roda com a rede fechada e tem teto de mensagens **por link**, que
   * é o que a conta de origem revoga quando quiser. Ver o cabeçalho de
   * `api/simular/compartilhado/route.ts`.
   *
   * O prefixo é o caminho inteiro, sem barra no fim: `/api/simular` continua
   * fechada, que é a rota que aceita fluxo do corpo.
   */
  '/api/simular/compartilhado',
  /**
   * O chat do site: o script do balão e a API que ele chama, do navegador de
   * um visitante da loja, que nunca terá sessão aqui.
   *
   * Não afrouxa nada: as rotas conferem sozinhas o `Origin` contra os domínios
   * do canal, o segredo do visitante e o limite por IP. Ver
   * `app/api/site/[chave]/`.
   */
  '/api/site/',
  // O script do balão, em `public/chat/`: a loja o carrega sem sessão nenhuma.
  '/chat/',
  '/logos/',
  /**
   * O ícone da aba do navegador.
   *
   * O App Router serve `src/app/icon.png` em `/icon.png` (e o da Apple em
   * `/apple-icon.png`), são rotas, não arquivos de `public/`, então o matcher
   * as pega e quem não tem sessão recebe um redirecionamento para `/entrar` no
   * lugar da imagem. O resultado é a **tela de login sem ícone**, que é
   * justamente a primeira tela que qualquer pessoa vê.
   *
   * `favicon.ico` já estava fora do matcher pelo mesmo motivo; estes dois
   * nasceram depois e não foram junto.
   *
   * Abrir não expõe nada: é a marca do produto, que também está na landing.
   */
  '/icon.png',
  '/apple-icon.png',
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
  // `robots.txt` **precisa** ser lido por quem não tem sessão, é essa a função
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
