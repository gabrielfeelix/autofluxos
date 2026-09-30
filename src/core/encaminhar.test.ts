import { describe, expect, it } from 'vitest'
import {
  encaminhamentoEmTexto,
  linkDoEncaminhamento,
  telefoneDoEncaminhamento,
  telefoneLegivel,
} from './encaminhar'
import { executar } from './engine/executar'
import { sessaoNova } from './engine/types'
import { validar } from './flow/validar'
import type { Fluxo } from './flow/schema'

describe('telefoneDoEncaminhamento', () => {
  it('põe o 55 no número brasileiro digitado com máscara', () => {
    expect(telefoneDoEncaminhamento('(44) 2101-1428')).toBe('554421011428')
    expect(telefoneDoEncaminhamento('44 98809-1552')).toBe('5544988091552')
  })

  it('aceita quem já escreveu o país e quem copiou com zero', () => {
    expect(telefoneDoEncaminhamento('+55 44 2101-1485')).toBe('554421011485')
    expect(telefoneDoEncaminhamento('0 44 2101-1485')).toBe('554421011485')
  })

  it('recusa o que não é telefone', () => {
    expect(telefoneDoEncaminhamento('')).toBeNull()
    expect(telefoneDoEncaminhamento('2101-1428')).toBeNull()
    expect(telefoneDoEncaminhamento('1234567890123456')).toBeNull()
  })
})

describe('link e texto', () => {
  it('põe a mensagem pronta codificada no wa.me', () => {
    expect(linkDoEncaminhamento('554421011428', 'Olá!\nProduto: headset')).toBe(
      'https://wa.me/554421011428?text=Ol%C3%A1!%0AProduto%3A%20headset',
    )
    expect(linkDoEncaminhamento('554421011428', '  ')).toBe('https://wa.me/554421011428')
  })

  it('mostra o número do jeito brasileiro', () => {
    expect(telefoneLegivel('554421011428')).toBe('(44) 2101-1428')
    expect(telefoneLegivel('5544988091552')).toBe('(44) 98809-1552')
    expect(telefoneLegivel('14155550123')).toBe('+14155550123')
  })

  it('em texto leva o link e o número, para canal sem botão', () => {
    const texto = encaminhamentoEmTexto({
      texto: 'Fala com o suporte',
      rotulo: 'Abrir conversa',
      link: 'https://wa.me/554421011428',
      nome: 'Suporte PCYES',
      telefone: '554421011428',
    })
    expect(texto).toBe('Fala com o suporte\n\nAbrir conversa: https://wa.me/554421011428\n\nSuporte PCYES: (44) 2101-1428')
  })
})

function fluxo(data: Record<string, unknown>): Fluxo {
  return {
    inicio: 'e',
    nodes: [
      {
        id: 'e',
        type: 'encaminhar',
        position: { x: 0, y: 0 },
        data: { texto: 'Oi {{nome}}, fala com o suporte', nome: 'Suporte PCYES', telefone: '(44) 2101-1428', mensagemPronta: 'Sou {{nome}}', ...data },
      },
    ],
    edges: [],
  } as Fluxo
}

describe('bloco encaminhar', () => {
  it('o motor manda o link com a mensagem interpolada', () => {
    const sessao = { ...sessaoNova(), vars: { nome: 'Ana' } }
    const { acoes } = executar(fluxo({}), sessao, { tipo: 'inicio' })
    expect(acoes).toContainEqual({
      tipo: 'encaminhar_contato',
      texto: 'Oi Ana, fala com o suporte',
      rotulo: 'Abrir conversa',
      link: 'https://wa.me/554421011428?text=Sou%20Ana',
      nome: 'Suporte PCYES',
      telefone: '554421011428',
      cartao: false,
    })
  })

  it('não publica sem telefone nem nome', () => {
    const codigos = validar(fluxo({ telefone: '123', nome: ' ' })).erros.map((e) => e.codigo)
    expect(codigos).toContain('ENCAMINHAR_SEM_TELEFONE')
    expect(codigos).toContain('ENCAMINHAR_SEM_NOME')
  })
})
