import 'server-only'
import {
  atualizarValor,
  cancelarAssinatura,
  criarAssinatura,
  garantirAviso,
  garantirClienteNoAsaas,
  lerFatura,
  linkDaProximaFatura,
} from '@/channels/asaas-da-4yu'
import { diaEmSaoPaulo } from '@/channels/pagamento'
import { documentoParaAsaas, valorDaAssinatura } from '@/core/mensalidade-da-4yu'
import type { CicloDeCobranca, IdDoPlano } from '@/core/planos'
import { alertar } from './alertar'
import { registrar } from './repos/auditoria'
import { acharCliente } from './repos/clientes'
import { assinaturaDaConta, contaDaFatura, gravarAssinatura, gravarFatura } from './repos/faturas-da-conta'
import { definirPlano, planoDaConta, tamanhoDaEquipe } from './repos/plano'
import { planoVigente } from './repos/planos'

/**
 * A mensalidade do AutoFluxos pelo Asaas da 4YU (docs/PLANO-MENSALIDADE-ASAAS.md).
 *
 * **O plano muda pelo aviso, nunca pelo clique.** Assinar cria a assinatura e
 * devolve a página de pagamento do Asaas; `clients.plano` só troca quando o
 * pagamento entra e o Asaas avisa. Quem fecha a aba sem pagar continua no
 * plano em que estava.
 */

/** Para onde o Asaas manda o e-mail quando o aviso falha. */
const EMAIL_DO_AVISO = 'contato@4yu.com.br'

export type ResultadoDeAssinar = { ok: true; link: string | null } | { ok: false; erro: string }

export async function assinar(
  clienteId: string,
  planoId: IdDoPlano,
  ciclo: CicloDeCobranca,
  /** `https://autofluxos.4yu.com.br`: de onde o Asaas chama o aviso. */
  origem: string,
): Promise<ResultadoDeAssinar> {
  const conta = await acharCliente(clienteId)
  if (!conta) return { ok: false, erro: 'organização não encontrada' }
  const documento = documentoParaAsaas(conta.cnpj)
  if (!documento) return { ok: false, erro: 'preencha o CNPJ ou CPF em Configurações, Negócio, antes de assinar' }
  if (!conta.email.trim()) return { ok: false, erro: 'preencha o e-mail em Configurações, Negócio, antes de assinar' }

  const plano = await planoVigente(planoId)
  if (plano.id !== planoId || !plano.ativo) return { ok: false, erro: 'esse plano não existe' }
  const valor = valorDaAssinatura(plano, ciclo, await tamanhoDaEquipe(clienteId))
  if (valor === null) return { ok: false, erro: `o plano ${plano.nome} não tem pagamento anual` }
  const descricao = `AutoFluxos ${plano.nome}, ${ciclo === 'anual' ? 'anual' : 'mensal'}`

  await garantirAviso(origem, EMAIL_DO_AVISO)
  const atual = await assinaturaDaConta(clienteId)
  const clienteAsaas =
    atual?.clienteAsaas ??
    (await garantirClienteNoAsaas({ clienteId, nome: conta.nome, documento, email: conta.email.trim() }))

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
    await gravarAssinatura(clienteId, { estado: 'ativa' })
  } else if (fatura.estado === 'vencida') {
    await gravarAssinatura(clienteId, { estado: 'atrasada' })
  }
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
