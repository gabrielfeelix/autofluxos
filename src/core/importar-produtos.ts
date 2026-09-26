/**
 * Importar o catálogo de uma planilha.
 *
 * Puro e sem rede. `core/planilha.ts` transforma o arquivo em linhas; este
 * arquivo decide o que cada linha quer dizer e o que ela faria no catálogo.
 * Quem grava é `server/acoes-importar-produtos.ts`.
 *
 * As decisões que importam:
 *
 *  - **linha com erro não derruba as outras.** A pessoa vê "linha 7: o tipo
 *    precisa ser produto ou serviço", e as outras 200 entram;
 *  - **casa por SKU, senão por nome.** Reimportar a mesma planilha atualiza em
 *    vez de duplicar, e é assim que se corrige preço em massa;
 *  - **célula vazia não apaga.** Numa atualização, só o que veio preenchido
 *    muda. Importar é somar e corrigir; apagar o preço de um item é gesto de
 *    um item só, na tela, e não efeito colateral de uma coluna em branco.
 */

import { normalizar } from './engine/interpolar'
import type { Linha } from './planilha'
import { conferirCategoria, conferirNome, conferirPreco, type Especie } from './produtos'

export type ItemDaPlanilha = {
  /** A linha na planilha, para o erro e a prévia apontarem para ela. */
  linha: number
  nome: string
  /** `null` = coluna vazia: item novo nasce produto, e o existente mantém. */
  especie: Especie | null
  sku: string | null
  preco: number | null
  descricao: string | null
  link: string | null
  foto: string | null
  /** O grupo no cardápio ou catálogo (0106). `null` = coluna vazia ou ausente. */
  categoria: string | null
}

export type ErroDaLinha = { linha: number; motivo: string }

export type Leitura =
  { ok: true; itens: ItemDaPlanilha[]; erros: ErroDaLinha[] } | { ok: false; motivo: string }

/** As colunas do modelo, na ordem em que o modelo as escreve. */
export const COLUNAS_DO_MODELO = ['nome', 'tipo', 'categoria', 'sku', 'preco', 'descricao', 'link', 'foto'] as const

type Coluna = (typeof COLUNAS_DO_MODELO)[number]

/**
 * Cabeçalho que a pessoa escreveu para o nome interno. Sem caixa e sem acento.
 * "produto" só vale como nome quando não há coluna "nome" (ver abaixo).
 */
const SINONIMOS: Record<string, Coluna> = {
  nome: 'nome',
  tipo: 'tipo',
  sku: 'sku',
  codigo: 'sku',
  preco: 'preco',
  valor: 'preco',
  descricao: 'descricao',
  link: 'link',
  url: 'link',
  foto: 'foto',
  imagem: 'foto',
  categoria: 'categoria',
  grupo: 'categoria',
  secao: 'categoria',
}

/** Teto de linhas por arquivo: acima disso a prévia vira página que ninguém lê. */
export const MAXIMO_DE_LINHAS = 2000

function chave(texto: string): string {
  return normalizar(texto)
}

function mapearCabecalho(celulas: string[]): Map<Coluna, number> | null {
  const mapa = new Map<Coluna, number>()
  celulas.forEach((bruto, i) => {
    const coluna = SINONIMOS[chave(bruto)]
    if (coluna && !mapa.has(coluna)) mapa.set(coluna, i)
  })
  // Planilha feita à mão costuma chamar a coluna do nome de "produto".
  const produto = celulas.findIndex((c) => chave(c) === 'produto')
  if (!mapa.has('nome') && produto >= 0) mapa.set('nome', produto)
  return mapa.has('nome') ? mapa : null
}

function endereco(
  bruto: string,
  oQue: 'link' | 'foto',
): { ok: true; valor: string | null } | { ok: false; motivo: string } {
  const texto = bruto.trim()
  if (texto === '') return { ok: true, valor: null }
  const artigo = oQue === 'foto' ? 'a foto' : 'o link'
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return {
      ok: false,
      motivo: `${artigo} precisa ser um endereço que começa com https://`,
    }
  }
  // `new URL` aceita "https:loja.com"; o banco (0093) exige as barras.
  if (url.protocol !== 'https:' || !/^https:\/\//i.test(texto)) {
    return {
      ok: false,
      motivo: `${artigo} precisa ser um endereço que começa com https://`,
    }
  }
  if (texto.length > 1000) return { ok: false, motivo: `${artigo} tem mais de 1000 caracteres` }
  // "HTTPS://" passa aqui e o check do banco é sensível a caixa.
  return { ok: true, valor: texto.replace(/^https:/i, 'https:') }
}

