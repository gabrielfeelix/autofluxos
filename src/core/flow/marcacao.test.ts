import { describe, expect, it } from 'vitest'
import { interpretarMarcacao, semMarcacao } from './marcacao'

describe('interpretarMarcacao', () => {
  it('devolve um trecho só quando não há marca', () => {
    expect(interpretarMarcacao('oi tudo bem')).toEqual([{ tipo: 'texto', texto: 'oi tudo bem' }])
  })

  it('reconhece as quatro marcas da Meta', () => {
    expect(interpretarMarcacao('*a*')).toEqual([
      { tipo: 'marca', marca: 'negrito', filhos: [{ tipo: 'texto', texto: 'a' }] },
    ])
    expect(interpretarMarcacao('_a_')[0]).toMatchObject({ marca: 'italico' })
    expect(interpretarMarcacao('~a~')[0]).toMatchObject({ marca: 'riscado' })
    expect(interpretarMarcacao('```a```')[0]).toMatchObject({ marca: 'mono' })
  })

  it('é o caso que quem usou reclamou: o texto entre asteriscos vira negrito', () => {
    expect(semMarcacao('Vamos falar sobre o *Pilates!*')).toBe('Vamos falar sobre o Pilates!')
    expect(interpretarMarcacao('Vamos falar sobre o *Pilates!*')).toEqual([
      { tipo: 'texto', texto: 'Vamos falar sobre o ' },
      { tipo: 'marca', marca: 'negrito', filhos: [{ tipo: 'texto', texto: 'Pilates!' }] },
    ])
  })

  it('não confunde multiplicação com negrito', () => {
    expect(interpretarMarcacao('2 * 3 * 4')).toEqual([{ tipo: 'texto', texto: '2 * 3 * 4' }])
  })

  it('deixa a marca sem par como texto', () => {
    expect(interpretarMarcacao('*sozinho')).toEqual([{ tipo: 'texto', texto: '*sozinho' }])
  })

  it('aninha', () => {
    expect(interpretarMarcacao('*_os dois_*')).toEqual([
      {
        tipo: 'marca',
        marca: 'negrito',
        filhos: [{ tipo: 'marca', marca: 'italico', filhos: [{ tipo: 'texto', texto: 'os dois' }] }],
      },
    ])
  })

  it('não formata nada dentro do monoespaçado', () => {
    expect(interpretarMarcacao('```a*b*c```')).toEqual([
      { tipo: 'marca', marca: 'mono', filhos: [{ tipo: 'texto', texto: 'a*b*c' }] },
    ])
  })

  it('atravessa quebra de linha, como o WhatsApp atravessa', () => {
    expect(semMarcacao('*duas\nlinhas*')).toBe('duas\nlinhas')
  })
})
