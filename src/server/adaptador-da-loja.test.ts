import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lojaFalsa } from '@/loja/falsa'

const lojaDaConta = vi.hoisted(() => vi.fn())
const lojaNuvemshopDaConta = vi.hoisted(() => vi.fn())
vi.mock('./repos/lojas', () => ({ lojaDaConta, lojaNuvemshopDaConta }))
const lojaNuvemshop = vi.hoisted(() => vi.fn())
vi.mock('@/loja/nuvemshop', () => ({ lojaNuvemshop }))
const lerCredencial = vi.hoisted(() => vi.fn())
vi.mock('./repos/conexoes', () => ({ lerCredencial }))
const lojaMagento = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento', () => ({ lojaMagento }))
const lojaAdmin = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento-admin', () => ({ lojaAdmin }))
// O catálogo próprio é o último recurso; aqui, vazio, para "nenhuma loja" dar null.
const listarProdutos = vi.hoisted(() => vi.fn())
vi.mock('./repos/produtos', () => ({ listarProdutos }))
const alertar = vi.hoisted(() => vi.fn())
vi.mock('./alertar', () => ({ alertar }))

const { estadoDoToken, lojaAtivaDaConta } = await import('./adaptador-da-loja')

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
  listarProdutos.mockResolvedValue([])
})

const calabresa = {
  id: 'p1',
  nome: 'Pizza Calabresa',
  especie: 'produto',
  preco: 52,
  sku: null,
  descricao: 'Calabresa e cebola',
  link: null,
  foto: 'https://x/calabresa.jpg',
  categoria: 'Pizzas',
  ordem: 1,
  arquivadoEm: null,
}

describe('lojaAtivaDaConta com a fonte escolhida no bloco', () => {
  it('catalogo: o catálogo próprio mesmo com a Magento ligada', async () => {
    lojaDaConta.mockResolvedValue(base)
    listarProdutos.mockResolvedValue([calabresa])
    const loja = await lojaAtivaDaConta('c1', 'catalogo')
    expect(loja).not.toBeNull()
    expect(lojaDaConta).not.toHaveBeenCalled()
    expect(lojaMagento).not.toHaveBeenCalled()
    const r = await loja!.buscar('calabresa')
    expect(r.ok && r.valor.map((p) => p.nome)).toEqual(['Pizza Calabresa'])
  })

  it('catalogo sem item ativo: null, e não a Magento', async () => {
    lojaDaConta.mockResolvedValue(base)
    expect(await lojaAtivaDaConta('c1', 'catalogo')).toBeNull()
  })

  it('loja: sem loja on-line ligada não cai no catálogo', async () => {
    lojaDaConta.mockResolvedValue(null)
    lojaNuvemshopDaConta.mockResolvedValue(null)
    listarProdutos.mockResolvedValue([calabresa])
    expect(await lojaAtivaDaConta('c1', 'loja')).toBeNull()
    expect(await lojaAtivaDaConta('c1')).not.toBeNull()
  })

  it('loja: a Magento ligada, como sem fonte', async () => {
    lojaDaConta.mockResolvedValue(base)
    listarProdutos.mockResolvedValue([calabresa])
    const r = await (await lojaAtivaDaConta('c1', 'loja'))!.buscar('headset')
    expect(r.ok && r.valor.map((p) => p.produtoId)).toEqual(['330107'])
  })
})

