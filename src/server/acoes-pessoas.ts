'use server'

import { conferirTrocaDeFuncao, ehFuncao, PAPEL_DA_FUNCAO, podeAtribuirFuncao, podeGerenciarPessoas } from '@/core/funcoes'
import { autenticacao } from './auth'
import { atorNaOrganizacao, definirFuncaoDoMembro, exigirHierarquia } from './pessoas'
import { registrar } from './repos/auditoria'
import { acharUsuarioPorEmail, papelNaConta } from './repos/usuarios'
import { acharUsuario } from './sessao'

/**
 * As ações da tela Configurações > Pessoas.
 *
 * **Todas passam pela regra de hierarquia no servidor** (plano da
 * administração, §2): esconder o botão na tela não basta, porque a ação é um
 * endpoint que qualquer um da organização alcança. Quem pede precisa estar
 * acima de quem é mexido, e só atribui funções até a sua.
 */

export async function acaoTrocarFuncao(clienteId: string, usuarioId: string, funcao: string): Promise<{ ok: boolean; erro?: string }> {
  if (!ehFuncao(funcao)) return { ok: false, erro: 'essa função não existe' }
  const r = await exigirHierarquia(clienteId, usuarioId)
  if ('ok' in r) return r
  const conferida = conferirTrocaDeFuncao(r.ator, r.alvo, funcao)
  if (!conferida.ok) return { ok: false, erro: conferida.motivo }

  const gravada = await definirFuncaoDoMembro(clienteId, usuarioId, funcao, r.ator.usuarioId)
  if (!gravada.ok) return { ok: false, erro: gravada.motivo }

  const sessao = r.ator.acesso.sessao
  await registrar({
    acao: 'trocou_funcao',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: (await acharUsuario(usuarioId))?.nome ?? '',
    detalhes: { funcao, de: r.alvo.funcao },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true }
}

/**
 * Dá acesso a alguém nesta organização, com uma função até a de quem pede.
 * E-mail que já tem login só é ligado; e-mail novo cria o login com a senha
 * provisória (o mesmo caminho sem SMTP de antes).
 */
export async function acaoDarAcessoNaOrganizacao(
  clienteId: string,
  formData: FormData,
): Promise<{ ok?: boolean; erro?: string; pessoa?: { id: string; nome: string; email: string; funcao: string } }> {
  const ator = await atorNaOrganizacao(clienteId)
  if (!podeGerenciarPessoas(ator)) return { erro: 'só gestor, administrador ou proprietário dá acesso' }

  const email = String(formData.get('email') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const funcao = String(formData.get('funcao') ?? 'atendente')
  if (email === '') return { erro: 'escreva o e-mail' }
  if (!ehFuncao(funcao)) return { erro: 'essa função não existe' }
  if (!podeAtribuirFuncao(ator, funcao)) return { erro: 'você só atribui funções até a sua' }

  const existente = await acharUsuarioPorEmail(email)
  let usuarioId = existente?.id ?? null
  if (usuarioId && (await papelNaConta(clienteId, usuarioId)) !== null) {
    return { erro: 'esta pessoa já está na organização: mude a função dela na tabela' }
  }
  if (!usuarioId) {
    if (nome === '') return { erro: 'escreva o nome de quem vai entrar' }
    if (senha.length < 10) return { erro: 'a senha precisa de pelo menos 10 caracteres' }
    try {
      const criado = await autenticacao().api.signUpEmail({ body: { name: nome, email, password: senha } })
      usuarioId = criado.user.id
    } catch (erro) {
      return { erro: erro instanceof Error ? erro.message : 'não deu para cadastrar' }
    }
  }
  try {
    await autenticacao().api.addMember({ body: { userId: usuarioId, role: PAPEL_DA_FUNCAO[funcao], organizationId: clienteId } })
  } catch (erro) {
    if ((await papelNaConta(clienteId, usuarioId)) === null) return { erro: erro instanceof Error ? erro.message : 'não deu para ligar a pessoa' }
  }
  const r = await definirFuncaoDoMembro(clienteId, usuarioId, funcao, ator.usuarioId)
  if (!r.ok) return { erro: r.motivo }

  const sessao = ator.acesso.sessao
  await registrar({
    acao: 'vinculou_membro',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: existente?.nome ?? nome,
    detalhes: { funcao, cadastrou: existente ? 'nao' : 'sim' },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true, pessoa: { id: usuarioId, nome: existente?.nome ?? nome, email, funcao } }
}
