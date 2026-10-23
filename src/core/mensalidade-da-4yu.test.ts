import { describe, expect, it } from 'vitest'
import { descricaoDaAssinatura, documentoParaAsaas, ehFiltroDeFaturas, filtrarFaturas, FILTRO_INICIAL, resumoDasFaturas, valorDaAssinatura } from './mensalidade-da-4yu'

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

describe('descricaoDaAssinatura', () => {
  const comNome = { ...plano, nome: 'Operação' }
  // O Intl separa "R$" do número com espaço inquebrável.
  const descricao = (...a: Parameters<typeof descricaoDaAssinatura>) => descricaoDaAssinatura(...a).replace(/\u00a0/g, ' ')
  it('diz o plano e os extras', () => {
    expect(descricao(comNome, 'mensal', 5)).toBe('AutoFluxos Operação, mensal: plano R$ 197,00 + 2 atendentes extras R$ 138,00')
  })
  it('no anual, os extras somam os 12 meses', () => {
    expect(descricao(comNome, 'anual', 4)).toBe('AutoFluxos Operação, anual: plano R$ 1.970,00 + 1 atendente extra R$ 828,00')
  })
})

describe('filtrarFaturas e resumoDasFaturas', () => {
  const f = (estado: string, vencimento: string, tipo = 'mensalidade', pagaEm: string | null = null) => ({ estado, vencimento, tipo, valorCentavos: 1000, pagaEm })
  const lista = [f('pendente', '2026-11-01'), f('vencida', '2026-10-01'), f('paga', '2026-09-01', 'excedente', '2026-09-02T12:00:00Z'), f('cancelada', '2025-12-01')]
  it('em aberto junta pendente e vencida', () => {
    expect(filtrarFaturas(lista, { ...FILTRO_INICIAL, situacao: 'em_aberto' })).toHaveLength(2)
  })
  it('filtra por tipo e ano juntos', () => {
    expect(filtrarFaturas(lista, { situacao: 'todas', tipo: 'excedente', ano: '2026' })).toHaveLength(1)
    expect(filtrarFaturas(lista, { ...FILTRO_INICIAL, ano: '2025' })).toHaveLength(1)
  })
  it('resume o que está em aberto e o pago no ano', () => {
    expect(resumoDasFaturas(lista, '2026')).toEqual({ emAberto: 2000, pagoNoAno: 1000, abertas: 2 })
  })
  it('lê o filtro do endereço sem aceitar lixo', () => {
    expect(ehFiltroDeFaturas({ situacao: 'pagas', tipo: 'x', ano: '20a6' })).toEqual({ situacao: 'pagas', tipo: 'todos', ano: 'todos' })
  })
})
