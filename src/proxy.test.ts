import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

/**
 * A porta do painel, e ela é **uma só**.
 *
 * A senha única do time saiu com a rota `/login`, e estes testes existem pelo
 * motivo de sempre: a mudança tem um jeito conhecido de dar errado, que é abrir
 * alguma coisa que estava fechada — ou fechar o que precisa ficar aberto, como
 * o link de fluxo compartilhado.
 *
 * O que se testa aqui é **a decisão**, não a autorização: o proxy só resolve se
 * a requisição segue. Quem confere de verdade é `server/sessao.ts`, e é por isso
 * que um cookie qualquer do Better Auth passa por aqui — ele morre no
 * `getSession` da tela seguinte, e é lá que isso é testado.
 */
const COOKIE_DO_USUARIO = 'better-auth.session_token=qualquer-coisa-assinada'

function pedir(caminho: string, cookie = ''): NextRequest {
  return new NextRequest(`https://painel.exemplo/${caminho.replace(/^\//, '')}`, {
    headers: cookie ? { cookie } : {},
  })
}

/** `NextResponse.next()` não redireciona nem responde: é "siga". */
function seguiu(resposta: Response): boolean {
  return resposta.status === 200 && resposta.headers.get('location') === null
}

function destinoDe(resposta: Response): string | null {
  const destino = resposta.headers.get('location')
  return destino ? new URL(destino).pathname : null
}

describe('a porta do painel', () => {
  it('deixa /entrar aberta — é a tela de quem ainda não entrou', async () => {
    expect(seguiu(await proxy(pedir('/entrar')))).toBe(true)
  })

  it('não redireciona quem chega ao /entrar com cookie', async () => {
    // Um cookie vencido viraria laço: a raiz confere de verdade, não encontra
    // sessão e devolve para cá. Quem decide isso é a tela, que lê a sessão.
    expect(seguiu(await proxy(pedir('/entrar', COOKIE_DO_USUARIO)))).toBe(true)
  })

  it('não deixa /criar-conta aberta, e este é o teste que mais importa aqui', async () => {
    // Ela abre a porta de primeira execução: sem usuário nenhum, quem chega
    // nasce administrador da plataforma. Pública, isso é qualquer um na
    // internet virando administrador antes do dono.
    expect(destinoDe(await proxy(pedir('/criar-conta')))).toBe('/entrar')
    expect(seguiu(await proxy(pedir('/criar-conta', COOKIE_DO_USUARIO)))).toBe(true)
  })

  it('manda quem não tem sessão para /entrar', async () => {
    expect(destinoDe(await proxy(pedir('/clientes/abc')))).toBe('/entrar')
    expect(destinoDe(await proxy(pedir('/')))).toBe('/entrar')
  })

  it('deixa passar quem traz o cookie do Better Auth', async () => {
    expect(seguiu(await proxy(pedir('/clientes/abc', COOKIE_DO_USUARIO)))).toBe(true)
  })

  it('a senha única não abre mais nada — a rota /login não existe', async () => {
    // O teste que prova a remoção: enquanto ela existia, `/login` era a única
    // rota que respondia sem cookie. Hoje ela é uma rota como outra qualquer, e
    // como qualquer outra vai para `/entrar`.
    expect(destinoDe(await proxy(pedir('/login')))).toBe('/entrar')
  })

  it('rota de API sem sessão responde 401, e não redireciona', async () => {
    // Redirecionar um `fetch` devolve o HTML do login com status 200, e quem
    // chamou trata como sucesso.
    const resposta = await proxy(pedir('/api/clientes/abc/inbox/alertas'))
    expect(resposta.status).toBe(401)
  })

  it('deixa /f/<token> aberta — é o link de fluxo compartilhado', async () => {
    // A única tela do sistema que abre sem sessão nenhuma. Atrás do login ela
    // não teria função: o ponto do link é chegar a quem não tem conta aqui.
    expect(seguiu(await proxy(pedir('/f/abc123')))).toBe(true)
  })

  it('a abertura do /f/ é de prefixo, e não pega vizinho parecido', async () => {
    // `startsWith('/f/')` e não `startsWith('/f')`: sem a barra, uma rota futura
    // chamada `/faturamento` nasceria pública sem ninguém notar.
    expect(destinoDe(await proxy(pedir('/faturamento')))).toBe('/entrar')
  })
})
