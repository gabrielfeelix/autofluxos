import 'server-only'
import {
  acessoDa4yu,
  mensalidadeConfigurada,
  atualizarValor,
  cancelarAssinatura,
  criarAssinatura,
  garantirAviso,
  garantirClienteNoAsaas,
  detalheDaFatura,
  lerFatura,
  lerNotaFiscal,
  linkDaProximaFatura,
  type DetalheDaFatura,
} from '@/channels/asaas-da-4yu'
import { diaEmSaoPaulo } from '@/channels/pagamento'
import { diaPorExtenso, proximaVirada } from '@/core/contrato-do-plano'
import { descricaoDaAssinatura, documentoParaAsaas, reaisDeCentavos, valorDaAssinatura } from '@/core/mensalidade-da-4yu'
import type { CicloDeCobranca, IdDoPlano } from '@/core/planos'
import { alertar } from './alertar'
import { avisarSuspensao } from './avisos-por-email'
import { registrar } from './repos/auditoria'
import { acharCliente, completarDadosDeCobranca } from './repos/clientes'
import {
  asaasIdDaFatura,
  assinaturaDaConta,
  contaDaFatura,
  gravarAssinatura,
  gravarFatura,
  gravarNotaFiscal,
  temFaturaVencida,
} from './repos/faturas-da-conta'
import { definirSuspensao } from './repos/organizacoes'
import { agendarDescida, definirPlano, planoDaConta, tamanhoDaEquipe } from './repos/plano'
import { planoVigente } from './repos/planos'

/**
 * A mensalidade do AutoFluxos pelo Asaas da 4YU (docs/PLANO-MENSALIDADE-ASAAS.md).
 *
 * **O plano muda pelo aviso, nunca pelo clique.** Assinar cria a assinatura e
 * devolve a página de pagamento do Asaas; `clients.plano` só troca quando o
 * pagamento entra e o Asaas avisa. Quem fecha a aba sem pagar continua no
 * plano em que estava.
 */

/**
 * O botão Assinar aparece para esta pessoa?
 *
 * Sem chave, para ninguém. Com a chave do **sandbox**, só para o
 * administrador da 4YU: é assim que o ciclo é provado em produção sem um
 * cliente de verdade assinar contra o ambiente de teste e achar que pagou.
 */
export function mensalidadeLiberada(adminDa4yu: boolean): boolean {
  if (!mensalidadeConfigurada()) return false
  try {
    return acessoDa4yu().ambiente === 'producao' || adminDa4yu
  } catch {
    return false
  }
}

/** De onde o Asaas chama o aviso: a produção, ou o endereço local configurado. */
export function origemDoAviso(): string {
  return process.env.VERCEL_ENV === 'production' ? 'https://autofluxos.4yu.com.br' : (process.env.BETTER_AUTH_URL ?? '')
}

/** Para onde o Asaas manda o e-mail quando o aviso falha. */
const EMAIL_DO_AVISO = 'contato@4yu.com.br'

export type ResultadoDeAssinar =
  | { ok: true; link: string | null }
  /** `falta`: a tela pede o dado ali mesmo, em vez de mandar a pessoa a outra página. */
  | { ok: false; erro: string; falta?: ('documento' | 'email')[] }

