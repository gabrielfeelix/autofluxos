import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { COOKIE_PAINEL, criarSessao, segredoDeSessao } from './lib/painel-auth'
import { proxy } from './proxy'

/**
 * As duas portas do painel, e quem cada uma abre.
 *
 * O que se testa aqui é **a decisão**, não a autorização: o proxy só resolve se
 * a requisição segue. Quem confere de verdade é `server/sessao.ts`, e é por isso
 * que um cookie do Better Auth qualquer passa por aqui — ele morre no
 * `getSession` da tela seguinte, e é lá que isso é testado.
 *
 * Estes testes existem porque a mudança tem um jeito conhecido de dar errado:
 * abrir para a sessão nova alguma coisa que a senha única fechava, ou fechar
 * para a senha única alguma coisa que ela abria.
 */
const SENHA = 'senha-de-teste-do-painel'
const COOKIE_DO_USUARIO = 'better-auth.session_token=qualquer-coisa-assinada'

const senhaAntes = process.env.PAINEL_SENHA
const segredoAntes = process.env.PAINEL_SEGREDO

beforeEach(() => {
  process.env.PAINEL_SENHA = SENHA
  process.env.PAINEL_SEGREDO = 'segredo-de-teste'
})

afterEach(() => {
  if (senhaAntes === undefined) delete process.env.PAINEL_SENHA
  else process.env.PAINEL_SENHA = senhaAntes
  if (segredoAntes === undefined) delete process.env.PAINEL_SEGREDO
  else process.env.PAINEL_SEGREDO = segredoAntes
})

function pedir(caminho: string, cookie = ''): NextRequest {
  return new NextRequest(`https://painel.exemplo/${caminho.replace(/^\//, '')}`, {
    headers: cookie ? { cookie } : {},
  })
}

async function cookieDoPainel(): Promise<string> {
  return `${COOKIE_PAINEL}=${await criarSessao(segredoDeSessao(SENHA))}`
}

/** `NextResponse.next()` não redireciona nem responde: é "siga". */
function seguiu(resposta: Response): boolean {
  return resposta.status === 200 && resposta.headers.get('location') === null
}

function destinoDe(resposta: Response): string | null {
  const destino = resposta.headers.get('location')
  return destino ? new URL(destino).pathname : null
}

describe('as portas do painel', () => {
  it('deixa /entrar aberta — é a tela de quem ainda não entrou', async () => {
    expect(seguiu(await proxy(pedir('/entrar')))).toBe(true)
  })

  it('não deixa /criar-conta aberta, e este é o teste que mais importa aqui', async () => {
    // Ela abre a porta de primeira execução: sem usuário nenhum, quem chega
    // nasce administrador da plataforma. Pública, isso é qualquer um na
    // internet virando administrador do painel.
    expect(destinoDe(await proxy(pedir('/criar-conta')))).toBe('/login')
    expect(seguiu(await proxy(pedir('/criar-conta', await cookieDoPainel())))).toBe(true)
  })

  it('não redireciona quem chega ao /entrar com cookie', async () => {
    // Um cookie vencido viraria laço: a raiz confere de verdade, não encontra
    // sessão e devolve para cá. Quem decide isso é a tela, que lê a sessão.
    expect(seguiu(await proxy(pedir('/entrar', COOKIE_DO_USUARIO)))).toBe(true)
  })

  it('manda quem não tem nada para o login enquanto a senha única existir', async () => {
    // Mandar o operador de hoje para uma tela onde a senha dele não funciona
    // seria trocar "expirou" por "quebrou".
    expect(destinoDe(await proxy(pedir('/clientes/abc')))).toBe('/login')
  })

  it('manda para /entrar quando não existe senha única', async () => {
    // Fora de produção o painel segue aberto sem senha nenhuma, para quem
    // clonou o repositório e ainda não tem credencial — daí precisar fingir
    // produção aqui. `NODE_ENV` é somente leitura para o TypeScript; `stubEnv`
    // é o caminho do Vitest e desfaz sozinho.
    delete process.env.PAINEL_SENHA
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(destinoDe(await proxy(pedir('/clientes/abc')))).toBe('/entrar')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('a sessão do painel continua abrindo tudo, como antes', async () => {
    const cookie = await cookieDoPainel()
    expect(seguiu(await proxy(pedir('/', cookie)))).toBe(true)
    expect(seguiu(await proxy(pedir('/clientes/abc', cookie)))).toBe(true)
    expect(seguiu(await proxy(pedir('/api/simular', cookie)))).toBe(true)
  })

  it('Basic Auth continua valendo — havia acesso já configurado com ele', async () => {
    const req = new NextRequest('https://painel.exemplo/clientes/abc', {
      headers: { authorization: `Basic ${btoa(`painel:${SENHA}`)}` },
    })
    expect(seguiu(await proxy(req))).toBe(true)
  })

  it('a sessão de usuário abre o painel, inclusive o simulador', async () => {
    // O simulador ficou fechado enquanto o `fluxoId` de qualquer cliente
    // resolvia a credencial daquele cliente. A rota confere o dono agora.
    expect(seguiu(await proxy(pedir('/clientes/abc', COOKIE_DO_USUARIO)))).toBe(true)
    expect(seguiu(await proxy(pedir('/api/simular', COOKIE_DO_USUARIO)))).toBe(true)
  })

  it('API sem credencial nenhuma responde 401, e não redireciona', async () => {
    const resposta = await proxy(pedir('/api/clientes/abc/leads/csv'))
    expect(resposta.status).toBe(401)
  })

  it('quem já tem sessão do painel não vê a tela de login de novo', async () => {
    expect(destinoDe(await proxy(pedir('/login', await cookieDoPainel())))).toBe('/')
  })

  it('cookie do painel adulterado não vale', async () => {
    const bom = await criarSessao(segredoDeSessao(SENHA))
    const ruim = `${COOKIE_PAINEL}=${bom.slice(0, -1)}0`
    expect(destinoDe(await proxy(pedir('/clientes/abc', ruim)))).toBe('/login')
  })
})
