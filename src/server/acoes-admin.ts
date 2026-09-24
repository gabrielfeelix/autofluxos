'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { acaoRemoverLogo, acaoSalvarCadastro, acaoSalvarLogo } from './acoes'
import { registrar } from './repos/auditoria'
import { acharCliente } from './repos/clientes'
import { definirSuspensao } from './repos/organizacoes'
import { pendenciasDoMembro } from './repos/equipes'
import { acharUsuarioPorEmail, papelNaConta, removerComDestino } from './repos/usuarios'
import { acharUsuario, exigirAdminDaPlataforma } from './sessao'
import { autenticacao } from './auth'
import { definirFuncaoDoMembro } from './pessoas'
import { definirPlano, planoDaConta } from './repos/plano'
import { planoVigente, salvarPlano } from './repos/planos'
import { ehRecursoDoPlano } from '@/core/planos'
import { acharPedido } from './repos/pedidos-de-plano'
import { ehFuncao, PAPEL_DA_FUNCAO, type IdDaFuncao } from '@/core/funcoes'

/**
 * As ações da administração da plataforma.
 *
 * **Toda ação aqui começa por `exigirAdminDaPlataforma()`**, mesmo quando o
 * layout de `/admin` já conferiu: layout não roda de novo na navegação, e
 * ação de servidor é um endpoint que qualquer um alcança com o id certo. A
 * conferência mora na ação, e não só na tela.
 *
 * Quando a mesma operação já existe para a organização (cadastro, logo), a
 * ação daqui confere a plataforma e delega: a regra de negócio fica num lugar
 * só, e o que muda é quem pode pedir e o rastro na auditoria.
 */

export async function acaoAdminSalvarCadastro(
  organizacaoId: string,
  estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const sessao = await exigirAdminDaPlataforma()
  const r = await acaoSalvarCadastro(organizacaoId, estado, formData)
  if (r.ok) {
    await registrar({
      acao: 'editou_organizacao',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: organizacaoId,
      alvoTipo: 'client',
      alvoId: organizacaoId,
      alvoNome: String(formData.get('nome') ?? ''),
    })
    revalidatePath('/admin/organizacoes')
  }
  return r
}

export async function acaoAdminSalvarLogo(
  organizacaoId: string,
  estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAdminDaPlataforma()
  return acaoSalvarLogo(organizacaoId, estado, formData)
}

export async function acaoAdminRemoverLogo(organizacaoId: string): Promise<void> {
  await exigirAdminDaPlataforma()
  await acaoRemoverLogo(organizacaoId)
}

/**
 * Suspende ou reativa a organização.
 *
 * Suspensa, ninguém da organização entra (a conferência mora em
 * `conferirAcessoAoCliente`), e o suporte 4YU continua entrando, porque é ele
 * quem resolve. O bot e os canais não são desligados aqui: suspensão é sobre
 * acesso ao painel, e parar atendimento em conversa viva é outra decisão.
 */
