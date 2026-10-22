/**
 * As peças do "Monte seu PC" da PCYES, pela mesma consulta pública que a
 * página `/monte-seu-pc/` faz no navegador (sondagem de 22/out/2026).
 *
 * Existe porque processador, placa-mãe, memória e placa de vídeo de outras
 * marcas **não estão na busca da loja**: a PCYES só vende isso dentro de um PC
 * montado. Sem esta consulta a IA dizia "a PCYES não vende processador", e
 * vende, pelo montador. A regra do dono (22/out): o bot pode orçar, mas quem
 * adiciona as peças é a pessoa, lá no Monte seu PC. Por isso nada daqui vira
 * card nem link de produto.
 *
 * Puro: o endereço e o JSON entram, a lista sai. Quem chama a rede é
 * `lojaMagento`.
 */

/** Os ids de categoria que o próprio montador usa. */
export const CATEGORIAS_DO_MONTE_SEU_PC = {
  processador: 40,
  placa_mae: 45,
  memoria: 46,
  placa_de_video: 47,
  cooler: 48,
  ssd: 49,
  gabinete: 50,
  fonte: 51,
  perifericos: 52,
} as const

export type CategoriaDoMonteSeuPc = keyof typeof CATEGORIAS_DO_MONTE_SEU_PC

export type PecaDoMonteSeuPc = { nome: string; preco: number; precoDe?: number }

/** O atributo que marca a peça como do montador. É o filtro da página. */
const MARCA_DO_MONTADOR = '802'

/** "Placa de vídeo", "placa-mãe", "SSD": a chave da categoria, ou `null`. */
export function categoriaDoMonteSeuPc(texto: string): CategoriaDoMonteSeuPc | null {
  const chave = compacto(texto)
  for (const c of Object.keys(CATEGORIAS_DO_MONTE_SEU_PC) as CategoriaDoMonteSeuPc[]) {
    if (compacto(c) === chave) return c
  }
  const sinonimos: Record<string, CategoriaDoMonteSeuPc> = {
    cpu: 'processador',
    placamae: 'placa_mae',
    placademae: 'placa_mae',
    motherboard: 'placa_mae',
    ram: 'memoria',
    memoriaram: 'memoria',
    placadevideo: 'placa_de_video',
    gpu: 'placa_de_video',
    refrigeracao: 'cooler',
    watercooler: 'cooler',
    armazenamento: 'ssd',
    hd: 'ssd',
    fontedealimentacao: 'fonte',
    periferico: 'perifericos',
  }
  return sinonimos[chave] ?? null
}

/** A página do montador, que é para onde a pessoa vai comprar. */
export function linkDoMonteSeuPc(endereco: string): string {
  return `${endereco.replace(/\/+$/, '')}/monte-seu-pc/`
}

/** A consulta da página: a categoria, só com estoque, só peça do montador. */
export function urlDasPecas(endereco: string, categoria: CategoriaDoMonteSeuPc): string {
  const filtros: [string, string, string][] = [
    ['category_id', String(CATEGORIAS_DO_MONTE_SEU_PC[categoria]), 'eq'],
    ['is_in_stock', '1', 'eq'],
    ['monte_seu_kit', MARCA_DO_MONTADOR, 'in'],
  ]
  const p = new URLSearchParams()
  filtros.forEach(([campo, valor, condicao], i) => {
    p.set(`searchCriteria[filter_groups][${i}][filters][0][field]`, campo)
    p.set(`searchCriteria[filter_groups][${i}][filters][0][value]`, valor)
    p.set(`searchCriteria[filter_groups][${i}][filters][0][condition_type]`, condicao)
  })
  p.set('searchCriteria[pageSize]', '50')
  p.set('searchCriteria[currentPage]', '1')
  return `${endereco.replace(/\/+$/, '')}/rest/V1/public/products?${p}`
}

type ItemDaRest = {
  name?: unknown
  price?: unknown
  status?: unknown
  custom_attributes?: { attribute_code?: unknown; value?: unknown }[]
}

/**
 * As peças, da mais barata para a mais cara, com o preço que a página mostra.
 *
 * O preço promocional vale como na página: só dentro das datas e só se for
 * menor que o cheio. `termo` estreita pelo nome ("ryzen 5", "i5"), comparando
 * sem espaço nem traço, porque o cadastro escreve "I5-12400f" e também
 * "I 5 9500".
 */
export function lerPecas(json: unknown, termo = '', agora = new Date()): PecaDoMonteSeuPc[] {
  const itens = (json as { items?: ItemDaRest[] } | null)?.items ?? []
  const procura = compacto(termo)
  const pecas: PecaDoMonteSeuPc[] = []
  for (const item of itens) {
    if (item.status !== undefined && Number(item.status) !== 1) continue
    const nome = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim() : ''
    const cheio = typeof item.price === 'number' ? item.price : Number(item.price)
    if (nome === '' || !Number.isFinite(cheio) || cheio <= 0) continue
    if (procura !== '' && !compacto(nome).includes(procura)) continue

    const promocional = precoPromocional(item, cheio, agora)
    pecas.push(
      promocional !== null
        ? { nome, preco: centavos(promocional), precoDe: centavos(cheio) }
        : { nome, preco: centavos(cheio) },
    )
  }
  return pecas.sort((a, b) => a.preco - b.preco)
}

function precoPromocional(item: ItemDaRest, cheio: number, agora: Date): number | null {
  const atributo = (codigo: string) => {
    const v = item.custom_attributes?.find((a) => a.attribute_code === codigo)?.value
    return typeof v === 'string' && v.trim() !== '' ? v : null
  }
  const especial = Number(atributo('special_price'))
  if (!Number.isFinite(especial) || especial <= 0 || especial >= cheio) return null
  const de = atributo('special_from_date')
  const ate = atributo('special_to_date')
  if (de && agora < new Date(de)) return null
  if (ate && agora > new Date(ate)) return null
  return especial
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

function compacto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