export async function assinar(
  clienteId: string,
  planoId: IdDoPlano,
  ciclo: CicloDeCobranca,
  /** `https://autofluxos.4yu.com.br`: de onde o Asaas chama o aviso. */
  origem: string,
  /** O que a pessoa preencheu no modal, quando faltava no cadastro. */
  dados: { documento?: string; email?: string } = {},
): Promise<ResultadoDeAssinar> {
  const conta = await acharCliente(clienteId)
  if (!conta) return { ok: false, erro: 'organização não encontrada' }
  if (dados.documento !== undefined && !documentoParaAsaas(dados.documento)) {
    return { ok: false, erro: 'o CNPJ precisa ter 14 números, ou o CPF 11', falta: ['documento'] }
  }
  if (dados.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) {
    return { ok: false, erro: 'confira o e-mail', falta: ['email'] }
  }
  await completarDadosDeCobranca(clienteId, { cnpj: dados.documento, email: dados.email })
  const documento = documentoParaAsaas(dados.documento ?? conta.cnpj)
  const email = (dados.email ?? conta.email).trim()
  const falta = [...(documento ? [] : (['documento'] as const)), ...(email ? [] : (['email'] as const))]
  if (falta.length > 0) return { ok: false, erro: 'faltam dados para emitir a cobrança e a nota fiscal', falta }

  const plano = await planoVigente(planoId)
  if (plano.id !== planoId || !plano.ativo) return { ok: false, erro: 'esse plano não existe' }
  const valor = valorDaAssinatura(plano, ciclo, await tamanhoDaEquipe(clienteId))
  if (valor === null) return { ok: false, erro: `o plano ${plano.nome} não tem pagamento anual` }
  const descricao = descricaoDaAssinatura(plano, ciclo, await tamanhoDaEquipe(clienteId))

  await garantirAviso(origem, EMAIL_DO_AVISO)
  const atual = await assinaturaDaConta(clienteId)
  const clienteAsaas =
    atual?.clienteAsaas ??
    (await garantirClienteNoAsaas({ clienteId, nome: conta.nome, documento: documento!, email }))

  let assinaturaRef = atual?.assinaturaRef ?? null
  let link: string | null
  if (assinaturaRef) {
    // Já assina: clicar de novo troca o valor e o ciclo, sem segunda assinatura.
    await atualizarValor(assinaturaRef, valor, { ciclo, descricao })
    link = await linkDaProximaFatura(assinaturaRef)
  } else {
    const criada = await criarAssinatura({
      clienteAsaas,
      clienteId,
      valorCentavos: valor,
      ciclo,
      primeiroVencimento: diaEmSaoPaulo(new Date()),
      descricao,
    })
    assinaturaRef = criada.assinaturaId
    link = criada.link
  }

  await gravarAssinatura(clienteId, {
    clienteAsaas,
    assinaturaRef,
    estado: atual?.estado === 'ativa' ? 'ativa' : 'aguardando',
    plano: plano.id,
    ciclo,
  })
  await registrar({
    acao: 'assinou_plano',
    contaId: clienteId,
    contaNome: conta.nome,
    alvoTipo: 'plano',
    alvoNome: plano.nome,
    detalhes: { ciclo, valorCentavos: valor, assinatura: assinaturaRef },
  })
  return { ok: true, link }
}

/**
 * O que o aviso do Asaas faz. Relê a fatura com a chave da 4YU, grava o
 * espelho e, se a mensalidade foi paga, põe a conta no plano assinado.
 */
export async function aplicarAvisoDaMensalidade(asaasId: string): Promise<void> {
  const fatura = await lerFatura(asaasId)
  const clienteId = await contaDaFatura(fatura)
  if (!clienteId) {
    await alertar('aviso da mensalidade sem conta', `a fatura ${asaasId} não bate com nenhuma assinatura`)
    return
  }
  await gravarFatura(clienteId, fatura)
  if (fatura.estado === 'paga') await reativarSeQuitou(clienteId)
  if (!fatura.assinaturaRef) return

  const assinatura = await assinaturaDaConta(clienteId)
  // Fatura de uma assinatura antiga, já trocada: o espelho basta.
  if (!assinatura || assinatura.assinaturaRef !== fatura.assinaturaRef) return

  if (fatura.estado === 'paga') {
    if (assinatura.plano && (await planoDaConta(clienteId)) !== assinatura.plano) {
      const plano = await planoVigente(assinatura.plano)
      const trocou = await definirPlano(clienteId, plano.id, plano.preco)
      if (!trocou.ok) throw new Error(trocou.erro)
      await registrar({
        acao: 'plano_trocado_pelo_pagamento',
        contaId: clienteId,
        alvoTipo: 'plano',
        alvoNome: plano.nome,
        detalhes: { fatura: asaasId, ciclo: assinatura.ciclo },
      })
    }
    // Suspensa ou pausada só sai por `reativarSeQuitou`, que confere as outras faturas.
    if (!ATRASO_QUE_TRAVA.has(assinatura.estado ?? '')) await gravarAssinatura(clienteId, { estado: 'ativa' })
  } else if (fatura.estado === 'vencida' && !ATRASO_QUE_TRAVA.has(assinatura.estado ?? '')) {
    await gravarAssinatura(clienteId, { estado: 'atrasada' })
  }
}

