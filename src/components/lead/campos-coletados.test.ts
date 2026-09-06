import { describe, expect, it } from 'vitest'
import { recorteDosCampos, TETO_DE_CAMPOS_VISIVEIS } from './campos-coletados'

const campos = (quantos: number): [string, string][] =>
  Array.from({ length: quantos }, (_, i) => [`campo_${i}`, `valor ${i}`])

describe('recorteDosCampos', () => {
  // É o caso da queixa: um fluxo de 20 perguntas despejava 20 blocos e
  // empurrava a anotação da equipe para fora da dobra.
  it('vinte campos mostram quatro e escondem dezesseis', () => {
    const { visiveis, escondidos } = recorteDosCampos(campos(20), false)
    expect(visiveis).toHaveLength(TETO_DE_CAMPOS_VISIVEIS)
    expect(escondidos).toBe(16)
  })

  it('aberto mostra todos — esconder não apaga', () => {
    const { visiveis, escondidos } = recorteDosCampos(campos(20), true)
    expect(visiveis).toHaveLength(20)
    expect(escondidos).toBe(16)
  })

  // O botão só existe quando há o que revelar; senão ele vira ruído numa tela
  // que nasceu desta rodada justamente por excesso de ruído.
  it('quatro campos ou menos não escondem nada', () => {
    expect(recorteDosCampos(campos(4), false).escondidos).toBe(0)
    expect(recorteDosCampos(campos(1), false).escondidos).toBe(0)
    expect(recorteDosCampos([], false).escondidos).toBe(0)
  })

  it('cinco campos escondem exatamente um, e o botão fala no singular', () => {
    const { escondidos, rotuloDoBotao } = recorteDosCampos(campos(5), false)
    expect(escondidos).toBe(1)
    expect(rotuloDoBotao).toBe('Ver mais 1 campo')
  })

  it('mais de um, plural', () => {
    expect(recorteDosCampos(campos(7), false).rotuloDoBotao).toBe('Ver mais 3 campos')
  })

  it('aberto, o botão volta', () => {
    expect(recorteDosCampos(campos(7), true).rotuloDoBotao).toBe('Ver menos')
  })

  it('a ordem dos quatro primeiros é a que veio, não uma escolha nossa', () => {
    const { visiveis } = recorteDosCampos(campos(10), false)
    expect(visiveis.map(([chave]) => chave)).toEqual([
      'campo_0',
      'campo_1',
      'campo_2',
      'campo_3',
    ])
  })
})
