import { LIMITE_DE_PRODUTOS, type ProdutoDaLoja } from '@/core/loja'
import type { Loja } from './types'

/**
 * Uma loja em memória, para testar quem usa `Loja` sem rede.
 *
 * `falhar` simula a loja fora do ar. `complementos` é o "combina com" que o
 * lojista cadastrou, por SKU.
 */
export function lojaFalsa({
  produtos = [],
  complementos = {},
  falhar = false,
}: {
  produtos?: ProdutoDaLoja[]
  complementos?: Record<string, string[]>
  falhar?: boolean
} = {}): Loja & { buscas: string[] } {
  const buscas: string[] = []
  const fora = { ok: false as const, motivo: 'a loja não respondeu: loja falsa desligada' }

  return {
    buscas,
    async buscar(termo) {
      buscas.push(termo)
      if (falhar) return fora
      const t = termo.trim().toLowerCase()
      if (!t) return { ok: true, valor: [] }
      return {
        ok: true,
        valor: produtos.filter((p) => p.nome.toLowerCase().includes(t)).slice(0, LIMITE_DE_PRODUTOS),
      }
    },
    async combinaCom(sku) {
      if (falhar) return fora
      const skus = complementos[sku] ?? []
      return {
        ok: true,
        valor: produtos.filter((p) => skus.includes(p.produtoId) && p.emEstoque).slice(0, LIMITE_DE_PRODUTOS),
      }
    },
    async lerPorSku(skus) {
      if (falhar) return fora
      return { ok: true, valor: skus.flatMap((sku) => produtos.filter((p) => p.produtoId === sku)) }
    },
    linkDaBusca(termo) {
      return `https://loja.falsa/catalogsearch/result/?q=${encodeURIComponent(termo.trim())}`
    },
    async lerConfig() {
      if (falhar) return fora
      return { ok: true, valor: { codigoDaLoja: 'default', moeda: 'BRL', sufixo: '' } }
    },
  }
}