describe('lojaAtivaDaConta', () => {
  it('sem loja ou desligada: null', async () => {
    lojaDaConta.mockResolvedValue(null)
    expect(await lojaAtivaDaConta('c1')).toBeNull()
    lojaDaConta.mockResolvedValue({ ...base, ativa: false })
    expect(await lojaAtivaDaConta('c1')).toBeNull()
  })

  it('Magento desligada e Nuvemshop ligada: a Nuvemshop, com o token do cofre', async () => {
    lojaDaConta.mockResolvedValue({ ...base, ativa: false })
    lojaNuvemshopDaConta.mockResolvedValue({ ...base, plataforma: 'nuvemshop', endereco: 'https://x.nuvemshop.com.br', storeId: '789', conexaoId: 'ns1' })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 'tok' })
    const falsa = lojaFalsa({ produtos: [headset] })
    lojaNuvemshop.mockReturnValue(falsa)
    expect(await lojaAtivaDaConta('c1')).toBe(falsa)
    expect(lojaNuvemshop).toHaveBeenCalledWith({ endereco: 'https://x.nuvemshop.com.br', storeId: '789', token: 'tok' })
  })

  it('Nuvemshop ligada sem token no cofre vale como desligada', async () => {
    lojaDaConta.mockResolvedValue(null)
    lojaNuvemshopDaConta.mockResolvedValue({ ...base, plataforma: 'nuvemshop', storeId: '789', conexaoId: 'ns1' })
    lerCredencial.mockResolvedValue(null)
    expect(await lojaAtivaDaConta('c1')).toBeNull()
    expect(lojaNuvemshop).not.toHaveBeenCalled()
  })

  it('sem token: a busca pública, sem ler o cofre', async () => {
    lojaDaConta.mockResolvedValue(base)
    const r = await (await lojaAtivaDaConta('c1'))!.buscar('headset')
    expect(r).toEqual({ ok: true, valor: [headset] })
    expect(lerCredencial).not.toHaveBeenCalled()
  })

  it('com token: quantidade na busca, e foto só no card', async () => {
    lojaDaConta.mockResolvedValue({ ...base, conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 't' })
    const foto = vi.fn(async () => ({ ok: true, valor: 'https://www.pcyes.com.br/media/catalog/product/h.jpg' }))
    lojaAdmin.mockReturnValue({ quantidade: async () => ({ ok: true, valor: 4 }), foto })
    const loja = (await lojaAtivaDaConta('c1'))!

    expect(await loja.buscar('headset')).toEqual({ ok: true, valor: [{ ...headset, quantidade: 4 }] })
    expect(foto).not.toHaveBeenCalled()

    expect(await loja.lerPorSku(['330107'])).toEqual({
      ok: true,
      valor: [{ ...headset, quantidade: 4, foto: 'https://www.pcyes.com.br/media/catalog/product/h.jpg' }],
    })
  })

  it('sem token: o card ainda ganha a foto, e estoque não é pedido', async () => {
    lojaDaConta.mockResolvedValue(base)
    const quantidade = vi.fn()
    lojaAdmin.mockReturnValue({ quantidade, foto: async () => ({ ok: true, valor: 'https://cdn/x.png' }) })
    const r = await (await lojaAtivaDaConta('c1'))!.lerPorSku(['330107'])
    expect(r).toEqual({ ok: true, valor: [{ ...headset, foto: 'https://cdn/x.png' }] })
    expect(quantidade).not.toHaveBeenCalled()
    expect(lojaAdmin).toHaveBeenCalledWith(expect.objectContaining({ credencial: null }))
  })

  it('cofre falhando: volta à busca pública, sem erro', async () => {
    lojaDaConta.mockResolvedValue({ ...base, conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockRejectedValue(new Error('vault fora'))
    const r = await (await lojaAtivaDaConta('c1'))!.buscar('headset')
    expect(r).toEqual({ ok: true, valor: [headset] })
    expect(lojaAdmin).toHaveBeenCalledWith(expect.objectContaining({ credencial: null }))
  })

  it('token recusado na conversa vira um alerta por conta por dia, sem o token', async () => {
    lojaDaConta.mockResolvedValue({ ...base, clienteId: 'c-recusa', conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 'token-secreto' })
    const recusa = { ok: false, motivo: 'o token foi recusado pela loja' }
    lojaAdmin.mockReturnValue({ quantidade: async () => recusa, foto: async () => recusa })

    const loja = (await lojaAtivaDaConta('c-recusa'))!
    const r = await loja.buscar('headset')
    await loja.buscar('headset')

    expect(r).toEqual({ ok: true, valor: [headset] })
    expect(alertar).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(alertar.mock.calls)).not.toContain('token-secreto')
  })
})

describe('estadoDoToken', () => {
  it('sem token conectado nem pergunta à loja', async () => {
    lojaDaConta.mockResolvedValue(base)
    expect(await estadoDoToken('c1')).toBe('sem_token')
    expect(lojaAdmin).not.toHaveBeenCalled()
  })

  it('devolve o que a loja disse', async () => {
    lojaDaConta.mockResolvedValue({ ...base, conexaoId: 'x1', estoqueExato: 'msi', estoqueId: 2 })
    lerCredencial.mockResolvedValue({ tipo: 'bearer', campo: null, valor: 't' })
    lojaAdmin.mockReturnValue({ conferir: async (via: string) => (via === 'msi' ? 'recusado' : 'ok') })
    expect(await estadoDoToken('c1')).toBe('recusado')
  })
})
