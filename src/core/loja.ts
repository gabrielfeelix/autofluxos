/**
 * A loja do cliente, do jeito que o bot precisa dela.
 *
 * Regra pura: nada de rede, relógio ou banco. Quem fala com o Magento é
 * `src/loja/magento.ts`; este arquivo só sabe montar a pergunta e ler a
 * resposta. Ver docs/INTEGRACAO-MAGENTO-23-SET.md.
 *
 * Duas regras que custam caro se alguém "simplificar":
 *
 * - **Preço ausente não é zero.** Magento devolve 0 quando o preço depende do
 *   grupo do cliente ou não foi cadastrado. Anunciar "R$ 0,00" no WhatsApp é o
 *   pior erro possível desta integração, então 0 e ausente viram a mesma
 *   coisa: `preco` não existe, e o bot diz que vai confirmar o valor.
 * - **O termo é variável GraphQL.** Ele vem do que o cliente final digitou.
 *   Concatenar na query abriria injeção; como variável, a query é constante.
 */

export const LIMITE_DE_PRODUTOS = 5

const CAMPOS_DO_PRODUTO = `
  sku
  name
  url_key
  stock_status
  price_range { minimum_price { regular_price { value } final_price { value } } }
`

export const QUERY_BUSCA = `query Buscar($termo: String!) {
  products(search: $termo, pageSize: ${LIMITE_DE_PRODUTOS}) { items { ${CAMPOS_DO_PRODUTO} } }
}`

export const QUERY_RECOMENDACOES = `query Recomendar($sku: String!) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    items {
      crosssell_products { ${CAMPOS_DO_PRODUTO} }
      related_products { ${CAMPOS_DO_PRODUTO} }
    }
  }
}`

export const QUERY_CONFIG = `{ storeConfig { store_code base_currency_code product_url_suffix } }`

export type ProdutoDaLoja = {
  produtoId: string
  nome: string
  preco?: number
  precoDe?: number
  emEstoque: boolean
  quantidade?: number
  link: string
}

export function normalizarEndereco(
  entrada: string,
): { ok: true; endereco: string } | { ok: false; motivo: string } {
  let url: URL
  try {
    url = new URL(entrada.trim())
  } catch {
    return { ok: false, motivo: 'escreva o endereço completo, começando com https://' }
  }
  if (url.protocol !== 'https:') return { ok: false, motivo: 'o endereço precisa começar com https://' }
  if (url.username || url.password) return { ok: false, motivo: 'o endereço não pode ter usuário ou senha' }
  if (url.search || url.hash) return { ok: false, motivo: 'use só o endereço da loja, sem ? ou # no fim' }
  const caminho = url.pathname.replace(/\/+$/, '')
  return { ok: true, endereco: `${url.origin}${caminho}` }
}

export function linkDoProduto(endereco: string, urlKey: string, sufixo: string): string {
  return `${endereco}/${encodeURIComponent(urlKey)}${sufixo}`
}

function valor(no: unknown): number | undefined {
  const v = (no as { value?: unknown } | null | undefined)?.value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

function traduzirItem(bruto: unknown, endereco: string, sufixo: string): ProdutoDaLoja | null {
  if (bruto === null || typeof bruto !== 'object') return null
  const it = bruto as Record<string, unknown>
  const sku = typeof it.sku === 'string' ? it.sku.trim() : ''
  const nome = typeof it.name === 'string' ? it.name.trim() : ''
  const urlKey = typeof it.url_key === 'string' ? it.url_key.trim() : ''
  if (!sku || !nome || !urlKey) return null

  const minimo = (it.price_range as { minimum_price?: Record<string, unknown> } | null | undefined)?.minimum_price
  const final = valor(minimo?.final_price)
  const cheio = valor(minimo?.regular_price)

  return {
    produtoId: sku,
    nome,
    ...(final !== undefined ? { preco: final } : {}),
    ...(final !== undefined && cheio !== undefined && cheio > final ? { precoDe: cheio } : {}),
    emEstoque: it.stock_status === 'IN_STOCK',
    link: linkDoProduto(endereco, urlKey, sufixo),
  }
}

function itensDe(json: unknown): unknown[] {
  const items = (json as { data?: { products?: { items?: unknown } } } | null)?.data?.products?.items
  return Array.isArray(items) ? items : []
}

export function traduzirProdutos(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[] {
  return itensDe(json)
    .map((i) => traduzirItem(i, endereco, sufixo))
    .filter((p): p is ProdutoDaLoja => p !== null)
    .slice(0, LIMITE_DE_PRODUTOS)
}

/**
 * O que o lojista marcou como "combina com", sem repetir e só com estoque.
 *
 * Recomendar o que está esgotado é oferecer o que não dá para vender. Ao
 * contrário da busca, onde "acabou" é resposta útil, aqui é ruído.
 */
export function traduzirRecomendacoes(json: unknown, endereco: string, sufixo: string): ProdutoDaLoja[] {
  const [produto] = itensDe(json) as Record<string, unknown>[]
  if (!produto) return []
  const juntos = [
    ...(Array.isArray(produto.crosssell_products) ? produto.crosssell_products : []),
    ...(Array.isArray(produto.related_products) ? produto.related_products : []),
  ]
  const vistos = new Set<string>()
  const saida: ProdutoDaLoja[] = []
  for (const bruto of juntos) {
    const p = traduzirItem(bruto, endereco, sufixo)
    if (!p || !p.emEstoque || vistos.has(p.produtoId)) continue
    vistos.add(p.produtoId)
    saida.push(p)
  }
  return saida.slice(0, LIMITE_DE_PRODUTOS)
}
