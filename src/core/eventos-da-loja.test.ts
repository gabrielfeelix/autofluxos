import { describe, expect, it } from 'vitest'
import { dadosDoPedido, eventoDoStatus, formatoDaLoja, instanteDaLoja, telefoneDoPedido } from './eventos-da-loja'

describe('status da loja como evento', () => {
  it('status padrão ganha nome em português', () => {
    expect(eventoDoStatus('processing')).toBe('pedido.processando')
    expect(eventoDoStatus('complete')).toBe('pedido.concluido')
  })

  it('status próprio da loja passa como veio', () => {
    expect(eventoDoStatus('em_transporte')).toBe('pedido.em_transporte')
  })

  it('status estranho não vira evento', () => {
    expect(eventoDoStatus('')).toBeNull()
    expect(eventoDoStatus('a b')).toBeNull()
  })
})

describe('o pedido vira os dados do aviso', () => {
  const pedido = {
    increment_id: '000001234',
    status: 'processing',
    customer_id: 182,
    customer_firstname: 'Gabriel',
    customer_email: 'g@exemplo.com',
    grand_total: 299.9,
    billing_address: { telephone: '(44) 99877-5978' },
    extension_attributes: { aceita_whatsapp: '1', shipping_assignments: [{}] },
  }

  it('com os nomes que o fluxo usa e o aceite normalizado', () => {
    expect(dadosDoPedido(pedido)).toMatchObject({
      pedido: '000001234',
      nome: 'Gabriel',
      customer_id: '182',
      total: '299.9',
      aceita_whatsapp: true,
    })
    expect(dadosDoPedido(pedido)).not.toHaveProperty('shipping_assignments')
  })

  it('telefone só com dígitos', () => {
    expect(telefoneDoPedido(pedido)).toBe('44998775978')
  })
})

it('data da loja vai e volta', () => {
  const data = instanteDaLoja('2026-10-26 18:04:11')
  expect(data?.toISOString()).toBe('2026-10-26T18:04:11.000Z')
  expect(formatoDaLoja(data!)).toBe('2026-10-26 18:04:11')
  expect(instanteDaLoja('ontem')).toBeNull()
})
