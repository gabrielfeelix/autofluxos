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
import { agendarDescida, agendarPreco, cancelarDescida, congelarPreco, contratoDaConta, definirPlano, organizacoesNoPlano } from './repos/plano'
import { criarPlano, excluirPlano, planosVigentes, salvarPlano, type EdicaoDePlano } from './repos/planos'
import { DIAS_DE_AVISO_DO_PRECO, diaDeHoje, proximaVirada, somarDias } from '@/core/contrato-do-plano'
import { preverTroca, recusaDaTroca, resumoDaTroca, type PrevisaoDaTroca } from './troca-de-plano'
import { ehIdDePlano, ehRecursoDoPlano, idDoNome, PLANO_DE_ENTRADA } from '@/core/planos'
import { CAPACIDADES, ehEscopo, type Politica } from '@/core/permissoes'
import { funcoesVigentes, salvarFuncao } from './repos/funcoes'
import { acharPedido, pedidosDePlano } from './repos/pedidos-de-plano'
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
/** O que muda se a organização for para `plano`, para o modal da administração. */
export async function acaoAdminPreverTroca(
  organizacaoId: string,
  plano: string,
): Promise<{ ok: boolean; erro?: string; previsao?: PrevisaoDaTroca }> {
  await exigirAdminDaPlataforma()
  if (!(await planoExiste(plano))) return { ok: false, erro: 'esse plano não existe' }
  return { ok: true, previsao: await preverTroca(organizacaoId, plano) }
}

async function planoExiste(id: string): Promise<boolean> {
  return ehIdDePlano(id) && (await planosVigentes()).some((plano) => plano.id === id)
}

/**
 * A troca pela administração, pela mesma regra do pedido: número a mais
 * bloqueia, recurso em uso que sai exige ciência, e o motivo vai para a
 * auditoria.
 *
 * **Subida vale na hora; descida, na virada do mês** (seção 8). A descida fica
 * agendada em `clients.plano_agendado`, a passada diária aplica e avisa 7 e 1
 * dia antes. Até lá tudo funciona: é o prazo para salvar e exportar.
 */
export async function acaoAdminTrocarPlano(
  organizacaoId: string,
  plano: string,
  pedidoId?: string,
  confirmacao: { ciente?: boolean; motivo?: string } = {},
): Promise<{ ok: boolean; erro?: string; agendadaPara?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (!(await planoExiste(plano))) return { ok: false, erro: 'esse plano não existe' }
  const organizacao = await acharCliente(organizacaoId)
  if (!organizacao) return { ok: false, erro: 'esta organização não existe mais' }

  const contrato = await contratoDaConta(organizacaoId)
  const de = contrato.plano
  const destino = (await planosVigentes()).find((item) => item.id === plano)!
  const previsao = de !== plano ? await preverTroca(organizacaoId, plano) : null
  const recusa = previsao ? recusaDaTroca(previsao, confirmacao.ciente === true) : null
  if (recusa) return { ok: false, erro: recusa }
  const motivo = String(confirmacao.motivo ?? '').trim().slice(0, 500)
  let agendadaPara: string | undefined
  if (de !== plano) {
    const desce = previsao?.impacto.sentido === 'desce'
    if (desce) {
      agendadaPara = proximaVirada(new Date())
      const r = await agendarDescida(organizacaoId, plano, agendadaPara)
      if (!r.ok) return { ok: false, erro: r.erro }
    } else {
      const r = await definirPlano(organizacaoId, plano, destino.preco)
      if (!r.ok) return { ok: false, erro: r.erro }
    }
    await registrar({
      acao: desce ? 'agendou_descida_de_plano' : 'trocou_plano',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: organizacaoId,
      contaNome: organizacao.nome,
      alvoTipo: 'plano',
      alvoId: plano,
      alvoNome: destino.nome,
      detalhes: {
        de,
        para: plano,
        ...(agendadaPara ? { valeEm: agendadaPara } : { precoContratado: destino.preco }),
        ...(pedidoId ? { pedido: pedidoId } : {}),
        ...(previsao ? resumoDaTroca(previsao) : {}),
        ...(motivo ? { motivo } : {}),
      },
      impersonadoPor: sessao.impersonadoPor,
    })
  } else if (contrato.planoAgendado) {
    // Escolher o plano que já vale desfaz a descida agendada.
    await cancelarDescida(organizacaoId)
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
      detalhes: { pedido: pedidoId, de, para: plano, ...(agendadaPara ? { valeEm: agendadaPara } : {}) },
      impersonadoPor: sessao.impersonadoPor,
    })
  }
  return { ok: true, ...(agendadaPara ? { agendadaPara } : {}) }
}

