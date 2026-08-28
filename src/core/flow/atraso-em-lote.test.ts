import { describe, expect, it } from 'vitest'
import { aceitaAtraso, aplicarAtrasoEmLote, dadosComAtraso } from './atraso-em-lote'
import { LIMITE_ATRASO_SEGUNDOS, LIMITE_PARTES } from './schema'

describe('dadosComAtraso — o "digitando…" posto de fora', () => {
  it('põe o atraso na frente da pilha, nunca no meio', () => {
    // No meio, a espera aconteceria depois de a fala já ter saído.
    const dados = dadosComAtraso('mensagem', { partes: [{ tipo: 'texto', texto: 'Oi' }] }, 2)
    expect(dados).toEqual({
      partes: [
        { tipo: 'atraso', segundos: 2 },
        { tipo: 'texto', texto: 'Oi' },
      ],
    })
  })

  it('troca o atraso que já existia em vez de empilhar outro', () => {
    const dados = dadosComAtraso(
      'mensagem',
      { partes: [{ tipo: 'atraso', segundos: 1 }, { tipo: 'texto', texto: 'Oi' }] },
      3,
    )
    expect(dados).toEqual({
      partes: [
        { tipo: 'atraso', segundos: 3 },
        { tipo: 'texto', texto: 'Oi' },
      ],
    })
  })

  it('zero tira o atraso — é como se desfaz o lote', () => {
    const dados = dadosComAtraso(
      'mensagem',
      { partes: [{ tipo: 'atraso', segundos: 2 }, { tipo: 'texto', texto: 'Oi' }] },
      0,
    )
    expect(dados).toEqual({ partes: [{ tipo: 'texto', texto: 'Oi' }] })
  })

  it('bloco no formato antigo entra no lote sem migration', () => {
    // `partesDaMensagem` lê `{ texto }` e devolve a pilha equivalente.
    expect(dadosComAtraso('mensagem', { texto: 'Oi' }, 1)).toEqual({
      texto: 'Oi',
      partes: [
        { tipo: 'atraso', segundos: 1 },
        { tipo: 'texto', texto: 'Oi' },
      ],
    })
  })

  it('na mídia o atraso é campo, e zero apaga o campo', () => {
    expect(dadosComAtraso('midia', { midia: 'imagem', url: 'x' }, 2)).toEqual({
      midia: 'imagem',
      url: 'x',
      atraso: 2,
    })
    expect(dadosComAtraso('midia', { midia: 'imagem', url: 'x', atraso: 2 }, 0)).toEqual({
      midia: 'imagem',
      url: 'x',
    })
  })

  it('bloco que não fala não muda', () => {
    expect(dadosComAtraso('pergunta', { texto: 'Qual seu nome?', opcoes: [] }, 2)).toBeNull()
    expect(dadosComAtraso('condicao', { variavel: 'a', operador: 'igual', valor: 'b' }, 2)).toBeNull()
    expect(aceitaAtraso('mensagem')).toBe(true)
    expect(aceitaAtraso('pergunta')).toBe(false)
  })

  it('quem já estava assim não muda — o lote não pode sujar o desfazer', () => {
    expect(
      dadosComAtraso('mensagem', { partes: [{ tipo: 'atraso', segundos: 2 }] }, 2),
    ).toBeNull()
    expect(dadosComAtraso('midia', { midia: 'imagem', url: 'x' }, 0)).toBeNull()
  })

  it('respeita o limite de segundos do schema', () => {
    const dados = dadosComAtraso('midia', { midia: 'imagem', url: 'x' }, 999)
    expect(dados).toEqual({ midia: 'imagem', url: 'x', atraso: LIMITE_ATRASO_SEGUNDOS })
    expect(dadosComAtraso('midia', { midia: 'imagem', url: 'x' }, Number.NaN)).toBeNull()
  })

  it('pilha cheia fica como está — passar do limite o schema recusa', () => {
    const partes = Array.from({ length: LIMITE_PARTES }, () => ({ tipo: 'texto', texto: 'a' }))
    expect(dadosComAtraso('mensagem', { partes }, 1)).toBeNull()
  })
})

describe('aplicarAtrasoEmLote — a conta que a tela mostra', () => {
  const blocos = [
    { id: 'a', type: 'mensagem', data: { partes: [{ tipo: 'texto', texto: 'Oi' }] } },
    { id: 'b', type: 'pergunta', data: { texto: 'Qual seu nome?', opcoes: [] } },
    { id: 'c', type: 'midia', data: { midia: 'imagem', url: 'x' } },
    { id: 'd', type: 'mensagem', data: { partes: [{ tipo: 'texto', texto: 'Tchau' }] } },
  ]

  it('mexe só nos selecionados, e conta só quem mudou de verdade', () => {
    const { blocos: saida, mudados } = aplicarAtrasoEmLote(blocos, ['a', 'b', 'c'], 1)
    expect(mudados).toBe(2)
    expect(saida[0]?.data.partes).toEqual([
      { tipo: 'atraso', segundos: 1 },
      { tipo: 'texto', texto: 'Oi' },
    ])
    // A pergunta não fala, e o que ficou de fora da seleção nem é tocado.
    expect(saida[1]).toBe(blocos[1])
    expect(saida[3]).toBe(blocos[3])
  })

  it('não muda o bloco original — o desfazer depende disso', () => {
    aplicarAtrasoEmLote(blocos, ['a'], 3)
    expect(blocos[0]?.data.partes).toEqual([{ tipo: 'texto', texto: 'Oi' }])
  })
})
