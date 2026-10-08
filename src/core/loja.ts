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
  /** Só no catálogo próprio: o grupo do item (0106), "Pizzas", "Bebidas". */
  categoria?: string
  /** Só no catálogo próprio: serviço agenda, produto pede (o botão da foto). */
  especie?: 'produto' | 'servico'
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

/**
 * O teto é o tamanho da página pedida: o bot pede os 5 de sempre, o seletor
 * do Inbox pede 20. Cortar sempre em 5 escondia o resto do seletor.
 */
export function traduzirProdutos(
  json: unknown,
  endereco: string,
  sufixo: string,
  limite = LIMITE_DE_PRODUTOS,
): ProdutoDaLoja[] {
  return itensDe(json)
    .map((i) => traduzirItem(i, endereco, sufixo))
    .filter((p): p is ProdutoDaLoja => p !== null)
    .slice(0, limite)
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
/**
 * Como um produto sai no canal.
 *
 * - **card**: tem link (o botão do card precisa dele) e foto, ou o canal
 *   desenha card sem foto;
 * - **imagem**: tem foto e não tem link. Antes ia como texto, e a foto
 *   sumia: o item do cardápio de um restaurante, que não tem página para
 *   linkar, chegava sem a foto que a pessoa pediu. Agora vai a foto com o
 *   texto do card na legenda, sem botão;
 * - **texto**: o resto.
 */
export function comoMandarProduto(
  produto: Pick<ProdutoDaLoja, 'link' | 'foto'>,
  canal: { temCard: boolean; cardSemFoto?: boolean; temPedir?: boolean },
): 'card' | 'pedir' | 'imagem' | 'texto' {
  const foto = (produto.foto ?? '').startsWith('https://')
  if (canal.temCard && produto.link && (foto || canal.cardSemFoto)) return 'card'
  // Foto sem link, num canal que desenha botão de resposta: a foto com o botão
  // de pedir embaixo. O produto com link (a loja on-line) nunca chega aqui.
  if (foto && !produto.link && canal.temPedir) return 'pedir'
  if (foto && !produto.link) return 'imagem'
  return 'texto'
}

/**
 * O botão embaixo da foto do produto sem link: pedir, ou agendar o serviço.
 *
 * O id carrega o nome, e é assim que o toque volta: `pedidoDoBotao` o lê e a
 * conversa recebe "Quero pedir: <nome>" como se a pessoa tivesse escrito. O
 * prefixo separa este botão de qualquer opção desenhada num fluxo.
 */
export const PREFIXO_DO_BOTAO_DE_PEDIDO = 'af-pedir:'

export function botaoDePedido(produto: Pick<ProdutoDaLoja, 'nome' | 'especie'>): { id: string; rotulo: string } {
  return {
    id: `${PREFIXO_DO_BOTAO_DE_PEDIDO}${[...produto.nome].slice(0, 200).join('')}`,
    rotulo: produto.especie === 'servico' ? 'Agendar' : 'Pedir',
  }
}

/** O texto que o toque no botão de pedir vira. `null` = não é esse botão. */
export function pedidoDoBotao(id: string): string | null {
  if (!id.startsWith(PREFIXO_DO_BOTAO_DE_PEDIDO)) return null
  const nome = id.slice(PREFIXO_DO_BOTAO_DE_PEDIDO.length).trim()
  return nome === '' ? null : `Quero pedir: ${nome}`
}

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

/**
 * A lista de produtos que a IA escreveu em texto vira vitrine com foto.
 *
 * A instrução pede "mostre com loja_mostrar, nunca em lista", e o Gemini
 * obedece; o Groq, primeiro da cadeia em produção, às vezes busca, não
 * mostra e escreve "• Milk-shake de chocolate - 500 ml..." (27/set, demo).
 * Pedir de novo no prompt é pedir. Aqui o servidor garante: linha de lista
 * que cita um produto que a busca trouxe **com foto e sem link** (catálogo
 * próprio) sai do texto, e o produto vai como foto com o botão de pedir.
 *
 * Produto com link (loja on-line) não entra: lá a lista em texto com o card
 * depois é o comportamento de sempre. `null` = nada a fazer.
 */
/**
 * O lugar onde a IA escreveu a chamada da vitrine em vez de chamar
 * (`interpretarResposta`). Nunca chega a ninguém: `vitrineDoTexto` tira a
 * linha e põe as fotos do que a busca trouxe.
 */
export const MARCA_DE_MOSTRAR = '⟦mostrar⟧'

/** O texto sem as linhas da marca: para quem não tem vitrine para pôr no lugar. */
export function semMarcaDeMostrar(texto: string): string {
  if (!texto.includes(MARCA_DE_MOSTRAR)) return texto
  return texto.split('\n').filter((l) => !l.includes(MARCA_DE_MOSTRAR)).join('\n').replace(/\n{3,}/g, '\n\n').trim() || 'Olha só 👇'
}

/** Até `maximo` produtos, alternando entre as partes do cardápio, na ordem em que vieram. */
function alternarPorParte(produtos: readonly ProdutoDaLoja[], maximo: number): ProdutoDaLoja[] {
  const partes = new Map<string, ProdutoDaLoja[]>()
  for (const p of produtos) {
    const chave = p.categoria ?? ''
    partes.set(chave, [...(partes.get(chave) ?? []), p])
  }
  const filas = [...partes.values()]
  const saida: ProdutoDaLoja[] = []
  for (let i = 0; saida.length < maximo && filas.some((f) => f.length > i); i++) {
    for (const f of filas) if (f[i] && saida.length < maximo) saida.push(f[i]!)
  }
  return saida
}

/**
 * A frase promete um link ou card que não saiu: "pelo link abaixo", "no card
 * aqui embaixo", "👇".
 *
 * 07/out/2026, PCYES: "Suporte Para Tablet ... PLMSA01A" esgotado. A IA buscou,
 * escreveu "você pode acessar a página dele pelo link abaixo" e não chamou
 * `loja_mostrar`; a pessoa ficou sem link nenhum. Ver `produtosPrometidos`.
 */
export const PROMETE_LINK =
  /\b(link|card|bot[aã]o|p[aá]gina)\b[^.\n]{0,40}\b(abaixo|embaixo|a seguir)\b|\bpelo link\b|👇/i

/**
 * Quais dos produtos buscados a frase prometeu, para o servidor mandar o card.
 *
 * Só o que dá para afirmar: o produto cujo código de modelo (palavra com letra
 * e número, como `PLMSA01A` ou `ST-LDA33GT`) aparece no que a pessoa escreveu
 * ou na frase, ou o único que a busca trouxe. Na dúvida, nenhum: card errado é
 * pior do que card faltando.
 */
export function produtosPrometidos(
  buscados: readonly ProdutoDaLoja[],
  pergunta: string,
  frase: string,
  maximo = 3,
): ProdutoDaLoja[] {
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const unicos = buscados.filter((p, i) => buscados.findIndex((q) => q.produtoId === p.produtoId) === i)
  const onde = norm(`${pergunta} ${frase}`)
  const codigos = (nome: string) =>
    nome.split(/\s+/).map(norm).filter((t) => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t))
  const citados = unicos.filter((p) => codigos(p.nome).some((c) => onde.includes(c)))
  if (citados.length > 0) return citados.slice(0, maximo)
  return unicos.length === 1 ? unicos : []
}

