import { LIMITE_DE_PRODUTOS, type ProdutoDaLoja } from './loja'

/**
 * A Nuvemshop vista pelo bot: só tradução, sem rede.
 *
 * Pesquisa e fontes em `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção Nuvemshop.
 * Quem chama a API é `loja/nuvemshop.ts`; aqui só se transforma o JSON dela no
 * `ProdutoDaLoja` que o card já sabe desenhar.
 *
 * Diferenças da Magento que moldam este arquivo:
 *
 *  - nome e `handle` vêm por idioma (`{ pt: ... }`);
 *  - preço e estoque são **por variação**, e o preço vem em texto;
 *  - estoque vem em número sem token extra; `stock_management: false` ou
 *    `stock` nulo é estoque infinito;
 *  - não há "combina com".
 */

/** Prefixo do `produtoId` quando o produto não tem SKU em variação nenhuma. */
export const PREFIXO_SEM_SKU = 'ns-'

type Variacao = {
  price?: unknown
  promotional_price?: unknown
  stock?: unknown
  stock_management?: unknown
  sku?: unknown
}

type ProdutoNuvemshop = {
  id?: unknown
  name?: unknown
  handle?: unknown
  canonical_url?: unknown
  published?: unknown
  images?: unknown
  variants?: unknown
}

function textoPorIdioma(no: unknown): string | null {
  if (typeof no === 'string') return no.trim() || null
  if (!no || typeof no !== 'object') return null
  const idiomas = no as Record<string, unknown>
  for (const chave of ['pt', 'es', 'en']) {
    const v = idiomas[chave]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  const primeiro = Object.values(idiomas).find((v) => typeof v === 'string' && v.trim())
  return typeof primeiro === 'string' ? primeiro.trim() : null
}

function dinheiro(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function infinito(v: Variacao): boolean {
  return v.stock_management === false || v.stock === null || v.stock === undefined || v.stock === ''
}

function quantidadeDe(v: Variacao): number {
  const n = typeof v.stock === 'number' ? v.stock : Number(v.stock)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function https(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  if (url.startsWith('https://')) return url
  // A CDN da Nuvemshop responde nos dois; o card do WhatsApp só aceita https.
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`
  if (url.startsWith('//')) return `https:${url}`
  return undefined
}

/** O link do produto: `canonical_url` quando vem, senão `/produtos/<handle>/`. */
export function linkDoProdutoNuvemshop(endereco: string, produto: { canonical_url?: unknown; handle?: unknown }): string {
  const canonica = https(produto.canonical_url)
  if (canonica) return canonica
  const handle = textoPorIdioma(produto.handle)
  return handle ? `${endereco}/produtos/${encodeURIComponent(handle)}/` : endereco
}

/** A página de busca da loja. Sem rede. */
export function linkDaBuscaNuvemshop(endereco: string, termo: string): string {
  return `${endereco}/search/?q=${encodeURIComponent(termo.trim())}`
}

/**
 * Um produto da API, ou `null` se não dá para mostrar (sem nome, oculto).
 *
 * Preço: variações com o mesmo preço viram `preco` (e `precoDe` quando há
 * promoção); preços diferentes viram `precoAPartirDe`, no lugar de `preco`,
 * pela regra do card: nunca anunciar a variação mais barata como o preço.
 */
export function traduzirProdutoNuvemshop(bruto: unknown, endereco: string): ProdutoDaLoja | null {
  if (!bruto || typeof bruto !== 'object') return null
  const p = bruto as ProdutoNuvemshop
  if (p.published === false) return null

  const nome = textoPorIdioma(p.name)
  if (!nome) return null

  const variacoes = (Array.isArray(p.variants) ? p.variants : []).filter(
    (v): v is Variacao => Boolean(v) && typeof v === 'object',
  )

  const sku = variacoes.map((v) => (typeof v.sku === 'string' ? v.sku.trim() : '')).find(Boolean)
  const produtoId = sku ?? `${PREFIXO_SEM_SKU}${String(p.id ?? '')}`

  const finais = variacoes
    .map((v) => dinheiro(v.promotional_price) ?? dinheiro(v.price))
    .filter((n): n is number => n !== undefined)
  const menor = finais.length > 0 ? Math.min(...finais) : undefined
  const variamDePreco = finais.some((n) => n !== menor)

  const produto: ProdutoDaLoja = {
    produtoId,
    nome,
    emEstoque: variacoes.length === 0 || variacoes.some((v) => infinito(v) || quantidadeDe(v) > 0),
    link: linkDoProdutoNuvemshop(endereco, p),
  }

  if (variamDePreco) {
    produto.precoAPartirDe = menor
  } else if (menor !== undefined) {
    produto.preco = menor
    const cheio = dinheiro(variacoes[0]?.price)
    if (cheio !== undefined && cheio > menor) produto.precoDe = cheio
  }

  // Quantidade só quando toda variação é contada: somar com uma infinita
  // daria um número que parece exato e não é.
  if (variacoes.length > 0 && variacoes.every((v) => !infinito(v))) {
    produto.quantidade = variacoes.reduce((soma, v) => soma + quantidadeDe(v), 0)
  }

  const imagens = Array.isArray(p.images) ? p.images : []
  const foto = https((imagens[0] as { src?: unknown } | undefined)?.src)
  if (foto) produto.foto = foto

  return produto
}

/** A lista de `GET /products`, até o limite que o bot mostra. */
export function traduzirListaNuvemshop(json: unknown, endereco: string): ProdutoDaLoja[] {
  if (!Array.isArray(json)) return []
  return json
    .map((p) => traduzirProdutoNuvemshop(p, endereco))
    .filter((p): p is ProdutoDaLoja => p !== null)
    .slice(0, LIMITE_DE_PRODUTOS)
}

/**
 * O endereço público da loja a partir de `GET /store`: o domínio próprio
 * quando há, senão o `original_domain` (`*.nuvemshop.com.br`). Sempre https.
 */
export function enderecoDaLojaNuvemshop(loja: unknown): string | null {
  if (!loja || typeof loja !== 'object') return null
  const l = loja as { domains?: unknown; original_domain?: unknown }
  const proprio = Array.isArray(l.domains) ? l.domains.find((d) => typeof d === 'string' && d.trim()) : undefined
  const dominio = (typeof proprio === 'string' ? proprio : typeof l.original_domain === 'string' ? l.original_domain : '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dominio)) return null
  return `https://${dominio.toLowerCase()}`
}
