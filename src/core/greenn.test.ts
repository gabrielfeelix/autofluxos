import { describe, expect, it } from 'vitest'
import { frasesDaVenda, lerAvisoDaGreenn } from './greenn'

const venda = (currentStatus: string, method = 'CREDIT_CARD') => ({
  type: 'sale',
  event: 'saleUpdated',
  oldStatus: 'created',
  currentStatus,
  sale: { id: 123, method, amount: 99, status: currentStatus },
  client: { name: 'Fulano', email: 'Fulano@Exemplo.com', cellphone: '+5544999998888' },
  product: { name: 'Manual Solar' },
})

describe('lerAvisoDaGreenn', () => {
  it('traduz cada status que importa', () => {
    expect(lerAvisoDaGreenn(venda('paid'))?.situacao).toBe('paga')
    expect(lerAvisoDaGreenn(venda('waiting_payment', 'BOLETO'))?.situacao).toBe('aguardando')
    expect(lerAvisoDaGreenn(venda('refunded'))?.situacao).toBe('reembolso')
    expect(lerAvisoDaGreenn(venda('chargedback'))?.situacao).toBe('reembolso')
  })

  it('ignora recusada, assinatura e carrinho abandonado', () => {
    expect(lerAvisoDaGreenn(venda('refused'))).toBeNull()
    expect(lerAvisoDaGreenn({ type: 'contract', currentStatus: 'paid' })).toBeNull()
    expect(lerAvisoDaGreenn({ type: 'lead', event: 'checkoutAbandoned' })).toBeNull()
    expect(lerAvisoDaGreenn('lixo')).toBeNull()
  })

  it('lê os dados do comprador e normaliza o e-mail', () => {
    const v = lerAvisoDaGreenn(venda('paid'))!
    expect(v).toMatchObject({ vendaId: '123', valor: 99, email: 'fulano@exemplo.com', telefone: '+5544999998888', nome: 'Fulano' })
    expect(frasesDaVenda(v)).toContain('compra paga: Manual Solar')
  })
})
