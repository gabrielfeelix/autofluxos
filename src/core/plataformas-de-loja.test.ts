import { describe, expect, it } from 'vitest'
import {
  FICHAS,
  PLATAFORMAS_DE_LOJA,
  ehPlataformaDeLoja,
  estadoDaPlataforma,
  mostraLoja,
  ordenarPlataformas,
} from './plataformas-de-loja'

const nada = { escolha: null, vende: false, lojaConectada: false, lojaCadastrada: false, temCatalogo: false }

describe('mostraLoja', () => {
  it('estúdio de pilates (atende, sem loja, sem catálogo, nunca escolheu) não vê', () => {
    expect(mostraLoja(nada)).toBe(false)
  })

  it('sem escolha, vale a regra de antes: vender, loja cadastrada ou catálogo', () => {
    expect(mostraLoja({ ...nada, vende: true })).toBe(true)
    expect(mostraLoja({ ...nada, lojaCadastrada: true })).toBe(true)
    expect(mostraLoja({ ...nada, temCatalogo: true })).toBe(true)
  })

  it('ligar mostra mesmo sem nada; desligar esconde mesmo vendendo', () => {
    expect(mostraLoja({ ...nada, escolha: true })).toBe(true)
    expect(mostraLoja({ ...nada, escolha: false, vende: true, temCatalogo: true, lojaCadastrada: true })).toBe(false)
  })

  it('loja conectada aparece mesmo desligada: é o único lugar de desligá-la', () => {
    expect(mostraLoja({ ...nada, escolha: false, lojaConectada: true })).toBe(true)
  })
})

describe('estadoDaPlataforma', () => {
  it('sem tela de conexão é "Em breve", mesmo que exista linha', () => {
    expect(estadoDaPlataforma(FICHAS.vtex, { ativa: true })).toBe('em_breve')
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
      estado: estadoDaPlataforma(FICHAS[id], id === 'magento' ? { ativa: true } : null),
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
