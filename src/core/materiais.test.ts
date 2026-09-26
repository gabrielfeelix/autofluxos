import { describe, expect, it } from 'vitest'
import { conferirMaterial, ehTipoDeMaterial, envioDoCardapio, type Material } from './materiais'

const pdf: Material = {
  tipo: 'cardapio-pdf',
  url: 'https://arquivos.exemplo/cardapio.pdf',
  nomeArquivo: 'Cardápio Pizzaria.pdf',
  atualizadoEm: '2026-09-26T12:00:00Z',
}
const imagem: Material = {
  tipo: 'cardapio-imagem',
  url: 'https://arquivos.exemplo/cardapio.jpg',
  nomeArquivo: null,
  atualizadoEm: '2026-09-26T12:00:00Z',
}

describe('ehTipoDeMaterial', () => {
  it('só os dois tipos da 0106', () => {
    expect(ehTipoDeMaterial('cardapio-pdf')).toBe(true)
    expect(ehTipoDeMaterial('cardapio-imagem')).toBe(true)
    expect(ehTipoDeMaterial('cardapio')).toBe(false)
    expect(ehTipoDeMaterial(null)).toBe(false)
  })
})

describe('conferirMaterial', () => {
  it('exige https com as barras', () => {
    expect(conferirMaterial('cardapio-pdf', 'http://a.com/x.pdf', '').ok).toBe(false)
    expect(conferirMaterial('cardapio-pdf', 'https:a.com/x.pdf', '').ok).toBe(false)
    expect(conferirMaterial('cardapio-pdf', 'nada', '').ok).toBe(false)
  })

  it('o PDF ganha .pdf no nome; vazio fica com o padrão', () => {
    expect(conferirMaterial('cardapio-pdf', ' https://a.com/x.pdf ', ' Cardápio  da casa ')).toEqual({
      ok: true,
      url: 'https://a.com/x.pdf',
      nomeArquivo: 'Cardápio da casa.pdf',
    })
    expect(conferirMaterial('cardapio-pdf', 'https://a.com/x.pdf', 'menu.PDF')).toMatchObject({ nomeArquivo: 'menu.PDF' })
    expect(conferirMaterial('cardapio-pdf', 'https://a.com/x.pdf', '')).toMatchObject({ nomeArquivo: null })
  })

  it('a imagem não guarda nome', () => {
    expect(conferirMaterial('cardapio-imagem', 'https://a.com/x.jpg', 'foto')).toMatchObject({ nomeArquivo: null })
  })

  it('recusa nome acima de 120', () => {
    expect(conferirMaterial('cardapio-pdf', 'https://a.com/x.pdf', 'a'.repeat(117)).ok).toBe(false)
    expect(conferirMaterial('cardapio-pdf', 'https://a.com/x.pdf', 'a'.repeat(116)).ok).toBe(true)
  })
})

describe('envioDoCardapio', () => {
  it('imagem primeiro, depois o PDF com o nome do arquivo', () => {
    expect(envioDoCardapio([pdf, imagem])).toEqual([
      { tipo: 'enviar_midia', midia: 'imagem', url: imagem.url },
      { tipo: 'enviar_midia', midia: 'documento', url: pdf.url, nomeArquivo: 'Cardápio Pizzaria.pdf' },
    ])
  })

  it('PDF sem nome sai com o padrão', () => {
    expect(envioDoCardapio([{ ...pdf, nomeArquivo: null }])[0]).toMatchObject({ nomeArquivo: 'Cardápio.pdf' })
  })

  it('sem material não manda nada', () => {
    expect(envioDoCardapio([])).toEqual([])
  })
})
