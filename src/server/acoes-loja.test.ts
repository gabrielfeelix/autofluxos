import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lojaFalsa } from '@/loja/falsa'

/**
 * A tela da loja: o que o servidor aceita, e o que ele nunca faz.
 *
 *  - endereço que não é https não chega a sair do servidor;
 *  - teste que falha não grava nada;
 *  - ligar refaz o teste no servidor, e não confia no que a tela mostrou;
 *  - desligar não apaga a loja.
 */

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('./permissoes', () => ({ exigirCapacidade: async () => ({ ok: true }), recusou: () => false }))

const lojaMagento = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento', () => ({ lojaMagento }))

const salvarLoja = vi.hoisted(() => vi.fn())
const ligarLoja = vi.hoisted(() => vi.fn())
const lojaDaConta = vi.hoisted(() => vi.fn())
const ligarEstoqueExato = vi.hoisted(() => vi.fn())
const desligarEstoqueExato = vi.hoisted(() => vi.fn())
vi.mock('./repos/lojas', () => ({ salvarLoja, ligarLoja, lojaDaConta, ligarEstoqueExato, desligarEstoqueExato }))

const criarConexao = vi.hoisted(() => vi.fn())
const apagarConexao = vi.hoisted(() => vi.fn())
vi.mock('./repos/conexoes', () => ({ criarConexao, apagarConexao }))

const lojaAdmin = vi.hoisted(() => vi.fn())
vi.mock('@/loja/magento-admin', () => ({ lojaAdmin }))

const { acaoConectarToken, acaoDesconectarToken, acaoDesligarLoja, acaoLigarLoja, acaoTestarLoja } =
  await import('./acoes-loja')

const headset = {
  produtoId: '330107',
  nome: 'Headset PCYES Comfort CM500',
  preco: 108.9,
  emEstoque: true,
  link: 'https://www.pcyes.com.br/headset-comfort-cm500',
}
const conta = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  lojaMagento.mockReset()
  salvarLoja.mockReset()
  ligarLoja.mockReset().mockResolvedValue({ ok: true })
})

describe('acoes da loja', () => {
  it('http é recusado sem chamar a loja', async () => {
    const r = await acaoTestarLoja(conta, 'http://www.pcyes.com.br', 'headset')
    expect(r.ok).toBe(false)
    expect(lojaMagento).not.toHaveBeenCalled()
  })

  it('termo curto é recusado sem chamar a loja', async () => {
    const r = await acaoTestarLoja(conta, 'https://www.pcyes.com.br', 'ab')
    expect(r.ok).toBe(false)
    expect(lojaMagento).not.toHaveBeenCalled()
  })

  it('teste que dá certo devolve amostra e avisa que não há complementos', async () => {
    lojaMagento.mockReturnValue(lojaFalsa({ produtos: [headset] }))
    const r = await acaoTestarLoja(conta, 'https://www.pcyes.com.br/', 'headset')
    expect(r).toMatchObject({ ok: true, endereco: 'https://www.pcyes.com.br', sufixo: '', semComplementos: true })
    expect(salvarLoja).not.toHaveBeenCalled()
  })

  it('ligar com a loja fora do ar não grava nada', async () => {
    lojaMagento.mockReturnValue(lojaFalsa({ falhar: true }))
    const r = await acaoLigarLoja(conta, 'https://www.pcyes.com.br', 'headset')
    expect(r.ok).toBe(false)
    expect(salvarLoja).not.toHaveBeenCalled()
    expect(ligarLoja).not.toHaveBeenCalled()
  })

  it('ligar refaz o teste, grava o que o servidor descobriu e liga', async () => {
    lojaMagento.mockReturnValue(lojaFalsa({ produtos: [headset] }))
    const r = await acaoLigarLoja(conta, 'https://www.pcyes.com.br/', 'headset')
    expect(r).toEqual({ ok: true })
    expect(salvarLoja).toHaveBeenCalledWith(conta, { endereco: 'https://www.pcyes.com.br', codigoDaLoja: 'default', sufixo: '' })
    expect(ligarLoja).toHaveBeenCalledWith(conta, true)
  })

  it('desligar só desliga', async () => {
    expect(await acaoDesligarLoja(conta)).toEqual({ ok: true })
    expect(ligarLoja).toHaveBeenCalledWith(conta, false)
    expect(salvarLoja).not.toHaveBeenCalled()
  })
})

describe('token de administrador', () => {
  const token = 'tok_' + 'x'.repeat(30)
  const lojaLigada = { endereco: 'https://www.pcyes.com.br', ativa: true, conexaoId: null }

  beforeEach(() => {
    lojaDaConta.mockReset().mockResolvedValue(lojaLigada)
    criarConexao.mockReset().mockResolvedValue({ id: 'cx1' })
    apagarConexao.mockReset()
    ligarEstoqueExato.mockReset()
    desligarEstoqueExato.mockReset()
    lojaAdmin.mockReset()
  })

  it('token recusado pela loja não chega ao cofre, e não volta no retorno', async () => {
    lojaAdmin.mockReturnValue({ descobrir: async () => ({ ok: false, motivo: 'o token foi recusado pela loja' }) })
    const r = await acaoConectarToken(conta, token, '330107')
    expect(r.ok).toBe(false)
    expect(criarConexao).not.toHaveBeenCalled()
    expect(JSON.stringify(r)).not.toContain(token)
  })

  it('token aceito vai ao cofre e liga o estoque exato', async () => {
    lojaAdmin.mockReturnValue({ descobrir: async () => ({ ok: true, valor: { via: 'msi', estoqueId: 2 } }) })
    const r = await acaoConectarToken(conta, `  ${token}  `, '330107')
    expect(r).toEqual({ ok: true, via: 'msi' })
    expect(criarConexao).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'bearer', valor: token }))
    expect(ligarEstoqueExato).toHaveBeenCalledWith(conta, { conexaoId: 'cx1', via: 'msi', estoqueId: 2 })
  })

  it('loja desligada ou token já conectado: recusa sem chamar a loja', async () => {
    lojaDaConta.mockResolvedValue({ ...lojaLigada, ativa: false })
    expect((await acaoConectarToken(conta, token, '330107')).ok).toBe(false)
    lojaDaConta.mockResolvedValue({ ...lojaLigada, conexaoId: 'cx0' })
    expect((await acaoConectarToken(conta, token, '330107')).ok).toBe(false)
    expect(lojaAdmin).not.toHaveBeenCalled()
  })

  it('desconectar zera o estado antes de apagar a Conexão', async () => {
    const ordem: string[] = []
    desligarEstoqueExato.mockImplementation(async () => (ordem.push('zerar'), { conexaoId: 'cx1' }))
    apagarConexao.mockImplementation(async () => void ordem.push('apagar'))
    expect(await acaoDesconectarToken(conta)).toEqual({ ok: true })
    expect(ordem).toEqual(['zerar', 'apagar'])
    expect(apagarConexao).toHaveBeenCalledWith('cx1', conta)
  })
})
