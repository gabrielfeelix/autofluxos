import { describe, expect, it } from 'vitest'
import {
  FICHAS,
  PLATAFORMAS_DE_LOJA,
  ehPlataformaDeLoja,
  estadoDaPlataforma,
  mostraLoja,
  ordenarPlataformas,
} from './plataformas-de-loja'

describe('mostraLoja', () => {
  it('aparece por padrão, inclusive para quem nunca escolheu', () => {
    expect(mostraLoja({ escolha: null, lojaConectada: false })).toBe(true)
    expect(mostraLoja({ escolha: true, lojaConectada: false })).toBe(true)
  })

  it('desligada no interruptor some', () => {
    expect(mostraLoja({ escolha: false, lojaConectada: false })).toBe(false)
  })

  it('loja conectada aparece mesmo desligada: é o único lugar de desligá-la', () => {
    expect(mostraLoja({ escolha: false, lojaConectada: true })).toBe(true)
  })
})

describe('estadoDaPlataforma', () => {
  it('sem tela de conexão é "Em breve", mesmo que exista linha', () => {
    expect(estadoDaPlataforma(FICHAS.vtex, { ativa: true })).toBe('em_breve')
  })

  it('tela pronta sem o app liberado continua "Em breve"; liberada, disponível', () => {
    expect(estadoDaPlataforma(FICHAS.nuvemshop, null, false)).toBe('em_breve')
    expect(estadoDaPlataforma(FICHAS.nuvemshop, null, true)).toBe('disponivel')
  })

  it('Magento: disponível, configurada (desligada) ou conectada', () => {
    expect(estadoDaPlataforma(FICHAS.magento, null)).toBe('disponivel')
    expect(estadoDaPlataforma(FICHAS.magento, { ativa: false })).toBe('configurada')
    expect(estadoDaPlataforma(FICHAS.magento, { ativa: true })).toBe('conectada')
  })
})

describe('ordenarPlataformas', () => {
  it('conectada primeiro, depois o que conecta hoje, e no "Em breve" o Brasil antes', () => {
    const cartoes = PLATAFORMAS_DE_LOJA.map((id) => ({
      ficha: FICHAS[id],
      estado: estadoDaPlataforma(FICHAS[id], id === 'magento' ? { ativa: true } : null, id !== 'nuvemshop'),
    }))
    const ordem = ordenarPlataformas(cartoes).map((c) => c.ficha.id)
    expect(ordem[0]).toBe('magento')
    expect(ordem.slice(1, 5)).toEqual(['nuvemshop', 'tray', 'loja_integrada', 'vtex'])
    expect(ordem.slice(5)).toEqual(['woocommerce', 'shopify'])
  })
})

describe('ehPlataformaDeLoja', () => {
  it('só aceita a lista fechada', () => {
    expect(ehPlataformaDeLoja('nuvemshop')).toBe(true)
    expect(ehPlataformaDeLoja('mercadolivre')).toBe(false)
    expect(ehPlataformaDeLoja(undefined)).toBe(false)
  })
})
