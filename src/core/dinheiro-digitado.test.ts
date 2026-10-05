import { describe, expect, it } from 'vitest'
import { formatarDinheiroDigitado as f, posicaoDepois, significativosAntes } from './dinheiro-digitado'

describe('formatarDinheiroDigitado', () => {
  it('põe o ponto de milhar enquanto digita', () => {
    expect(f('1')).toBe('1')
    expect(f('1500')).toBe('1.500')
    expect(f('1234567')).toBe('1.234.567')
  })
  it('vírgula abre no máximo dois centavos', () => {
    expect(f('1500,')).toBe('1.500,')
    expect(f('1500,5')).toBe('1.500,5')
    expect(f('1500,567')).toBe('1.500,56')
    expect(f(',5')).toBe('0,5')
  })
  it('refaz o milhar quando a pessoa apaga ou cola', () => {
    expect(f('1.5000')).toBe('15.000')
    expect(f('1500.50')).toBe('1.500,50')
    expect(f('R$ 2.000,00')).toBe('2.000,00')
    expect(f('abc')).toBe('')
    expect(f('007')).toBe('7')
  })
  it('acha o cursor de volta depois de formatar', () => {
    expect(posicaoDepois('1.500', significativosAntes('1500', 4))).toBe(5)
    expect(posicaoDepois('15.000', significativosAntes('1.5000', 3))).toBe(2)
  })
})