/**
 * Pagou e não sobrou fatura vencida: a conta volta. Só desfaz a suspensão
 * que **a mensalidade** fez (`estado = 'suspensa'`); a que a 4YU fez à mão,
 * por outro motivo, continua até alguém daqui reativar.
 */
async function reativarSeQuitou(clienteId: string): Promise<void> {
  if (await temFaturaVencida(clienteId)) return
  const assinatura = await assinaturaDaConta(clienteId)
  if (assinatura?.estado === 'atrasada') await gravarAssinatura(clienteId, { estado: 'ativa' })
  if (!ATRASO_QUE_TRAVA.has(assinatura?.estado ?? '')) return
  const r = await definirSuspensao(clienteId, false)
  if (!r.ok) throw new Error(r.motivo ?? 'não foi possível reativar')
  await gravarAssinatura(clienteId, { estado: 'ativa' })
  await registrar({ ...SISTEMA, acao: 'reativou_organizacao', contaId: clienteId, detalhes: { motivo: 'mensalidade paga' } })
  await avisarSuspensao(clienteId, false)
}

const SISTEMA = { autorEmail: 'sistema@autofluxos', autorId: null }

/** Os estados em que a régua travou algo (painel no dia 10, recursos no 30). */
const ATRASO_QUE_TRAVA = new Set(['suspensa', 'pausada'])

/**
 * Põe na assinatura o valor de hoje: o plano e a equipe. Chamada quando a
 * equipe muda e quando a descida agendada é aplicada. Conta sem assinatura,
 * ou com ela cancelada, não faz nada.
 *
 * Enquanto aguarda o primeiro pagamento, o plano é o que está sendo comprado
 * (`assinatura.plano`); depois, o que está em vigor na conta.
 */
export async function sincronizarAssinatura(clienteId: string): Promise<void> {
  if (!mensalidadeConfigurada()) return
  const assinatura = await assinaturaDaConta(clienteId)
  if (!assinatura?.assinaturaRef || assinatura.estado?.startsWith('cancelada')) return
  const planoId = assinatura.estado === 'aguardando' && assinatura.plano ? assinatura.plano : await planoDaConta(clienteId)
  const plano = await planoVigente(planoId)
  const ciclo = assinatura.ciclo ?? 'mensal'
  const valor = valorDaAssinatura(plano, ciclo, await tamanhoDaEquipe(clienteId))
  // Anual de um plano que deixou de ter anual: a 4YU resolve à mão, não o relógio.
  if (valor === null) throw new Error(`o plano ${plano.nome} não tem anual, e a assinatura de ${clienteId} é anual`)
  await atualizarValor(assinatura.assinaturaRef, valor, { descricao: descricaoDaAssinatura(plano, ciclo, await tamanhoDaEquipe(clienteId)) })
  if (assinatura.plano !== plano.id) await gravarAssinatura(clienteId, { plano: plano.id })
}

/**
 * Trocar de plano com a assinatura já paga (fase 3).
 *
 * **Subir vale na hora**: o plano muda agora e o valor da assinatura também,
 * inclusive na fatura em aberto. **Descer fica para a virada do mês**, como
 * sempre foi: a descida é agendada, e a passada que a aplica chama
 * `sincronizarAssinatura`. Passar ao anual conta como subir.
 */
