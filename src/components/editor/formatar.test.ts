import { describe, expect, it } from 'vitest'
import { alternarMarca } from './formatar'

/**
 * A barra de formatação guarda a sintaxe do WhatsApp na cabeça de quem
 * escreve. O que ela não pode fazer é produzir marcador quebrado — `**texto**`
 * aparece com os asteriscos na conversa, e quem vê acha que o painel está
 * errado.
 */
describe('alternar marca na seleção', () => {
  it('envolve o que está selecionado', () => {
    const r = alternarMarca('bom dia', 0, 3, 'negrito')
    expect(r.proximo).toBe('*bom* dia')
    // A seleção continua sobre a palavra, não sobre os asteriscos: quem marcou
    // negrito e clicou em itálico em seguida espera os dois na mesma palavra.
    expect(r.proximo.slice(r.selecaoInicio, r.selecaoFim)).toBe('bom')
  })

  it('tira a marca quando ela já está lá, por dentro da seleção', () => {
    const r = alternarMarca('*bom* dia', 0, 5, 'negrito')
    expect(r.proximo).toBe('bom dia')
    expect(r.proximo.slice(r.selecaoInicio, r.selecaoFim)).toBe('bom')
  })

  it('tira a marca quando ela está por fora da seleção', () => {
    // É o caso comum de dar dois cliques na palavra: o navegador seleciona
    // "bom" e deixa os asteriscos de fora.
    const r = alternarMarca('*bom* dia', 1, 4, 'negrito')
    expect(r.proximo).toBe('bom dia')
    expect(r.proximo.slice(r.selecaoInicio, r.selecaoFim)).toBe('bom')
  })

  it('sem seleção, insere o par e põe o cursor no meio', () => {
    const r = alternarMarca('oi ', 3, 3, 'italico')
    expect(r.proximo).toBe('oi __')
    expect(r.selecaoInicio).toBe(4)
    expect(r.selecaoFim).toBe(4)
  })

  it('monoespaçado usa três crases dos dois lados', () => {
    const r = alternarMarca('codigo', 0, 6, 'mono')
    expect(r.proximo).toBe('```codigo```')
  })

  it('tirar monoespaçado devolve o texto limpo', () => {
    expect(alternarMarca('```x```', 0, 7, 'mono').proximo).toBe('x')
  })

  it('não confunde uma marca com a outra', () => {
    // `_bom_` selecionado com o botão de negrito tem que virar `*_bom_*`, e
    // não perder o itálico.
    expect(alternarMarca('_bom_', 0, 5, 'negrito').proximo).toBe('*_bom_*')
  })

  it('aguenta cursor fora do texto sem estourar', () => {
    // Acontece de verdade: o campo é controlado, o valor muda por baixo, e a
    // posição guardada é de um texto que já não existe.
    expect(alternarMarca('oi', 99, 120, 'negrito').proximo).toBe('oi**')
  })
})
