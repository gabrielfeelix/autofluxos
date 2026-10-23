import { describe, expect, it } from 'vitest'
import { documentoParaAsaas, valorDaAssinatura } from './mensalidade-da-4yu'

const plano = { preco: 197, precoAnual: 1970, atendentes: 3, precoAtendenteExtra: 69 }

describe('valorDaAssinatura', () => {
  it('cobra só o plano enquanto a equipe cabe nele', () => {
    expect(valorDaAssinatura(plano, 'mensal', 3)).toBe(19700)
  })

  it('soma o atendente extra no mensal', () => {
    expect(valorDaAssinatura(plano, 'mensal', 5)).toBe(19700 + 2 * 6900)
  })

  it('no anual, o extra vem pelos 12 meses', () => {
    expect(valorDaAssinatura(plano, 'anual', 4)).toBe(197000 + 12 * 6900)
  })

  it('plano sem anual não tem valor anual', () => {
    expect(valorDaAssinatura({ ...plano, precoAnual: null }, 'anual', 1)).toBeNull()
  })
})

describe('documentoParaAsaas', () => {
  it('aceita CPF e CNPJ com ou sem máscara', () => {
    expect(documentoParaAsaas('12.345.678/0001-90')).toBe('12345678000190')
    expect(documentoParaAsaas('123.456.789-01')).toBe('12345678901')
  })

  it('recusa vazio e tamanho errado', () => {
    expect(documentoParaAsaas('')).toBeNull()
    expect(documentoParaAsaas(null)).toBeNull()
    expect(documentoParaAsaas('1234')).toBeNull()
  })
})
