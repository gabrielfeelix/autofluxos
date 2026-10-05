import { describe, expect, it } from 'vitest'
import { nomeParaMostrar } from './nome-para-mostrar'

describe('nomeParaMostrar', () => {
  it('o nome corrigido pela equipe ganha do nome do perfil', () => {
    expect(nomeParaMostrar({ nomeReal: 'Ana Souza', nome: 'aninha', waId: '5544999990000' })).toBe('Ana Souza')
    expect(nomeParaMostrar({ nomeReal: ' ', nome: 'aninha', waId: '5544999990000' })).toBe('aninha')
  })

  it('sem nome, visitante do site não mostra o hash', () => {
    expect(nomeParaMostrar({ nome: null, waId: 'site:4ec7fbc41773d3e27eb28190cf555' })).toBe('Visitante do site')
  })

  it('sem nome, telefone sai formatado', () => {
    expect(nomeParaMostrar({ nome: null, waId: '5511999910621' })).not.toBe('5511999910621')
  })
})
