import { describe, expect, it, vi } from 'vitest'
import type { ProdutoDaLoja } from '@/core/loja'
import { enriquecer, type Complemento } from './enriquecer'

const p = (produtoId: string, emEstoque = true): ProdutoDaLoja => ({
  produtoId,
  nome: `Produto ${produtoId}`,
  preco: 10,
  emEstoque,
  link: `https://loja.com.br/${produtoId}`,
})

function admin(sobre: Partial<Complemento> = {}): Complemento {
  return {
    quantidade: vi.fn(async (sku: string) => ({ ok: true as const, valor: sku.length })),
    foto: vi.fn(async (sku: string) => ({ ok: true as const, valor: `https://loja.com.br/media/${sku}.jpg` })),
    ...sobre,
  }
}

describe('enriquecer', () => {
  it('acrescenta quantidade e foto', async () => {
    const r = await enriquecer([p('abc')], admin(), { via: 'msi', estoqueId: 1, prazoMs: 1000 })
    expect(r).toEqual([{ ...p('abc'), quantidade: 3, foto: 'https://loja.com.br/media/abc.jpg' }])
  })

  // Estoque não é para o cliente: acima das últimas unidades o número nem
  // chega ao modelo, e o bot não tem o que contar a quem pergunta.
  it('estoque acima das últimas unidades não segue adiante', async () => {
    const [r] = await enriquecer([p('abcdefgh')], admin(), { via: 'msi', estoqueId: 1, prazoMs: 1000 })
    expect(r!.quantidade).toBeUndefined()
    expect(r!.foto).toBe('https://loja.com.br/media/abcdefgh.jpg')
  })

  it('esgotado não gasta chamada de quantidade, mas ganha foto', async () => {
    const a = admin()
    const [r] = await enriquecer([p('x', false)], a, { via: 'msi', estoqueId: 1, prazoMs: 1000 })
    expect(a.quantidade).not.toHaveBeenCalled()
    expect(r!.foto).toBeDefined()
    expect(r!.quantidade).toBeUndefined()
  })

  it('token recusado devolve o resultado da fase 1 intacto', async () => {
    const recusa = async () => ({ ok: false as const, motivo: 'o token foi recusado pela loja' })
    const r = await enriquecer([p('abc')], admin({ quantidade: recusa, foto: recusa }), {
      via: 'msi',
      estoqueId: 1,
      prazoMs: 1000,
    })
    expect(r).toEqual([p('abc')])
  })

  it('loja lenta não segura a resposta além do prazo', async () => {
    const nunca = () => new Promise<never>(() => {})
    const inicio = Date.now()
    const r = await enriquecer([p('abc')], admin({ quantidade: nunca, foto: nunca }), {
      via: 'msi',
      estoqueId: 1,
      prazoMs: 50,
    })
    expect(Date.now() - inicio).toBeLessThan(500)
    expect(r).toEqual([p('abc')])
  })

  it('foto null não vira campo', async () => {
    const semFoto = async () => ({ ok: true as const, valor: null })
    const [r] = await enriquecer([p('abc')], admin({ foto: semFoto }), { via: 'msi', estoqueId: 1, prazoMs: 1000 })
    expect(r).not.toHaveProperty('foto')
  })
})