export async function mudarAssinatura(
  clienteId: string,
  desejado: IdDoPlano,
  ciclo: CicloDeCobranca,
): Promise<{ ok: true; mensagem: string; aplicado: boolean } | { ok: false; erro: string }> {
  const assinatura = await assinaturaDaConta(clienteId)
  if (!assinatura?.assinaturaRef) return { ok: false, erro: 'esta organização ainda não tem assinatura' }
  const destino = await planoVigente(desejado)
  if (destino.id !== desejado || !destino.ativo) return { ok: false, erro: 'esse plano não existe' }
  const atual = await planoVigente(await planoDaConta(clienteId))
  const cicloAtual = assinatura.ciclo ?? 'mensal'
  if (destino.id === atual.id && ciclo === cicloAtual) return { ok: false, erro: 'a organização já está neste plano' }

  const sobe = destino.preco > atual.preco || (destino.id === atual.id && ciclo === 'anual')
  if (!sobe) {
    const para = proximaVirada(new Date())
    const r = await agendarDescida(clienteId, destino.id, para)
    if (!r.ok) return { ok: false, erro: r.erro ?? 'não foi possível agendar a mudança' }
    await registrar({ acao: 'agendou_descida_pela_assinatura', contaId: clienteId, alvoTipo: 'plano', alvoNome: destino.nome, detalhes: { para } })
    return { ok: true, aplicado: false, mensagem: `A organização passa para o ${destino.nome} em ${diaPorExtenso(para)}. Até lá, tudo continua como está.` }
  }

  const valor = valorDaAssinatura(destino, ciclo, await tamanhoDaEquipe(clienteId))
  if (valor === null) return { ok: false, erro: `o plano ${destino.nome} não tem pagamento anual` }
  await atualizarValor(assinatura.assinaturaRef, valor, { ciclo, descricao: descricaoDaAssinatura(destino, ciclo, await tamanhoDaEquipe(clienteId)) })
  const trocou = await definirPlano(clienteId, destino.id, destino.preco)
  if (!trocou.ok) return { ok: false, erro: trocou.erro ?? 'não foi possível trocar o plano' }
  await gravarAssinatura(clienteId, { plano: destino.id, ciclo })
  await registrar({
    acao: 'subiu_de_plano_pela_assinatura',
    contaId: clienteId,
    alvoTipo: 'plano',
    alvoNome: destino.nome,
    detalhes: { de: atual.id, ciclo, valorCentavos: valor },
  })
  return { ok: true, aplicado: true, mensagem: `Plano ${destino.nome} ativo. A assinatura passou a ${reaisDeCentavos(valor)} ${ciclo === 'anual' ? 'por ano' : 'por mês'}.` }
}

/** Encerra a assinatura no Asaas. O plano fica como está até a 4YU decidir. */
export async function cancelarMensalidade(clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  const atual = await assinaturaDaConta(clienteId)
  if (!atual?.assinaturaRef) return { ok: false, erro: 'esta organização não tem assinatura' }
  await cancelarAssinatura(atual.assinaturaRef)
  await gravarAssinatura(clienteId, { assinaturaRef: null, estado: 'cancelada' })
  await registrar({ acao: 'cancelou_assinatura', contaId: clienteId, detalhes: { assinatura: atual.assinaturaRef } })
  return { ok: true }
}

/**
 * A equipe mudou: o atendente extra entra (ou sai) do valor da assinatura.
 * Nunca lança: entrar ou sair alguém da equipe não pode falhar por causa do
 * Asaas. A falha vira alerta, e a 4YU acerta o valor à mão.
 */
export async function acompanharEquipe(clienteId: string): Promise<void> {
  await sincronizarAssinatura(clienteId).catch((erro) =>
    alertar('a assinatura não acompanhou a equipe', erro, { cliente: clienteId }),
  )
}

/** O aviso de nota emitida: relê a nota e guarda o PDF na fatura. */
export async function aplicarNotaDaMensalidade(notaId: string): Promise<void> {
  const nota = await lerNotaFiscal(notaId)
  if (nota.emitida && nota.pagamento && nota.pdf) await gravarNotaFiscal(nota.pagamento, nota.pdf)
}

/**
 * O detalhe que o painel lateral mostra. A fatura precisa ser **desta** conta
 * (`asaasIdDaFatura`); o id no endereço não basta. De carona, guarda o PDF da
 * nota se o aviso dela se perdeu.
 */
export async function detalheDaFaturaDaConta(clienteId: string, faturaId: string): Promise<DetalheDaFatura | null> {
  const asaasId = await asaasIdDaFatura(clienteId, faturaId)
  if (!asaasId) return null
  const detalhe = await detalheDaFatura(asaasId)
  if (detalhe.nota?.emitida && detalhe.nota.pdf) await gravarNotaFiscal(asaasId, detalhe.nota.pdf).catch(() => undefined)
  return detalhe
}