function lerLinha(
  { linha, celulas }: Linha,
  colunas: Map<Coluna, number>,
): { ok: true; item: ItemDaPlanilha } | { ok: false; motivo: string } {
  const celula = (c: Coluna) => {
    const i = colunas.get(c)
    return i === undefined ? '' : (celulas[i] ?? '').trim()
  }

  const nome = conferirNome(celula('nome'))
  if (!nome.ok) return nome

  const tipo = chave(celula('tipo'))
  let especie: Especie | null = null
  if (tipo === 'produto') especie = 'produto'
  else if (tipo === 'servico') especie = 'servico'
  else if (tipo !== '') return { ok: false, motivo: 'o tipo precisa ser "produto" ou "serviço"' }

  const preco = conferirPreco(celula('preco'))
  if (!preco.ok) return { ok: false, motivo: `preço: ${preco.motivo}` }

  const sku = celula('sku')
  if (sku.length > 64) return { ok: false, motivo: 'o SKU precisa ter até 64 caracteres' }

  const descricao = celula('descricao')
  if (descricao.length > 2000) return { ok: false, motivo: 'a descrição precisa ter até 2000 caracteres' }

  const link = endereco(celula('link'), 'link')
  if (!link.ok) return link
  const foto = endereco(celula('foto'), 'foto')
  if (!foto.ok) return foto

  const categoria = conferirCategoria(celula('categoria'))
  if (!categoria.ok) return categoria

  return {
    ok: true,
    item: {
      linha,
      nome: nome.nome,
      especie,
      sku: sku === '' ? null : sku,
      preco: preco.preco,
      descricao: descricao === '' ? null : descricao,
      link: link.valor,
      foto: foto.valor,
      categoria: categoria.categoria,
    },
  }
}

/** Cabeçalho na primeira linha, um item por linha depois dele. */
export function lerProdutosDaPlanilha(linhas: Linha[]): Leitura {
  const [cabecalho, ...corpo] = linhas
  const colunas = cabecalho ? mapearCabecalho(cabecalho.celulas) : null
  if (!colunas)
    return {
      ok: false,
      motivo: 'a primeira linha precisa ter uma coluna "nome"',
    }
  if (corpo.length === 0) {
    return {
      ok: false,
      motivo: 'a planilha não tem nenhuma linha de produto embaixo do cabeçalho',
    }
  }
  if (corpo.length > MAXIMO_DE_LINHAS) {
    return {
      ok: false,
      motivo: `a planilha tem ${corpo.length} linhas; o máximo por arquivo é ${MAXIMO_DE_LINHAS}`,
    }
  }

  const itens: ItemDaPlanilha[] = []
  const erros: ErroDaLinha[] = []
  const skus = new Map<string, number>()
  const nomes = new Map<string, number>()

  for (const linha of corpo) {
    const lida = lerLinha(linha, colunas)
    if (!lida.ok) {
      erros.push({ linha: linha.linha, motivo: lida.motivo })
      continue
    }
    const { item } = lida
    // Repetido dentro da mesma planilha: a segunda linha sobrescreveria a
    // primeira calada, ou esbarraria no índice único do banco.
    const chaveSku = item.sku === null ? null : chave(item.sku)
    const antesSku = chaveSku === null ? undefined : skus.get(chaveSku)
    if (antesSku !== undefined) {
      erros.push({
        linha: item.linha,
        motivo: `o SKU "${item.sku}" já apareceu na linha ${antesSku}`,
      })
      continue
    }
    const antesNome = nomes.get(chave(item.nome))
    if (antesNome !== undefined) {
      erros.push({
        linha: item.linha,
        motivo: `o nome "${item.nome}" já apareceu na linha ${antesNome}`,
      })
      continue
    }
    if (chaveSku !== null) skus.set(chaveSku, item.linha)
    nomes.set(chave(item.nome), item.linha)
    itens.push(item)
  }

  return { ok: true, itens, erros }
}

/** O que o catálogo ativo já tem, só o que o casamento precisa. */
export type ProdutoExistente = { id: string; nome: string; sku: string | null }

export type PlanoDeImportacao = {
  criar: ItemDaPlanilha[]
  atualizar: { id: string; item: ItemDaPlanilha }[]
  erros: ErroDaLinha[]
}

/**
 * O que cada linha faria no catálogo ativo: criar, atualizar ou nada (erro).
 *
 * Arquivado não entra no casamento: o índice único é só entre ativos, então
 * um item arquivado com o mesmo SKU não impede o novo, e reviver arquivado por
 * planilha seria decisão que ninguém tomou.
 */
export function planejarImportacao(
  itens: ItemDaPlanilha[],
  existentes: ProdutoExistente[],
): PlanoDeImportacao {
  const porSku = new Map<string, ProdutoExistente>()
  const porNome = new Map<string, ProdutoExistente>()
  for (const p of existentes) {
    if (p.sku) porSku.set(chave(p.sku), p)
    porNome.set(chave(p.nome), p)
  }

  const plano: PlanoDeImportacao = { criar: [], atualizar: [], erros: [] }
  const usados = new Map<string, number>()

  for (const item of itens) {
    const alvo = (item.sku ? porSku.get(chave(item.sku)) : undefined) ?? porNome.get(chave(item.nome))

    if (!alvo) {
      plano.criar.push(item)
      continue
    }

    const outroComONome = porNome.get(chave(item.nome))
    if (outroComONome && outroComONome.id !== alvo.id) {
      plano.erros.push({
        linha: item.linha,
        motivo: `já existe outro item chamado "${item.nome}" no catálogo`,
      })
      continue
    }

    const antes = usados.get(alvo.id)
    if (antes !== undefined) {
      plano.erros.push({
        linha: item.linha,
        motivo: `esta linha e a linha ${antes} atualizariam o mesmo item do catálogo`,
      })
      continue
    }

    usados.set(alvo.id, item.linha)
    plano.atualizar.push({ id: alvo.id, item })
  }

  return plano
}
