import { describe, expect, it } from 'vitest'
import { classificarLinha, marcadorAoDigitarEspaco, quebraNaLista, temBlocos, type Edicao } from './listas'
import { interpretarMarcacao } from './marcacao'

function aplicar(valor: string, edicao: Edicao | null) {
  if (!edicao) return null
  const texto = valor.slice(0, edicao.inicio) + edicao.texto + valor.slice(edicao.fim)
  return { texto, cursor: edicao.inicio + edicao.texto.length }
}

describe('marcadorAoDigitarEspaco', () => {
  it('troca * e - no começo da linha por •', () => {
    expect(aplicar('*', marcadorAoDigitarEspaco('*', 1))).toEqual({ texto: '• ', cursor: 2 })
    expect(aplicar('oi\n-', marcadorAoDigitarEspaco('oi\n-', 4))).toEqual({ texto: 'oi\n• ', cursor: 5 })
  })

  it('não mexe em negrito nem em conta', () => {
    expect(marcadorAoDigitarEspaco('*negrito', 8)).toBeNull()
    expect(marcadorAoDigitarEspaco('2 *', 3)).toBeNull()
    expect(marcadorAoDigitarEspaco('', 0)).toBeNull()
  })
})

describe('quebraNaLista', () => {
  it('abre o próximo item', () => {
    expect(aplicar('• item', quebraNaLista('• item', 6, 6))).toEqual({ texto: '• item\n• ', cursor: 9 })
  })

  it('continua a numeração', () => {
    const valor = '1. um\n2. dois'
    expect(aplicar(valor, quebraNaLista(valor, 13, 13))?.texto).toBe('1. um\n2. dois\n3. ')
  })

  it('item vazio encerra a lista', () => {
    const valor = '• item\n• '
    expect(aplicar(valor, quebraNaLista(valor, 9, 9))).toEqual({ texto: '• item\n', cursor: 7 })
  })

  it('o roteiro inteiro: * item, Enter, item 2, Enter, Enter, *negrito*', () => {
    let valor = '*'
    let r = aplicar(valor, marcadorAoDigitarEspaco(valor, 1))!
    valor = r.texto + 'item'
    r = aplicar(valor, quebraNaLista(valor, valor.length, valor.length))!
    valor = r.texto + 'item 2'
    r = aplicar(valor, quebraNaLista(valor, valor.length, valor.length))!
    valor = r.texto
    r = aplicar(valor, quebraNaLista(valor, valor.length, valor.length))!
    valor = r.texto + '*negrito*'
    expect(valor).toBe('• item\n• item 2\n*negrito*')
    expect(quebraNaLista(valor, valor.length, valor.length)).toBeNull()
  })

  it('fora de lista, ou antes do marcador, o Enter é o de sempre', () => {
    expect(quebraNaLista('oi', 2, 2)).toBeNull()
    expect(quebraNaLista('• item', 0, 0)).toBeNull()
    expect(quebraNaLista('\n• a', 0, 0)).toBeNull()
  })
})

describe('classificarLinha', () => {
  it('lê os marcadores de lista e a citação', () => {
    expect(classificarLinha('• a')).toEqual({ tipo: 'item', simbolo: '•', conteudo: 'a' })
    expect(classificarLinha('- a')).toEqual({ tipo: 'item', simbolo: '•', conteudo: 'a' })
    expect(classificarLinha('* a')).toEqual({ tipo: 'item', simbolo: '•', conteudo: 'a' })
    expect(classificarLinha('12. a')).toEqual({ tipo: 'item', simbolo: '12.', conteudo: 'a' })
    expect(classificarLinha('> a')).toEqual({ tipo: 'citacao', conteudo: 'a' })
  })

  it('negrito no começo da linha não é item', () => {
    expect(classificarLinha('*a*').tipo).toBe('texto')
    expect(temBlocos('oi\n*a*')).toBe(false)
    expect(temBlocos('oi\n• a')).toBe(true)
  })

  it('a marcação continua valendo dentro do item', () => {
    const linha = classificarLinha('• *frete* grátis')
    expect(interpretarMarcacao(linha.conteudo)[0]).toMatchObject({ marca: 'negrito' })
  })
})