/** Desfaz a descida agendada: a organização fica no plano de hoje. */
export async function acaoAdminCancelarDescida(organizacaoId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const organizacao = await acharCliente(organizacaoId)
  if (!organizacao) return { ok: false, erro: 'esta organização não existe mais' }
  const contrato = await contratoDaConta(organizacaoId)
  if (!contrato.planoAgendado) return { ok: true }
  const r = await cancelarDescida(organizacaoId)
  if (!r.ok) return r
  await registrar({
    acao: 'cancelou_descida_de_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: organizacaoId,
    contaNome: organizacao.nome,
    alvoTipo: 'plano',
    alvoId: contrato.planoAgendado,
    alvoNome: contrato.planoAgendado,
    detalhes: { plano: contrato.plano, desceriaPara: contrato.planoAgendado, valeria: contrato.planoAgendadoPara },
    impersonadoPor: sessao.impersonadoPor,
  })
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
  /** Reais por conversa acima da faixa. */
  precoExcedente: number
  resumo: string
  itens: string[]
  recursos: string[]
  ativo: boolean
}

/** Edita um plano. Valida tudo antes do banco: a recusa do `check` viria em linguagem de Postgres. */
/** Valida tudo antes do banco: a recusa do `check` viria em linguagem de Postgres. */
function validarPlano(dados: DadosDoPlano): { ok: true; edicao: EdicaoDePlano } | { ok: false; erro: string } {
  const nome = String(dados.nome ?? '').trim()
  if (nome.length < 1 || nome.length > 60) return { ok: false, erro: 'o nome precisa ter de 1 a 60 caracteres' }
  const inteiro = (valor: unknown, minimo: number) => (Number.isInteger(Number(valor)) && Number(valor) >= minimo ? Number(valor) : null)
  const preco = inteiro(dados.preco, 0)
  const conversas = inteiro(dados.conversas, 0)
  const numeros = inteiro(dados.numeros, 1)
  if (preco === null) return { ok: false, erro: 'o preço é um número inteiro de reais, zero ou mais' }
  if (conversas === null) return { ok: false, erro: 'o limite de conversas é um número inteiro, zero ou mais' }
  if (numeros === null) return { ok: false, erro: 'o plano comporta pelo menos 1 número' }
  const precoExcedente = Math.round(Number(dados.precoExcedente) * 100) / 100
  if (!Number.isFinite(precoExcedente) || precoExcedente < 0) return { ok: false, erro: 'o preço do excedente é em reais, zero ou mais' }
  const recursos = (dados.recursos ?? []).filter(ehRecursoDoPlano)
  const itens = (dados.itens ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
  return {
    ok: true,
    edicao: { nome, preco, conversas, numeros, precoExcedente, resumo: String(dados.resumo ?? '').trim(), itens, recursos, ativo: dados.ativo !== false },
  }
}

/**
 * O que fazer com quem já está no plano quando o preço muda (seção 8.1): o
 * preço novo vale para organização nova; para as existentes, manter o antigo
 * (legado) ou aplicar com aviso de 30 dias.
 */
export type PrecoParaQuemJaEsta = 'manter' | 'avisar'

export async function acaoAdminSalvarPlano(
  id: string,
  dados: DadosDoPlano,
  quemJaEsta: PrecoParaQuemJaEsta = 'manter',
): Promise<{ ok: boolean; erro?: string; avisadas?: number }> {
  const sessao = await exigirAdminDaPlataforma()
  const anterior = ehIdDePlano(id) ? (await planosVigentes()).find((plano) => plano.id === id) : undefined
  if (!anterior) return { ok: false, erro: 'esse plano não existe' }
  const validado = validarPlano(dados)
  if (!validado.ok) return validado
  const { nome, preco, conversas, numeros, precoExcedente } = validado.edicao

  /*
   * Antes de mudar o preço, quem está no plano sem preço gravado ganha o de
   * antes: sem isso, o preço novo valeria para eles na hora, que é o que a
   * seção 8.1 proíbe.
   */
  const mudouPreco = preco !== anterior.preco
  if (mudouPreco) await congelarPreco(id, anterior.preco)
  const r = await salvarPlano(id, validado.edicao)
  if (!r.ok) return { ok: false, erro: r.motivo }
  let avisadas = 0
  if (mudouPreco && quemJaEsta === 'avisar') {
    const alvo = (await organizacoesNoPlano(id)).filter((organizacao) => !organizacao.agendada && organizacao.precoContratado !== preco).map((organizacao) => organizacao.id)
    const r2 = await agendarPreco(alvo, preco, somarDias(diaDeHoje(new Date()), DIAS_DE_AVISO_DO_PRECO))
    if (!r2.ok) return { ok: false, erro: r2.erro }
    avisadas = alvo.length
  }
  await registrar({
    acao: 'editou_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'plano',
    alvoId: id,
    alvoNome: nome,
    detalhes: { preco, conversas, numeros, precoExcedente, ativo: dados.ativo !== false, ...(mudouPreco ? { precoAntes: anterior.preco, quemJaEsta, avisadas } : {}) },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true, avisadas }
}

/**
 * Cria um plano (A8), e "Duplicar" é o mesmo com os dados de outro. O id nasce
 * do nome e não muda depois; nome repetido ganha número no fim do id.
 */
export async function acaoAdminCriarPlano(dados: DadosDoPlano): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const validado = validarPlano(dados)
  if (!validado.ok) return validado
  const base = idDoNome(validado.edicao.nome) || 'plano'
  const existentes = new Set((await planosVigentes()).map((plano) => plano.id))
  let id = base
  for (let n = 2; existentes.has(id); n++) id = `${base.slice(0, 36)}-${n}`
  const r = await criarPlano(id, validado.edicao)
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrar({
    acao: 'criou_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'plano',
    alvoId: id,
    alvoNome: validado.edicao.nome,
    detalhes: { preco: validado.edicao.preco, conversas: validado.edicao.conversas, numeros: validado.edicao.numeros, ativo: validado.edicao.ativo },
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true, id }
}

/** O que impede excluir o plano: as organizações nele e os pedidos abertos para ele. */
export async function acaoAdminImpedimentosDoPlano(id: string): Promise<{
  ok: boolean
  erro?: string
  organizacoes?: { id: string; nome: string; agendada: boolean }[]
  pedidos?: number
  motivo?: string | null
}> {
  await exigirAdminDaPlataforma()
  if (!ehIdDePlano(id)) return { ok: false, erro: 'esse plano não existe' }
  const [organizacoes, pedidos, planos] = await Promise.all([organizacoesNoPlano(id), pedidosDePlano({}).catch(() => []), planosVigentes()])
  return {
    ok: true,
    organizacoes: organizacoes.map(({ id: organizacaoId, nome, agendada }) => ({ id: organizacaoId, nome, agendada })),
    pedidos: pedidos.filter((pedido) => pedido.situacao === 'aberto' && pedido.para === id).length,
    motivo: motivoParaNaoExcluir(id, planos),
  }
}

function motivoParaNaoExcluir(id: string, planos: { id: string; ativo: boolean }[]): string | null {
  if (id === PLANO_DE_ENTRADA) return 'É o plano em que organização nova nasce; ele não se exclui. Tire de venda se não quiser vender.'
  if (!planos.some((plano) => plano.id !== id && plano.ativo)) return 'Precisa sobrar pelo menos um plano à venda.'
  return null
}

/**
 * Move todas as organizações de um plano para outro, na hora, para o plano
 * poder ser excluído. **O preço contratado de cada uma não muda**: é o plano
 * que está saindo, não o contrato. Descida agendada para o plano que sai
 * passa a apontar para o destino.
 */
export async function acaoAdminMoverOrganizacoes(de: string, para: string): Promise<{ ok: boolean; erro?: string; movidas?: number }> {
  const sessao = await exigirAdminDaPlataforma()
  if (de === para || !ehIdDePlano(de) || !(await planoExiste(para))) return { ok: false, erro: 'escolha outro plano de destino' }
  const planos = await planosVigentes()
  const origem = planos.find((plano) => plano.id === de)
  const destino = planos.find((plano) => plano.id === para)!
  const organizacoes = await organizacoesNoPlano(de)
  for (const organizacao of organizacoes) {
    if (organizacao.agendada) {
      const contrato = await contratoDaConta(organizacao.id)
      const r = await agendarDescida(organizacao.id, para, contrato.planoAgendadoPara ?? proximaVirada(new Date()))
      if (!r.ok) return { ok: false, erro: r.erro }
    } else {
      const r = await definirPlano(organizacao.id, para, organizacao.precoContratado ?? origem?.preco ?? destino.preco)
      if (!r.ok) return { ok: false, erro: r.erro }
    }
    await registrar({
      acao: 'trocou_plano',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: organizacao.id,
      contaNome: organizacao.nome,
      alvoTipo: 'plano',
      alvoId: para,
      alvoNome: destino.nome,
      detalhes: { de, para, motivo: `o plano ${origem?.nome ?? de} vai ser excluído`, precoMantido: true },
      impersonadoPor: sessao.impersonadoPor,
    })
  }
  return { ok: true, movidas: organizacoes.length }
}

/** Exclui o plano, se nada o prende (A8). */
export async function acaoAdminExcluirPlano(id: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  const impedimentos = await acaoAdminImpedimentosDoPlano(id)
  if (!impedimentos.ok) return { ok: false, erro: impedimentos.erro }
  if (impedimentos.motivo) return { ok: false, erro: impedimentos.motivo }
  const quantas = impedimentos.organizacoes?.length ?? 0
  if (quantas > 0) return { ok: false, erro: `${quantas} ${quantas === 1 ? 'organização está' : 'organizações estão'} neste plano. Mova antes de excluir.` }
  if ((impedimentos.pedidos ?? 0) > 0) return { ok: false, erro: 'há pedido de troca aberto para este plano. Atenda ou recuse antes.' }
  const plano = (await planosVigentes()).find((item) => item.id === id)
  const r = await excluirPlano(id)
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrar({
    acao: 'excluiu_plano',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'plano',
    alvoId: id,
    alvoNome: plano?.nome ?? id,
    detalhes: plano ? { preco: plano.preco, conversas: plano.conversas } : {},
    impersonadoPor: sessao.impersonadoPor,
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Funções (A7)
// ---------------------------------------------------------------------------

/**
 * Edita o que uma função pode. O Proprietário não se edita, e o nível de
 * nenhuma muda: ele é a hierarquia. Vale na hora para todo mundo com a função
 * gravada, em todas as organizações.
 */
export async function acaoAdminSalvarFuncao(id: string, capacidades: Record<string, string>): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (!ehFuncao(id)) return { ok: false, erro: 'essa função não existe' }
  if (id === 'proprietario') return { ok: false, erro: 'o Proprietário pode tudo e não se edita' }
  const politica = {} as Politica
  for (const capacidade of CAPACIDADES) {
    const escopo = capacidades[capacidade]
    if (!escopo || !ehEscopo(escopo)) return { ok: false, erro: 'escopo inválido' }
    politica[capacidade] = escopo
  }
  const atual = (await funcoesVigentes()).porId[id]
  const r = await salvarFuncao(id, { descricao: atual.descricao, capacidades: politica })
  if (!r.ok) return { ok: false, erro: r.motivo }
  await registrar({
    acao: 'editou_funcao',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'funcao',
    alvoId: id,
    alvoNome: atual.nome,
    detalhes: politica,
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
