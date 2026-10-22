import { MAX_QUANTIDADE } from './cobranca'
import type { ProdutoDaLoja } from './loja'

/**
 * O Cobrar do Inbox a partir do catálogo (cobrança camada 2, parte d).
 *
 * Quem atende escolhe o produto e a quantidade; o preço vem do catálogo ou da
 * loja conectada, relido no servidor, e a soma sai daqui, em centavos. O
 * navegador manda só o id e a quantidade, nunca o preço.
 *
 * Os itens ficam em `cobrancas.itens`, e é por eles que "o que eu vendi pelo
 * chat" tem resposta. Cobrança em valor livre continua sem itens, de propósito:
 * sinal e ajuste não são produto.
 */

/** Um item cobrado. `valorCentavos` é o preço de **cada um**, não da linha. */
export type ItemCobrado = {
  nome: string
  quantidade: number
  valorCentavos: number
  /** O id que a busca devolveu (SKU ou id da linha); ausente nas cobranças antigas. */
  produtoId?: string
  /** `catalogo` é o catálogo próprio; `loja` é Magento ou Nuvemshop. */
  fonte?: 'catalogo' | 'loja'
}

export type PedidoDeItem = { produtoId: string; quantidade: number }

/** Linhas demais numa cobrança de conversa é engano, não pedido. */
export const MAX_LINHAS = 20

const DESCRICAO_MAXIMA = 200

export type ItensConferidos =
  | { ok: true; itens: ItemCobrado[]; totalCentavos: number; descricao: string }
  | { ok: false; erro: string }

/** Só o catálogo próprio diz a espécie do item: é por ela que se sabe a fonte. */
export function fonteDoProduto(produto: ProdutoDaLoja): 'catalogo' | 'loja' {
  return produto.especie ? 'catalogo' : 'loja'
}

/** "2x Pizza grande, 1x Coca 2L", cortado em 200 com "e mais N". */
export function descricaoDosItens(itens: readonly Pick<ItemCobrado, 'nome' | 'quantidade'>[]): string {
  const partes = itens.map((i) => `${i.quantidade}x ${i.nome.trim()}`)
  for (let n = partes.length; n > 0; n--) {
    const resto = partes.length - n
    const texto = partes.slice(0, n).join(', ') + (resto > 0 ? ` e mais ${resto}` : '')
    if (texto.length <= DESCRICAO_MAXIMA) return texto
  }
  return partes[0]!.slice(0, DESCRICAO_MAXIMA - 1) + '…'
}

/**
 * Confere os pedidos contra o que a loja acabou de devolver e soma.
 *
 * Recusa com o motivo, e não "conserta": item que sumiu, sem preço ou com
 * preço por variação não pode virar Pix com valor adivinhado.
 */
export function conferirItens(
  pedidos: readonly PedidoDeItem[],
  lidos: readonly ProdutoDaLoja[],
  descricaoDigitada = '',
): ItensConferidos {
  const juntos = new Map<string, number>()
  for (const p of pedidos) {
    const id = p.produtoId.trim()
    if (!id) continue
    juntos.set(id, (juntos.get(id) ?? 0) + p.quantidade)
  }
  if (juntos.size === 0) return { ok: false, erro: 'Escolha pelo menos um item.' }
  if (juntos.size > MAX_LINHAS) return { ok: false, erro: `Até ${MAX_LINHAS} itens por cobrança.` }

  const itens: ItemCobrado[] = []
  let total = 0
  for (const [id, quantidade] of juntos) {
    const produto = lidos.find((l) => l.produtoId === id)
    if (!produto) return { ok: false, erro: 'Um dos itens saiu do catálogo. Busque de novo.' }
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTIDADE) {
      return { ok: false, erro: `A quantidade de ${produto.nome} vai de 1 a ${MAX_QUANTIDADE}.` }
    }
    if (produto.preco === undefined) {
      return {
        ok: false,
        erro:
          produto.precoAPartirDe !== undefined
            ? `${produto.nome} tem preço por variação. Cobre em Valor livre.`
            : `${produto.nome} está sem preço. Cadastre o preço ou cobre em Valor livre.`,
      }
    }
    const unitario = Math.round(produto.preco * 100)
    itens.push({ nome: produto.nome, quantidade, valorCentavos: unitario, produtoId: id, fonte: fonteDoProduto(produto) })
    total += unitario * quantidade
  }

  if (total <= 0) return { ok: false, erro: 'O total precisa ser maior que zero.' }
  if (total > 100_000_000) return { ok: false, erro: 'Valor acima do permitido para uma cobrança.' }
  const digitada = descricaoDigitada.trim()
  if (digitada.length > DESCRICAO_MAXIMA) return { ok: false, erro: `A descrição passa de ${DESCRICAO_MAXIMA} caracteres.` }
  return { ok: true, itens, totalCentavos: total, descricao: digitada || descricaoDosItens(itens) }
}

/** Itens de uma cobrança lidos do `jsonb`, descartando o que não tem forma de item. */
export function itensDoJson(bruto: unknown): ItemCobrado[] {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((i) => {
    if (!i || typeof i !== 'object') return []
    const { nome, quantidade, valorCentavos } = i as Record<string, unknown>
    if (typeof nome !== 'string' || typeof quantidade !== 'number' || typeof valorCentavos !== 'number') return []
    return [{ nome, quantidade, valorCentavos }]
  })
}
