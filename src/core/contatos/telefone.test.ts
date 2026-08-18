import { describe, expect, it } from 'vitest'
import { chavesDoTelefone, digitos, telefoneCanonico, telefoneLegivel } from './telefone'

describe('chaves do telefone', () => {
  const casa = (a: string, b: string) =>
    chavesDoTelefone(a).some((chave) => chavesDoTelefone(b).includes(chave))

  it('tira máscara, DDI e espaço — a planilha do cliente tem todos', () => {
    const esperado = chavesDoTelefone('5511987654321')
    for (const escrito of [
      '+55 (11) 98765-4321',
      '55 11 98765 4321',
      '(11) 98765-4321',
      '11987654321',
      '+5511987654321',
    ]) {
      expect(chavesDoTelefone(escrito)).toEqual(esperado)
    }
  })

  /**
   * O caso que quebra tudo se for ignorado: o mesmo aparelho aparece com e sem
   * o nono dígito, e uma comparação literal diria que são duas pessoas.
   */
  it('casa o mesmo celular com e sem o nono dígito', () => {
    expect(casa('5511987654321', '551187654321')).toBe(true)
    expect(casa('(11) 98765-4321', '11 8765-4321')).toBe(true)
  })

  it('não inventa nono dígito para telefone fixo', () => {
    // Fixo começa com 2 a 5 e nunca ganhou nono dígito. Uma chave `551139001234`
    // com um 9 na frente não existe em lugar nenhum e só criaria falso positivo.
    expect(chavesDoTelefone('1139001234')).toEqual(['551139001234'])
  })

  it('celular sem o nono ganha a variante com ele', () => {
    expect(chavesDoTelefone('1187654321').sort()).toEqual(
      ['551187654321', '5511987654321'].sort(),
    )
  })

  it('números de DDDs diferentes não se confundem', () => {
    expect(casa('11987654321', '21987654321')).toBe(false)
  })

  /**
   * Chutar o DDD casaria a conversa de uma pessoa com o cadastro de outra, e
   * um palpite errado é indistinguível de acerto depois de gravado.
   */
  it('número sem DDD não casa com nada — vira pendência, não palpite', () => {
    expect(chavesDoTelefone('987654321')).toEqual([])
    expect(chavesDoTelefone('98765432')).toEqual([])
  })

  it('vazio e lixo não viram chave', () => {
    expect(chavesDoTelefone('')).toEqual([])
    expect(chavesDoTelefone('sem telefone')).toEqual([])
    expect(chavesDoTelefone('-')).toEqual([])
  })

  it('número estrangeiro passa inteiro, sem regra de nono dígito', () => {
    // Português: +351 912 345 678. Não é nosso caso comum, mas o cliente que
    // atende gringo não pode ver o cadastro dele sumir.
    expect(chavesDoTelefone('+351912345678')).toEqual(['351912345678'])
  })

  it('não casa números que só se parecem', () => {
    expect(casa('5511987654321', '5511987654322')).toBe(false)
  })
})

describe('forma canônica', () => {
  it('prefere a forma com nono dígito, que é a válida hoje', () => {
    expect(telefoneCanonico('11 8765-4321')).toBe('5511987654321')
    expect(telefoneCanonico('+55 (11) 98765-4321')).toBe('5511987654321')
  })

  it('fixo fica como é', () => {
    expect(telefoneCanonico('(11) 3900-1234')).toBe('551139001234')
  })

  it('devolve null quando não dá para normalizar', () => {
    expect(telefoneCanonico('98765432')).toBeNull()
    expect(telefoneCanonico('')).toBeNull()
  })
})

describe('forma legível', () => {
  it('formata celular e fixo', () => {
    expect(telefoneLegivel('5511987654321')).toBe('+55 (11) 98765-4321')
    expect(telefoneLegivel('551139001234')).toBe('+55 (11) 3900-1234')
  })

  it('devolve o cru quando não reconhece, em vez de mostrar lixo formatado', () => {
    expect(telefoneLegivel('351912345678')).toBe('351912345678')
    expect(telefoneLegivel('sem telefone')).toBe('sem telefone')
  })
})

describe('digitos', () => {
  it('deixa só número', () => {
    expect(digitos('+55 (11) 98765-4321')).toBe('5511987654321')
  })
})
