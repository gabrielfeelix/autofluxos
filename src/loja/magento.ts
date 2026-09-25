import 'server-only'
import {
  LIMITE_DE_CARDS,
  linkDaBusca,
  QUERY_BUSCA,
  QUERY_CONFIG,
  paginaDaBusca,
  totalDe,
  QUERY_POR_SKU,
  QUERY_ATRIBUTOS,
  QUERY_FICHA,
  QUERY_RECOMENDACOES,
  traduzirFicha,
  traduzirFrete,
  traduzirPorSku,
  traduzirProdutos,
  traduzirRecomendacoes,
} from '@/core/loja'
import { chamarHttp } from '@/server/efeitos/http'
import type { DadosDaLoja, Loja, ResultadoDaLoja } from './types'

type Chamar = typeof chamarHttp

/**
 * Magento pelo GraphQL público, sem credencial.
 *
 * Usa GET e não POST: o Magento aceita query por GET, o cache de página da
 * loja (Varnish/Fastly) responde sem acordar o PHP, e o verbo deixa óbvio no
 * log que isto não escreve nada.
 *
 * Toda chamada passa por `chamarHttp`, que confere o endereço contra rede
 * interna a cada salto. O endereço vem do lojista; confiar nele uma vez, na
 * hora de salvar, deixaria a porta aberta para quem trocar o DNS depois.
 */
export function lojaMagento(dados: DadosDaLoja, chamar: Chamar = chamarHttp): Loja {
  async function graphql(query: string, variaveis: Record<string, unknown>): Promise<ResultadoDaLoja<unknown>> {
    const url = new URL(`${dados.endereco}/graphql`)
    url.searchParams.set('query', query)
    if (Object.keys(variaveis).length > 0) url.searchParams.set('variables', JSON.stringify(variaveis))
    const resposta = await chamar(
      {
        tipo: 'chamar_http',
        metodo: 'GET',
        url: url.toString(),
        cabecalhos: dados.codigoDaLoja ? [{ chave: 'Store', valor: dados.codigoDaLoja }] : [],
        corpo: '',
        mapear: [],
        aoFalhar: 'humano',
      },
      { deTeste: false, comJson: true },
    )
    if (!resposta.ok) return { ok: false, motivo: `a loja não respondeu: ${resposta.motivo}` }
    const erros = (resposta.json as { errors?: unknown[] } | null)?.errors
    if (Array.isArray(erros) && erros.length > 0) return { ok: false, motivo: 'a loja recusou a consulta' }
    return { ok: true, valor: resposta.json }
  }

  /**
   * A REST de visitante, a mesma que o checkout usa sem login.
   *
   * O frete não tem consulta pública direta: a loja só calcula para um
   * carrinho. Então se cria um carrinho de visitante, põe o item e pergunta.
   * Não vira pedido, e o Magento limpa carrinho de visitante abandonado.
   */
  async function rest(caminho: string, corpo: unknown): Promise<ResultadoDaLoja<unknown>> {
    const base = dados.codigoDaLoja ? `/rest/${encodeURIComponent(dados.codigoDaLoja)}/V1` : '/rest/V1'
    const resposta = await chamar(
      {
        tipo: 'chamar_http',
        metodo: 'POST',
        url: `${dados.endereco}${base}${caminho}`,
        cabecalhos: [{ chave: 'Content-Type', valor: 'application/json' }],
        corpo: JSON.stringify(corpo),
        mapear: [],
        aoFalhar: 'humano',
      },
      { deTeste: false, comJson: true },
    )
    if (!resposta.ok) return { ok: false, motivo: `a loja não respondeu: ${resposta.motivo}` }
    return { ok: true, valor: resposta.json }
  }

  return {
    async frete(sku, cep) {
      const carrinho = await rest('/guest-carts', {})
      if (!carrinho.ok) return carrinho
      const id = carrinho.valor
      if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) {
        return { ok: false, motivo: 'a loja não abriu o carrinho para calcular o frete' }
      }
      const item = await rest(`/guest-carts/${id}/items`, { cartItem: { sku, qty: 1, quote_id: id } })
      if (!item.ok) return item
      const r = await rest(`/guest-carts/${id}/estimate-shipping-methods`, {
        address: { postcode: cep, country_id: 'BR' },
      })
      return r.ok ? { ok: true, valor: traduzirFrete(r.valor) } : r
    },
    async buscar(termo, opcoes) {
      const limpo = termo.trim().slice(0, 80)
      if (!limpo) return { ok: true, valor: [] }
      // O Magento devolve a última página de novo quando se pede além dela; o
      // total é que diz onde a lista acaba.
      const { pagina, porPagina } = paginaDaBusca(opcoes)
      const r = await graphql(QUERY_BUSCA, { termo: limpo, porPagina, pagina })
      if (r.ok && (pagina - 1) * porPagina >= totalDe(r.valor)) return { ok: true, valor: [] }
      return r.ok ? { ok: true, valor: traduzirProdutos(r.valor, dados.endereco, dados.sufixo) } : r
    },
    async combinaCom(sku) {
      const r = await graphql(QUERY_RECOMENDACOES, { sku })
      return r.ok ? { ok: true, valor: traduzirRecomendacoes(r.valor, dados.endereco, dados.sufixo) } : r
    },
    async lerPorSku(skus) {
      const pedidos = [...new Set(skus.map((s) => s.trim()).filter(Boolean))].slice(0, LIMITE_DE_CARDS)
      if (pedidos.length === 0) return { ok: true, valor: [] }
      const r = await graphql(QUERY_POR_SKU, { skus: pedidos })
      return r.ok ? { ok: true, valor: traduzirPorSku(r.valor, pedidos, dados.endereco, dados.sufixo) } : r
    },
    async ficha(sku) {
      const limpo = sku.trim()
      if (!limpo) return { ok: true, valor: null }
      const [r, atributos] = await Promise.all([
        graphql(QUERY_FICHA, { sku: limpo }),
        graphql(QUERY_ATRIBUTOS, { sku: limpo }),
      ])
      // Atributo recusado (Magento antes do 2.4.7) não derruba a ficha.
      return r.ok ? { ok: true, valor: traduzirFicha(r.valor, atributos.ok ? atributos.valor : null) } : r
    },
    linkDaBusca(termo) {
      return linkDaBusca(dados.endereco, termo)
    },
    async lerConfig() {
      const r = await graphql(QUERY_CONFIG, {})
      if (!r.ok) return r
      const c = (r.valor as { data?: { storeConfig?: Record<string, unknown> } }).data?.storeConfig
      if (!c) return { ok: false, motivo: 'a loja respondeu, mas sem configuração; o GraphQL pode estar desligado' }
      return {
        ok: true,
        valor: {
          codigoDaLoja: typeof c.store_code === 'string' ? c.store_code : null,
          moeda: typeof c.base_currency_code === 'string' ? c.base_currency_code : 'BRL',
          // `null` quer dizer "sem sufixo", e não "use o padrão". A PCYES responde
          // null e o link certo é sem `.html` (sondagem de 23/set/2026).
          sufixo: typeof c.product_url_suffix === 'string' ? c.product_url_suffix : '',
        },
      }
    },
  }
}
