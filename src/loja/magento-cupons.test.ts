import { describe, expect, it } from 'vitest'
import { juntarCupons, mensagemDoCupom, regraDeCupomFixo, textoDoDesconto } from './magento-cupons'

const HOJE = '2026-09-30'
const regra = {
  rule_id: 7,
  name: 'Boas-vindas',
  is_active: true,
  coupon_type: 'SPECIFIC_COUPON',
  use_auto_generation: false,
  simple_action: 'by_percent',
  discount_amount: 5,
  to_date: '2026-12-31',
}

describe('quais regras viram cupom na Inbox', () => {
  it('regra ativa de código fixo dentro da data entra', () => {
    expect(regraDeCupomFixo(regra, HOJE)).toBe(true)
  })

  it('desconto automático (sem cupom, como o do Pix) não entra', () => {
    expect(regraDeCupomFixo({ ...regra, coupon_type: 'NO_COUPON' }, HOJE)).toBe(false)
  })

  it('códigos gerados um por pessoa não entram', () => {
    expect(regraDeCupomFixo({ ...regra, use_auto_generation: true }, HOJE)).toBe(false)
  })

  it('vencida ou ainda não começada não entra', () => {
    expect(regraDeCupomFixo({ ...regra, to_date: '2026-09-29' }, HOJE)).toBe(false)
    expect(regraDeCupomFixo({ ...regra, from_date: '2026-10-01' }, HOJE)).toBe(false)
  })
})

describe('os cupons da regra', () => {
  it('cupom esgotado fica de fora; o resto sai com a validade da regra', () => {
    const lista = juntarCupons(
      [regra],
      [
        { rule_id: 7, code: 'BEMVINDO5' },
        { rule_id: 7, code: 'ESGOTOU', usage_limit: 10, times_used: 10 },
      ],
      HOJE,
    )
    expect(lista).toEqual([
      { codigo: 'BEMVINDO5', nome: 'Boas-vindas', desconto: '5% de desconto', descricao: '', validoAte: '2026-12-31' },
    ])
  })
})

describe('o texto do desconto', () => {
  it('valor fixo no carrinho e frete grátis', () => {
    expect(textoDoDesconto({ simple_action: 'cart_fixed', discount_amount: 50, simple_free_shipping: '1' })).toBe(
      'R$ 50,00 de desconto no carrinho + Frete grátis',
    )
  })
})

describe('a mensagem que sai', () => {
  it('uma só, curta, com o código em negrito', () => {
    expect(
      mensagemDoCupom({
        codigo: 'BEMVINDO10',
        nome: 'Boas-vindas',
        desconto: '10% de desconto',
        descricao: '',
        validoAte: '2026-12-31',
      }),
    ).toBe('Cupom 10% off para o site:\n*BEMVINDO10*\nVálido até 31/12/2026.')
  })
})