export function vitrineDoTexto(
  texto: string,
  buscados: readonly ProdutoDaLoja[],
  maximo = 3,
): { texto: string; produtos: ProdutoDaLoja[] } | null {
  const norm = (t: string) =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  // O nome sem a medida do fim ("Milk-shake de chocolate 500 ml" → "milk shake de chocolate").
  const nucleo = (nome: string) => norm(nome).replace(/\s+\d+([.,]\d+)?\s*(ml|l|g|kg|cm)$/, '').trim()
  const candidatos = buscados.filter(
    (p, i) =>
      !p.link && (p.foto ?? '').startsWith('https://') && buscados.findIndex((q) => q.produtoId === p.produtoId) === i,
  )
  // A marca some sempre, mesmo sem produto para pôr no lugar.
  const marcou = texto.includes(MARCA_DE_MOSTRAR)
  if (marcou) texto = texto.split('\n').filter((l) => !l.includes(MARCA_DE_MOSTRAR)).join('\n')
  if (candidatos.length === 0) {
    return marcou ? { texto: texto.replace(/\n{3,}/g, '\n\n').trim() || 'Olha só 👇', produtos: [] } : null
  }

  const BULLET = /^\s*([•·▪◦*-]|\d+[.)])\s+/
  const escolhidos: ProdutoDaLoja[] = []
  const linhas = texto.split('\n').filter((linha) => {
    if (!BULLET.test(linha)) return true
    const l = norm(linha)
    const achado = candidatos.find((p) => nucleo(p.nome).length >= 3 && l.includes(nucleo(p.nome)))
    if (!achado) return true
    if (!escolhidos.includes(achado)) escolhidos.push(achado)
    return false
  })
  if (escolhidos.length === 0 && !marcou) return null

  const limpo = linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const produtos = escolhidos.length > 0 ? escolhidos.slice(0, maximo) : alternarPorParte(candidatos, maximo)
  return { texto: limpo === '' ? 'Olha só 👇' : limpo, produtos }
}
