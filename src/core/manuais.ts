/**
 * Drivers e manuais da loja, pela consulta `drivers` do GraphQL da Magento.
 *
 * **Por que GraphQL, e por que antes era HTML.** Até out/2026 a PCYES publicava
 * os arquivos em `/drivers`, um módulo sem API, e ler a página era a única
 * porta. O site novo (front em Next.js, medido em 26/out/2026) trocou a
 * página por `/drivers-e-manuais`, que lê a consulta `drivers` do mesmo
 * `/graphql` da loja. O endereço antigo passou a dar 404 para tudo, e cada
 * pedido de driver virou "a consulta falhou" e foi para um atendente fora do
 * horário. A consulta é a mesma que a página pública faz no navegador.
 *
 * **Puro de propósito**: recebe o JSON, devolve dado. Quem chama é o adaptador
 * (`loja/magento.ts`). Se a loja mudar a consulta, o que quebra é só isto, e
 * quebra vazio: lista sem item vira "não achei", nunca um arquivo errado.
 */

/** Um produto da página de downloads, como a busca devolve. */
export type ItemDeDownload = { manualId: string; nome: string; categoria: string }

/** Um arquivo da página do produto. */
export type ArquivoDeDownload = { secao: 'driver' | 'manual' | 'outro'; nome: string; url: string; formato: string }

/** Quantos produtos a busca devolve ao modelo. Mais que isso é lista, não resposta. */
export const LIMITE_DE_MANUAIS = 5

/** A busca da página, a mesma de `/drivers-e-manuais?q=`. */
export const QUERY_BUSCA_DE_DOWNLOADS =
  'query($q:String){drivers(q:$q,category:"all",page:1,limit:12){items{id name category_name}}}'

/** Um produto: a foto e os dois arquivos que a página oferece. */
export const QUERY_DOWNLOADS = 'query($id:Int!){driver(id:$id){id name image link_driver link_manual}}'

export function linkDaBuscaDeDownloads(endereco: string, termo: string): string {
  const url = new URL(`${endereco.replace(/\/+$/, '')}/drivers-e-manuais`)
  if (termo.trim()) url.searchParams.set('q', termo.trim())
  return url.toString()
}

/** A página de um produto. `null` para id que não é número: ele vira caminho de URL. */
export function linkDaPaginaDeDownloads(endereco: string, manualId: string): string | null {
  return /^\d{1,9}$/.test(manualId) ? `${endereco.replace(/\/+$/, '')}/drivers-e-manuais/${manualId}` : null
}

type ItemDaConsulta = {
  id?: unknown
  name?: unknown
  category_name?: unknown
  image?: unknown
  link_driver?: unknown
  link_manual?: unknown
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : ''
}

/** Só `https`: o link sai daqui direto para o celular de alguém. */
function httpsDe(valor: unknown): string | null {
  const url = textoDe(valor)
  return url.startsWith('https://') ? url : null
}

/** Os produtos da busca, sem repetir e até `LIMITE_DE_MANUAIS`. */
export function lerBuscaDeDownloads(json: unknown): ItemDeDownload[] {
  const lista = (json as { data?: { drivers?: { items?: ItemDaConsulta[] | null } | null } } | null)?.data?.drivers?.items
  const itens: ItemDeDownload[] = []
  const vistos = new Set<string>()
  for (const item of Array.isArray(lista) ? lista : []) {
    const id = String(item?.id ?? '')
    const nome = textoDe(item?.name)
    if (!/^\d{1,9}$/.test(id) || nome === '' || vistos.has(id)) continue
    vistos.add(id)
    itens.push({ manualId: id, nome, categoria: textoDe(item.category_name) })
    if (itens.length >= LIMITE_DE_MANUAIS) break
  }
  return itens
}

/**
 * Os arquivos de um produto. A seção decide o que o bot faz: manual em PDF vai
 * anexado na conversa; driver é executável, que o WhatsApp não entrega, e vai
 * pela página. `null` quando o produto não existe.
 */
export function lerDownloads(json: unknown): { nome: string; foto: string | null; arquivos: ArquivoDeDownload[] } | null {
  const item = (json as { data?: { driver?: ItemDaConsulta | null } } | null)?.data?.driver
  if (!item) return null
  const nome = textoDe(item.name)
  const arquivos: ArquivoDeDownload[] = []
  const driver = httpsDe(item.link_driver)
  if (driver) arquivos.push({ secao: 'driver', nome: `Driver ${nome}`.trim(), url: driver, formato: formatoDaUrl(driver) })
  const manual = httpsDe(item.link_manual)
  if (manual) arquivos.push({ secao: 'manual', nome: `Manual ${nome}`.trim(), url: manual, formato: formatoDaUrl(manual) })
  if (nome === '' && arquivos.length === 0) return null
  return { nome, foto: httpsDe(item.image), arquivos }
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

/** Rótulo do botão do card: até 20 caracteres, o limite do `cta_url`. */
const ROTULOS = { driver: 'Baixar driver', manual: 'Ver manual', ambos: 'Ver downloads' } as const

/**
 * O card de quando não há manual em PDF para anexar: a foto do produto, o que
 * existe para baixar e um botão para a página. Em 06/out/2026 o cooler Duley
 * Black Vulcan da PCYES tinha driver `.exe` e manual `.doc`, nenhum dos dois
 * anexável, e a IA respondia com o endereço solto no meio da frase.
 *
 * Escrito aqui e não pelo modelo, pelo mesmo motivo da legenda do manual: o
 * link nunca é inventado. `null` quando a página não tem arquivo nenhum.
 */
export function cardDosDownloads(produto: string, arquivos: ArquivoDeDownload[]): { texto: string; rotulo: string } | null {
  const temDriver = arquivos.some((a) => a.secao === 'driver')
  const temManual = arquivos.some((a) => a.secao === 'manual')
  if (arquivos.length === 0) return null
  const linhas = [
    ...(temDriver ? ['💾 Driver para instalar no computador'] : []),
    ...(temManual ? ['📄 Manual do produto'] : []),
    ...(!temDriver && !temManual ? ['📁 Arquivos do produto'] : []),
  ]
  const rotulo = temDriver === temManual ? ROTULOS.ambos : temDriver ? ROTULOS.driver : ROTULOS.manual
  return {
    texto: [`*${produto}*`, '', ...linhas, '', 'Tudo na página oficial de downloads, é só tocar no botão.'].join('\n'),
    rotulo,
  }
}
