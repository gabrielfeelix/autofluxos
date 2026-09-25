/**
 * Drivers e manuais da loja, lidos da página pública de downloads.
 *
 * **Por que HTML e não API.** A PCYES publica os arquivos em `/drivers`, um
 * módulo próprio do Magento sem GraphQL nem REST (medido em 25/set/2026: a
 * busca `?q=basaran` devolve os produtos em cards, e a página de cada um
 * separa "Drivers" de "Manuais" com o link direto do arquivo). Ler a página é
 * a única porta, e ela é a mesma que qualquer visitante vê.
 *
 * **Puro de propósito**: recebe o HTML, devolve dado. Quem baixa é o adaptador
 * (`loja/magento.ts`), pela chamada que confere rede interna. Se a loja mudar
 * o layout, o que quebra é só isto, e quebra vazio: lista sem item vira "não
 * achei", nunca um arquivo errado.
 */

/** Um produto da página de downloads, como a busca devolve. */
export type ItemDeDownload = { manualId: string; nome: string; categoria: string }

/** Um arquivo da página do produto. */
export type ArquivoDeDownload = { secao: 'driver' | 'manual' | 'outro'; nome: string; url: string; formato: string }

/** Quantos produtos a busca devolve ao modelo. Mais que isso é lista, não resposta. */
export const LIMITE_DE_MANUAIS = 5

export function linkDaBuscaDeDownloads(endereco: string, termo: string): string {
  const url = new URL(`${endereco}/drivers/index/index/`)
  url.searchParams.set('category', 'all')
  url.searchParams.set('limit', '12')
  url.searchParams.set('q', termo.trim())
  return url.toString()
}

/** A página de um produto. `null` para id que não é número: ele vira caminho de URL. */
export function linkDaPaginaDeDownloads(endereco: string, manualId: string): string | null {
  return /^\d{1,9}$/.test(manualId) ? `${endereco}/drivers/index/view/id/${manualId}/` : null
}

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

function texto(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Os produtos da busca. Cada card é um `<a>` para `/drivers/index/view/id/N/`
 * com a foto (o `alt` é o nome) e o selo da categoria.
 */
export function lerBuscaDeDownloads(html: string): ItemDeDownload[] {
  const itens: ItemDeDownload[] = []
  const vistos = new Set<string>()
  const cards = html.split(/<a\s+href="[^"]*\/drivers\/index\/view\/id\//).slice(1)
  for (const card of cards) {
    const id = /^(\d{1,9})\//.exec(card)?.[1]
    if (!id || vistos.has(id)) continue
    // O card acaba no próximo `</a>`; o resto é do vizinho.
    const corpo = card.slice(0, card.indexOf('</a>') === -1 ? undefined : card.indexOf('</a>'))
    const nome = texto(/alt="([^"]*)"/.exec(corpo)?.[1] ?? '')
    if (nome === '') continue
    const categoria = texto(/class="product-category-badge"[^>]*>([\s\S]*?)<\/span>/.exec(corpo)?.[1] ?? '')
    vistos.add(id)
    itens.push({ manualId: id, nome, categoria })
    if (itens.length >= LIMITE_DE_MANUAIS) break
  }
  return itens
}

/**
 * Os arquivos da página de um produto, com a seção de onde vieram.
 *
 * A seção decide o que o bot faz: manual em PDF vai anexado na conversa;
 * driver é executável, que o WhatsApp não entrega, e vai pela página. Só
 * `https`: o link sai daqui direto para o celular de alguém.
 */
export function lerPaginaDeDownloads(html: string): { nome: string; arquivos: ArquivoDeDownload[] } {
  const titulo = texto(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
  const nome = titulo.split(/\s+[|–-]\s+/)[0] ?? titulo

  const arquivos: ArquivoDeDownload[] = []
  const secoes = html.split(/<h2 class="download-section-title">/).slice(1)
  for (const secaoHtml of secoes) {
    const tituloDaSecao = texto(secaoHtml.slice(0, secaoHtml.indexOf('</h2>'))).toLowerCase()
    const secao: ArquivoDeDownload['secao'] = tituloDaSecao.startsWith('driver')
      ? 'driver'
      : tituloDaSecao.startsWith('manua')
        ? 'manual'
        : 'outro'
    for (const card of secaoHtml.split(/<div class="download-card">/).slice(1)) {
      const url = /<a href="(https:\/\/[^"\s]+)"/.exec(card)?.[1]
      if (!url) continue
      arquivos.push({
        secao,
        nome: texto(/class="download-name"[^>]*>([\s\S]*?)<\/div>/.exec(card)?.[1] ?? ''),
        url,
        formato: formatoDaUrl(url),
      })
    }
  }
  return { nome, arquivos }
}

/**
 * O formato pela extensão da URL, e não pelo selo da página: o selo do driver
 * do Basaran diz "ZIP" e o arquivo é `.exe` (25/set/2026).
 */
function formatoDaUrl(url: string): string {
  const caminho = new URL(url).pathname.toLowerCase()
  return /\.([a-z0-9]{2,4})$/.exec(caminho)?.[1] ?? ''
}

/** O manual que vai anexado: o primeiro PDF da seção de manuais. */
export function manualEmPdf(arquivos: ArquivoDeDownload[]): ArquivoDeDownload | null {
  return arquivos.find((a) => a.secao === 'manual' && a.formato === 'pdf') ?? null
}

/** Nome do arquivo que a pessoa vê antes de baixar. Sem caractere que celular estranhe. */
export function nomeDoArquivoDoManual(produto: string): string {
  const limpo = produto.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `Manual ${limpo || 'do produto'}.pdf`
}

/**
 * A legenda que vai com o PDF, no estilo de quem manda exame: o arquivo em
 * cima, a explicação embaixo, na mesma mensagem. Escrita aqui e não pelo
 * modelo, para o link da página nunca ser inventado.
 */
export function legendaDoManual(produto: string, paginaDeDownloads: string, temDriver: boolean): string {
  return [
    `📄 *Manual: ${produto}*`,
    '',
    'Pronto! O manual está no arquivo acima.',
    '',
    temDriver ? `💾 Driver e outros arquivos:\n${paginaDeDownloads}` : `Outros arquivos do produto:\n${paginaDeDownloads}`,
  ].join('\n')
}
