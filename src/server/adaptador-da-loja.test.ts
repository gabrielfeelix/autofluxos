import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lojaFalsa } from '@/loja/falsa'

const lojaDaConta = vi.hoisted(() => vi.fn())
vi.mock('./repos/lojas', () => ({ lojaDaConta }))
const lerCredencial = vi.hoisted(() => vi.fn())
vi.mock('./repos/conexoes', () => ({ lerCredencial }))
const lojaMagento = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento', () => ({ lojaMagento }))
const lojaAdmin = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento-admin', () => ({ lojaAdmin }))

const { lojaAtivaDaConta } = await import('./adaptador-da-loja')

const headset = { produtoId: '330107', nome: 'Headset', preco: 108.9, emEstoque: true, link: 'https://l/h' }
const base = {
  id: 'l1',
  clienteId: 'c1',
  plataforma: 'magento',
  endereco: 'https://www.pcyes.com.br',
  codigoDaLoja: 'default',
  sufixo: '',
  ativa: true,
  conexaoId: null,
  estoqueExato: 'desligado',
  estoqueId: null,
  verificadaEm: '2026-09-23T12:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  lojaMagento.mockReturnValue(lojaFalsa({ produtos: [headset] }))
})

describe('lojaAtivaDaConta', () => {
  it('sem loja ou desligada: null', async () => {
    lojaDaConta.mockResolvedValue(null)
    expect(await lojaAtivaDaConta('c1')).toBeNull()
    lojaDaConta.mockResolvedValue({ ...base, ativa: false })
    expect(await lojaAtivaDaConta('c1')).toBeNull()
  })

  it('sem token: a busca pública, sem ler o cofre', async () => {
    lojaDaConta.mockResolvedValue(base)
    const r = await (await lojaAtivaDaConta('c1'))!.buscar('headset')
    expect(r).toEqual({ ok: true, valor: [headset] })
    expect(lerCredencial).not.toHaveBeenCalled()
  })

  it('com token: foto e quantidade por cima', async () => {
    lojaDaConta.mockResolvedValue({ ...base, conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 't' })
    lojaAdmin.mockReturnValue({
      quantidade: async () => ({ ok: true, valor: 4 }),
      foto: async () => ({ ok: true, valor: 'https://www.pcyes.com.br/media/catalog/product/h.jpg' }),
    })
    const r = await (await lojaAtivaDaConta('c1'))!.buscar('headset')
    expect(r).toEqual({
      ok: true,
      valor: [{ ...headset, quantidade: 4, foto: 'https://www.pcyes.com.br/media/catalog/product/h.jpg' }],
    })
  })

  it('cofre falhando: volta à busca pública, sem erro', async () => {
    lojaDaConta.mockResolvedValue({ ...base, conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockRejectedValue(new Error('vault fora'))
    const r = await (await lojaAtivaDaConta('c1'))!.buscar('headset')
    expect(r).toEqual({ ok: true, valor: [headset] })
    expect(lojaAdmin).not.toHaveBeenCalled()
  })
})
