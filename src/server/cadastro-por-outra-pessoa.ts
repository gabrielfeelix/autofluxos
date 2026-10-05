import 'server-only'
import { cookies } from 'next/headers'
import { autenticacao } from './auth'

/**
 * Cria o login de **outra pessoa** sem trocar a sessão de quem está cadastrando.
 *
 * `signUpEmail` abre a sessão de quem acabou de nascer, e o `nextCookies()`
 * grava esse cookie na resposta da Server Action, sem exceção. Chamado de
 * "Adicionar usuário", isso trocava o administrador pela pessoa nova: em
 * 05/out o dono criou o Rodrigo e passou a navegar como ele, com o selo
 * "você" ao lado do nome dele.
 *
 * Desligar `autoSignIn` no geral não serve: com ele desligado a biblioteca
 * responde sucesso falso para e-mail repetido, e o cadastro público, que entra
 * logo depois de criar, quebraria no login seguinte. Então o cadastro continua
 * o da biblioteca (senha vazada, tamanho, e-mail de confirmação), e aqui só se
 * desfaz o efeito colateral: os cookies de sessão voltam a ser os de antes, e
 * a sessão aberta para a pessoa nova é revogada, já que ninguém tem o token.
 */
export async function cadastrarSemTrocarDeSessao(dados: { nome: string; email: string; senha: string }) {
  const pote = await cookies()
  const contexto = await autenticacao().$context
  const daSessao = Object.values(contexto.authCookies)
  const antes = new Map(daSessao.map((cookie) => [cookie.name, pote.get(cookie.name)?.value]))

  try {
    const criado = await autenticacao().api.signUpEmail({
      body: { name: dados.nome, email: dados.email, password: dados.senha },
    })
    await contexto.internalAdapter.deleteUserSessions(criado.user.id)
    return criado
  } finally {
    for (const cookie of daSessao) {
      const valor = antes.get(cookie.name)
      if (valor === undefined) pote.delete({ name: cookie.name, path: cookie.attributes.path ?? '/' })
      else {
        const { sameSite, ...resto } = cookie.attributes
        pote.set(cookie.name, valor, { ...resto, sameSite: sameSite?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined })
      }
    }
  }
}