export async function acaoAdminSuspender(
  organizacaoId: string,
  suspender: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const organizacao = await acharCliente(organizacaoId)
  if (!organizacao) return { ok: false, erro: 'esta organização não existe mais' }

  const r = await definirSuspensao(organizacaoId, suspender)
  if (!r.ok) return { ok: false, erro: r.motivo }

  await registrar({
    acao: suspender ? 'suspendeu_organizacao' : 'reativou_organizacao',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: organizacaoId,
    alvoTipo: 'client',
    alvoId: organizacaoId,
    alvoNome: organizacao.nome,
  })
  revalidatePath('/admin/organizacoes')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Pessoas de uma organização, pela administração
// ---------------------------------------------------------------------------

async function registrarTroca(
  sessao: Awaited<ReturnType<typeof exigirAdminDaPlataforma>>,
  organizacaoId: string,
  usuarioId: string,
  funcao: IdDaFuncao,
) {
  await registrar({
    acao: 'trocou_funcao',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: organizacaoId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: (await acharUsuario(usuarioId))?.nome ?? '',
    detalhes: { funcao },
    impersonadoPor: sessao.impersonadoPor,
  })
}

/** O suporte está fora da escada (nível 5): troca qualquer função, inclusive a posse. */
export async function acaoAdminDefinirFuncao(
  organizacaoId: string,
  usuarioId: string,
  funcao: string,
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (!ehFuncao(funcao)) return { ok: false, erro: 'essa função não existe' }
  if ((await papelNaConta(organizacaoId, usuarioId)) === null) return { ok: false, erro: 'esta pessoa não está nesta organização' }

  const r = await definirFuncaoDoMembro(organizacaoId, usuarioId, funcao, sessao.usuario.id)
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrarTroca(sessao, organizacaoId, usuarioId, funcao)
  return { ok: true }
}

export async function acaoAdminPendencias(organizacaoId: string, usuarioId: string) {
  await exigirAdminDaPlataforma()
  return { ok: true, ...(await pendenciasDoMembro(organizacaoId, usuarioId)) }
}

export async function acaoAdminRemoverPessoa(
  organizacaoId: string,
  usuarioId: string,
  destino: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const r = await removerComDestino(organizacaoId, usuarioId, destino)
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrar({
    acao: 'removeu_membro',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: organizacaoId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: (await acharUsuario(usuarioId))?.nome ?? '',
    impersonadoPor: sessao.impersonadoPor,
  })
  revalidatePath('/admin/organizacoes')
  return { ok: true }
}

/**
 * Dá acesso a alguém: e-mail que já existe é ligado à organização; e-mail
 * novo cadastra a pessoa com a senha provisória digitada aqui (o mesmo
 * caminho de Configurações > Pessoas, sem SMTP).
 */
export async function acaoAdminDarAcesso(
  organizacaoId: string,
  formData: FormData,
): Promise<ResultadoDoAcesso> {
  const sessao = await exigirAdminDaPlataforma()
  const email = String(formData.get('email') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const funcao = String(formData.get('funcao') ?? 'atendente')
  if (email === '') return { erro: 'escreva o e-mail' }
  if (!ehFuncao(funcao)) return { erro: 'essa função não existe' }
  if (!(await acharCliente(organizacaoId))) return { erro: 'esta organização não existe mais' }

  const existente = await acharUsuarioPorEmail(email)
  let usuarioId = existente?.id ?? null
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

  if ((await papelNaConta(organizacaoId, usuarioId)) === null) {
    try {
      await autenticacao().api.addMember({ body: { userId: usuarioId, role: PAPEL_DA_FUNCAO[funcao], organizationId: organizacaoId } })
    } catch (erro) {
      if ((await papelNaConta(organizacaoId, usuarioId)) === null) {
        return { erro: erro instanceof Error ? erro.message : 'não deu para ligar a pessoa à organização' }
      }
    }
  }
  const r = await definirFuncaoDoMembro(organizacaoId, usuarioId, funcao, sessao.usuario.id)
  if (!r.ok) return { erro: r.motivo }

  await registrar({
    acao: 'vinculou_membro',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: organizacaoId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: existente?.nome ?? nome,
    detalhes: { funcao, cadastrou: existente ? 'nao' : 'sim' },
    impersonadoPor: sessao.impersonadoPor,
  })
  revalidatePath('/admin/usuarios')
  return { ok: true, pessoa: { id: usuarioId, nome: existente?.nome ?? nome, email, funcao } }
}

// ---------------------------------------------------------------------------
// Plano da organização e pedidos de troca
// ---------------------------------------------------------------------------

/**
 * Troca o plano da organização (grava `clients.plano`) e, quando vem de um
 * pedido, fecha o pedido como atendido. As duas coisas vão para a auditoria.
 */
export async function acaoAdminTrocarPlano(
  organizacaoId: string,
  plano: string,
  pedidoId?: string,
): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (plano !== 'essencial' && plano !== 'operacao' && plano !== 'escala') return { ok: false, erro: 'esse plano não existe' }
  const organizacao = await acharCliente(organizacaoId)
  if (!organizacao) return { ok: false, erro: 'esta organização não existe mais' }

  const de = await planoDaConta(organizacaoId)
  const destino = await planoVigente(plano)
  if (de !== plano) {
    const r = await definirPlano(organizacaoId, plano)
    if (!r.ok) return { ok: false, erro: r.erro }
    await registrar({
      acao: 'trocou_plano',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: organizacaoId,
      contaNome: organizacao.nome,
      alvoTipo: 'plano',
      alvoId: plano,
      alvoNome: destino.nome,
      detalhes: { de, para: plano, ...(pedidoId ? { pedido: pedidoId } : {}) },
      impersonadoPor: sessao.impersonadoPor,
    })
  }
  if (pedidoId) {
    await registrar({
      acao: 'atendeu_pedido_de_plano',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: organizacaoId,
      contaNome: organizacao.nome,
      alvoTipo: 'pedido',
      alvoId: pedidoId,
      alvoNome: destino.nome,
      detalhes: { pedido: pedidoId, de, para: plano },
      impersonadoPor: sessao.impersonadoPor,
    })
  }
  revalidatePath('/admin/organizacoes')
  return { ok: true }
}

export async function acaoAdminRecusarPedido(pedidoId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const pedido = await acharPedido(pedidoId)
  if (!pedido) return { ok: false, erro: 'esse pedido não existe' }
  if (pedido.situacao !== 'aberto') return { ok: false, erro: 'esse pedido já foi respondido' }
  await registrar({
    acao: 'recusou_pedido_de_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: pedido.organizacaoId,
    contaNome: pedido.organizacaoNome,
    alvoTipo: 'pedido',
    alvoId: pedidoId,
    alvoNome: pedido.para,
    detalhes: { pedido: pedidoId, de: pedido.de, para: pedido.para },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Planos editáveis (A6)
// ---------------------------------------------------------------------------

export type DadosDoPlano = {
  nome: string
  preco: number
  conversas: number
  numeros: number
  resumo: string
  itens: string[]
  recursos: string[]
  ativo: boolean
}

/** Edita um plano. Valida tudo antes do banco: a recusa do `check` viria em linguagem de Postgres. */
export async function acaoAdminSalvarPlano(id: string, dados: DadosDoPlano): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (id !== 'essencial' && id !== 'operacao' && id !== 'escala') return { ok: false, erro: 'esse plano não existe' }
  const nome = String(dados.nome ?? '').trim()
  if (nome.length < 1 || nome.length > 60) return { ok: false, erro: 'o nome precisa ter de 1 a 60 caracteres' }
  const inteiro = (valor: unknown, minimo: number) => (Number.isInteger(Number(valor)) && Number(valor) >= minimo ? Number(valor) : null)
  const preco = inteiro(dados.preco, 0)
  const conversas = inteiro(dados.conversas, 0)
  const numeros = inteiro(dados.numeros, 1)
  if (preco === null) return { ok: false, erro: 'o preço é um número inteiro de reais, zero ou mais' }
  if (conversas === null) return { ok: false, erro: 'o limite de conversas é um número inteiro, zero ou mais' }
  if (numeros === null) return { ok: false, erro: 'o plano comporta pelo menos 1 número' }
  const recursos = (dados.recursos ?? []).filter(ehRecursoDoPlano)
  const itens = (dados.itens ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 20)

  const r = await salvarPlano(id, { nome, preco, conversas, numeros, resumo: String(dados.resumo ?? '').trim(), itens, recursos, ativo: dados.ativo !== false })
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrar({
    acao: 'editou_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'plano',
    alvoId: id,
    alvoNome: nome,
    detalhes: { preco, conversas, numeros, ativo: dados.ativo !== false },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Usuários (logins) da plataforma
// ---------------------------------------------------------------------------

export type OperacaoDeUsuario = 'tornar_admin' | 'tirar_admin' | 'suspender' | 'devolver' | 'derrubar_sessoes'

/**
 * Uma operação sobre um login, para a tabela de Usuários.
 *
 * Devolve o resultado em vez de revalidar a tela: a linha já mudou na hora
 * (ação otimista) e só volta se isto recusar.
 */
export async function acaoAdminUsuario(usuarioId: string, operacao: OperacaoDeUsuario): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (usuarioId === sessao.usuario.id && operacao !== 'derrubar_sessoes') {
    return { ok: false, erro: 'isso não se faz com o próprio login' }
  }
  const alvo = await acharUsuario(usuarioId)
  if (!alvo) return { ok: false, erro: 'este login não existe mais' }

  const api = autenticacao().api
  const comHeaders = { headers: await headers() }
  try {
    if (operacao === 'tornar_admin' || operacao === 'tirar_admin') {
      await api.setRole({ ...comHeaders, body: { userId: usuarioId, role: operacao === 'tornar_admin' ? 'admin' : 'user' } })
    } else if (operacao === 'suspender') {
      await api.banUser({ ...comHeaders, body: { userId: usuarioId } })
    } else if (operacao === 'devolver') {
      await api.unbanUser({ ...comHeaders, body: { userId: usuarioId } })
    } else {
      await api.revokeUserSessions({ ...comHeaders, body: { userId: usuarioId } })
    }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para fazer isso' }
  }

  const acao = {
    tornar_admin: 'trocou_papel',
    tirar_admin: 'trocou_papel',
    suspender: 'suspendeu_acesso',
    devolver: 'devolveu_acesso',
    derrubar_sessoes: 'revogou_sessoes',
  }[operacao]
  await registrar({
    acao,
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: alvo.nome,
    detalhes: operacao.endsWith('_admin') ? { papelDePlataforma: operacao === 'tornar_admin' ? 'admin' : 'user' } : {},
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true }
}

/** O que "dar acesso" devolve: a pessoa, para a tabela pôr a linha sem recarregar. */
export type ResultadoDoAcesso = EstadoSalvar & { pessoa?: { id: string; nome: string; email: string; funcao: string } }
