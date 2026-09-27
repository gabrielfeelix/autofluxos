import { describe, expect, it } from 'vitest'
import { codigoPix, crc16, lerValor, limparNome, reaisDito } from './pagamento-demo'

describe('pagamento da demonstração', () => {
  it('CRC16 do BR Code bate com o vetor conhecido', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  it('o copia e cola tem valor, nome sem acento e CRC que confere', () => {
    const c = codigoPix(95.8, 'Pizzaria Exemplo')
    expect(c.startsWith('000201')).toBe(true)
    expect(c).toContain('540595.80')
    expect(c).toContain('5916PIZZARIA EXEMPLO')
    expect(c.slice(-4)).toBe(crc16(c.slice(0, -4)))
  })

  it('lê valor com vírgula, ponto de milhar e recusa lixo', () => {
    expect(lerValor('95,80')).toBe(95.8)
    expect(lerValor('R$ 1.095,80')).toBe(1095.8)
    expect(lerValor('95.80')).toBe(95.8)
    expect(lerValor('abc')).toBeNull()
    expect(lerValor('0')).toBeNull()
    expect(lerValor('1000000')).toBeNull()
  })

  it('limpa o nome e mostra reais', () => {
    expect(limparNome('Burger do Zé <script>')).toBe('Burger do Zé script')
    expect(limparNome('')).toBe('Loja Exemplo')
    expect(reaisDito(95.8)).toBe('R$ 95,80')
  })
})
