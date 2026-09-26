import { describe, expect, it } from 'vitest'
import type { Produto } from '@/core/produtos'
import { lojaCatalogo } from './catalogo'

function produto(p: Partial<Produto> & { id: string; nome: string }): Produto {
  return {
    especie: 'produto',
    preco: null,
    sku: null,
    descricao: null,
    link: null,
    foto: null,
    categoria: null,
    ordem: null,
    arquivadoEm: null,
    ...p,
  }
}

const CATALOGO: Produto[] = [
  produto({
    id: 'u1',
    nome: 'Cadeira Gamer Sentinel',
    sku: 'CAD-001',
    preco: 1299.9,
    descricao: 'Ergonômica, cor preta',
    link: 'https://loja/cadeira',
    foto: 'https://cdn/cadeira.png',
  }),
  produto({ id: 'u2', nome: 'Avaliação física', especie: 'servico', preco: 150 }),
  produto({ id: 'u3', nome: 'Cadeira de escritório', descricao: 'Cor branca' }),
  produto({ id: 'u4', nome: 'Cadeira velha', arquivadoEm: '2026-09-01T00:00:00Z' }),
]

const loja = lojaCatalogo(async () => CATALOGO)

async function nomes(termo: string) {
  const r = await loja.buscar(termo)
  if (!r.ok) throw new Error(r.motivo)
  return r.valor.map((p) => p.nome)
}

describe('lojaCatalogo.buscar', () => {
  it('acha por nome sem acento e sem caixa', async () => {
    expect(await nomes('avaliacao')).toEqual(['Avaliação física'])
  })

  it('acha por SKU e por descrição', async () => {
    expect(await nomes('cad-001')).toEqual(['Cadeira Gamer Sentinel'])
    expect(await nomes('ergonomica')).toEqual(['Cadeira Gamer Sentinel'])
  })

  it('com várias palavras, prefere quem tem todas', async () => {
    expect(await nomes('cadeira preta')).toEqual(['Cadeira Gamer Sentinel'])
  })

  it('sem item com todas as palavras, devolve quem tem alguma, o melhor primeiro', async () => {
    expect(await nomes('cadeira azul')).toEqual(['Cadeira Gamer Sentinel', 'Cadeira de escritório'])
  })

  it('arquivado não aparece', async () => {
    expect(await nomes('velha')).toEqual([])
  })

  it('termo vazio não lista o catálogo inteiro', async () => {
    expect(await nomes('  ')).toEqual([])
  })

  it('traduz o item: sem preço não inventa preço, sem estoque controlado, link vazio sem link', async () => {
    const r = await loja.buscar('escritorio')
    expect(r.ok && r.valor[0]).toEqual({
      produtoId: 'u3',
      nome: 'Cadeira de escritório',
      descricao: 'Cor branca',
      emEstoque: true,
      semControleDeEstoque: true,
      link: '',
    })
    const s = await loja.buscar('sentinel')
    expect(s.ok && s.valor[0]).toMatchObject({
      produtoId: 'CAD-001',
      preco: 1299.9,
      foto: 'https://cdn/cadeira.png',
      link: 'https://loja/cadeira',
    })
  })
})

describe('lojaCatalogo, o resto da interface', () => {
  it('lerPorSku acha por SKU sem caixa e pelo id, na ordem pedida', async () => {
    const r = await loja.lerPorSku(['u2', 'cad-001', 'nao-existe'])
    expect(r.ok && r.valor.map((p) => p.nome)).toEqual(['Avaliação física', 'Cadeira Gamer Sentinel'])
  })

  it('lerPorSku não devolve arquivado', async () => {
    const r = await loja.lerPorSku(['u4'])
    expect(r.ok && r.valor).toEqual([])
  })

  it('combinaCom é vazio e linkDaBusca não existe', async () => {
    expect(await loja.combinaCom('CAD-001')).toEqual({ ok: true, valor: [] })
    expect(loja.linkDaBusca('cadeira')).toBe('')
  })

  it('banco fora do ar vira falha com motivo, não lista vazia', async () => {
    const quebrada = lojaCatalogo(async () => {
      throw new Error('timeout')
    })
    expect(await quebrada.buscar('cadeira')).toEqual({ ok: false, motivo: 'não deu para ler o catálogo: timeout' })
  })
})

describe('lojaCatalogo por categoria (0106)', () => {
  const cardapio = lojaCatalogo(async () => [
    produto({ id: 'p1', nome: 'Calabresa', categoria: 'Pizzas', preco: 45 }),
    produto({ id: 'p2', nome: 'Mussarela', categoria: 'Pizzas', preco: 40 }),
    produto({ id: 'b1', nome: 'Coca lata', categoria: 'Bebidas', preco: 6 }),
    produto({ id: 'b2', nome: 'Suco de calabresa', categoria: 'Bebidas', preco: 1 }),
    produto({ id: 's1', nome: 'Brinde calabresa' }),
  ])

  it('o nome do grupo acha os itens dele, mesmo sem a palavra no nome', async () => {
    const r = await cardapio.buscar('pizza')
    expect(r.ok && r.valor.map((p) => p.nome)).toEqual(['Calabresa', 'Mussarela'])
  })

  it('o filtro deixa só a categoria, sem distinguir caixa', async () => {
    const r = await cardapio.buscar('calabresa', { categoria: ' pizzas ' })
    expect(r.ok && r.valor.map((p) => p.produtoId)).toEqual(['p1'])
  })

  it('sem filtro, a busca vê todas as categorias e os itens sem categoria', async () => {
    const r = await cardapio.buscar('calabresa')
    expect(r.ok && r.valor.map((p) => p.produtoId)).toEqual(['p1', 'b2', 's1'])
  })

  it('categoria vazia é o mesmo que sem filtro', async () => {
    const r = await cardapio.buscar('calabresa', { categoria: '' })
    expect(r.ok && r.valor).toHaveLength(3)
  })

  it('o card leva a categoria, e lerPorSku respeita o filtro', async () => {
    const r = await cardapio.lerPorSku(['p1', 'b1'], { categoria: 'Bebidas' })
    expect(r.ok && r.valor).toEqual([expect.objectContaining({ produtoId: 'b1', categoria: 'Bebidas' })])
  })
})
