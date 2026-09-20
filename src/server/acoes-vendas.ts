'use server'

import { revalidatePath } from 'next/cache'
import { lerValor } from '@/core/crm'
import type { ItemDaVenda } from '@/core/vendas'
import { listarMotivos } from './repos/motivos-de-perda'
import { vendaDoCartao } from './repos/vendas'
import {
  cancelarVendaEResolver,
  registrarVendaEConcluir,
  type DestinoDaOportunidade,
} from './servicos/registrar-venda'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações da venda (T5.2).
 *
 * **Duas capacidades diferentes, e a separação é a decisão.** Registrar é
 * `registrar_venda`; corrigir ou cancelar é `corrigir_venda`, que mexe em
 * número já fechado e que a RB-40 não dá ao operador por padrão. Quem pode
 * lançar uma venda não pode, pelo mesmo crachá, desfazer o mês passado.
 *
 * **Nada aqui fala de pagamento** (RB-29). Venda registrada quer dizer que a
 * empresa confirmou a compra; se algum dia o produto acompanhar pagamento,
 * será por outra origem, com conciliação própria.
 */

export type RespostaDaVenda = {
  ok: boolean
  erro?: string
  /** `true` quer dizer "já estava feito, e devolvi o que existe". É sucesso. */
  repetida?: boolean
}

type ItemDaTela = {
  produtoId?: string | null
  descricao: string
  /** Texto da tela: "1.500" e "89,90" são os dois formatos que se digita aqui. */
  quantidade?: string | null
  valorUnitario?: string | null
}

/**
 * Traduz os itens da tela.
 *
 * Campo vazio vira `null`, e **não zero**: "não sei a quantidade" é resposta
 * legítima, e 1 por conveniência inventaria um número que ninguém informou
 * (RB-30).
 */
function lerItens(itens: readonly ItemDaTela[]): { ok: true; itens: ItemDaVenda[] } | { ok: false; erro: string } {
  const lidos: ItemDaVenda[] = []

  for (const item of itens) {
    const descricao = item.descricao.trim()
    if (descricao === '') continue // linha em branco do formulário: ignora.

    const quantidade = lerValor(item.quantidade ?? '')
    if (!quantidade.ok) return { ok: false, erro: `quantidade inválida em "${descricao}"` }

    const unitario = lerValor(item.valorUnitario ?? '')
    if (!unitario.ok) return { ok: false, erro: `valor inválido em "${descricao}"` }

    lidos.push({
      produtoId: item.produtoId || null,
      descricao,
      quantidade: quantidade.valor,
      valorUnitario: unitario.valor,
    })
  }

  return { ok: true, itens: lidos }
}

export async function acaoRegistrarVenda(
  clienteId: string,
  cartaoId: string,
  dados: {
    dataDaVenda: string
    valorTotal?: string
    nota?: string
    itens?: readonly ItemDaTela[]
    chaveDaOperacao?: string
  },
): Promise<RespostaDaVenda> {
  const acesso = await exigirCapacidade(clienteId, 'registrar_venda', 'proprios')
  if (recusou(acesso)) return acesso

  const total = lerValor(dados.valorTotal ?? '')
  if (!total.ok) return { ok: false, erro: total.motivo }

  const itens = lerItens(dados.itens ?? [])
  if (!itens.ok) return { ok: false, erro: itens.erro }

  const quem = await sessaoAtual()
  const r = await registrarVendaEConcluir({
    clienteId,
    cartaoId,
    dataDaVenda: dados.dataDaVenda,
    valorTotal: total.valor,
    itens: itens.itens,
    nota: dados.nota ?? null,
    autor: quem?.usuario.nome ?? null,
    chaveDaOperacao: dados.chaveDaOperacao ?? null,
  })

  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true, repetida: r.repetida }
}

export async function acaoCancelarVenda(
  clienteId: string,
  vendaId: string,
  dados: { motivo: string; destino: string; motivoDaPerda?: string },
): Promise<RespostaDaVenda> {
  // `corrigir_venda`, e não `registrar_venda`: desfazer número fechado é outro
  // poder, e a RB-40 não o dá ao operador por padrão.
  const acesso = await exigirCapacidade(clienteId, 'corrigir_venda', 'proprios')
  if (recusou(acesso)) return acesso

  if (dados.destino !== 'reabrir' && dados.destino !== 'perdida') {
    return { ok: false, erro: 'escolha se a oportunidade volta a ficar aberta ou vira perdida' }
  }

  // Motivo da perda tem que ser um da conta, pela mesma razão do fechamento
  // normal: motivo digitado à mão vira "preço", "Preço" e "achou caro" como
  // três coisas diferentes, e aí não dá para agrupar nada.
  if (dados.destino === 'perdida') {
    const motivos = (await listarMotivos(clienteId)).map((m) => m.nome)
    const escolhido = (dados.motivoDaPerda ?? '').trim()
    if (escolhido !== '' && !motivos.includes(escolhido)) {
      return { ok: false, erro: 'esse motivo de perda não é da sua conta' }
    }
  }

  const quem = await sessaoAtual()
  const r = await cancelarVendaEResolver({
    clienteId,
    vendaId,
    motivo: dados.motivo,
    destino: dados.destino as DestinoDaOportunidade,
    motivoDaPerda: dados.motivoDaPerda ?? null,
    autor: quem?.usuario.nome ?? null,
  })

  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

/**
 * A venda de uma oportunidade, para a tela de correção abrir preenchida.
 *
 * Exige `ler_valores`: o total é dinheiro, e quem não pode ver número não pode
 * vê-lo por este caminho lateral. A RB da §10.3 é explícita sobre dado
 * financeiro não ser inferível por outra porta.
 */
export async function acaoLerVendaDoCartao(
  clienteId: string,
  cartaoId: string,
): Promise<
  | { ok: true; venda: { id: string; dataDaVenda: string; valorTotal: number | null; nota: string | null } | null }
  | { ok: false; erro: string }
> {
  const acesso = await exigirCapacidade(clienteId, 'ler_valores', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  const venda = await vendaDoCartao(clienteId, cartaoId)
  return {
    ok: true,
    venda: venda
      ? {
          id: venda.id,
          dataDaVenda: venda.dataDaVenda,
          valorTotal: venda.valorTotal,
          nota: venda.nota,
        }
      : null,
  }
}

function recarregar(clienteId: string): void {
  revalidatePath(`/clientes/${clienteId}/quadros`)
  revalidatePath(`/clientes/${clienteId}/leads`)
}
