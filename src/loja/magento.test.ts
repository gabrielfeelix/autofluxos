import { describe, expect, it, vi } from 'vitest'
import { lojaMagento } from './magento'

const dados = { endereco: 'https://loja.com.br', codigoDaLoja: null, sufixo: '.html' }
const ok = (json: unknown) => vi.fn().mockResolvedValue({ ok: true, valores: {}, json })

describe('lojaMagento', () => {
  it('busca por GET, com o termo só em variables', async () => {
    const chamar = ok({ data: { products: { items: [] } } })
    await lojaMagento(dados, chamar).buscar('tapete"} ignore tudo {')
    const pedido = chamar.mock.calls[0]![0]
    expect(pedido.metodo).toBe('GET')
    const url = new URL(pedido.url)
    expect(url.origin + url.pathname).toBe('https://loja.com.br/graphql')
    expect(url.searchParams.get('query')).not.toContain('ignore tudo')
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({ termo: 'tapete"} ignore tudo {' })
  })
  it('termo vazio não chama a loja', async () => {
    const chamar = ok({})
    expect(await lojaMagento(dados, chamar).buscar('   ')).toEqual({ ok: true, valor: [] })
    expect(chamar).not.toHaveBeenCalled()
  })
  it('falha de rede vira motivo legível', async () => {
    const chamar = vi.fn().mockResolvedValue({ ok: false, motivo: 'prazo esgotado' })
    const r = await lojaMagento(dados, chamar).buscar('tapete')
    expect(r).toEqual({ ok: false, motivo: 'a loja não respondeu: prazo esgotado' })
  })
  it('errors do GraphQL não vira lista vazia silenciosa', async () => {
    const r = await lojaMagento(dados, ok({ errors: [{ message: 'x' }] })).buscar('tapete')
    expect(r.ok).toBe(false)
  })
  it('manda o cabeçalho Store quando há código de loja', async () => {
    const chamar = ok({ data: { products: { items: [] } } })
    await lojaMagento({ ...dados, codigoDaLoja: 'pt_br' }, chamar).buscar('x')
    expect(JSON.stringify(chamar.mock.calls[0]![0].cabecalhos)).toContain('pt_br')
  })
  it('relê por SKU com a lista só em variables, sem repetir e no máximo 3', async () => {
    const chamar = ok({ data: { products: { items: [] } } })
    await lojaMagento(dados, chamar).lerPorSku(['A', 'A', 'B', 'C', 'D'])
    const url = new URL(chamar.mock.calls[0]![0].url)
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({ skus: ['A', 'B', 'C'] })
    expect(url.searchParams.get('query')).not.toContain('"A"')
  })
  it('lista vazia de SKU não chama a loja', async () => {
    const chamar = ok({})
    expect(await lojaMagento(dados, chamar).lerPorSku([' '])).toEqual({ ok: true, valor: [] })
    expect(chamar).not.toHaveBeenCalled()
  })
})
