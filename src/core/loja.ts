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

import { comoDinheiro } from './crm'

export const LIMITE_DE_PRODUTOS = 5

/**
 * Quantos cards o bot manda de uma vez.
 *
 * Três e não os cinco da busca: cada card é uma mensagem inteira no WhatsApp,
 * e cinco seguidos empurram a conversa para fora da tela de quem perguntou.
 */
export const LIMITE_DE_CARDS = 3

/** Até quantas unidades o estoque vira "últimas N". Acima disso, nenhum número sai. */
export const ULTIMAS_UNIDADES = 5

const CAMPOS_DO_PRODUTO = `
  sku
  name
  url_key
  canonical_url
  stock_status
  price_range {
    minimum_price { regular_price { value } final_price { value } }
    maximum_price { final_price { value } }
  }
`

export const QUERY_BUSCA = `query Buscar($termo: String!, $porPagina: Int!, $pagina: Int!) {
  products(search: $termo, pageSize: $porPagina, currentPage: $pagina) { total_count items { ${CAMPOS_DO_PRODUTO} } }
}`

/** Quantos produtos a busca achou no total; sem o campo, conta como infinito. */
export function totalDe(json: unknown): number {
  const t = (json as { data?: { products?: { total_count?: unknown } } } | null)?.data?.products?.total_count
  return typeof t === 'number' && Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/** Página e tamanho saneados: página a partir de 1, no máximo 50 por vez. */
export function paginaDaBusca(opcoes?: { pagina?: number; porPagina?: number }): { pagina: number; porPagina: number } {
  const pagina = Math.max(1, Math.floor(opcoes?.pagina ?? 1))
  const porPagina = Math.min(50, Math.max(1, Math.floor(opcoes?.porPagina ?? LIMITE_DE_PRODUTOS)))
  return { pagina, porPagina }
}

export const QUERY_RECOMENDACOES = `query Recomendar($sku: String!) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    items {
      crosssell_products { ${CAMPOS_DO_PRODUTO} }
      related_products { ${CAMPOS_DO_PRODUTO} }
    }
  }
}`

/**
 * Relê produtos pelo SKU, para o card sair com o preço de agora.
 *
 * `in` com lista, e a lista vai como variável pelo mesmo motivo do termo: os
 * SKUs passaram pela trava `soDeResultadoAnterior`, mas a query continua
 * constante mesmo assim.
 */
export const QUERY_POR_SKU = `query Ler($skus: [String]) {
  products(filter: { sku: { in: $skus } }, pageSize: ${LIMITE_DE_CARDS}) { items { ${CAMPOS_DO_PRODUTO} } }
}`

export const QUERY_CONFIG = `{ storeConfig { store_code base_currency_code product_url_suffix } }`

export type ProdutoDaLoja = {
  produtoId: string
  nome: string
  preco?: number
  precoDe?: number
  /**
   * Produto com variações de preços diferentes (cor, tamanho): o menor deles.
   * Aparece **no lugar** de `preco`, nunca junto, para o bot não anunciar a
   * variação mais barata como se fosse o preço do produto.
   */
  precoAPartirDe?: number
  emEstoque: boolean
  /**
   * Catálogo próprio da conta (`loja/catalogo.ts`): ninguém conta estoque
   * nele, e serviço não tem estoque. O card não escreve "em estoque" por cima
   * de um dado que não existe.
   */
  semControleDeEstoque?: true
  /** Só no catálogo próprio: o que o dono escreveu sobre o item. */
  descricao?: string
  quantidade?: number
  /** Só com token (fase 2). Ausente = sem foto real; nunca o placeholder da loja. */
  foto?: string
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

/**
 * O `canonical_url` da loja como link absoluto, ou `null` para cair no
 * `url_key`. Vem relativo (`caminho-do-produto.html`) ou absoluto, conforme a
 * configuração; absoluto só vale se for da própria loja, para um catálogo
 * adulterado não mandar o cliente para outro site.
 */
export function linkCanonico(endereco: string, canonico: unknown): string | null {
  if (typeof canonico !== 'string' || canonico.trim() === '') return null
  const valor = canonico.trim()
  if (/^https?:\/\//i.test(valor)) {
    try {
      return new URL(valor).host === new URL(endereco).host ? valor : null
    } catch {
      return null
    }
  }
  return `${endereco}/${valor.replace(/^\/+/, '')}`
}

/**
 * A página de busca da própria loja, para quando a busca do bot volta vazia.
 *
 * Vazio não quer dizer "não vende": a busca é por relevância, e o termo que o
 * bot escolheu pode não bater com o nome do produto. O link deixa a pessoa
 * procurar do jeito dela em vez de ouvir um "não temos" falso. A rota é a
 * padrão do Magento (`catalogsearch/result`), conferida 200 na PCYES em
 * 23/set/2026.
 */
export function linkDaBusca(endereco: string, termo: string): string {
  return `${endereco}/catalogsearch/result/?q=${encodeURIComponent(termo.trim())}`
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

  // O endereço de verdade é o `canonical_url` (reescrita de URL da loja); o
  // `url_key` só coincide com ele quando ninguém mexeu. Na DEV da PCYES o
  // `url_key` dá 404 e a loja joga para a home (25/set/2026).
  const link = linkCanonico(endereco, it.canonical_url) ?? linkDoProduto(endereco, urlKey, sufixo)

  const faixa = it.price_range as
    | { minimum_price?: Record<string, unknown>; maximum_price?: Record<string, unknown> }
    | null
    | undefined
  const final = valor(faixa?.minimum_price?.final_price)
  const cheio = valor(faixa?.minimum_price?.regular_price)
  const teto = valor(faixa?.maximum_price?.final_price)

  // Variações com preços diferentes: "a partir de", e sem de/por, porque o
  // "de" de uma variação ao lado do "por" de outra seria desconto inventado.
  if (final !== undefined && teto !== undefined && teto > final) {
    return {
      produtoId: sku,
      nome,
      precoAPartirDe: final,
      emEstoque: it.stock_status === 'IN_STOCK',
      link,
    }
  }

  return {
    produtoId: sku,
    nome,
    ...(final !== undefined ? { preco: final } : {}),
    ...(final !== undefined && cheio !== undefined && cheio > final ? { precoDe: cheio } : {}),
    emEstoque: it.stock_status === 'IN_STOCK',
    link,
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

/**
 * O resultado da releitura, na ordem em que o bot pediu.
 *
 * A loja devolve na ordem dela, e o bot escolheu uma ordem ao falar ("o
 * primeiro é o mais barato"). SKU que a loja não devolveu some, sem erro: o
 * produto pode ter saído do catálogo entre a busca e o card.
 */
export function traduzirPorSku(json: unknown, skus: readonly string[], endereco: string, sufixo: string): ProdutoDaLoja[] {
  const porSku = new Map<string, ProdutoDaLoja>()
  for (const bruto of itensDe(json)) {
    const p = traduzirItem(bruto, endereco, sufixo)
    if (p) porSku.set(p.produtoId, p)
  }
  return skus.flatMap((sku) => {
    const p = porSku.get(sku)
    return p ? [p] : []
  })
}

/**
 * As linhas do card: nome, preço e estoque. Sem o link, que cada canal põe do
 * seu jeito (botão no WhatsApp e no Instagram, texto quando não há foto).
 *
 * Sem preço não escreve preço nenhum, nem "R$ 0,00" nem "consulte": o bot já
 * disse na conversa que vai confirmar o valor, e o card repetir isso é ruído.
 *
 * `whatsapp` marca a promoção como o WhatsApp desenha: o preço antigo
 * ~riscado~ e o novo em *negrito*. Cor não existe lá; o riscado é o que
 * separa um do outro. Só para quem desenha a marcação (o card da Cloud API e
 * a Inbox); o Instagram e o texto puro mostrariam os símbolos crus.
 */
export function linhasDoCard(
  produto: ProdutoDaLoja,
  opcoes: { whatsapp?: boolean } = {},
): { titulo: string; detalhe: string } {
  const partes: string[] = []
  if (produto.precoAPartirDe !== undefined) partes.push(`a partir de ${comoDinheiro(produto.precoAPartirDe)}`)
  else if (produto.preco !== undefined) {
    partes.push(
      produto.precoDe !== undefined
        ? opcoes.whatsapp
          ? `de ~${comoDinheiro(produto.precoDe)}~ por *${comoDinheiro(produto.preco)}*`
          : `de ${comoDinheiro(produto.precoDe)} por ${comoDinheiro(produto.preco)}`
        : comoDinheiro(produto.preco),
    )
  }
  // Catálogo próprio: ninguém conta estoque, então o card não afirma nada.
  if (!produto.semControleDeEstoque) {
    if (!produto.emEstoque) partes.push('esgotado')
    else if (produto.quantidade !== undefined && produto.quantidade <= ULTIMAS_UNIDADES) {
      partes.push(produto.quantidade === 1 ? 'última unidade' : `últimas ${produto.quantidade} unidades`)
    } else partes.push('em estoque')
  }
  return { titulo: produto.nome, detalhe: partes.join(', ') }
}

/**
 * O card quando ele não pode ser card: sem foto real, ou num canal sem o
 * recurso. Texto com o link no fim, e a prévia do link mostra o que a loja
 * tiver. Nunca a foto placeholder da loja.
 */
export function textoDoCard(produto: ProdutoDaLoja): string {
  const { titulo, detalhe } = linhasDoCard(produto)
  // Item do catálogo próprio pode não ter preço nem link: linha vazia no
  // WhatsApp é espaço sobrando no meio da mensagem.
  return [titulo, detalhe, produto.link].filter(Boolean).join('\n')
}

/*
 * ---------------------------------------------------------------------------
 * A ficha do produto: descrição e especificações, para a IA tirar dúvida
 * ---------------------------------------------------------------------------
 *
 * A busca traz nome, preço e estoque, e isso não responde "funciona no PS5?"
 * nem "o microfone é removível?". A resposta mora na página do produto, e a
 * IA só a lê quando a pergunta pede (`loja_detalhes`), porque a ficha é o
 * pedaço mais caro em token de toda a conversa.
 */

/** Quanto da ficha chega ao modelo. Folga para a pergunta comum, e só. */
export const LIMITE_DA_FICHA = 1500

export type FichaDoProduto = {
  produtoId: string
  nome: string
  descricao: string
  /** Atributos de escolha da loja ("headsetcommicrofone: Retrátil"). */
  especificacoes: string[]
}

export const QUERY_FICHA = `query Ficha($sku: String) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    items { sku name short_description { html } description { html } }
  }
}`

/**
 * Os atributos, numa consulta à parte porque `custom_attributesV2` só existe
 * do Magento 2.4.7 em diante: na mesma consulta, loja mais velha recusaria a
 * ficha inteira por causa de um campo que é só complemento.
 */
export const QUERY_ATRIBUTOS = `query Atributos($sku: String) {
  products(filter: { sku: { eq: $sku } }, pageSize: 1) {
    items { custom_attributesV2 { items { code ... on AttributeSelectedOptions { selected_options { label } } } } }
  }
}`

/**
 * Atributo de escolha que é configuração da loja, e não do produto.
 * Medido na PCYES (25/set/2026): status, layout de página, frete, Facebook.
 * Custo, fornecedor e estoque entram por precaução: se a loja um dia criar
 * esse atributo, ele não vai parar na boca do bot.
 */
const ATRIBUTO_INTERNO =
  /^(status|visibility|page_layout|options_container|msrp_|gift_|tax_class|am_|send_to_|freterapido_|custom_design|custom_layout|mais_vendido|quantity_and_stock|cost|custo|fornecedor|supplier|margem|estoque|stock|qty)/

const ENTIDADES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&amp;': '&',
}

/**
 * HTML de descrição virando texto que se lê.
 *
 * **Duas passadas, e é medido.** A descrição da PCYES é HTML do Page Builder
 * com outro HTML dentro, escapado (`&lt;style&gt;` com centenas de linhas de
 * CSS). Uma passada tira as tags de fora e revela as de dentro como texto; a
 * segunda tira essas. Sem ela, o modelo recebia 11 mil caracteres de CSS.
 */
export function limparHtml(html: string): string {
  let texto = html
  for (let passada = 0; passada < 2; passada++) {
    texto = texto
      .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|table|ul|ol)>/gi, '\n')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(lt|gt|quot|#39|apos|nbsp|amp);/g, (e) => ENTIDADES[e] ?? e)
  }
  return texto
    .split('\n')
    .map((linha) => linha.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** Corta no fim de uma linha ou palavra, para não partir número no meio. */
function cortarFicha(texto: string, limite: number): string {
  if (texto.length <= limite) return texto
  const pedaco = texto.slice(0, limite)
  const quebra = Math.max(pedaco.lastIndexOf('\n'), pedaco.lastIndexOf(' '))
  return `${(quebra > limite * 0.8 ? pedaco.slice(0, quebra) : pedaco).trimEnd()}…`
}

export function traduzirFicha(json: unknown, atributos: unknown): FichaDoProduto | null {
  const item = itensDe(json)[0] as
    | { sku?: unknown; name?: unknown; short_description?: { html?: unknown }; description?: { html?: unknown } }
    | undefined
  if (!item || typeof item.sku !== 'string' || typeof item.name !== 'string') return null

  const html = (campo: { html?: unknown } | undefined) => (typeof campo?.html === 'string' ? limparHtml(campo.html) : '')
  const curta = html(item.short_description)
  const longa = html(item.description)
  // A curta primeiro: na PCYES é ela que traz os números (frequência,
  // sensibilidade, compatibilidade). A longa entra com o que sobrar.
  const descricao = cortarFicha([curta, longa].filter(Boolean).join('\n'), LIMITE_DA_FICHA)

  const brutos = (itensDe(atributos)[0] as { custom_attributesV2?: { items?: unknown } } | undefined)
    ?.custom_attributesV2?.items
  const especificacoes = (Array.isArray(brutos) ? brutos : []).flatMap((a) => {
    const { code, selected_options } = a as { code?: unknown; selected_options?: unknown }
    if (typeof code !== 'string' || ATRIBUTO_INTERNO.test(code) || !Array.isArray(selected_options)) return []
    const rotulos = selected_options
      .map((o) => (o as { label?: unknown }).label)
      .filter((l): l is string => typeof l === 'string' && l !== '')
    return rotulos.length > 0 ? [`${code}: ${rotulos.join(', ')}`] : []
  })

  return { produtoId: item.sku, nome: item.name, descricao, especificacoes: especificacoes.slice(0, 15) }
}

/*
 * ---------------------------------------------------------------------------
 * Frete por CEP
 * ---------------------------------------------------------------------------
 */

export type OpcaoDeFrete = { transportadora: string; servico: string; preco: number }

/** Só os 8 dígitos. Qualquer outra coisa não é CEP, e a loja nem é chamada. */
export function cepLimpo(cep: string): string | null {
  const digitos = cep.replace(/\D/g, '')
  return digitos.length === 8 ? digitos : null
}

/**
 * O que `estimate-shipping-methods` devolve, virando o que a IA lê.
 *
 * O prazo vem dentro do nome do serviço ("PAC (7 dias úteis)"), e é assim
 * que ele vai: separar seria adivinhar o formato de cada transportadora.
 * Indisponível sai; mais barato primeiro.
 */
export function traduzirFrete(json: unknown): OpcaoDeFrete[] {
  if (!Array.isArray(json)) return []
  return json
    .flatMap((m) => {
      const o = m as { available?: unknown; carrier_title?: unknown; method_title?: unknown; amount?: unknown }
      if (o.available === false || typeof o.amount !== 'number') return []
      return [
        {
          transportadora: typeof o.carrier_title === 'string' ? o.carrier_title : '',
          servico: typeof o.method_title === 'string' ? o.method_title : '',
          preco: o.amount,
        },
      ]
    })
    .sort((a, b) => a.preco - b.preco)
}
