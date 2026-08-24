import { describe, expect, it } from 'vitest'
import {
  contarCaracteres,
  cortarCaracteres,
  semMetadeDeCaractere,
  temMetadeDeCaractere,
} from './texto'

describe('contarCaracteres', () => {
  it('conta emoji como um caractere, que é como a Meta conta', () => {
    expect('📅'.length).toBe(2)
    expect(contarCaracteres('📅')).toBe(1)
  })

  it('deixa passar o rótulo de 20 que o .length reprovava', () => {
    const rotulo = '📅 Falar com recepção'
    expect(rotulo.length).toBe(21)
    expect(contarCaracteres(rotulo)).toBe(20)
  })
})

describe('cortarCaracteres', () => {
  it('não parte o emoji ao meio', () => {
    const cru = 'Aula de Pilates hoj📅'
    expect(temMetadeDeCaractere(cru.slice(0, 20))).toBe(true)
    expect(temMetadeDeCaractere(cortarCaracteres(cru, 20))).toBe(false)
  })

  it('devolve o mesmo texto quando cabe', () => {
    expect(cortarCaracteres('oi', 20)).toBe('oi')
  })
})

describe('metade de caractere', () => {
  it('reconhece o substituto solto que derruba o gravar', () => {
    const quebrado = 'oi\ud83d'
    expect(temMetadeDeCaractere(quebrado)).toBe(true)
    expect(JSON.stringify(quebrado)).toContain('\\ud83d')
    expect(semMetadeDeCaractere(quebrado)).toBe('oi')
  })

  it('não acusa emoji inteiro', () => {
    expect(temMetadeDeCaractere('oi 📅')).toBe(false)
  })
})
